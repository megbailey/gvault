/**
 * @vitest-environment jsdom
 *
 * Settings used by Encrypt, Decrypt, and the Drive overlay dialog.
 *
 * Verifies passphrase rules from Settings, default encrypted-folder name
 * fallback, and that a persisted payload is normalized before use.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
    DEFAULT_ENCRYPTED_FOLDER_NAME,
    DEFAULT_SETTINGS,
    SETTINGS_STORAGE_KEY,
    loadSettings,
    saveSettings,
    validatePassphrase,
} from "../src/utils/settings";

describe("validatePassphrase", () => {
    it("requires a passphrase before any encrypt/upload can start", () => {
        expect(validatePassphrase("", DEFAULT_SETTINGS)).toBe(
            "Enter a security passphrase before uploading."
        );
    });

    it("enforces the minimum length from Settings", () => {
        expect(
            validatePassphrase("short", { ...DEFAULT_SETTINGS, minPassphraseLength: 10 })
        ).toBe("Passphrase must be at least 10 characters.");
        expect(
            validatePassphrase("long-enough", { ...DEFAULT_SETTINGS, minPassphraseLength: 10 })
        ).toBeNull();
    });

    it("requires a special character when that Settings option is on", () => {
        const settings = { ...DEFAULT_SETTINGS, requireSpecialCharacters: true };
        expect(validatePassphrase("NoSpecials", settings)).toBe(
            "Passphrase must include at least one special character."
        );
        expect(validatePassphrase("Has-special", settings)).toBeNull();
    });
});

describe("saveSettings and loadSettings", () => {
    afterEach(() => {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
    });

    it("falls back to _gvault_encrypted when the folder name is blank", async () => {
        const saved = await saveSettings({
            ...DEFAULT_SETTINGS,
            encryptedFolderName: "   ",
        });
        expect(saved.encryptedFolderName).toBe(DEFAULT_ENCRYPTED_FOLDER_NAME);

        const loaded = await loadSettings();
        expect(loaded.encryptedFolderName).toBe(DEFAULT_ENCRYPTED_FOLDER_NAME);
    });
});
