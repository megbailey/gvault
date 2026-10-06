import { getDriveFolder, type DriveFolder } from "./driveFolder";
import { refreshAccessToken } from "./getAccessToken";
import { openDrivePicker } from "./openDrivePicker";
import { folderItem, type PickerTarget } from "./pickerProtocol";

export function isAccessTokenRejection(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    return /\b401\b|invalid authentication|invalid credentials|login required/i.test(message);
}

export function isFolderAccessRejection(error: unknown): boolean {
    const message = error instanceof Error ? error.message : "";
    return /\b403\b|insufficient permission|sufficient permissions|permission denied|has not granted|forbidden/i.test(message);
}

export type FolderAccess = "available" | "expired" | "missing" | "signed-out";

export function actionForFolderAccess(access: FolderAccess): "use" | "reapprove" | "refresh-token" | "keep-name" {
    if (access === "available") {
        return "use";
    }
    if (access === "expired") {
        return "reapprove";
    }
    if (access === "signed-out") {
        return "refresh-token";
    }
    return "keep-name";
}

async function lookupFolder(token: string, folderId: string): Promise<{ access: FolderAccess; folder: DriveFolder | null }> {
    try {
        const folder = await getDriveFolder(token, folderId);
        if (!folder) {
            return { access: "missing", folder: null };
        }
        return { access: "available", folder };
    } catch (error) {
        if (isAccessTokenRejection(error)) {
            return { access: "signed-out", folder: null };
        }
        if (isFolderAccessRejection(error)) {
            return { access: "expired", folder: null };
        }
        throw error;
    }
}

export async function ensureGrantedFolder(options: {
    token: string;
    folder: DriveFolder;
    target: PickerTarget;
}): Promise<{ token: string; folder: DriveFolder; regranted: boolean; missing?: boolean }> {
    let token = options.token;
    let looked = await lookupFolder(token, options.folder.id);
    if (actionForFolderAccess(looked.access) === "refresh-token") {
        token = await refreshAccessToken(token);
        looked = await lookupFolder(token, options.folder.id);
    }
    if (looked.folder && actionForFolderAccess(looked.access) === "use") {
        return { token, folder: looked.folder, regranted: false };
    }
    if (actionForFolderAccess(looked.access) === "keep-name") {
        return { token, folder: options.folder, regranted: false, missing: true };
    }

    const record = await openDrivePicker({
        mode: "folder",
        target: options.target,
        fileId: options.folder.id,
    });
    const picked = folderItem(record.items ?? []);
    if (!picked) {
        throw new Error("Select the Drive folder to continue.");
    }

    return {
        token,
        folder: { id: picked.id, name: picked.name },
        regranted: true,
    };
}
