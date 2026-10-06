import React, { useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { ensureGrantedFolder } from "../utils/folderAccess";
import { openDrivePicker, PickerCancelledError } from "../utils/openDrivePicker";
import { folderItem, type PickerResultRecord } from "../utils/pickerProtocol";
import { usePickerResult } from "../utils/usePickerResult";
import type { DriveFolder } from "../utils/driveFolder";
import { foldersExceptDefault } from "../utils/uploadDestination";
import { FolderIcon } from "./icons";

type FolderPickerProps = {
    defaultFolderName: string;
    approvedFolders: DriveFolder[];
    selectedFolder: DriveFolder | null;
    onSelect: (folder: DriveFolder | null) => void;
};

function folderFromRecord(record: PickerResultRecord): { folder: DriveFolder | null; error: string | null } {
    if (record.cancelled) {
        return { folder: null, error: "Folder choice was cancelled." };
    }
    if (record.error) {
        return { folder: null, error: record.error };
    }
    const folder = folderItem(record.items ?? []);
    if (!folder) {
        return { folder: null, error: "Select a Google Drive folder." };
    }
    return { folder: { id: folder.id, name: folder.name }, error: null };
}

const FolderPicker = ({
    defaultFolderName,
    approvedFolders,
    selectedFolder,
    onSelect,
}: FolderPickerProps) => {
    const [open, setOpen] = useState(false);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const displayName = selectedFolder?.name ?? defaultFolderName;

    const applyRecord = (record: PickerResultRecord) => {
        const result = folderFromRecord(record);
        if (result.folder) {
            onSelect(result.folder);
            setOpen(false);
        }
        setError(result.error);
    };

    usePickerResult("upload-folder", applyRecord);

    const browse = async () => {
        setOpening(true);
        setError(null);
        try {
            applyRecord(await openDrivePicker({ mode: "folder", target: "upload-folder" }));
        } catch (browseError) {
            if (browseError instanceof PickerCancelledError) {
                setError("Folder choice was cancelled.");
            } else {
                setError(browseError instanceof Error ? browseError.message : "Could not open Google Drive.");
            }
        } finally {
            setOpening(false);
        }
    };

    const chooseSaved = async (folder: DriveFolder | null) => {
        if (!folder) {
            onSelect(null);
            setError(null);
            setOpen(false);
            return;
        }

        setOpening(true);
        setError(null);
        try {
            const token = await getAccessToken();
            const granted = await ensureGrantedFolder({
                token,
                folder,
                target: "upload-folder",
            });
            if (granted.missing) {
                setError(`${folder.name} is no longer in Drive. Its name stays in this list.`);
                return;
            }
            onSelect(granted.folder);
            setOpen(false);
        } catch (chooseError) {
            if (chooseError instanceof PickerCancelledError) {
                setError("Folder choice was cancelled.");
            } else {
                setError(chooseError instanceof Error ? chooseError.message : "Could not open that folder.");
            }
        } finally {
            setOpening(false);
        }
    };

    return (
        <div className="folder-picker">
            <div className="folder-picker__row">
                <button
                    type="button"
                    className="folder-picker__side-icon"
                    aria-label="Choose a Google Drive folder"
                    aria-expanded={open}
                    onClick={() => setOpen((current) => !current)}
                    disabled={opening}
                >
                    <FolderIcon />
                </button>
                <button
                    type="button"
                    className="folder-picker__trigger"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-labelledby="uploadDestinationLabel"
                    onClick={() => setOpen((current) => !current)}
                    disabled={opening}
                >
                    <span className="folder-picker__name">{displayName}</span>
                    <span className="folder-picker__action">{opening ? "Opening…" : open ? "Close" : "Change"}</span>
                </button>
            </div>
            {open && (
                <div className="folder-picker__panel" role="dialog" aria-label="Approved Drive folders">
                    <ul className="folder-picker__list">
                        <li className="folder-picker__item">
                            <button
                                type="button"
                                className={selectedFolder ? "folder-picker__item-main" : "folder-picker__item-main folder-picker__item-main--current"}
                                onClick={() => chooseSaved(null)}
                            >
                                <FolderIcon />
                                <span>Default ({defaultFolderName})</span>
                            </button>
                        </li>
                        {foldersExceptDefault(approvedFolders, defaultFolderName).map((folder) => (
                            <li key={folder.id} className="folder-picker__item">
                                <button
                                    type="button"
                                    className={selectedFolder?.id === folder.id
                                        ? "folder-picker__item-main folder-picker__item-main--current"
                                        : "folder-picker__item-main"}
                                    onClick={() => chooseSaved(folder)}
                                >
                                    <FolderIcon />
                                    <span>{folder.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="folder-picker__footer">
                        <button type="button" className="folder-picker__reset" onClick={browse} disabled={opening}>
                            Choose another folder
                        </button>
                    </div>
                </div>
            )}
            <p className="field__help">
                {approvedFolders.length > 0
                    ? "Approved folders can be used again without another approval. Google asks again only if you choose a folder whose approval has expired."
                    : `Default is ${defaultFolderName}, created on first upload if needed. Google asks once for any other folder, then it stays in this list.`}
            </p>
            {error && <p className="folder-picker__error">{error}</p>}
        </div>
    );
};

export default FolderPicker;
