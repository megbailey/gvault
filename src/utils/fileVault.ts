import { deriveKey, decrypt, encrypt } from "./crypto";
import { CURRENT_VAULT_VERSION, GVaultFile, type VaultChunk } from "../GVaultFile";
import {
    encodeVaultChunkJson,
    extractJsonArrayObjects,
    measureVaultJsonBytes,
    plaintextChunkSizes,
    vaultJsonEnvelope,
} from "./vaultJson";

export const VAULT_CHUNK_SIZE = 1024 * 1024;

export type VaultProgress = {
    phase: "encrypt" | "decrypt" | "upload" | "download";
    completed: number;
    total: number;
};

export type VaultByteSink = {
    write(data: Uint8Array): Promise<void>;
    finish?(): Promise<unknown>;
};

export function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function isIncorrectPassphraseError(error: unknown): boolean {
    if (error instanceof DOMException) {
        return error.name === "OperationError" || error.name === "InvalidAccessError";
    }
    return error instanceof Error && /operationerror|decrypt/i.test(error.message);
}

function yieldToUi(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output;
}

export function encodeChunkAad(index: number, count: number): Uint8Array<ArrayBuffer> {
    const aad = new Uint8Array(8);
    const view = new DataView(aad.buffer);
    view.setUint32(0, index, false);
    view.setUint32(4, count, false);
    return aad;
}

export function encodeChunkIv(prefix: Uint8Array, index: number): Uint8Array<ArrayBuffer> {
    const iv = new Uint8Array(12);
    iv.set(prefix.subarray(0, 8), 0);
    new DataView(iv.buffer).setUint32(8, index, false);
    return iv;
}

export function bytesToReadableStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
}

export async function encryptVaultToSink(
    file: File,
    passphrase: string,
    openSink: (totalBytes: number) => Promise<VaultByteSink>,
    onProgress?: (progress: VaultProgress) => void
): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ivPrefix = crypto.getRandomValues(new Uint8Array(8));
    const key = await deriveKey(passphrase, salt);
    const sizes = plaintextChunkSizes(file.size, VAULT_CHUNK_SIZE);
    const ivs = sizes.map((_, index) => Array.from(encodeChunkIv(ivPrefix, index)));
    const meta = {
        filename: file.name,
        salt: Array.from(salt),
        chunkSize: VAULT_CHUNK_SIZE,
        chunkCount: sizes.length,
    };
    const total = measureVaultJsonBytes(meta, sizes, ivs);
    const { header, footer } = vaultJsonEnvelope(meta);
    const comma = new TextEncoder().encode(",");
    const sink = await openSink(total);

    await sink.write(header);

    for (let index = 0; index < sizes.length; index++) {
        const offset = index * VAULT_CHUNK_SIZE;
        const end = Math.min(offset + VAULT_CHUNK_SIZE, file.size);
        const data = file.size === 0
            ? new ArrayBuffer(0)
            : await file.slice(offset, end).arrayBuffer();
        const iv = encodeChunkIv(ivPrefix, index);
        const aad = encodeChunkAad(index, sizes.length);
        const ciphertext = await encrypt(data, key, iv, aad);
        if (index > 0) {
            await sink.write(comma);
        }
        await sink.write(encodeVaultChunkJson(ivs[index], arrayBufferToBase64(ciphertext)));
        onProgress?.({
            phase: "encrypt",
            completed: file.size === 0 ? 1 : end,
            total: Math.max(file.size, 1),
        });
        await yieldToUi();
    }

    await sink.write(footer);
    await sink.finish?.();
}

export async function packVaultFile(
    file: File,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    const parts: Uint8Array[] = [];
    await encryptVaultToSink(file, passphrase, async () => ({
        async write(data) {
            parts.push(data.slice());
        },
    }), onProgress);
    return GVaultFile.fromJsonString(new TextDecoder().decode(concatBytes(parts)));
}

function parseVaultChunkJson(value: string): VaultChunk {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error("Invalid vault file structure.");
    }
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid vault file structure.");
    }
    const item = parsed as Record<string, unknown>;
    if (!Array.isArray(item.iv) || item.iv.length !== 12 || typeof item.cipherText !== "string" || !item.cipherText) {
        throw new Error("Invalid vault file structure.");
    }
    return { iv: item.iv as number[], cipherText: item.cipherText };
}

export async function unpackVaultFromByteStream(
    stream: ReadableStream<Uint8Array>,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
): Promise<{ filename: string; data: Blob }> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const marker = '"chunks":[';
    let headerPrefix = "";

    while (!headerPrefix) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const markerIndex = buffer.indexOf(marker);
        if (markerIndex >= 0) {
            headerPrefix = buffer.slice(0, markerIndex);
            buffer = buffer.slice(markerIndex + marker.length);
            break;
        }
        if (done) {
            throw new Error("That file is not a valid .gvault.json package.");
        }
    }

    let header: Record<string, unknown>;
    try {
        header = JSON.parse(`${headerPrefix}"chunks":[]}`);
    } catch {
        throw new Error("That file is not a valid .gvault.json package.");
    }

    const version = typeof header.version === "number" ? header.version : 0;
    if (version !== CURRENT_VAULT_VERSION) {
        throw new Error("Unsupported vault file version.");
    }

    const filename = typeof header.filename === "string" ? header.filename.trim() : "";
    const chunkSize = typeof header.chunkSize === "number" ? header.chunkSize : 0;
    const salt = header.salt;
    const declaredCount = typeof header.chunkCount === "number" ? header.chunkCount : 0;
    if (!filename || !Array.isArray(salt) || salt.length !== 16 || chunkSize <= 0 || declaredCount <= 0) {
        throw new Error("Invalid vault file structure.");
    }

    const key = await deriveKey(passphrase, new Uint8Array(salt as number[]));
    const parts: BlobPart[] = [];
    let finished = false;
    let chunkIndex = 0;

    const consumeObjects = async (objects: string[]) => {
        for (const object of objects) {
            const chunk = parseVaultChunkJson(object);
            const iv = new Uint8Array(chunk.iv);
            const ciphertext = base64ToArrayBuffer(chunk.cipherText);
            const aad = encodeChunkAad(chunkIndex, declaredCount);
            try {
                const data = await decrypt(ciphertext, key, iv as Uint8Array<ArrayBuffer>, aad);
                parts.push(new Uint8Array(data));
            } catch (error) {
                if (isIncorrectPassphraseError(error)) {
                    throw new Error("The passphrase was incorrect. Please try again.");
                }
                throw error;
            }
            chunkIndex += 1;
            onProgress?.({ phase: "decrypt", completed: chunkIndex, total: declaredCount });
            await yieldToUi();
        }
    };

    try {
        while (!finished) {
            const extracted = extractJsonArrayObjects(buffer);
            buffer = extracted.rest;
            finished = extracted.finished;
            await consumeObjects(extracted.objects);
            if (finished) {
                break;
            }
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            if (done) {
                const tail = extractJsonArrayObjects(buffer);
                await consumeObjects(tail.objects);
                if (!tail.finished) {
                    throw new Error("Invalid vault file structure.");
                }
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }

    if (chunkIndex !== declaredCount) {
        throw new Error("Invalid vault file structure.");
    }

    return { filename, data: new Blob(parts) };
}

export async function unpackVaultFile(
    vault: GVaultFile,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    const bytes = new TextEncoder().encode(vault.toJsonString());
    return unpackVaultFromByteStream(bytesToReadableStream(bytes), passphrase, onProgress);
}
