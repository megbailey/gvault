import type { VaultProgress } from "./fileVault";

export const UPLOAD_CHUNK_SIZE = 256 * 1024;
const MAX_RETRIES = 5;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextOffsetFromRange(rangeHeader: string | null): number | null {
    if (!rangeHeader) {
        return null;
    }
    const match = /bytes=(\d+)-(\d+)/i.exec(rangeHeader);
    if (!match) {
        return null;
    }
    return Number(match[2]) + 1;
}

async function readUploadStatus(sessionURI: string, total: number): Promise<number> {
    const response = await fetch(sessionURI, {
        method: "PUT",
        headers: {
            "Content-Length": "0",
            "Content-Range": `bytes */${total}`,
        },
    });

    if (response.status === 200 || response.status === 201) {
        return total;
    }

    if (response.status === 308) {
        return nextOffsetFromRange(response.headers.get("Range")) ?? 0;
    }

    throw new Error(`Could not resume upload: ${response.status} ${response.statusText}`);
}

async function putChunk(
    sessionURI: string,
    chunk: Uint8Array,
    offset: number,
    total: number
): Promise<Response> {
    const end = offset + chunk.byteLength - 1;
    return fetch(sessionURI, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": String(chunk.byteLength),
            "Content-Range": `bytes ${offset}-${end}/${total}`,
        },
        body: chunk.slice(),
    });
}

class RetryableUploadError extends Error {}

async function withRetries<T>(task: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await task();
        } catch (error) {
            lastError = error;
            if (!(error instanceof RetryableUploadError) && attempt < MAX_RETRIES - 1) {
                const message = error instanceof Error ? error.message : "";
                if (!/retryable|network|failed to fetch/i.test(message)) {
                    throw error;
                }
            }
            await sleep(Math.min(1000 * 2 ** attempt, 8000));
        }
    }
    throw lastError instanceof Error ? lastError : new Error("Upload failed.");
}

class ByteQueue {
    private parts: Uint8Array[] = [];
    private size = 0;

    get length(): number {
        return this.size;
    }

    push(data: Uint8Array): void {
        if (data.byteLength === 0) {
            return;
        }
        this.parts.push(data);
        this.size += data.byteLength;
    }

    peek(count: number): Uint8Array {
        const n = Math.min(count, this.size);
        const output = new Uint8Array(n);
        let offset = 0;
        let remaining = n;
        for (const part of this.parts) {
            const take = Math.min(part.byteLength, remaining);
            output.set(part.subarray(0, take), offset);
            offset += take;
            remaining -= take;
            if (remaining === 0) {
                break;
            }
        }
        return output;
    }

    consume(count: number): void {
        let remaining = Math.min(count, this.size);
        this.size -= remaining;
        while (remaining > 0 && this.parts.length > 0) {
            const first = this.parts[0];
            if (first.byteLength <= remaining) {
                remaining -= first.byteLength;
                this.parts.shift();
            } else {
                this.parts[0] = first.subarray(remaining);
                remaining = 0;
            }
        }
    }
}

export class ResumableUploader {
    private readonly queue = new ByteQueue();
    private confirmed = 0;
    private result: unknown;

    constructor(
        private readonly sessionURI: string,
        private readonly total: number,
        private readonly onProgress?: (progress: VaultProgress) => void
    ) {}

    async write(data: Uint8Array): Promise<void> {
        this.queue.push(data);
        while (this.queue.length >= UPLOAD_CHUNK_SIZE && this.confirmed < this.total) {
            await this.flush(UPLOAD_CHUNK_SIZE);
        }
    }

    async finish(): Promise<unknown> {
        while (this.confirmed < this.total) {
            if (this.queue.length === 0) {
                throw new Error("Upload did not finish.");
            }
            await this.flush(this.queue.length);
        }
        return this.result;
    }

    private async flush(size: number): Promise<void> {
        const chunk = this.queue.peek(size);
        const response = await withRetries(async () => {
            const next = await putChunk(this.sessionURI, chunk, this.confirmed, this.total);
            if (next.status === 200 || next.status === 201 || next.status === 308) {
                return next;
            }
            if (next.status >= 500 || next.status === 429) {
                throw new RetryableUploadError(`Retryable upload error: ${next.status}`);
            }
            throw new Error(`Data upload failed: ${next.status} ${next.statusText}`);
        });

        if (response.status === 200 || response.status === 201) {
            this.queue.consume(chunk.byteLength);
            this.confirmed = this.total;
            this.onProgress?.({ phase: "upload", completed: this.total, total: this.total });
            this.result = await response.json();
            return;
        }

        const resumed = nextOffsetFromRange(response.headers.get("Range"));
        const nextOffset = resumed === null
            ? await withRetries(() => readUploadStatus(this.sessionURI, this.total))
            : resumed;
        if (nextOffset < this.confirmed) {
            throw new Error("Upload session went backwards and cannot be streamed.");
        }
        this.queue.consume(nextOffset - this.confirmed);
        this.confirmed = nextOffset;
        this.onProgress?.({ phase: "upload", completed: this.confirmed, total: this.total });
    }
}

export async function startResumableUpload(options: {
    token: string;
    filename: string;
    total: number;
    parentFolderId?: string;
    onProgress?: (progress: VaultProgress) => void;
}): Promise<ResumableUploader> {
    const metadata: { name: string; mimeType: string; parents?: string[] } = {
        name: `${options.filename}.gvault.json`,
        mimeType: "application/json",
    };
    if (options.parentFolderId) {
        metadata.parents = [options.parentFolderId];
    }

    const initSession = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.token}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "application/json",
                "X-Upload-Content-Length": String(options.total),
            },
            body: JSON.stringify(metadata),
        }
    );

    if (!initSession.ok) {
        throw new Error(`Failed to initiate session: ${initSession.status} ${initSession.statusText}`);
    }

    const sessionURI = initSession.headers.get("Location");
    if (!sessionURI) {
        throw new Error("Did not receive a valid upload session URI from Google.");
    }

    return new ResumableUploader(sessionURI, options.total, options.onProgress);
}
