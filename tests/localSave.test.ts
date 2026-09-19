import { describe, expect, it } from "vitest";
import { decryptedOutputPath, sanitizePathSegment } from "../src/utils/localSave";

describe("decryptedOutputPath", () => {
    it("recreates the selected Drive folder and nested path", () => {
        expect(
            decryptedOutputPath("docs", "nested/notes.txt.gvault.json", "notes.txt")
        ).toBe("docs/nested/notes.txt");
    });

    it("places a top-level vault file inside the selected folder", () => {
        expect(
            decryptedOutputPath("Photos", "vacation.jpg.gvault.json", "vacation.jpg")
        ).toBe("Photos/vacation.jpg");
    });

    it("sanitizes unsafe path segments", () => {
        expect(sanitizePathSegment("a/b")).toBe("a_b");
        expect(
            decryptedOutputPath("My Drive", "q?.txt.gvault.json", "q?.txt")
        ).toBe("My Drive/q_.txt");
    });
});
