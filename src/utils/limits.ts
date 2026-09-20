export const MAX_DRIVE_INTERCEPT_FILES = 10;
export const MAX_DRIVE_FOLDER_FILES = 50;

/**
 * Drive’s files.create cap is 5,120 GB (5 TiB) for the uploaded
 * `.gvault.json`. Base64, a 16-byte GCM tag per 1 MiB chunk, and JSON
 * wrapping expand the package by about 4/3. This is the largest plaintext
 * that still fits under that cap with worst-case IV digits.
 */
export const MAX_FILE_SIZE = 4_122_898_362_590;

export function formatFileSizeLimit(bytes: number = MAX_FILE_SIZE): string {
    if (bytes === MAX_FILE_SIZE) {
        return "3.75 TB";
    }
    return `${Math.round(bytes / (1024 * 1024))} MB`;
}
