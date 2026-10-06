/**
 * Drive folder creation used when encrypting a local folder tree, and the
 * recursive listing used when Decrypt walks a selected Drive folder.
 *
 * ensureDriveFolderPath walks docs/nested and creates or reuses each segment
 * so Photos/a.jpg lands in Photos, not flattened into My Drive.
 * listDriveVaultTree rebuilds that same tree for decrypt and ignores files
 * that are not .gvault.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDriveFolderPath, getDriveFolder, listDriveVaultFiles, listDriveVaultTree } from "../src/utils/driveFolder";

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        json: async () => body,
    } as Response;
}

describe("ensureDriveFolderPath", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns the destination id when a loose file has no parent folders", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureDriveFolderPath("token", "dest-1", [])).resolves.toBe("dest-1");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("creates each missing nested folder once and reuses the cache", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const method = init?.method ?? "GET";
            if (method === "GET") {
                return jsonResponse({ files: [] });
            }
            const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
            return jsonResponse({ id: `id-${body.name}` });
        });
        vi.stubGlobal("fetch", fetchMock);

        const cache = new Map<string, string>();
        const first = await ensureDriveFolderPath("token", "dest-1", ["docs", "nested"], cache);
        const second = await ensureDriveFolderPath("token", "dest-1", ["docs", "nested"], cache);

        expect(first).toBe("id-nested");
        expect(second).toBe("id-nested");
        expect(cache.get("docs")).toBe("id-docs");
        expect(cache.get("docs/nested")).toBe("id-nested");

        const creates = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
        expect(creates).toHaveLength(2);
    });
});

function driveQuery(input: RequestInfo | URL): string {
    return new URL(String(input)).searchParams.get("q") ?? "";
}

function isFolderList(query: string): boolean {
    return query.includes("mimeType = 'application/vnd.google-apps.folder'");
}

describe("getDriveFolder", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("treats My Drive as already available and reports a missing folder", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: false,
            status: 404,
            json: async () => ({}),
        }) as Response);
        vi.stubGlobal("fetch", fetchMock);

        await expect(getDriveFolder("token", "root")).resolves.toEqual({ id: "root", name: "My Drive" });
        await expect(getDriveFolder("token", "folder-1")).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("reports an expired folder grant separately from a folder that is gone", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            json: async () => ({}),
        }) as Response));

        await expect(getDriveFolder("token", "folder-1")).rejects.toThrow(/403/);
    });

    it("returns a folder GVault can already use", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                id: "folder-1",
                name: "Taxes",
                mimeType: "application/vnd.google-apps.folder",
            }),
        }) as Response));

        await expect(getDriveFolder("token", "folder-1")).resolves.toEqual({
            id: "folder-1",
            name: "Taxes",
        });
    });
});

describe("listDriveVaultFiles", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns only .gvault files so Decrypt never opens a plaintext Drive file", async () => {
        const fetchMock = vi.fn(async () =>
            jsonResponse({
                files: [
                    { id: "1", name: "notes.txt.gvault" },
                    { id: "2", name: "photo.jpg" },
                    { id: "3", name: "README.gvault" },
                    { id: "4", name: "legacy.gvault.json" },
                ],
            })
        );
        vi.stubGlobal("fetch", fetchMock);

        const result = await listDriveVaultFiles("token", { parentId: "dest-1" });
        expect(result.files).toEqual([
            { id: "1", name: "notes.txt.gvault" },
            { id: "3", name: "README.gvault" },
        ]);
    });
});

describe("listDriveVaultTree", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("walks nested folders and keeps each vault file under its relative path", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const query = driveQuery(input);
            if (query.includes("'dest-1' in parents") && isFolderList(query)) {
                return jsonResponse({ files: [{ id: "nested-id", name: "nested" }] });
            }
            if (query.includes("'dest-1' in parents")) {
                return jsonResponse({ files: [{ id: "f1", name: "notes.txt.gvault" }] });
            }
            if (query.includes("'nested-id' in parents") && isFolderList(query)) {
                return jsonResponse({ files: [] });
            }
            if (query.includes("'nested-id' in parents")) {
                return jsonResponse({ files: [{ id: "f2", name: "inner.txt.gvault" }] });
            }
            return jsonResponse({ files: [] });
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(listDriveVaultTree("token", "dest-1")).resolves.toEqual([
            { file: { id: "f1", name: "notes.txt.gvault" }, relativePath: "notes.txt.gvault" },
            { file: { id: "f2", name: "inner.txt.gvault" }, relativePath: "nested/inner.txt.gvault" },
        ]);
    });

    it("stops a folder decrypt when there are more vault files than the batch cap", async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            if (isFolderList(driveQuery(input))) {
                return jsonResponse({ files: [] });
            }
            return jsonResponse({
                files: [
                    { id: "1", name: "a.gvault" },
                    { id: "2", name: "b.gvault" },
                ],
            });
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(listDriveVaultTree("token", "dest-1", { maxFiles: 1 })).rejects.toThrow(
            "This folder has more than 1 encrypted files."
        );
    });
});
