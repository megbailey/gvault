import { GVaultFile } from "../GVaultFile";
import type { VaultProgress } from "./fileVault";

const UPLOAD_CHUNK_SIZE = 256 * 1024;
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

async function uploadFile(
    token: string,
    file: GVaultFile,
    parentFolderId?: string,
    onProgress?: (progress: VaultProgress) => void
) {
    const body = new TextEncoder().encode(file.toJsonString());
    const total = body.byteLength;

    const metadata: { name: string; mimeType: string; parents?: string[] } = {
        name: `${file.filename}.gvault.json`,
        mimeType: "application/json",
    };

    if (parentFolderId) {
        metadata.parents = [parentFolderId];
    }

    const initSession = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": "application/json",
                "X-Upload-Content-Length": String(total),
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

    let offset = 0;
    let lastResponse: Response | null = null;

    while (offset < total) {
        const end = Math.min(offset + UPLOAD_CHUNK_SIZE, total);
        const chunk = body.subarray(offset, end);

        lastResponse = await withRetries(async () => {
            const response = await putChunk(sessionURI, chunk, offset, total);
            if (response.status === 200 || response.status === 201 || response.status === 308) {
                return response;
            }
            if (response.status >= 500 || response.status === 429) {
                throw new RetryableUploadError(`Retryable upload error: ${response.status}`);
            }
            throw new Error(`Data upload failed: ${response.status} ${response.statusText}`);
        });

        if (lastResponse.status === 200 || lastResponse.status === 201) {
            onProgress?.({ phase: "upload", completed: total, total });
            return lastResponse.json();
        }

        const resumed = nextOffsetFromRange(lastResponse.headers.get("Range"));
        if (resumed === null) {
            offset = await withRetries(() => readUploadStatus(sessionURI, total));
        } else {
            offset = resumed;
        }

        if (offset >= total) {
            break;
        }

        onProgress?.({ phase: "upload", completed: offset, total });
    }

    if (lastResponse && (lastResponse.status === 200 || lastResponse.status === 201)) {
        return lastResponse.json();
    }

    const completed = await withRetries(async () => {
        const status = await readUploadStatus(sessionURI, total);
        if (status < total) {
            throw new Error("Upload did not finish.");
        }
        return { id: undefined };
    });

    return completed;
}

export default uploadFile;
