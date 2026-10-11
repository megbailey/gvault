import type { DriveFolder } from "./driveFolder";
import { folderItems, type PickedDriveItem } from "./pickerProtocol";

export const UPLOAD_FOLDER_STORAGE_KEY = "gvaultUploadFolder";
export const UPLOAD_FOLDERS_STORAGE_KEY = "gvaultUploadFolders";
export const APPROVED_FOLDERS_HELP = "Folders from your last Drive selection can be used again without additional approval. A new selection replaces this list. \n\nGoogle asks again only if you choose a new set of folders or choose a folder whose approval has since expired.";
const MAX_APPROVED_FOLDERS = 30;

export type SavedUploadFolders = {
    folders: DriveFolder[];
    selectedId: string | null;
};

function hasExtensionStorage(): boolean {
    return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export function normalizeUploadFolder(value: unknown): DriveFolder | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const folder = value as Partial<DriveFolder>;
    const name = typeof folder.name === "string" ? folder.name.trim() : "";
    if (typeof folder.id !== "string" || folder.id.length === 0 || folder.id === "root" || name.length === 0) {
        return null;
    }
    const parentId = typeof folder.parentId === "string" && folder.parentId.length > 0 && folder.parentId !== "root" && folder.parentId !== folder.id
        ? folder.parentId
        : undefined;
    return parentId ? { id: folder.id, name, parentId } : { id: folder.id, name };
}

export function normalizeUploadFolders(value: unknown): SavedUploadFolders {
    const legacy = normalizeUploadFolder(value);
    if (legacy && !Array.isArray((value as { folders?: unknown }).folders)) {
        return { folders: [legacy], selectedId: legacy.id };
    }

    const record = value && typeof value === "object" ? value as { folders?: unknown; selectedId?: unknown } : {};
    const folders: DriveFolder[] = [];
    if (Array.isArray(record.folders)) {
        for (const entry of record.folders) {
            const folder = normalizeUploadFolder(entry);
            if (folder && !folders.some((existing) => existing.id === folder.id)) {
                folders.push(folder);
            }
            if (folders.length >= MAX_APPROVED_FOLDERS) {
                break;
            }
        }
    }

    const ids = new Set(folders.map((folder) => folder.id));
    const linked = folders.map((folder) => {
        if (folder.parentId && ids.has(folder.parentId)) {
            return folder;
        }
        if (!folder.parentId) {
            return folder;
        }
        return { id: folder.id, name: folder.name };
    });

    const selectedId = typeof record.selectedId === "string" && linked.some((folder) => folder.id === record.selectedId)
        ? record.selectedId
        : null;
    return { folders: linked, selectedId };
}

export function isDefaultFolderName(name: string, defaultFolderName: string): boolean {
    return name.trim().toLowerCase() === defaultFolderName.trim().toLowerCase();
}

export function foldersExceptDefault(folders: DriveFolder[], defaultFolderName: string): DriveFolder[] {
    return folders.filter((folder) => !isDefaultFolderName(folder.name, defaultFolderName));
}

export function visibleParentId(folder: DriveFolder, folders: DriveFolder[]): string | undefined {
    const byId = new Map(folders.map((entry) => [entry.id, entry]));
    const parentId = folder.parentId;
    if (!parentId || parentId === "root" || parentId === folder.id || !byId.has(parentId)) {
        return undefined;
    }
    const seen = new Set<string>([folder.id]);
    let current = parentId;
    while (byId.has(current)) {
        if (seen.has(current)) {
            return undefined;
        }
        seen.add(current);
        const next = byId.get(current)?.parentId;
        if (!next || next === "root" || next === current || !byId.has(next)) {
            return parentId;
        }
        current = next;
    }
    return undefined;
}

export function foldersAt(folders: DriveFolder[], parentId: string | null, defaultFolderName?: string): DriveFolder[] {
    const rows = folders.filter((folder) => {
        const parent = visibleParentId(folder, folders);
        if (!parentId || parentId === "root") {
            return !parent;
        }
        return parent === parentId;
    });
    if ((!parentId || parentId === "root") && defaultFolderName) {
        return foldersExceptDefault(rows, defaultFolderName);
    }
    return rows;
}

export function foldersFromPickerItems(items: PickedDriveItem[]): DriveFolder[] {
    const folders = folderItems(items);
    const ids = new Set(folders.map((folder) => folder.id));
    return folders.map((folder) => {
        const parentId = folder.parents?.find((id) => id !== folder.id && id !== "root" && ids.has(id));
        return parentId
            ? { id: folder.id, name: folder.name, parentId }
            : { id: folder.id, name: folder.name };
    });
}

export function rememberFolder(folders: DriveFolder[], folder: DriveFolder): DriveFolder[] {
    const next = normalizeUploadFolder(folder);
    if (!next) {
        return folders;
    }
    const previous = folders.find((existing) => existing.id === next.id);
    const saved = next.parentId || !previous?.parentId ? next : { ...next, parentId: previous.parentId };
    return [saved, ...folders.filter((existing) => existing.id !== next.id)].slice(0, MAX_APPROVED_FOLDERS);
}

let folderWrite: Promise<unknown> = Promise.resolve();

function enqueueFolderWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = folderWrite.then(task, task);
    folderWrite = run.then(() => undefined, () => undefined);
    return run;
}

async function readStoredValue(key: string): Promise<unknown> {
    if (hasExtensionStorage()) {
        const result = await chrome.storage.local.get(key);
        return result[key];
    }
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

async function writeStoredValue(key: string, value: unknown): Promise<void> {
    if (hasExtensionStorage()) {
        await chrome.storage.local.set({ [key]: value });
        return;
    }
    localStorage.setItem(key, JSON.stringify(value));
}

async function removeStoredValue(key: string): Promise<void> {
    if (hasExtensionStorage()) {
        await chrome.storage.local.remove(key);
        return;
    }
    localStorage.removeItem(key);
}

export async function loadUploadFolders(): Promise<SavedUploadFolders> {
    const stored = await readStoredValue(UPLOAD_FOLDERS_STORAGE_KEY);
    if (stored) {
        return normalizeUploadFolders(stored);
    }
    const legacy = normalizeUploadFolders(await readStoredValue(UPLOAD_FOLDER_STORAGE_KEY));
    if (legacy.folders.length > 0) {
        await saveUploadFolders(legacy);
        await removeStoredValue(UPLOAD_FOLDER_STORAGE_KEY);
    }
    return legacy;
}

export async function saveUploadFolders(saved: SavedUploadFolders): Promise<SavedUploadFolders> {
    const next = normalizeUploadFolders(saved);
    await writeStoredValue(UPLOAD_FOLDERS_STORAGE_KEY, next);
    return next;
}

export function recordApprovedFolder(folder: DriveFolder, select = false): Promise<SavedUploadFolders> {
    return enqueueFolderWrite(async () => {
        const current = await loadUploadFolders();
        const folders = rememberFolder(current.folders, folder);
        const savedFolder = folders.find((entry) => entry.id === folder.id);
        return saveUploadFolders({
            folders,
            selectedId: select && savedFolder ? savedFolder.id : current.selectedId,
        });
    });
}

export function pickedFolders(incoming: DriveFolder[]): DriveFolder[] {
    const next: DriveFolder[] = [];
    for (const folder of incoming) {
        const normalized = normalizeUploadFolder(folder);
        if (!normalized || next.some((entry) => entry.id === normalized.id)) {
            continue;
        }
        next.push(normalized);
        if (next.length >= MAX_APPROVED_FOLDERS) {
            break;
        }
    }
    return next;
}

export function recordApprovedFolders(incoming: DriveFolder[]): Promise<SavedUploadFolders> {
    return enqueueFolderWrite(async () => {
        const current = await loadUploadFolders();
        const folders = pickedFolders(incoming);
        const selectedId = current.selectedId && folders.some((folder) => folder.id === current.selectedId)
            ? current.selectedId
            : null;
        return saveUploadFolders({ folders, selectedId });
    });
}

export function forgetApprovedFolder(folderId: string): Promise<SavedUploadFolders> {
    return enqueueFolderWrite(async () => {
        const current = await loadUploadFolders();
        return saveUploadFolders({
            folders: current.folders.filter((folder) => folder.id !== folderId),
            selectedId: current.selectedId === folderId ? null : current.selectedId,
        });
    });
}

export async function selectUploadFolder(folder: DriveFolder | null): Promise<SavedUploadFolders> {
    if (!folder) {
        return enqueueFolderWrite(async () => {
            const current = await loadUploadFolders();
            return saveUploadFolders({ folders: current.folders, selectedId: null });
        });
    }
    return recordApprovedFolder(folder, true);
}
