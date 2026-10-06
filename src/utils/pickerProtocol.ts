import { VAULT_FILE_SUFFIX } from "./vaultBinary";

export const PICKER_RESULT_KEY = "gvaultPickerResult";
export const PICKER_RESULT_MAX_AGE_MS = 10 * 60 * 1000;
export const FOLDER_MIME = "application/vnd.google-apps.folder";

export type PickerMode = "folder" | "files";
export type PickerTarget = "upload-folder" | "decrypt-files" | "drive-grant";

export type PickedDriveItem = {
    id: string;
    name: string;
    mimeType: string;
};

export type PickerResultRecord = {
    requestId: string;
    target: PickerTarget;
    createdAt: number;
    cancelled?: boolean;
    error?: string;
    items?: PickedDriveItem[];
};

export type OnePickRequest = {
    requestId: string;
    target: PickerTarget;
    mode: PickerMode;
    fileId?: string;
};

export function isPickerTarget(value: unknown): value is PickerTarget {
    return value === "upload-folder" || value === "decrypt-files" || value === "drive-grant";
}

export function isPickerMode(value: unknown): value is PickerMode {
    return value === "folder" || value === "files";
}

export function parseOnePickRequest(value: unknown): OnePickRequest | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const message = value as Partial<OnePickRequest>;
    if (typeof message.requestId !== "string" || message.requestId.length === 0) {
        return null;
    }
    if (!isPickerMode(message.mode) || !isPickerTarget(message.target)) {
        return null;
    }
    const fileId = typeof message.fileId === "string" && message.fileId.length > 0 && message.fileId !== "root"
        ? message.fileId
        : undefined;
    return {
        requestId: message.requestId,
        target: message.target,
        mode: message.mode,
        fileId,
    };
}

export function resultFromDriveItems(
    request: OnePickRequest,
    items: PickedDriveItem[],
    now = Date.now()
): PickerResultRecord {
    if (items.length === 0) {
        return {
            requestId: request.requestId,
            target: request.target,
            createdAt: now,
            error: "Google Drive did not return a selection.",
        };
    }
    return {
        requestId: request.requestId,
        target: request.target,
        createdAt: now,
        items,
    };
}

export function takeMatchingResult(
    record: PickerResultRecord | undefined,
    target: PickerTarget,
    now = Date.now()
): PickerResultRecord | null {
    if (!record || record.target !== target) {
        return null;
    }
    if (typeof record.createdAt !== "number" || now - record.createdAt > PICKER_RESULT_MAX_AGE_MS) {
        return null;
    }
    if (typeof record.requestId !== "string" || record.requestId.length === 0) {
        return null;
    }
    return record;
}

export function folderItem(items: PickedDriveItem[]): PickedDriveItem | null {
    return items.find((item) => item.mimeType === FOLDER_MIME) ?? null;
}

export function vaultFileItems(items: PickedDriveItem[]): { files: PickedDriveItem[]; skipped: number } {
    const files = items.filter((item) =>
        item.mimeType !== FOLDER_MIME && item.name.toLowerCase().endsWith(VAULT_FILE_SUFFIX)
    );
    return { files, skipped: items.length - files.length };
}
