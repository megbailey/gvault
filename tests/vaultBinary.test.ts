/**
 * Binary .gvault header and size math. Encrypt streams these bytes to Drive;
 * decrypt reconstructs IVs from the header prefix plus chunk index.
 */
import { describe, expect, it, vi } from "vitest";
import { packVaultFile, unpackVaultFromByteStream, VAULT_CHUNK_SIZE } from "../src/utils/fileVault";
import { MAX_FILE_SIZE } from "../src/utils/limits";
import {
    CURRENT_VAULT_VERSION,
    DEFAULT_VAULT_CHUNK_SIZE,
    DRIVE_UPLOAD_CAP_BYTES,
    encodeVaultHeader,
    gcmCiphertextByteLength,
    MAX_VAULT_FILENAME_BYTES,
    maxPlaintextWithinVaultCap,
    measureVaultBytes,
    parseVaultHeader,
    plaintextChunkSizes,
    VAULT_HEADER_FIXED_BYTES,
    VAULT_MAGIC,
    vaultByteLength,
} from "../src/utils/vaultBinary";

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

describe("vault binary header", () => {
    it("round-trips salt, IV prefix, sizes, and a UTF-8 filename", () => {
        const salt = new Uint8Array(16).map((_, index) => index);
        const ivPrefix = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        const header = encodeVaultHeader({
            salt,
            ivPrefix,
            chunkSize: VAULT_CHUNK_SIZE,
            plaintextSize: 11,
            filename: "héllo.txt",
        });

        expect([...header.subarray(0, 4)]).toEqual([...VAULT_MAGIC]);
        expect(new DataView(header.buffer).getUint32(4, false)).toBe(CURRENT_VAULT_VERSION);

        const parsed = parseVaultHeader(header);
        expect(parsed.filename).toBe("héllo.txt");
        expect(parsed.plaintextSize).toBe(11);
        expect(parsed.chunkSize).toBe(VAULT_CHUNK_SIZE);
        expect([...parsed.salt]).toEqual([...salt]);
        expect([...parsed.ivPrefix]).toEqual([...ivPrefix]);
        expect(parsed.byteLength).toBe(header.byteLength);
    });

    it("rejects JSON leftovers and truncated headers", () => {
        const leftoverJson = new TextEncoder().encode(
            '{"version":2,"kdf":"Argon2id","cipher":"AES-256-GCM","filename":"a.txt"}'
        );
        expect(leftoverJson.byteLength).toBeGreaterThan(VAULT_HEADER_FIXED_BYTES);
        expect(() => parseVaultHeader(leftoverJson)).toThrow("That file is not a valid .gvault package.");
        expect(() => parseVaultHeader(new Uint8Array(10))).toThrow("Invalid vault file structure.");
    });

    it("plans one empty chunk and multiple 1 MiB chunks", () => {
        expect(plaintextChunkSizes(0, VAULT_CHUNK_SIZE)).toEqual([0]);
        expect(plaintextChunkSizes(VAULT_CHUNK_SIZE, VAULT_CHUNK_SIZE)).toEqual([VAULT_CHUNK_SIZE]);
        expect(plaintextChunkSizes(VAULT_CHUNK_SIZE + 1, VAULT_CHUNK_SIZE)).toEqual([
            VAULT_CHUNK_SIZE,
            1,
        ]);
        expect(gcmCiphertextByteLength(0)).toBe(16);
    });

    it("keeps the documented plaintext cap under Drive’s 5 TiB upload limit", () => {
        const worstName = "a".repeat(MAX_VAULT_FILENAME_BYTES);
        expect(maxPlaintextWithinVaultCap()).toBe(MAX_FILE_SIZE);
        expect(vaultByteLength(MAX_FILE_SIZE, MAX_VAULT_FILENAME_BYTES, DEFAULT_VAULT_CHUNK_SIZE)).toBe(
            DRIVE_UPLOAD_CAP_BYTES
        );
        expect(measureVaultBytes(MAX_FILE_SIZE, worstName, VAULT_CHUNK_SIZE)).toBe(DRIVE_UPLOAD_CAP_BYTES);
        expect(measureVaultBytes(MAX_FILE_SIZE + 1, worstName, VAULT_CHUNK_SIZE)).toBe(DRIVE_UPLOAD_CAP_BYTES + 1);
        expect(VAULT_HEADER_FIXED_BYTES).toBe(46);
    });
});

describe("vault binary streaming", () => {
    it("measures and encodes the same bytes as GVaultFile.toBytes", async () => {
        const file = new File(["hello vault"], "héllo.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const encoded = vault.toBytes();
        expect(measureVaultBytes(file.size, vault.filename, vault.chunkSize)).toBe(encoded.byteLength);

        const header = encodeVaultHeader({
            salt: vault.salt,
            ivPrefix: vault.ivPrefix,
            chunkSize: vault.chunkSize,
            plaintextSize: file.size,
            filename: vault.filename,
        });
        expect(concatBytes([header, ...vault.chunks])).toEqual(encoded);
    });

    it("decrypts a streamed vault in small byte pieces", async () => {
        const file = new File(["hello vault"], "hello.txt");
        const vault = await packVaultFile(file, "secret-passphrase");
        const result = await unpackVaultFromByteStream(bytesToStream(vault.toBytes(), 17), "secret-passphrase");
        expect(result.filename).toBe("hello.txt");
        expect(await result.data.text()).toBe("hello vault");
    });

    it("rejects a streamed vault that is not binary GVLT", async () => {
        const bytes = new TextEncoder().encode(
            '{"version":2,"kdf":"Argon2id","cipher":"AES-256-GCM","filename":"a.txt"}'
        );
        await expect(unpackVaultFromByteStream(bytesToStream(bytes, 8), "secret-passphrase")).rejects.toThrow(
            "That file is not a valid .gvault package."
        );
    });
});
