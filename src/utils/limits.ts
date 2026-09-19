export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_DRIVE_INTERCEPT_FILES = 10;
export const MAX_DRIVE_FOLDER_FILES = 50;

export function formatFileSizeLimit(bytes: number = MAX_FILE_SIZE): string {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
}
