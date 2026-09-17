import { describe, it, expect, vi } from "vitest";
import { GVaultFile } from "../src/GVaultFile";

describe("GVaultFile", () => {
    it("round-trips a chunked vault", () => {
        const vault = new GVaultFile({
            version: 2,
            kdf: "Argon2id",
            cipher: "AES-256-GCM",
            salt: Array.from({ length: 16 }, (_, i) => i),
            filename: "notes.txt",
            chunkSize: 1024,
            chunks: [{ iv: Array.from({ length: 12 }, () => 1), cipherText: "YWJj" }],
        });

        const restored = GVaultFile.fromJsonString(vault.toJsonString());
        expect(restored.version).toBe(2);
        expect(restored.filename).toBe("notes.txt");
        expect(restored.chunks).toHaveLength(1);
    });

    it("rejects version 1 vaults", () => {
        const json = JSON.stringify({
            version: 1,
            kdf: "Argon2id",
            cipher: "AES-256-GCM",
            salt: Array.from({ length: 16 }, () => 2),
            iv: Array.from({ length: 12 }, () => 3),
            filename: "old.pdf",
            cipherText: "YWJj",
        });

        expect(() => GVaultFile.fromJsonString(json)).toThrow("Unsupported vault file version.");
    });

    it("rejects malformed JSON", () => {
        expect(() => GVaultFile.fromJsonString("{not-json")).toThrow("Invalid vault file structure.");
    });
});
