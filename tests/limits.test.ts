/**
 * Upload size and batch caps shared by the popup and Drive overlay.
 *
 * Loose file uploads allow 10 files; folder uploads allow 50. Each file is
 * capped at 25 MB so the browser encrypt step stays bounded.
 */
import { describe, expect, it } from "vitest";
import {
    formatFileSizeLimit,
    MAX_DRIVE_FOLDER_FILES,
    MAX_DRIVE_INTERCEPT_FILES,
    MAX_FILE_SIZE,
} from "../src/utils/limits";

describe("limits", () => {
    it("keeps the documented file and folder batch caps", () => {
        expect(MAX_FILE_SIZE).toBe(25 * 1024 * 1024);
        expect(MAX_DRIVE_INTERCEPT_FILES).toBe(10);
        expect(MAX_DRIVE_FOLDER_FILES).toBe(50);
        expect(formatFileSizeLimit()).toBe("25 MB");
    });
});
