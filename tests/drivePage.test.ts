import { describe, expect, it } from "vitest";
import {
    interceptRejectionMessage,
    isDirectoryUpload,
    parseDriveUploadDestination,
    validateInterceptedFiles,
} from "../src/utils/drivePage";

describe("parseDriveUploadDestination", () => {
    it("uses the current folder id from a Drive folder URL", () => {
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
});

describe("validateInterceptedFiles", () => {
    it("rejects folder uploads", () => {
        expect(isDirectoryUpload([{ size: 1, webkitRelativePath: "docs/a.txt" }])).toBe(true);
        expect(
            validateInterceptedFiles([{ size: 1, webkitRelativePath: "docs/a.txt" }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: false, reason: "folder" });
    });

    it("rejects files over the size limit", () => {
        expect(
            validateInterceptedFiles([{ size: 11 }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: false, reason: "too-large" });
    });

    it("rejects more files than the batch limit", () => {
        expect(
            validateInterceptedFiles([{ size: 1 }, { size: 1 }, { size: 1 }], {
                maxFileSize: 10,
                maxFiles: 2,
            })
        ).toEqual({ ok: false, reason: "too-many" });
    });

    it("accepts a normal file batch", () => {
        expect(
            validateInterceptedFiles([{ size: 1 }, { size: 2 }], {
                maxFileSize: 10,
                maxFiles: 5,
            })
        ).toEqual({ ok: true });
    });

    it("explains that cancelled uploads were not sent unencrypted", () => {
        expect(
            interceptRejectionMessage("too-large", {
                maxFileSizeLabel: "25 MB",
                maxFiles: 10,
            })
        ).toMatch(/sent unencrypted/i);
    });
});
