/**
 * Shared encrypt-then-upload used by the popup and the Drive overlay.
 *
 * For a folder selection like docs/nested/a.txt, this must create the nested
 * Drive folders, encrypt the file, and upload the .gvault.json into that
 * parent — not into the destination root.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptAndUploadFiles } from "../src/utils/encryptUpload";

const ensureDriveFolderPath = vi.fn();
const packVaultFile = vi.fn();
const uploadFile = vi.fn();

vi.mock("../src/utils/driveFolder", () => ({
    ensureDriveFolderPath: (...args: unknown[]) => ensureDriveFolderPath(...args),
}));

vi.mock("../src/utils/fileVault", () => ({
    packVaultFile: (...args: unknown[]) => packVaultFile(...args),
}));

vi.mock("../src/utils/uploadFile", () => ({
    default: (...args: unknown[]) => uploadFile(...args),
}));

describe("encryptAndUploadFiles", () => {
    beforeEach(() => {
        ensureDriveFolderPath.mockReset().mockResolvedValue("parent-id");
        packVaultFile.mockReset().mockImplementation(async (file: File) => ({ filename: file.name }));
        uploadFile.mockReset().mockResolvedValue({ id: "file-1" });
    });

    it("uploads a loose file into the chosen destination folder", async () => {
        const file = new File(["hi"], "report.pdf");
        const names = await encryptAndUploadFiles({
            files: [file],
            passphrase: "secret",
            token: "token",
            destinationFolderId: "dest-1",
        });

        expect(ensureDriveFolderPath).toHaveBeenCalledWith("token", "dest-1", [], expect.any(Map));
        expect(uploadFile).toHaveBeenCalledWith("token", { filename: "report.pdf" }, "parent-id", undefined);
        expect(names).toEqual(["report.pdf.gvault.json"]);
    });

    it("creates nested Drive folders for a folder upload then uploads each vault file", async () => {
        const file = new File(["hi"], "a.txt");
        Object.defineProperty(file, "webkitRelativePath", { value: "docs/nested/a.txt" });

        await encryptAndUploadFiles({
            files: [file],
            passphrase: "secret",
            token: "token",
            destinationFolderId: "dest-1",
        });

        expect(ensureDriveFolderPath).toHaveBeenCalledWith(
            "token",
            "dest-1",
            ["docs", "nested"],
            expect.any(Map)
        );
        expect(packVaultFile).toHaveBeenCalledWith(file, "secret", undefined);
        expect(uploadFile).toHaveBeenCalledWith("token", { filename: "a.txt" }, "parent-id", undefined);
    });

    it("uses the explicit path list from the Drive overlay when File.webkitRelativePath is missing", async () => {
        const file = new File(["hi"], "a.txt");

        await encryptAndUploadFiles({
            files: [file],
            relativePaths: ["docs/nested/a.txt"],
            passphrase: "secret",
            token: "token",
            destinationFolderId: "dest-1",
        });

        expect(ensureDriveFolderPath).toHaveBeenCalledWith(
            "token",
            "dest-1",
            ["docs", "nested"],
            expect.any(Map)
        );
    });
});
