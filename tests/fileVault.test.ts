import { describe, it, expect, vi } from "vitest";
import { packVaultFile, unpackVaultFile, VAULT_CHUNK_SIZE } from "../src/utils/fileVault";

vi.mock("argon2-browser/dist/argon2-bundled.min.js", () => ({
    default: {
        hash: vi.fn().mockResolvedValue({
            hash: new Uint8Array(32).fill(1),
            encoded: "mocked-encoded",
        }),
    },
}));

describe("fileVault", () => {
    it("encrypts a file in chunks and decrypts it back", async () => {
        const file = new File(["hello vault"], "hello.txt", { type: "text/plain" });
        const vault = await packVaultFile(file, "secret-passphrase");

        expect(vault.version).toBe(2);
        expect(vault.chunks?.length).toBeGreaterThan(0);

        const result = await unpackVaultFile(vault, "secret-passphrase");
        expect(result.filename).toBe("hello.txt");
        expect(new TextDecoder().decode(result.data)).toBe("hello vault");
    });

    it("rejects a vault whose chunks were reordered", async () => {
        const bytes = new Uint8Array(VAULT_CHUNK_SIZE + 1);
        bytes.fill(9);
        const file = new File([bytes], "two-chunks.bin");
        const vault = await packVaultFile(file, "secret-passphrase");
        expect(vault.chunks).toHaveLength(2);

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
