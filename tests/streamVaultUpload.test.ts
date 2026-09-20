/**
 * Encrypt-then-stream upload writes vault JSON in pieces to a Drive
 * resumable session instead of JSON.stringify'ing the whole package first.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { unpackVaultFromByteStream } from "../src/utils/fileVault";
import { encryptAndStreamUploadVault } from "../src/utils/streamVaultUpload";

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

describe("encryptAndStreamUploadVault", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uploads streamed JSON that decrypts back to the original file", async () => {
        const bodies: Uint8Array[] = [];
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            if ((init?.method ?? "GET") === "POST") {
                return {
                    ok: true,
                    headers: {
                        get: (name: string) => (name === "Location" ? "https://upload.test/session" : null),
                    },
                } as Response;
            }

            if (init?.body instanceof Uint8Array) {
                bodies.push(init.body);
            } else if (init?.body instanceof ArrayBuffer) {
                bodies.push(new Uint8Array(init.body));
            }

            return {
                status: 200,
                json: async () => ({ id: "file-1" }),
            } as Response;
        });
        vi.stubGlobal("fetch", fetchMock);

        const file = new File(["hello streamed vault"], "notes.txt");
        await encryptAndStreamUploadVault({
            file,
            passphrase: "secret-passphrase",
            token: "token",
            parentFolderId: "folder-1",
        });

        expect(fetchMock).toHaveBeenCalled();
        const assembled = bodies.reduce((total, part) => {
            const next = new Uint8Array(total.byteLength + part.byteLength);
            next.set(total, 0);
            next.set(part, total.byteLength);
            return next;
        }, new Uint8Array());
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(assembled);
                controller.close();
            },
        });
        const result = await unpackVaultFromByteStream(stream, "secret-passphrase");
        expect(result.filename).toBe("notes.txt");
        expect(await result.data.text()).toBe("hello streamed vault");
    });
});
