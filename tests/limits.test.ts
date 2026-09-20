/**
 * Upload size and batch caps shared by the popup and Drive overlay.
 *
 * Loose file uploads allow 10 files; folder uploads allow 50. Each file is
 * capped at 3.75 TB so the streamed .gvault.json stays under Drive’s
 * 5,120 GB upload limit after base64, GCM tags, and JSON wrapping.
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
        expect(MAX_FILE_SIZE).toBe(4_122_898_362_590);
        expect(MAX_DRIVE_INTERCEPT_FILES).toBe(10);
        expect(MAX_DRIVE_FOLDER_FILES).toBe(50);
        expect(formatFileSizeLimit()).toBe("3.75 TB");
    });
});
