import { deriveKey, decrypt, encrypt } from "./crypto";
import { GVaultFile } from "../GVaultFile";
import {
    DEFAULT_VAULT_CHUNK_SIZE,
    encodeVaultHeader,
    gcmCiphertextByteLength,
    measureVaultBytes,
    parseVaultHeader,
    plaintextChunkSizes,
    VAULT_HEADER_FIXED_BYTES,
    VAULT_MAGIC,
} from "./vaultBinary";

export const VAULT_CHUNK_SIZE = DEFAULT_VAULT_CHUNK_SIZE;

export type VaultProgress = {
    phase: "encrypt" | "decrypt" | "upload" | "download";
    completed: number;
    total: number;
};

export type VaultByteSink = {
    write(data: Uint8Array): Promise<void>;
    finish?(): Promise<unknown>;
};

function isIncorrectPassphraseError(error: unknown): boolean {
    if (error instanceof DOMException) {
        return error.name === "OperationError" || error.name === "InvalidAccessError";
    }
    return error instanceof Error && /operationerror|decrypt/i.test(error.message);
}

function yieldToUi(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function copyToArrayBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
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

class StreamByteReader {
    private leftover = new Uint8Array(0);

    constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

    async readExact(count: number): Promise<Uint8Array<ArrayBuffer>> {
        while (this.leftover.byteLength < count) {
            const { value, done } = await this.reader.read();
            if (done) {
                throw new Error("Invalid vault file structure.");
            }
            const next = new Uint8Array(this.leftover.byteLength + value.byteLength);
            next.set(this.leftover, 0);
            next.set(value, this.leftover.byteLength);
            this.leftover = next;
        }
        const output = copyToArrayBufferBytes(this.leftover.subarray(0, count));
        this.leftover = this.leftover.subarray(count);
        return output;
    }

    release(): void {
        this.reader.releaseLock();
    }
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
    const header = encodeVaultHeader({
        salt,
        ivPrefix,
        chunkSize: VAULT_CHUNK_SIZE,
        plaintextSize: file.size,
        filename: file.name,
    });
    const sink = await openSink(measureVaultBytes(file.size, file.name, VAULT_CHUNK_SIZE));
    await sink.write(header);

    for (let index = 0; index < sizes.length; index++) {
        const offset = index * VAULT_CHUNK_SIZE;
        const end = Math.min(offset + VAULT_CHUNK_SIZE, file.size);
        const data = file.size === 0
            ? new ArrayBuffer(0)
            : await file.slice(offset, end).arrayBuffer();
        const iv = encodeChunkIv(ivPrefix, index);
        const aad = encodeChunkAad(index, sizes.length);
        const ciphertext = new Uint8Array(await encrypt(data, key, iv, aad));
        await sink.write(ciphertext);
        onProgress?.({
            phase: "encrypt",
            completed: file.size === 0 ? 1 : end,
            total: Math.max(file.size, 1),
        });
        await yieldToUi();
    }

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
    return GVaultFile.fromBytes(concatBytes(parts));
}

export async function unpackVaultFromByteStream(
    stream: ReadableStream<Uint8Array>,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
): Promise<{ filename: string; data: Blob }> {
    const reader = new StreamByteReader(stream.getReader());
    try {
        const fixed = await reader.readExact(VAULT_HEADER_FIXED_BYTES);
        for (let index = 0; index < VAULT_MAGIC.byteLength; index++) {
            if (fixed[index] !== VAULT_MAGIC[index]) {
                throw new Error("That file is not a valid .gvault package.");
            }
        }
        const nameLength = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength).getUint16(44, false);
        const headerBytes = new Uint8Array(VAULT_HEADER_FIXED_BYTES + nameLength);
        headerBytes.set(fixed, 0);
        if (nameLength > 0) {
            headerBytes.set(await reader.readExact(nameLength), VAULT_HEADER_FIXED_BYTES);
        }
        const header = parseVaultHeader(headerBytes);
        const sizes = plaintextChunkSizes(header.plaintextSize, header.chunkSize);
        const key = await deriveKey(passphrase, header.salt);
        const parts: BlobPart[] = [];

        for (let index = 0; index < sizes.length; index++) {
            const ciphertext = await reader.readExact(gcmCiphertextByteLength(sizes[index]));
            const iv = encodeChunkIv(header.ivPrefix, index);
            const aad = encodeChunkAad(index, sizes.length);
            try {
                const data = await decrypt(ciphertext, key, iv, aad);
                parts.push(new Uint8Array(data));
            } catch (error) {
                if (isIncorrectPassphraseError(error)) {
                    throw new Error("The passphrase was incorrect. Please try again.");
                }
                throw error;
            }
            onProgress?.({ phase: "decrypt", completed: index + 1, total: sizes.length });
            await yieldToUi();
        }

        return { filename: header.filename, data: new Blob(parts) };
    } catch (error) {
        if (error instanceof Error && (
            error.message === "Unsupported vault file version."
            || error.message === "The passphrase was incorrect. Please try again."
            || error.message === "That file is not a valid .gvault package."
        )) {
            throw error;
        }
        if (error instanceof Error && error.message === "Invalid vault file structure.") {
            throw error;
        }
        throw new Error("That file is not a valid .gvault package.");
    } finally {
        reader.release();
    }
}

export async function unpackVaultFile(
    vault: GVaultFile,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    return unpackVaultFromByteStream(bytesToReadableStream(vault.toBytes()), passphrase, onProgress);
}
