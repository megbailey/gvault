/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { actionForFolderAccess, isAccessTokenRejection, isFolderAccessRejection } from "../src/utils/folderAccess";
import {
    UPLOAD_FOLDER_STORAGE_KEY,
    UPLOAD_FOLDERS_STORAGE_KEY,
    forgetApprovedFolder,
    loadUploadFolders,
    normalizeUploadFolders,
    pickedFolders,
    recordApprovedFolders,
    foldersExceptDefault,
    foldersAt,
    foldersFromPickerItems,
    rememberFolder,
    selectUploadFolder,
} from "../src/utils/uploadDestination";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("approved upload folders", () => {
    afterEach(() => {
        localStorage.removeItem(UPLOAD_FOLDER_STORAGE_KEY);
        localStorage.removeItem(UPLOAD_FOLDERS_STORAGE_KEY);
    });

    it("keeps every approved folder and can return to the default without dropping them", async () => {
        await selectUploadFolder({ id: "folder-9", name: "Taxes" });
        await selectUploadFolder({ id: "folder-2", name: "Photos" });
        expect(await loadUploadFolders()).toEqual({
            folders: [
                { id: "folder-2", name: "Photos" },
                { id: "folder-9", name: "Taxes" },
            ],
            selectedId: "folder-2",
        });

        await selectUploadFolder(null);
        expect(await loadUploadFolders()).toEqual({
            folders: [
                { id: "folder-2", name: "Photos" },
                { id: "folder-9", name: "Taxes" },
            ],
            selectedId: null,
        });
    });

    it("updates a folder name in place and reads the previous single-folder record", async () => {
        localStorage.setItem(UPLOAD_FOLDER_STORAGE_KEY, JSON.stringify({ id: "folder-9", name: "Taxes" }));
        expect(await loadUploadFolders()).toEqual({
            folders: [{ id: "folder-9", name: "Taxes" }],
            selectedId: "folder-9",
        });
        expect(localStorage.getItem(UPLOAD_FOLDER_STORAGE_KEY)).toBeNull();

        const folders = rememberFolder(
            [{ id: "folder-9", name: "Taxes" }],
            { id: "folder-9", name: "Taxes 2026" }
        );
        expect(folders).toEqual([{ id: "folder-9", name: "Taxes 2026" }]);
    });

    it("stores one folder list that Encrypt and Decrypt both read", async () => {
        const encryptSource = readFileSync(path.resolve("src/components/Upload.tsx"), "utf8");
        const encryptPicker = readFileSync(path.resolve("src/components/FolderPicker.tsx"), "utf8");
        const decryptSource = readFileSync(path.resolve("src/components/VaultFilePicker.tsx"), "utf8");
        const sharedTree = readFileSync(path.resolve("src/components/ApprovedFolderTree.tsx"), "utf8");
        const approvalHelp = "Folders from your last Drive selection can be used again without additional approval. A new selection replaces this list. Google asks again only if you choose a folder whose approval has expired.";
        expect(encryptSource).toContain("loadUploadFolders");
        expect(decryptSource).toContain("loadUploadFolders");
        expect(encryptSource).toContain("recordApprovedFolders");
        expect(decryptSource).not.toContain("recordApprovedFolders");
        expect(encryptPicker).toContain("ApprovedFolderTree");
        expect(decryptSource).toContain("ApprovedFolderTree");
        expect(sharedTree).toContain("Default (");
        expect(sharedTree).toContain("foldersAt");
        expect(encryptPicker).toContain(approvalHelp);
        expect(decryptSource).toContain(approvalHelp);

        await selectUploadFolder({ id: "folder-2", name: "Photos" });
        const afterEncrypt = await loadUploadFolders();
        expect(afterEncrypt.folders).toEqual([{ id: "folder-2", name: "Photos" }]);

        await recordApprovedFolders([
            { id: "folder-9", name: "Taxes" },
            { id: "folder-3", name: "Receipts" },
            { id: "root", name: "My Drive" },
        ]);
        const shared = await loadUploadFolders();
        expect(shared.selectedId).toBeNull();
        expect(shared.folders).toEqual([
            { id: "folder-9", name: "Taxes" },
            { id: "folder-3", name: "Receipts" },
        ]);
        expect(JSON.parse(localStorage.getItem(UPLOAD_FOLDERS_STORAGE_KEY) ?? "{}")).toEqual(shared);
        expect(pickedFolders(shared.folders)).toEqual(shared.folders);

        await forgetApprovedFolder("folder-9");
        expect(await loadUploadFolders()).toEqual({
            folders: [{ id: "folder-3", name: "Receipts" }],
            selectedId: null,
        });
    });

    it("hides the default folder name because Default already shows it", () => {
        expect(foldersExceptDefault([
            { id: "folder-1", name: "_gvault_default" },
            { id: "folder-2", name: "Photos" },
            { id: "folder-3", name: "  _gvault_default  " },
        ], "_gvault_default")).toEqual([
            { id: "folder-2", name: "Photos" },
        ]);
    });

    it("nests a folder only when its parent was selected too", () => {
        const parent = { id: "parent", name: "Taxes" };
        const child = { id: "child", name: "2024", parentId: "parent" };
        const orphan = { id: "orphan", name: "Receipts", parentId: "missing" };
        const saved = normalizeUploadFolders({
            folders: [parent, child, orphan],
            selectedId: null,
        }).folders;

        expect(foldersAt(saved, null, "_gvault_encrypted").map((folder) => folder.id)).toEqual(["parent", "orphan"]);
        expect(foldersAt(saved, "parent").map((folder) => folder.id)).toEqual(["child"]);
        expect(foldersFromPickerItems([
            { id: "parent", name: "Taxes", mimeType: "application/vnd.google-apps.folder", parents: ["root"] },
            { id: "child", name: "2024", mimeType: "application/vnd.google-apps.folder", parents: ["parent"] },
            { id: "notes", name: "notes.txt.gvault", mimeType: "application/octet-stream" },
        ])).toEqual([
            { id: "parent", name: "Taxes" },
            { id: "child", name: "2024", parentId: "parent" },
        ]);
        expect(foldersFromPickerItems([
            { id: "child", name: "2024", mimeType: "application/vnd.google-apps.folder", parents: ["parent"] },
        ])).toEqual([{ id: "child", name: "2024" }]);
    });

    it("drops My Drive root, blank names, and a selection that is not in the list", () => {
        expect(normalizeUploadFolders({
            folders: [
                { id: "root", name: "My Drive" },
                { id: "folder-9", name: "  " },
                { id: "folder-2", name: " Photos " },
            ],
            selectedId: "missing",
        })).toEqual({
            folders: [{ id: "folder-2", name: "Photos" }],
            selectedId: null,
        });
    });
});

describe("folder reapproval", () => {
    it("asks Google again only for the expired folder the user chose", () => {
        expect(actionForFolderAccess("available")).toBe("use");
        expect(actionForFolderAccess("expired")).toBe("reapprove");
        expect(actionForFolderAccess("signed-out")).toBe("refresh-token");
        expect(actionForFolderAccess("missing")).toBe("keep-name");
    });
});

describe("Drive rejection checks", () => {
    it("separates an expired token from a folder Google will not open", () => {
        expect(isAccessTokenRejection(new Error("Invalid Credentials"))).toBe(true);
        expect(isAccessTokenRejection(new Error("Failed to open Drive folder: 401 Unauthorized"))).toBe(true);
        expect(isFolderAccessRejection(new Error("The user does not have sufficient permissions for this file."))).toBe(true);
        expect(isFolderAccessRejection(new Error("Failed to upload: 403 Forbidden"))).toBe(true);
        expect(isAccessTokenRejection(new Error("Failed to upload: 403 Forbidden"))).toBe(false);
        expect(isFolderAccessRejection(new Error("Invalid Credentials"))).toBe(false);
    });
});