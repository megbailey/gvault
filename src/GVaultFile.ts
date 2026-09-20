export const CURRENT_VAULT_VERSION = 2;

export type VaultChunk = {
    iv: number[];
    cipherText: string;
};

export type VaultFileSchema = {
    version: number;
    kdf: string;
    cipher: string;
    salt: number[];
    filename: string;
    chunkSize: number;
    chunkCount: number;
    chunks: VaultChunk[];
};

function isNumberArray(value: unknown, expectedLength?: number): value is number[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
        return false;
    }
    return expectedLength === undefined || value.length === expectedLength;
}

export class GVaultFile {
    public version: number;
    public kdf: string;
    public cipher: string;
    public salt: number[];
    public filename: string;
    public chunkSize: number;
    public chunkCount: number;
    public chunks: VaultChunk[];

    constructor(data: VaultFileSchema) {
        this.version = data.version;
        this.kdf = data.kdf;
        this.cipher = data.cipher;
        this.salt = data.salt;
        this.filename = data.filename;
        this.chunkSize = data.chunkSize;
        this.chunks = data.chunks;
        this.chunkCount = data.chunkCount;
    }

    public toJsonString(): string {
        return JSON.stringify({
            version: this.version,
            kdf: this.kdf,
            cipher: this.cipher,
            salt: this.salt,
            filename: this.filename,
            chunkSize: this.chunkSize,
            chunkCount: this.chunks.length,
            chunks: this.chunks,
        });
    }

    public static fromJsonString(jsonString: string): GVaultFile {
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonString);
        } catch {
            throw new Error("Invalid vault file structure.");
        }

        if (!parsed || typeof parsed !== "object") {
            throw new Error("Invalid vault file structure.");
        }

        const data = parsed as Record<string, unknown>;
        const version = typeof data.version === "number" ? data.version : 0;
        if (version !== CURRENT_VAULT_VERSION) {
            throw new Error("Unsupported vault file version.");
        }

        const kdf = typeof data.kdf === "string" ? data.kdf : "";
        const cipher = typeof data.cipher === "string" ? data.cipher : "";
        const filename = typeof data.filename === "string" ? data.filename.trim() : "";
        const chunkSize = typeof data.chunkSize === "number" ? data.chunkSize : 0;

        if (!filename || !isNumberArray(data.salt, 16) || chunkSize <= 0) {
            throw new Error("Invalid vault file structure.");
        }

        if (!Array.isArray(data.chunks) || data.chunks.length === 0) {
            throw new Error("Invalid vault file structure.");
        }

        if (typeof data.chunkCount !== "number" || data.chunkCount !== data.chunks.length) {
            throw new Error("Invalid vault file structure.");
        }
        const chunkCount = data.chunkCount;

        const chunks: VaultChunk[] = data.chunks.map((chunk) => {
            if (!chunk || typeof chunk !== "object") {
                throw new Error("Invalid vault file structure.");
            }
            const item = chunk as Record<string, unknown>;
            if (!isNumberArray(item.iv, 12) || typeof item.cipherText !== "string" || item.cipherText.length === 0) {
                throw new Error("Invalid vault file structure.");
            }
            return { iv: item.iv, cipherText: item.cipherText };
        });

        return new GVaultFile({
            version,
            kdf,
            cipher,
            salt: data.salt,
            filename,
            chunkSize,
            chunkCount,
            chunks,
        });
    }
}
