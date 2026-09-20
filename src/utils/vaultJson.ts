import { CURRENT_VAULT_VERSION } from "../GVaultFile";

export const AES_GCM_TAG_BYTES = 16;
export const VAULT_KDF = "Argon2id";
export const VAULT_CIPHER = "AES-256-GCM";

const encoder = new TextEncoder();

export type VaultJsonMeta = {
    filename: string;
    salt: number[];
    chunkSize: number;
    chunkCount: number;
};

export function gcmCiphertextByteLength(plaintextLength: number): number {
    return plaintextLength + AES_GCM_TAG_BYTES;
}

export function base64EncodedLength(byteLength: number): number {
    return 4 * Math.ceil(byteLength / 3);
}

export function plaintextChunkSizes(fileSize: number, chunkSize: number): number[] {
    if (fileSize <= 0) {
        return [0];
    }
    const sizes: number[] = [];
    let remaining = fileSize;
    while (remaining > 0) {
        const next = Math.min(chunkSize, remaining);
        sizes.push(next);
        remaining -= next;
    }
    return sizes;
}

export function vaultJsonEnvelope(meta: VaultJsonMeta): { header: Uint8Array; footer: Uint8Array } {
    const empty = JSON.stringify({
        version: CURRENT_VAULT_VERSION,
        kdf: VAULT_KDF,
        cipher: VAULT_CIPHER,
        salt: meta.salt,
        filename: meta.filename,
        chunkSize: meta.chunkSize,
        chunkCount: meta.chunkCount,
        chunks: [],
    });
    const marker = '"chunks":[]';
    const index = empty.lastIndexOf(marker);
    if (index < 0) {
        throw new Error("Failed to build vault JSON envelope.");
    }
    const header = empty.slice(0, index + '"chunks":['.length);
    const footer = `]${empty.slice(index + marker.length)}`;
    return {
        header: encoder.encode(header),
        footer: encoder.encode(footer),
    };
}

export function encodeVaultChunkJson(iv: number[], cipherText: string): Uint8Array {
    return encoder.encode(JSON.stringify({ iv, cipherText }));
}

export function measureVaultJsonBytes(
    meta: VaultJsonMeta,
    plaintextSizes: number[],
    ivs: number[][]
): number {
    if (plaintextSizes.length !== ivs.length || plaintextSizes.length !== meta.chunkCount) {
        throw new Error("Vault chunk plan does not match chunkCount.");
    }

    const { header, footer } = vaultJsonEnvelope(meta);
    let total = header.byteLength + footer.byteLength;
    for (let index = 0; index < plaintextSizes.length; index++) {
        const cipherLength = gcmCiphertextByteLength(plaintextSizes[index]);
        const skeleton = JSON.stringify({ iv: ivs[index], cipherText: "" });
        total += encoder.encode(skeleton.slice(0, -2)).byteLength
            + base64EncodedLength(cipherLength)
            + encoder.encode(skeleton.slice(-2)).byteLength;
        if (index < plaintextSizes.length - 1) {
            total += 1;
        }
    }
    return total;
}

export function extractJsonArrayObjects(buffer: string): {
    objects: string[];
    rest: string;
    finished: boolean;
} {
    const objects: string[] = [];
    let index = 0;

    while (index < buffer.length) {
        while (index < buffer.length && /[\s,]/.test(buffer[index])) {
            index += 1;
        }
        if (index >= buffer.length) {
            break;
        }
        if (buffer[index] === "]") {
            return { objects, rest: buffer.slice(index + 1), finished: true };
        }
        if (buffer[index] !== "{") {
            throw new Error("Invalid vault file structure.");
        }

        let depth = 0;
        let inString = false;
        let escape = false;
        const start = index;
        for (; index < buffer.length; index++) {
            const char = buffer[index];
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (char === "\\") {
                    escape = true;
                } else if (char === "\"") {
                    inString = false;
                }
                continue;
            }
            if (char === "\"") {
                inString = true;
            } else if (char === "{") {
                depth += 1;
            } else if (char === "}") {
                depth -= 1;
                if (depth === 0) {
                    objects.push(buffer.slice(start, index + 1));
                    index += 1;
                    break;
                }
            }
        }
        if (depth !== 0) {
            return { objects, rest: buffer.slice(start), finished: false };
        }
    }

    return { objects, rest: buffer.slice(index), finished: false };
}
