/**
 * On-disk .gvault binary schema (vault format v3).
 *
 * Encrypt streams this package to Drive; Decrypt streams it back while unpacking.
 * These tests verify a valid vault serializes and reloads, and that broken
 * bytes are rejected instead of being treated as ciphertext.
 */
import { describe, it, expect } from "vitest";
import { CURRENT_VAULT_VERSION, GVaultFile } from "../src/GVaultFile";
import { VAULT_MAGIC } from "../src/utils/vaultBinary";

function sampleVault(chunks = [new Uint8Array(16).fill(7)]): GVaultFile {
    return new GVaultFile({
        version: CURRENT_VAULT_VERSION,
        salt: new Uint8Array(16).map((_, index) => index),
        ivPrefix: new Uint8Array(8).fill(1),
        filename: "notes.txt",
        chunkSize: 1024,
        chunks,
    });
}

describe("GVaultFile", () => {
    it("round-trips a chunked vault through binary", () => {
        const vault = sampleVault();
        const restored = GVaultFile.fromBytes(vault.toBytes());
        expect(restored.version).toBe(3);
        expect(restored.filename).toBe("notes.txt");
        expect(restored.chunkCount).toBe(1);
        expect(restored.chunks).toHaveLength(1);
        expect([...vault.toBytes().subarray(0, 4)]).toEqual([...VAULT_MAGIC]);
    });

    it("rejects a vault whose magic bytes are wrong", () => {
        const bytes = sampleVault().toBytes();
        bytes[0] = 0;
        expect(() => GVaultFile.fromBytes(bytes)).toThrow("That file is not a valid .gvault package.");
    });

    it("rejects version 2 vaults so JSON packages cannot be opened", () => {
        const bytes = sampleVault().toBytes();
        new DataView(bytes.buffer).setUint32(4, 2, false);
        expect(() => GVaultFile.fromBytes(bytes)).toThrow("Unsupported vault file version.");
    });

    it("rejects truncated vault bytes", () => {
        const bytes = sampleVault().toBytes();
        expect(() => GVaultFile.fromBytes(bytes.subarray(0, 10))).toThrow("Invalid vault file structure.");
    });

    it("rejects a vault whose chunk payload is incomplete", () => {
        const bytes = sampleVault().toBytes();
        expect(() => GVaultFile.fromBytes(bytes.subarray(0, bytes.byteLength - 1))).toThrow(
            "Invalid vault file structure."
        );
    });
});
