import {
    encodeVaultHeader,
    gcmCiphertextByteLength,
    parseVaultHeader,
    plaintextChunkSizes,
} from "./utils/vaultBinary";

export { CURRENT_VAULT_VERSION, VAULT_FILE_SUFFIX, VAULT_MIME_TYPE } from "./utils/vaultBinary";

export type VaultFileSchema = {
    version: number;
    salt: Uint8Array;
    ivPrefix: Uint8Array;
    filename: string;
    chunkSize: number;
    chunks: Uint8Array[];
};

export class GVaultFile {
    public version: number;
    public salt: Uint8Array;
    public ivPrefix: Uint8Array;
    public filename: string;
    public chunkSize: number;
    public chunks: Uint8Array[];

    constructor(data: VaultFileSchema) {
        this.version = data.version;
        this.salt = data.salt;
        this.ivPrefix = data.ivPrefix;
        this.filename = data.filename;
        this.chunkSize = data.chunkSize;
        this.chunks = data.chunks;
    }

    public get chunkCount(): number {
        return this.chunks.length;
    }

    public toBytes(): Uint8Array {
        if (this.chunks.length === 0) {
            throw new Error("Invalid vault file structure.");
        }
        const plaintextSize = this.chunks.reduce((sum, chunk) => sum + chunk.byteLength - 16, 0);
        const header = encodeVaultHeader({
            salt: this.salt,
            ivPrefix: this.ivPrefix,
            chunkSize: this.chunkSize,
            plaintextSize,
            filename: this.filename,
        });
        const total = header.byteLength + this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const bytes = new Uint8Array(total);
        bytes.set(header, 0);
        let offset = header.byteLength;
        for (const chunk of this.chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    }

    public static fromBytes(bytes: Uint8Array): GVaultFile {
        const header = parseVaultHeader(bytes);
        const sizes = plaintextChunkSizes(header.plaintextSize, header.chunkSize);
        const chunks: Uint8Array[] = [];
        let offset = header.byteLength;
        for (const plain of sizes) {
            const cipherLength = gcmCiphertextByteLength(plain);
            if (offset + cipherLength > bytes.byteLength) {
                throw new Error("Invalid vault file structure.");
            }
            chunks.push(bytes.slice(offset, offset + cipherLength));
            offset += cipherLength;
        }
        if (offset !== bytes.byteLength || chunks.length === 0) {
            throw new Error("Invalid vault file structure.");
        }

        return new GVaultFile({
            version: header.version,
            salt: header.salt,
            ivPrefix: header.ivPrefix,
            filename: header.filename,
            chunkSize: header.chunkSize,
            chunks,
        });
    }
}
