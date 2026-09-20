/**
 * Streaming vault JSON must match GVaultFile.toJsonString() byte-for-byte
 * so Drive receives a valid package without materializing the full string
 * during encrypt.
 */
import { describe, expect, it, vi } from "vitest";
import { packVaultFile, unpackVaultFromByteStream, VAULT_CHUNK_SIZE } from "../src/utils/fileVault";
import {
    encodeVaultChunkJson,
    measureVaultJsonBytes,
    plaintextChunkSizes,
    vaultJsonEnvelope,
} from "../src/utils/vaultJson";

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

function concatBytes(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.byteLength;
    }
    return output;
}

function bytesToStream(bytes: Uint8Array, chunkSize: number): ReadableStream<Uint8Array> {
    let offset = 0;
    return new ReadableStream({
        pull(controller) {
            if (offset >= bytes.length) {
                controller.close();
                return;
            }
            controller.enqueue(bytes.subarray(offset, offset + chunkSize));
            offset += chunkSize;
        },
    });
}

describe("vault JSON streaming", () => {
    it("measures and encodes the same bytes as GVaultFile.toJsonString", async () => {
        const file = new File(["hello vault"], "héllo.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const sizes = plaintextChunkSizes(file.size, vault.chunkSize);
        const ivs = vault.chunks.map((chunk) => chunk.iv);
        const meta = {
            filename: vault.filename,
            salt: vault.salt,
            chunkSize: vault.chunkSize,
            chunkCount: vault.chunks.length,
        };

        const encoded = new TextEncoder().encode(vault.toJsonString());
        expect(measureVaultJsonBytes(meta, sizes, ivs)).toBe(encoded.byteLength);

        const { header, footer } = vaultJsonEnvelope(meta);
        const parts = [header];
        vault.chunks.forEach((chunk, index) => {
            if (index > 0) {
                parts.push(new TextEncoder().encode(","));
            }
            parts.push(encodeVaultChunkJson(chunk.iv, chunk.cipherText));
        });
        parts.push(footer);
        expect(new TextDecoder().decode(concatBytes(parts))).toBe(vault.toJsonString());
    });

    it("decrypts a streamed vault in small byte pieces", async () => {
        const file = new File(["hello vault"], "hello.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const bytes = new TextEncoder().encode(vault.toJsonString());
        const result = await unpackVaultFromByteStream(bytesToStream(bytes, 17), "secret-passphrase");
        expect(result.filename).toBe("hello.txt");
        expect(await result.data.text()).toBe("hello vault");
    });

    it("rejects a streamed vault that omits chunkCount", async () => {
        const file = new File(["hello vault"], "hello.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const parsed = JSON.parse(vault.toJsonString()) as { chunkCount?: number };
        delete parsed.chunkCount;
        const bytes = new TextEncoder().encode(JSON.stringify(parsed));
        await expect(unpackVaultFromByteStream(bytesToStream(bytes, 21), "secret-passphrase")).rejects.toThrow(
            "Invalid vault file structure."
        );
    });

    it("plans one empty chunk and multiple 1 MiB chunks", () => {
        expect(plaintextChunkSizes(0, VAULT_CHUNK_SIZE)).toEqual([0]);
        expect(plaintextChunkSizes(VAULT_CHUNK_SIZE, VAULT_CHUNK_SIZE)).toEqual([VAULT_CHUNK_SIZE]);
        expect(plaintextChunkSizes(VAULT_CHUNK_SIZE + 1, VAULT_CHUNK_SIZE)).toEqual([
            VAULT_CHUNK_SIZE,
            1,
        ]);
    });
});
