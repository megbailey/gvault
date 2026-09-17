import { deriveKey, decrypt, encrypt } from "./crypto";
import { CURRENT_VAULT_VERSION, GVaultFile, type VaultChunk } from "../GVaultFile";

export const VAULT_CHUNK_SIZE = 1024 * 1024;

export type VaultProgress = {
    phase: "encrypt" | "decrypt" | "upload" | "download";
    completed: number;
    total: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
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

function concatBuffers(parts: Uint8Array[]): ArrayBuffer {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output.buffer;
}

export function encodeChunkAad(index: number, count: number): Uint8Array<ArrayBuffer> {
    const aad = new Uint8Array(8);
    const view = new DataView(aad.buffer);
    view.setUint32(0, index, false);
    view.setUint32(4, count, false);
    return aad;
}

export async function packVaultFile(
    file: File,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt);
    const chunkCount = Math.max(1, Math.ceil(file.size / VAULT_CHUNK_SIZE));
    const chunks: VaultChunk[] = [];

    for (let index = 0; index < chunkCount; index++) {
        const offset = index * VAULT_CHUNK_SIZE;
        const end = Math.min(offset + VAULT_CHUNK_SIZE, file.size);
        const data = file.size === 0
            ? new ArrayBuffer(0)
            : await file.slice(offset, end).arrayBuffer();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const aad = encodeChunkAad(index, chunkCount);
        const ciphertext = await encrypt(data, key, iv, aad);
        chunks.push({
            iv: Array.from(iv),
            cipherText: arrayBufferToBase64(ciphertext),
        });
        onProgress?.({
            phase: "encrypt",
            completed: file.size === 0 ? 1 : end,
            total: Math.max(file.size, 1),
        });
        await yieldToUi();
    }

    return new GVaultFile({
        version: CURRENT_VAULT_VERSION,
        kdf: "Argon2id",
        cipher: "AES-256-GCM",
        salt: Array.from(salt),
        filename: file.name,
        chunkSize: VAULT_CHUNK_SIZE,
        chunks,
    });
}

export async function unpackVaultFile(
    vault: GVaultFile,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    if (vault.version !== CURRENT_VAULT_VERSION || vault.chunks.length === 0) {
        throw new Error("Unsupported vault file version.");
    }

    const salt = new Uint8Array(vault.salt);
    const key = await deriveKey(passphrase, salt);
    const chunkCount = vault.chunks.length;

    try {
        const parts: Uint8Array[] = [];
        for (let index = 0; index < chunkCount; index++) {
            const chunk = vault.chunks[index];
            const iv = new Uint8Array(chunk.iv);
            const ciphertext = base64ToArrayBuffer(chunk.cipherText);
            const aad = encodeChunkAad(index, chunkCount);
            const data = await decrypt(ciphertext, key, iv as Uint8Array<ArrayBuffer>, aad);
            parts.push(new Uint8Array(data));
            onProgress?.({ phase: "decrypt", completed: index + 1, total: chunkCount });
            await yieldToUi();
        }

        return {
            filename: vault.filename,
            data: concatBuffers(parts),
        };
    } catch (error) {
        if (isIncorrectPassphraseError(error)) {
            throw new Error("The passphrase was incorrect. Please try again.");
        }
        throw error;
    }
}
