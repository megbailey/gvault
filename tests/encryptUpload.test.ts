/**
 * Shared encrypt-then-upload used by the popup and the Drive overlay.
 *
 * For a folder selection like docs/nested/a.txt, this must create the nested
 * Drive folders, encrypt the file, and upload the .gvault into that
 * parent — not into the destination root.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptAndUploadFiles } from "../src/utils/encryptUpload";

const ensureDriveFolderPath = vi.fn();
const encryptAndStreamUploadVault = vi.fn();

vi.mock("../src/utils/driveFolder", () => ({
    ensureDriveFolderPath: (...args: unknown[]) => ensureDriveFolderPath(...args),
}));

vi.mock("../src/utils/streamVaultUpload", () => ({
    encryptAndStreamUploadVault: (...args: unknown[]) => encryptAndStreamUploadVault(...args),
}));

describe("encryptAndUploadFiles", () => {
    beforeEach(() => {
        ensureDriveFolderPath.mockReset().mockResolvedValue("parent-id");
        encryptAndStreamUploadVault.mockReset().mockResolvedValue(undefined);
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
        expect(encryptAndStreamUploadVault).toHaveBeenCalledWith({
            file,
            passphrase: "secret",
            token: "token",
            parentFolderId: "parent-id",
            onProgress: undefined,
        });
        expect(names).toEqual(["report.pdf.gvault"]);
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
        expect(encryptAndStreamUploadVault).toHaveBeenCalledWith({
            file,
            passphrase: "secret",
            token: "token",
            parentFolderId: "parent-id",
            onProgress: undefined,
        });
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
