export type ExtensionSettings = {
    minPassphraseLength: number | null;
    requireSpecialCharacters: boolean;
    encryptedFolderName: string;
    deleteEncryptedFileAfterDownload: boolean;
};

export const DEFAULT_ENCRYPTED_FOLDER_NAME = "_gvault_encrypted";

export const DEFAULT_SETTINGS: ExtensionSettings = {
    minPassphraseLength: null,
    requireSpecialCharacters: false,
    encryptedFolderName: DEFAULT_ENCRYPTED_FOLDER_NAME,
    deleteEncryptedFileAfterDownload: false,
};

export const SETTINGS_STORAGE_KEY = "gvaultSettings";

const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/;

function hasExtensionStorage(): boolean {
    return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

function normalizeSettings(value: Partial<ExtensionSettings> | undefined): ExtensionSettings {
    const folderName = value?.encryptedFolderName?.trim() || DEFAULT_ENCRYPTED_FOLDER_NAME;
    const minLength = value?.minPassphraseLength;
    const parsedMinLength =
        typeof minLength === "number" && Number.isFinite(minLength) && minLength > 0
            ? Math.floor(minLength)
            : null;

    return {
        minPassphraseLength: parsedMinLength,
        requireSpecialCharacters: Boolean(value?.requireSpecialCharacters),
        encryptedFolderName: folderName,
        deleteEncryptedFileAfterDownload: Boolean(value?.deleteEncryptedFileAfterDownload),
    };
}

export async function loadSettings(): Promise<ExtensionSettings> {
    if (hasExtensionStorage()) {
        const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        return normalizeSettings(result[SETTINGS_STORAGE_KEY] as Partial<ExtensionSettings> | undefined);
    }

    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        return normalizeSettings(raw ? JSON.parse(raw) : undefined);
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
    const next = normalizeSettings(settings);

    if (hasExtensionStorage()) {
        await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
        return next;
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    return next;
}

export function validatePassphrase(
    passphrase: string,
    settings: ExtensionSettings
): string | null {
    if (!passphrase) {
        return "Enter a security passphrase before uploading.";
    }

    if (
        settings.minPassphraseLength !== null &&
        passphrase.length < settings.minPassphraseLength
    ) {
        return `Passphrase must be at least ${settings.minPassphraseLength} characters.`;
    }

    if (settings.requireSpecialCharacters && !SPECIAL_CHAR_PATTERN.test(passphrase)) {
        return "Passphrase must include at least one special character.";
    }

    return null;
}
