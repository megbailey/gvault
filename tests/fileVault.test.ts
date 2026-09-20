/**
 * Pack/unpack of a user file into the .gvault.json vault.
 *
 * This is the core Encrypt / Decrypt feature: a File becomes chunked
 * AES-256-GCM ciphertext, then unpack restores the original name and bytes.
 * Tampering tests prove that reordered or duplicated chunks cannot be
 * decrypted as a valid document.
 */
import { describe, it, expect, vi } from "vitest";
import { encodeChunkIv, packVaultFile, unpackVaultFile, VAULT_CHUNK_SIZE } from "../src/utils/fileVault";

vi.mock("argon2-browser/dist/argon2-bundled.min.js", () => ({
    default: {
        hash: vi.fn().mockImplementation(async ({ pass }: { pass: string }) => {
            const hash = new Uint8Array(32);
            const text = String(pass);
            for (let index = 0; index < 32; index++) {
                hash[index] = text.charCodeAt(index % text.length) + index;
            }
            return { hash, encoded: "mocked-encoded" };
        }),
    },
}));

describe("fileVault", () => {
    it("builds each chunk IV from a per-file random prefix plus the chunk index", () => {
        const prefix = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(Array.from(encodeChunkIv(prefix, 0))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 0]);
        expect(Array.from(encodeChunkIv(prefix, 1))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0, 1]);
    });

    it("encrypts a file in chunks and decrypts it back to the original document", async () => {
        const file = new File(["hello vault"], "hello.txt", { type: "text/plain" });
        const vault = await packVaultFile(file, "secret-passphrase");

        expect(vault.version).toBe(2);
        expect(vault.chunks?.length).toBeGreaterThan(0);

        const result = await unpackVaultFile(vault, "secret-passphrase");
        expect(result.filename).toBe("hello.txt");
        expect(new TextDecoder().decode(result.data)).toBe("hello vault");
    });

    it("encrypts and decrypts an empty file so zero-byte uploads still work", async () => {
        const file = new File([], "empty.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const result = await unpackVaultFile(vault, "secret-passphrase");
        expect(result.filename).toBe("empty.txt");
        expect(result.data.byteLength).toBe(0);
    });

    it("rejects decrypt when the passphrase is wrong", async () => {
        const file = new File(["hello vault"], "hello.txt", { type: "text/plain" });
        const vault = await packVaultFile(file, "secret-passphrase");

        await expect(unpackVaultFile(vault, "wrong-passphrase")).rejects.toThrow(
            "The passphrase was incorrect. Please try again."
        );
    });

    it("rejects a vault whose chunks were reordered", async () => {
        // Two chunks so index 0 and 1 can be swapped. AAD includes the index,
        // so the swapped payload must not decrypt as valid plaintext.
        const bytes = new Uint8Array(VAULT_CHUNK_SIZE + 1);
        bytes.fill(9);
        const file = new File([bytes], "two-chunks.bin");
        const vault = await packVaultFile(file, "secret-passphrase");
        expect(vault.chunks).toHaveLength(2);
        const prefix = vault.chunks[0].iv.slice(0, 8);
        expect(vault.chunks[1].iv.slice(0, 8)).toEqual(prefix);
        expect(vault.chunks[0].iv.slice(8)).toEqual([0, 0, 0, 0]);
        expect(vault.chunks[1].iv.slice(8)).toEqual([0, 0, 0, 1]);

        const [first, second] = vault.chunks;
        vault.chunks = [second, first];

        await expect(unpackVaultFile(vault, "secret-passphrase")).rejects.toThrow(
            "The passphrase was incorrect. Please try again."
        );
    });

    it("rejects a vault whose chunks were duplicated", async () => {
        const file = new File(["hello vault"], "hello.txt", { type: "text/plain" });
        const vault = await packVaultFile(file, "secret-passphrase");
        vault.chunks.push(vault.chunks[0]);

        await expect(unpackVaultFile(vault, "secret-passphrase")).rejects.toThrow(
            "The passphrase was incorrect. Please try again."
        );
    });
});
