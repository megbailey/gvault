import React, { useCallback, useEffect, useState } from "react";
import getAccessToken, { refreshAccessToken } from "../utils/getAccessToken";
import {
    listDriveFolders,
    MY_DRIVE_ROOT,
    type DriveFolder,
} from "../utils/driveFolder";
import { ChevronIcon, FolderIcon } from "./icons";

type FolderPickerProps = {
    defaultFolderName: string;
    selectedFolder: DriveFolder | null;
    onSelect: (folder: DriveFolder | null) => void;
};

const FolderPicker = ({ defaultFolderName, selectedFolder, onSelect }: FolderPickerProps) => {
    const [open, setOpen] = useState(false);
    const [path, setPath] = useState<DriveFolder[]>([MY_DRIVE_ROOT]);
    const [folders, setFolders] = useState<DriveFolder[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
    const [token, setToken] = useState<string | null>(null);

    const currentFolder = path[path.length - 1] ?? MY_DRIVE_ROOT;
    const isSearching = debouncedSearch.trim().length > 0;
    const displayName = selectedFolder?.name ?? defaultFolderName;

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
        return () => window.clearTimeout(timeout);
    }, [search]);

    const loadFolders = useCallback(async (authToken: string, pageToken?: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listDriveFolders(authToken, {
                parentId: currentFolder.id,
                search: debouncedSearch,
                pageToken,
            });
            setFolders((current) => pageToken ? [...current, ...result.folders] : result.folders);
            setNextPageToken(result.nextPageToken);
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Could not load Drive folders.";
            if (/401|403|insufficient|auth/i.test(message) && authToken) {
                try {
                    const freshToken = await refreshAccessToken(authToken);
                    setToken(freshToken);
                    const result = await listDriveFolders(freshToken, {
                        parentId: currentFolder.id,
                        search: debouncedSearch,
                    });
                    setFolders(result.folders);
                    setNextPageToken(result.nextPageToken);
                    setError(null);
                    return;
                } catch {
                    // Fall through to the original error.
                }
            }
            setFolders([]);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [currentFolder.id, debouncedSearch]);

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
                await loadFolders(authToken);
            } catch (authError) {
                if (!cancelled) {
                    setError(authError instanceof Error ? authError.message : "Google sign-in is required.");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, loadFolders, token]);

    const chooseFolder = (folder: DriveFolder | null) => {
        onSelect(folder);
        setOpen(false);
        setSearch("");
    };

    return (
        <div className="folder-picker">
            <div className="folder-picker__row">
                <button
                    type="button"
                    className="folder-picker__side-icon"
                    aria-label={open ? "Close folder picker" : "Choose a Google Drive folder"}
                    aria-expanded={open}
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    <FolderIcon />
                </button>
                <button
                    type="button"
                    className="folder-picker__trigger"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-labelledby="uploadDestinationLabel"
                    onClick={() => setOpen((isOpen) => !isOpen)}
                >
                    <span className="folder-picker__name">{displayName}</span>
                    <span className="folder-picker__action">{open ? "Close" : "Browse"}</span>
                </button>
            </div>
            <p className="field__help">
                {selectedFolder
                    ? "Uploads go to the Drive folder you selected."
                    : `Default is ${defaultFolderName}, created on first upload if needed.`}
            </p>

            {open && (
                <div className="folder-picker__panel" role="dialog" aria-label="Choose a Google Drive folder">
                    <input
                        className="field__input"
                        type="search"
                        placeholder="Search folders"
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
                    {loading && folders.length === 0 && <p className="settings-status">Loading folders…</p>}
                    {!loading && !error && folders.length === 0 && (
                        <p className="settings-status">No folders found here.</p>
                    )}

                    <ul className="folder-picker__list">
                        {folders.map((folder) => (
                            <li key={folder.id} className="folder-picker__item">
                                <button
                                    type="button"
                                    className="folder-picker__item-main"
                                    onClick={() => chooseFolder(folder)}
                                >
                                    <FolderIcon />
                                    <span>{folder.name}</span>
                                </button>
                                {!isSearching && (
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
                                )}
                            </li>
                        ))}
                    </ul>

                    {nextPageToken && token && (
                        <button
                            type="button"
                            className="field__text-button"
                            onClick={() => loadFolders(token, nextPageToken)}
                        >
                            Load more
                        </button>
                    )}

                    <div className="folder-picker__footer">
                        {!isSearching && (
                            <button
                                type="button"
                                className="field__text-button"
                                onClick={() => chooseFolder(currentFolder.id === MY_DRIVE_ROOT.id ? MY_DRIVE_ROOT : currentFolder)}
                            >
                                Use {currentFolder.name}
                            </button>
                        )}
                        {selectedFolder && (
                            <button
                                type="button"
                                className="folder-picker__reset"
                                onClick={() => chooseFolder(null)}
                            >
                                Use default ({defaultFolderName})
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FolderPicker;
