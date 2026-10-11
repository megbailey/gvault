import React, { useCallback, useEffect, useState } from "react";
import getAccessToken, { refreshAccessToken } from "../utils/getAccessToken";
import { ensureGrantedFolder, isAccessTokenRejection, isFolderAccessRejection } from "../utils/folderAccess";
import {
    listDriveFolders,
    listDriveVaultFiles,
    MY_DRIVE_ROOT,
    type DriveFile,
    type DriveFolder,
} from "../utils/driveFolder";
import { openDrivePicker, PickerCancelledError } from "../utils/openDrivePicker";
import { vaultFileItems, type PickerResultRecord } from "../utils/pickerProtocol";
import { usePickerResult } from "../utils/usePickerResult";
import { forgetApprovedFolder, foldersAt, loadUploadFolders, isDefaultFolderName } from "../utils/uploadDestination";
import { DEFAULT_ENCRYPTED_FOLDER_NAME, loadSettings } from "../utils/settings";
import ApprovedFolderTree from "./ApprovedFolderTree";
import { FileIcon } from "./icons";

export type VaultPickerSelection =
    | { kind: "file"; file: DriveFile }
    | { kind: "files"; files: DriveFile[] }
    | { kind: "folder"; folder: DriveFolder };

function selectionFromRecord(record: PickerResultRecord): {
    selection: VaultPickerSelection | null;
    error: string | null;
    note: string | null;
} {
    if (record.cancelled) {
        return { selection: null, error: "Drive file choice was cancelled.", note: null };
    }
    if (record.error) {
        return { selection: null, error: record.error, note: null };
    }

    const { files, skipped } = vaultFileItems(record.items ?? []);
    if (files.length === 0) {
        return { selection: null, error: "Choose one or more .gvault files.", note: null };
    }

    const selection = files.length === 1
        ? { kind: "file" as const, file: { id: files[0].id, name: files[0].name } }
        : { kind: "files" as const, files: files.map((file) => ({ id: file.id, name: file.name })) };
    const note = skipped > 0
        ? `Skipped ${skipped} item${skipped === 1 ? "" : "s"} that ${skipped === 1 ? "is" : "are"} not .gvault files.`
        : null;
    return { selection, error: null, note };
}

type VaultFilePickerProps = {
    selected: VaultPickerSelection | null;
    onSelect: (selection: VaultPickerSelection | null) => void;
};

const VaultFilePicker = ({ selected, onSelect }: VaultFilePickerProps) => {
    const [open, setOpen] = useState(false);
    const [path, setPath] = useState<DriveFolder[]>([MY_DRIVE_ROOT]);
    const [folders, setFolders] = useState<DriveFolder[]>([]);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
    const [token, setToken] = useState<string | null>(null);
    const [openingDrive, setOpeningDrive] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const [approvedFolders, setApprovedFolders] = useState<DriveFolder[]>([]);
    const [defaultFolderName, setDefaultFolderName] = useState(DEFAULT_ENCRYPTED_FOLDER_NAME);

    const currentFolder = path[path.length - 1] ?? MY_DRIVE_ROOT;
    const isSearching = debouncedSearch.trim().length > 0;
    const displayName = selected?.kind === "file"
        ? selected.file.name
        : selected?.kind === "files"
            ? `${selected.files.length} .gvault files`
            : selected?.kind === "folder"
                ? selected.folder.name
                : "Select a .gvault file or folder";
    const defaultFolder = [...approvedFolders, ...folders].find((folder) => isDefaultFolderName(folder.name, defaultFolderName)) ?? null;
    const defaultSelected = selected?.kind === "folder" && (
        selected.folder.id === defaultFolder?.id || isDefaultFolderName(selected.folder.name, defaultFolderName)
    );

    const applyRecord = (record: PickerResultRecord) => {
        const result = selectionFromRecord(record);
        if (result.selection) {
            onSelect(result.selection);
            setOpen(false);
            setSearch("");
        }
        setError(result.error);
        setNote(result.note);
    };

    usePickerResult("decrypt-files", applyRecord);

    useEffect(() => {
        loadSettings().then((settings) => setDefaultFolderName(settings.encryptedFolderName));
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        loadUploadFolders().then((saved) => setApprovedFolders(saved.folders));
    }, [open]);

    const dropMissingFolder = (folder: DriveFolder) => {
        setApprovedFolders((current) => current.filter((entry) => entry.id !== folder.id));
        void forgetApprovedFolder(folder.id);
    };

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
        return () => window.clearTimeout(timeout);
    }, [search]);

    const fetchItems = useCallback(async (authToken: string, pageToken?: string) => {
        if (isSearching) {
            const result = await listDriveVaultFiles(authToken, {
                search: debouncedSearch,
                pageToken,
            });
            return {
                folders: [] as DriveFolder[],
                files: result.files,
                nextPageToken: result.nextPageToken,
            };
        }

        const [folderResult, fileResult] = await Promise.all([
            pageToken
                ? Promise.resolve({ folders: [] as DriveFolder[], nextPageToken: undefined })
                : listDriveFolders(authToken, { parentId: currentFolder.id }),
            listDriveVaultFiles(authToken, {
                parentId: currentFolder.id,
                pageToken,
            }),
        ]);

        return {
            folders: pageToken ? undefined : folderResult.folders,
            files: fileResult.files,
            nextPageToken: fileResult.nextPageToken,
        };
    }, [currentFolder.id, debouncedSearch, isSearching]);

    const loadItems = useCallback(async (authToken: string, pageToken?: string) => {
        setLoading(true);
        setError(null);
        try {
            let result;
            try {
                result = await fetchItems(authToken, pageToken);
            } catch (loadError) {
                const message = loadError instanceof Error ? loadError.message : "Could not load Drive files.";
                if (isAccessTokenRejection(loadError)) {
                    const freshToken = await refreshAccessToken(authToken);
                    setToken(freshToken);
                    result = await fetchItems(freshToken, pageToken);
                } else if (isFolderAccessRejection(loadError) && currentFolder.id !== MY_DRIVE_ROOT.id) {
                    const granted = await ensureGrantedFolder({
                        token: authToken,
                        folder: currentFolder,
                        target: "decrypt-files",
                    });
                    if (granted.missing) {
                        dropMissingFolder(currentFolder);
                        throw new Error(`${currentFolder.name} is no longer in Drive, so it was removed from this list.`);
                    }
                    if (granted.approved?.length) {
                        setApprovedFolders(granted.approved);
                    }
                    setToken(granted.token);
                    result = await fetchItems(granted.token, pageToken);
                } else {
                    throw loadError;
                }
            }

            if (result.folders) {
                setFolders(result.folders);
            }
            setFiles((current) => pageToken ? [...current, ...result.files] : result.files);
            setNextPageToken(result.nextPageToken);
        } catch (loadError) {
            setFolders([]);
            setFiles([]);
            setError(loadError instanceof Error ? loadError.message : "Could not load Drive files.");
        } finally {
            setLoading(false);
        }
    }, [fetchItems]);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const authToken = token ?? await getAccessToken();
                if (cancelled) {
                    return;
                }
                setToken(authToken);
                await loadItems(authToken);
            } catch (authError) {
                if (!cancelled) {
                    setError(authError instanceof Error ? authError.message : "Google sign-in is required.");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, loadItems, token]);

    const chooseFile = (file: DriveFile) => {
        onSelect({ kind: "file", file });
        setOpen(false);
        setSearch("");
        setNote(null);
    };

    const chooseFolder = async (folder: DriveFolder) => {
        if (folder.id === MY_DRIVE_ROOT.id) {
            onSelect({ kind: "folder", folder });
            setOpen(false);
            setSearch("");
            setNote(null);
            return;
        }

        setOpeningDrive(true);
        setError(null);
        try {
            const authToken = token ?? await getAccessToken();
            setToken(authToken);
            const granted = await ensureGrantedFolder({
                token: authToken,
                folder,
                target: "decrypt-files",
            });
            if (granted.missing) {
                dropMissingFolder(folder);
                setError(`${folder.name} is no longer in Drive, so it was removed from this list.`);
                return;
            }
            if (granted.approved?.length) {
                setApprovedFolders(granted.approved);
            }
            onSelect({ kind: "folder", folder: granted.folder });
            setOpen(false);
            setSearch("");
            setNote(null);
        } catch (chooseError) {
            if (chooseError instanceof PickerCancelledError) {
                setError("Folder choice was cancelled.");
            } else {
                setError(chooseError instanceof Error ? chooseError.message : "Could not open that folder.");
            }
        } finally {
            setOpeningDrive(false);
        }
    };

    const openFromDrive = async () => {
        setOpeningDrive(true);
        setError(null);
        setNote(null);
        try {
            applyRecord(await openDrivePicker({ mode: "files", target: "decrypt-files" }));
        } catch (browseError) {
            if (browseError instanceof PickerCancelledError) {
                setError("Drive file choice was cancelled.");
            } else {
                setError(browseError instanceof Error ? browseError.message : "Could not open Google Drive.");
            }
        } finally {
            setOpeningDrive(false);
        }
    };

    return (
        <div className="folder-picker">
            <div className="folder-picker__row">
                <button
                    type="button"
                    className="folder-picker__side-icon"
                    aria-label={open ? "Close file picker" : "Choose a .gvault file or folder"}
                    aria-expanded={open}
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    <FileIcon />
                </button>
                <button
                    type="button"
                    className="folder-picker__trigger"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-labelledby="decryptFileLabel"
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    <span className="folder-picker__name">{displayName}</span>
                    <span className="folder-picker__action">{openingDrive ? "Opening…" : open ? "Close" : "Change"}</span>
                </button>
            </div>
            {note && <p className="field__help">{note}</p>}

            {open && (
                <div className="folder-picker__panel" role="dialog" aria-label="Choose a .gvault file or folder">
                    <input
                        className="field__input"
                        type="search"
                        placeholder="Search by file name"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    {error && <p className="folder-picker__error">{error}</p>}
                    {loading && files.length === 0 && (
                        <p className="settings-status">Loading files…</p>
                    )}
                    {!loading && !error && files.length === 0 && (path.length > 1 ? foldersAt(approvedFolders, currentFolder.id).length === 0 : approvedFolders.length === 0) && (
                        <p className="settings-status">No .gvault files GVault can see here. Choose another folder to view its contents.</p>
                    )}

                    <ApprovedFolderTree
                        folders={approvedFolders}
                        defaultFolderName={defaultFolderName}
                        path={path}
                        onPathChange={(next) => {
                            setPath(next);
                            setSearch("");
                        }}
                        selectedId={selected?.kind === "folder" ? selected.folder.id : null}
                        defaultSelected={defaultSelected}
                        showFolders={!isSearching}
                        onChoose={(folder) => {
                            if (!folder) {
                                if (!defaultFolder) {
                                    setError(`${defaultFolderName} is not in Drive yet. Its name stays available as the default.`);
                                    return;
                                }
                                void chooseFolder(defaultFolder);
                                return;
                            }
                            void chooseFolder(folder);
                        }}
                        trailing={files.map((file) => (
                            <li key={file.id} className="folder-picker__item">
                                <button
                                    type="button"
                                    className="folder-picker__item-main"
                                    onClick={() => chooseFile(file)}
                                >
                                    <FileIcon />
                                    <span>{file.name}</span>
                                </button>
                            </li>
                        ))}
                    />

                    {nextPageToken && token && (
                        <button
                            type="button"
                            className="field__text-button"
                            onClick={() => loadItems(token, nextPageToken)}
                        >
                            Load more
                        </button>
                    )}

                    <div className="folder-picker__footer">
                        {!isSearching && (
                            <button
                                type="button"
                                className="field__text-button"
                                onClick={() => chooseFolder(currentFolder)}
                            >
                                Decrypt this folder ({currentFolder.name})
                            </button>
                        )}
                        <button
                            type="button"
                            className="folder-picker__reset"
                            onClick={openFromDrive}
                            disabled={openingDrive}
                        >
                            {openingDrive ? "Opening Google Drive…" : "Choose another folder"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VaultFilePicker;
