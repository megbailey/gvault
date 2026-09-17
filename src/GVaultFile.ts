
interface VaultFileSchema {
    version: number;
    kdf: string;
    cipher: string;
    salt: number[];
    iv: number[];
    filename: string;
    cipherText: string;
}

export class GVaultFile {
    public version: number;
    public kdf: string;
    public cipher: string;
    public salt: number[];
    public iv: number[];
    public filename: string;
    public cipherText: string;

    constructor(data: VaultFileSchema) {
        this.version = data.version;
        this.kdf = data.kdf;
        this.cipher = data.cipher;
        this.salt = data.salt;
        this.iv = data.iv;
        this.filename = data.filename;
        this.cipherText = data.cipherText;
    }

    public toJsonString(): string {
        return JSON.stringify({
            version: this.version,
            kdf: this.kdf,
            cipher: this.cipher,
            salt: this.salt,
            iv: this.iv,
            filename: this.filename,
            cipherText: this.cipherText
        });
    }

    public static fromJsonString(jsonString: string): GVaultFile {
        const parsed = JSON.parse(jsonString) as VaultFileSchema;
        
        // Validate required fields are present
        if (!parsed.salt || !parsed.iv || !parsed.cipherText) {
            throw new Error("Invalid vault file structure.");
        }

        return new GVaultFile( parsed );
    }
}
