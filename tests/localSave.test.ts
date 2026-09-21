/**
 * Local download paths for Decrypt folder.
 *
 * After each .gvault in a Drive folder is unpacked, files are saved under
 * Downloads as {selectedFolder}/{nested path}/{original filename}. These tests
 * verify that tree is rebuilt and unsafe characters cannot escape the path.
 */
import { describe, expect, it } from "vitest";
import { decryptedOutputPath, sanitizePathSegment } from "../src/utils/localSave";

describe("decryptedOutputPath", () => {
    it("recreates the selected Drive folder and nested path", () => {
        expect(
            decryptedOutputPath("docs", "nested/notes.txt.gvault", "notes.txt")
        ).toBe("docs/nested/notes.txt");
    });

    it("places a top-level vault file inside the selected folder", () => {
        expect(
            decryptedOutputPath("Photos", "vacation.jpg.gvault", "vacation.jpg")
        ).toBe("Photos/vacation.jpg");
    });

    it("sanitizes unsafe path segments so downloads stay inside Downloads", () => {
        expect(sanitizePathSegment("a/b")).toBe("a_b");
        expect(
            decryptedOutputPath("My Drive", "q?.txt.gvault", "q?.txt")
        ).toBe("My Drive/q_.txt");
    });
});
