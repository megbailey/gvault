/**
 * Drive-page intercept helpers used by the Honey-style overlay.
 *
 * Covers: which Drive folder an intercepted upload should land in (from the
 * URL), whether a selection is a folder tree, size/count guards so plaintext
 * is cancelled instead of sent, and how nested relative paths become Drive
 * parent folders.
 */
import { describe, expect, it } from "vitest";
import {
    interceptRejectionMessage,
    isDirectoryUpload,
    parentFolderSegments,
    parseDriveUploadDestination,
    relativePathForFile,
    summarizeInterceptedUpload,
    validateInterceptedFiles,
} from "../src/utils/drivePage";

describe("parseDriveUploadDestination", () => {
    it("uploads into the folder the user is viewing", () => {
        expect(
            parseDriveUploadDestination("https://drive.google.com/drive/u/0/folders/abc123_XYZ")
        ).toEqual({
            folderId: "abc123_XYZ",
            label: "Current folder",
        });
    });

    it("uploads to My Drive from Home", () => {
        expect(
            parseDriveUploadDestination("https://drive.google.com/drive/u/0/home")
        ).toEqual({
            folderId: "root",
            label: "My Drive",
        });
    });

    it("uploads to My Drive when the URL has no folder id", () => {
        expect(
            parseDriveUploadDestination("https://drive.google.com/drive/u/1/my-drive")
        ).toEqual({
            folderId: "root",
            label: "My Drive",
        });
    });

    it("uploads to My Drive when the page URL cannot be parsed", () => {
        expect(parseDriveUploadDestination("not-a-url")).toEqual({
            folderId: "root",
            label: "My Drive",
        });
    });
});

describe("validateInterceptedFiles", () => {
    it("allows folder uploads so New > Folder upload can be encrypted", () => {
        expect(isDirectoryUpload([{ size: 1, webkitRelativePath: "docs/a.txt" }])).toBe(true);
        expect(
            validateInterceptedFiles([{ size: 1, webkitRelativePath: "docs/a.txt" }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: true });
    });

    it("rejects files over the size limit so the original upload is cancelled", () => {
        expect(
            validateInterceptedFiles([{ size: 11 }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: false, reason: "too-large" });
    });

    it("rejects more files than the batch limit so huge folders do not start", () => {
        expect(
            validateInterceptedFiles([{ size: 1 }, { size: 1 }, { size: 1 }], {
                maxFileSize: 10,
                maxFiles: 2,
            })
        ).toEqual({ ok: false, reason: "too-many" });
    });

    it("rejects an empty selection after a folder read fails", () => {
        expect(validateInterceptedFiles([], { maxFileSize: 10, maxFiles: 5 })).toEqual({
            ok: false,
            reason: "empty",
        });
    });

    it("accepts a normal file batch", () => {
        expect(
            validateInterceptedFiles([{ size: 1 }, { size: 2 }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: true });
    });

    it("tells the user the cancelled upload was not sent unencrypted", () => {
        expect(
            interceptRejectionMessage("too-large", {
                maxFileSizeLabel: "25 MB",
                maxFiles: 10,
            })
        ).toMatch(/sent unencrypted/i);
        expect(
            interceptRejectionMessage("too-many", {
                maxFileSizeLabel: "25 MB",
                maxFiles: 10,
            })
        ).toMatch(/10 files/);
        expect(
            interceptRejectionMessage("empty", {
                maxFileSizeLabel: "25 MB",
                maxFiles: 10,
            })
        ).toMatch(/No files were selected/);
    });
});

describe("folder upload paths", () => {
    it("keeps nested files under their relative folder segments", () => {
        expect(relativePathForFile({ name: "a.txt", webkitRelativePath: "docs/nested/a.txt" })).toBe(
            "docs/nested/a.txt"
        );
        expect(parentFolderSegments("docs/nested/a.txt")).toEqual(["docs", "nested"]);
        expect(parentFolderSegments("a.txt")).toEqual([]);
    });

    it("normalizes Windows paths from a dropped folder", () => {
        expect(relativePathForFile({ name: "a.txt" }, "docs\\nested\\a.txt")).toBe("docs/nested/a.txt");
        expect(parentFolderSegments("docs/nested/a.txt")).toEqual(["docs", "nested"]);
    });

    it("summarizes a single dropped folder for the passphrase dialog", () => {
        expect(
            summarizeInterceptedUpload(
                [
                    { name: "a.txt", webkitRelativePath: "docs/a.txt" },
                    { name: "b.txt", webkitRelativePath: "docs/nested/b.txt" },
                ]
            )
        ).toEqual({
            isFolder: true,
            rootNames: ["docs"],
            fileCount: 2,
        });
    });

    it("treats loose files as a non-folder batch", () => {
        expect(
            summarizeInterceptedUpload([{ name: "report.pdf" }])
        ).toEqual({
            isFolder: false,
            rootNames: [],
            fileCount: 1,
        });
    });

    it("detects folder uploads from cloned relative paths after postMessage", () => {
        // File.webkitRelativePath is lost when MAIN world posts files to the
        // overlay, so the content script also sends an explicit path list.
        expect(
            isDirectoryUpload([{ size: 1, name: "a.txt" }], ["docs/a.txt"])
        ).toBe(true);
    });
});
