export const VAULT_MAGIC = new Uint8Array([0x47, 0x56, 0x4c, 0x54]); // GVLT
export const CURRENT_VAULT_VERSION = 3;
export const VAULT_FILE_SUFFIX = ".gvault";
export const VAULT_MIME_TYPE = "application/octet-stream";
export const AES_GCM_TAG_BYTES = 16;
export const VAULT_HEADER_FIXED_BYTES = 46;
export const MAX_VAULT_FILENAME_BYTES = 0xffff;
/** Drive `files.create` cap: 5,120 GB = 5 TiB. */
export const DRIVE_UPLOAD_CAP_BYTES = 5 * 1024 * 1024 * 1024 * 1024;
export const DEFAULT_VAULT_CHUNK_SIZE = 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type VaultBinaryHeader = {
    version: number;
    salt: Uint8Array;
    ivPrefix: Uint8Array;
    chunkSize: number;
    plaintextSize: number;
    filename: string;
    byteLength: number;
};

export function gcmCiphertextByteLength(plaintextLength: number): number {
    return plaintextLength + AES_GCM_TAG_BYTES;
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

export function vaultChunkCount(plaintextSize: number, chunkSize: number): number {
    if (plaintextSize <= 0) {
        return 1;
    }
    return Math.ceil(plaintextSize / chunkSize);
}

function encodeFilename(filename: string): Uint8Array {
    const name = encoder.encode(filename);
    if (name.byteLength === 0) {
        throw new Error("File name cannot be empty.");
    }
    if (name.byteLength > MAX_VAULT_FILENAME_BYTES) {
        throw new Error("File name is too long to store in a vault.");
    }
    return name;
}

export function vaultByteLength(plaintextSize: number, filenameBytes: number, chunkSize: number): number {
    return VAULT_HEADER_FIXED_BYTES
        + filenameBytes
        + plaintextSize
        + AES_GCM_TAG_BYTES * vaultChunkCount(plaintextSize, chunkSize);
}

export function measureVaultBytes(plaintextSize: number, filename: string, chunkSize: number): number {
    return vaultByteLength(plaintextSize, encodeFilename(filename).byteLength, chunkSize);
}

/**
 * Largest plaintext whose vault still fits `vaultCapBytes`, assuming a filename
 * of `filenameBytes` and 1 MiB chunks. Tags are 16 bytes each; empty files still
 * write one tag.
 */
export function maxPlaintextWithinVaultCap(
    vaultCapBytes: number = DRIVE_UPLOAD_CAP_BYTES,
    filenameBytes: number = MAX_VAULT_FILENAME_BYTES,
    chunkSize: number = DEFAULT_VAULT_CHUNK_SIZE
): number {
    const header = BigInt(VAULT_HEADER_FIXED_BYTES + filenameBytes);
    const cap = BigInt(vaultCapBytes);
    const size = BigInt(chunkSize);
    const tag = BigInt(AES_GCM_TAG_BYTES);
    if (cap < header + tag) {
        return 0;
    }

    // P + tag * chunkCount(P) <= cap - header
    const budget = cap - header;
    const fullChunks = budget / (size + tag);
    const fromFullChunks = fullChunks * size;
    const nextChunks = fullChunks + 1n;
    const fromPartial = budget - tag * nextChunks;
    const best = fromPartial > fullChunks * size && fromPartial <= nextChunks * size
        ? fromPartial
        : fromFullChunks;
    return Number(best);
}

export function encodeVaultHeader(meta: {
    salt: Uint8Array;
    ivPrefix: Uint8Array;
    chunkSize: number;
    plaintextSize: number;
    filename: string;
}): Uint8Array {
    if (meta.salt.byteLength !== 16 || meta.ivPrefix.byteLength !== 8) {
        throw new Error("Invalid vault file structure.");
    }
    const name = encodeFilename(meta.filename);

    const header = new Uint8Array(VAULT_HEADER_FIXED_BYTES + name.byteLength);
    const view = new DataView(header.buffer);
    header.set(VAULT_MAGIC, 0);
    view.setUint32(4, CURRENT_VAULT_VERSION, false);
    header.set(meta.salt, 8);
    header.set(meta.ivPrefix, 24);
    view.setUint32(32, meta.chunkSize, false);
    view.setBigUint64(36, BigInt(meta.plaintextSize), false);
    view.setUint16(44, name.byteLength, false);
    header.set(name, 46);
    return header;
}

export function parseVaultHeader(bytes: Uint8Array): VaultBinaryHeader {
    if (bytes.byteLength < VAULT_HEADER_FIXED_BYTES) {
        throw new Error("Invalid vault file structure.");
    }
    for (let index = 0; index < VAULT_MAGIC.byteLength; index++) {
        if (bytes[index] !== VAULT_MAGIC[index]) {
            throw new Error("That file is not a valid .gvault package.");
        }
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getUint32(4, false);
    if (version !== CURRENT_VAULT_VERSION) {
        throw new Error("Unsupported vault file version.");
    }

    const filenameLength = view.getUint16(44, false);
    if (filenameLength === 0 || bytes.byteLength < VAULT_HEADER_FIXED_BYTES + filenameLength) {
        throw new Error("Invalid vault file structure.");
    }

    const filename = decoder.decode(bytes.subarray(46, 46 + filenameLength)).trim();
    const chunkSize = view.getUint32(32, false);
    const plaintextSize = Number(view.getBigUint64(36, false));
    if (!filename || chunkSize <= 0 || !Number.isSafeInteger(plaintextSize) || plaintextSize < 0) {
        throw new Error("Invalid vault file structure.");
    }

    return {
        version,
        salt: bytes.slice(8, 24),
        ivPrefix: bytes.slice(24, 32),
        chunkSize,
        plaintextSize,
        filename,
        byteLength: VAULT_HEADER_FIXED_BYTES + filenameLength,
    };
}
