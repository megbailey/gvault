/**
 * On-disk .gvault.json schema (vault format v2).
 *
 * Encrypt writes this JSON to Drive; Decrypt parses it before unpacking.
 * These tests verify a valid vault serializes and reloads, and that old or
 * broken JSON is rejected instead of being treated as ciphertext.
 */
import { describe, it, expect } from "vitest";
import { GVaultFile } from "../src/GVaultFile";

describe("GVaultFile", () => {
    it("round-trips a chunked vault through JSON", () => {
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

    it("rejects version 1 vaults so pre-launch files cannot be opened", () => {
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

    it("rejects malformed JSON so Decrypt does not treat garbage as a vault", () => {
        expect(() => GVaultFile.fromJsonString("{not-json")).toThrow("Invalid vault file structure.");
    });

    it("rejects a vault whose salt or chunk list is structurally invalid", () => {
        const base = {
            version: 2,
            kdf: "Argon2id",
            cipher: "AES-256-GCM",
            salt: Array.from({ length: 16 }, () => 1),
            filename: "notes.txt",
            chunkSize: 1024,
            chunks: [{ iv: Array.from({ length: 12 }, () => 1), cipherText: "YWJj" }],
        };

        expect(() => GVaultFile.fromJsonString(JSON.stringify({ ...base, salt: [1, 2] }))).toThrow(
            "Invalid vault file structure."
        );
        expect(() => GVaultFile.fromJsonString(JSON.stringify({ ...base, chunks: [] }))).toThrow(
            "Invalid vault file structure."
        );
    });
});
