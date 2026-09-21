import {
    DEFAULT_VAULT_CHUNK_SIZE,
    DRIVE_UPLOAD_CAP_BYTES,
    MAX_VAULT_FILENAME_BYTES,
    maxPlaintextWithinVaultCap,
} from "./vaultBinary";

export const MAX_DRIVE_INTERCEPT_FILES = 10;
export const MAX_DRIVE_FOLDER_FILES = 50;

/**
 * Drive’s files.create cap is 5,120 GB = 5 TiB = 5,497,558,138,880 bytes for
 * the uploaded `.gvault`. Worst-case header is 46 + 65,535 = 65,581 bytes.
 * Each 1 MiB chunk adds a 16-byte GCM tag. The largest plaintext that still
 * fits is 5,497,474,188,499 bytes (5,242,799 full chunks + a 984,275-byte
 * tail). That vault is exactly the Drive cap.
 */
export const MAX_FILE_SIZE = maxPlaintextWithinVaultCap(
    DRIVE_UPLOAD_CAP_BYTES,
    MAX_VAULT_FILENAME_BYTES,
    DEFAULT_VAULT_CHUNK_SIZE
);

export function formatExactByteCount(bytes: number): string {
    return `${String(bytes).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} bytes`;
}

export function formatFileSizeLimit(bytes: number = MAX_FILE_SIZE): string {
    if (bytes === MAX_FILE_SIZE) {
        return formatExactByteCount(MAX_FILE_SIZE);
    }
    return `${Math.round(bytes / (1024 * 1024))} MB`;
}
