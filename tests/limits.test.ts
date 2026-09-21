/**
 * Upload size and batch caps shared by the popup and Drive overlay.
 *
 * Loose file uploads allow 10 files; folder uploads allow 50. Each file is
 * capped at 5,497,474,188,499 bytes so the streamed .gvault stays at or under
 * Drive’s 5,497,558,138,880-byte (5,120 GB) upload limit after GCM tags and
 * a worst-case binary header.
 */
import { describe, expect, it } from "vitest";
import {
    formatExactByteCount,
    formatFileSizeLimit,
    MAX_DRIVE_FOLDER_FILES,
    MAX_DRIVE_INTERCEPT_FILES,
    MAX_FILE_SIZE,
} from "../src/utils/limits";
import {
    DEFAULT_VAULT_CHUNK_SIZE,
    DRIVE_UPLOAD_CAP_BYTES,
    MAX_VAULT_FILENAME_BYTES,
    maxPlaintextWithinVaultCap,
    vaultByteLength,
} from "../src/utils/vaultBinary";

describe("limits", () => {
    it("keeps the documented file and folder batch caps", () => {
        expect(DRIVE_UPLOAD_CAP_BYTES).toBe(5_497_558_138_880);
        expect(MAX_FILE_SIZE).toBe(5_497_474_188_499);
        expect(MAX_FILE_SIZE).toBe(maxPlaintextWithinVaultCap());
        expect(MAX_DRIVE_INTERCEPT_FILES).toBe(10);
        expect(MAX_DRIVE_FOLDER_FILES).toBe(50);
        expect(formatFileSizeLimit()).toBe("5,497,474,188,499 bytes");
        expect(formatExactByteCount(MAX_FILE_SIZE)).toBe("5,497,474,188,499 bytes");
    });

    it("derives the plaintext cap so the worst-case vault equals Drive’s upload limit", () => {
        const vaultAtCap = vaultByteLength(
            MAX_FILE_SIZE,
            MAX_VAULT_FILENAME_BYTES,
            DEFAULT_VAULT_CHUNK_SIZE
        );
        const vaultOverCap = vaultByteLength(
            MAX_FILE_SIZE + 1,
            MAX_VAULT_FILENAME_BYTES,
            DEFAULT_VAULT_CHUNK_SIZE
        );
        expect(vaultAtCap).toBe(DRIVE_UPLOAD_CAP_BYTES);
        expect(vaultOverCap).toBe(DRIVE_UPLOAD_CAP_BYTES + 1);
    });
});
