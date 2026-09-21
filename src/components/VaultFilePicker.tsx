import React, { useCallback, useEffect, useState } from "react";
import getAccessToken, { refreshAccessToken } from "../utils/getAccessToken";
import {
    listDriveFolders,
    listDriveVaultFiles,
    MY_DRIVE_ROOT,
    type DriveFile,
    type DriveFolder,
} from "../utils/driveFolder";
import { ChevronIcon, FileIcon, FolderIcon } from "./icons";

export type VaultPickerSelection =
    | { kind: "file"; file: DriveFile }
    | { kind: "folder"; folder: DriveFolder };

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

    const currentFolder = path[path.length - 1] ?? MY_DRIVE_ROOT;
    const isSearching = debouncedSearch.trim().length > 0;
    const displayName = selected?.kind === "file"
        ? selected.file.name
        : selected?.kind === "folder"
            ? selected.folder.name
            : "Select a .gvault file or folder";

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
                if (/401|403|insufficient|auth/i.test(message) && authToken) {
                    const freshToken = await refreshAccessToken(authToken);
                    setToken(freshToken);
                    result = await fetchItems(freshToken, pageToken);
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
    };

    const chooseFolder = (folder: DriveFolder) => {
        onSelect({ kind: "folder", folder });
        setOpen(false);
        setSearch("");
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
                    <span className="folder-picker__action">{open ? "Close" : "Browse"}</span>
                </button>
            </div>
            <p className="field__help">
                {selected?.kind === "folder"
                    ? "Every .gvault file in this folder and its subfolders will be decrypted."
                    : "Select a .gvault file, or open a folder and choose Decrypt this folder."}
            </p>

            {open && (
                <div className="folder-picker__panel" role="dialog" aria-label="Choose a .gvault file or folder">
                    <input
                        className="field__input"
                        type="search"
                        placeholder="Search by file name"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    {!isSearching && (
                        <nav className="folder-picker__crumbs" aria-label="Folder path">
                            {path.map((folder, index) => (
                                <button
                                    key={`${folder.id}-${index}`}
                                    type="button"
                                    className="folder-picker__crumb"
                                    onClick={() => setPath(path.slice(0, index + 1))}
                                >
                                    {folder.name}
                                </button>
                            ))}
                        </nav>
                    )}

                    {error && <p className="folder-picker__error">{error}</p>}
                    {loading && folders.length === 0 && files.length === 0 && (
                        <p className="settings-status">Loading files…</p>
                    )}
                    {!loading && !error && folders.length === 0 && files.length === 0 && (
                        <p className="settings-status">No .gvault files found here.</p>
                    )}

                    <ul className="folder-picker__list">
                        {folders.map((folder) => (
                            <li key={folder.id} className="folder-picker__item">
                                <button
                                    type="button"
                                    className="folder-picker__item-main"
                                    onClick={() => {
                                        setPath([...path, folder]);
                                        setSearch("");
                                    }}
                                >
                                    <FolderIcon />
                                    <span>{folder.name}</span>
                                </button>
                                <button
                                    type="button"
                                    className="folder-picker__open"
                                    aria-label={`Open ${folder.name}`}
                                    onClick={() => {
                                        setPath([...path, folder]);
                                        setSearch("");
                                    }}
                                >
                                    <ChevronIcon />
                                </button>
                            </li>
                        ))}
                        {files.map((file) => (
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
                    </ul>

                    {nextPageToken && token && (
                        <button
                            type="button"
                            className="field__text-button"
                            onClick={() => loadItems(token, nextPageToken)}
                        >
                            Load more
                        </button>
                    )}

                    {!isSearching && (
                        <div className="folder-picker__footer">
                            <button
                                type="button"
                                className="field__text-button"
                                onClick={() => chooseFolder(currentFolder)}
                            >
                                Decrypt this folder ({currentFolder.name})
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VaultFilePicker;
