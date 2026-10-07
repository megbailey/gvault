import React, { useEffect, useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { ensureGrantedFolder } from "../utils/folderAccess";
import { openDrivePicker, PickerCancelledError } from "../utils/openDrivePicker";
import { type PickerResultRecord } from "../utils/pickerProtocol";
import { usePickerResult } from "../utils/usePickerResult";
import { MY_DRIVE_ROOT, type DriveFolder } from "../utils/driveFolder";
import { foldersFromPickerItems } from "../utils/uploadDestination";
import ApprovedFolderTree from "./ApprovedFolderTree";
import { FolderIcon } from "./icons";

type FolderPickerProps = {
    defaultFolderName: string;
    approvedFolders: DriveFolder[];
    selectedFolder: DriveFolder | null;
    onSelect: (folder: DriveFolder | null, approved?: DriveFolder[]) => void;
    onRemove: (folder: DriveFolder) => void;
    onOpen?: () => void;
};

function foldersFromRecord(record: PickerResultRecord): { folders: DriveFolder[]; error: string | null } {
    if (record.cancelled) {
        return { folders: [], error: "Folder choice was cancelled." };
    }
    if (record.error) {
        return { folders: [], error: record.error };
    }
    const folders = foldersFromPickerItems(record.items ?? []);
    if (folders.length === 0) {
        return { folders: [], error: "Select a Google Drive folder." };
    }
    return { folders, error: null };
}

const FolderPicker = ({
    defaultFolderName,
    approvedFolders,
    selectedFolder,
    onSelect,
    onRemove,
    onOpen,
}: FolderPickerProps) => {
    const [open, setOpen] = useState(false);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [path, setPath] = useState<DriveFolder[]>([MY_DRIVE_ROOT]);
    const displayName = selectedFolder?.name ?? defaultFolderName;

    useEffect(() => {
        if (!open) {
            setPath([MY_DRIVE_ROOT]);
            return;
        }
        onOpen?.();
    }, [open, onOpen]);

    const applyRecord = (record: PickerResultRecord) => {
        const result = foldersFromRecord(record);
        if (result.folders.length > 0) {
            onSelect(result.folders[0], result.folders);
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
                onRemove(folder);
                setError(`${folder.name} is no longer in Drive, so it was removed from this list.`);
                return;
            }
            onSelect(granted.folder, granted.approved);
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
                    <ApprovedFolderTree
                        folders={approvedFolders}
                        defaultFolderName={defaultFolderName}
                        path={path}
                        onPathChange={setPath}
                        selectedId={selectedFolder?.id ?? null}
                        defaultSelected={!selectedFolder}
                        onChoose={(folder) => {
                            void chooseSaved(folder);
                        }}
                    />
                    <div className="folder-picker__footer">
                        <button type="button" className="folder-picker__reset" onClick={browse} disabled={opening}>
                            Choose another folder
                        </button>
                    </div>
                </div>
            )}
            <p className="field__help">
                {approvedFolders.length > 0
                    ? "Folders from your last Drive selection can be used again without additional approval. A new selection replaces this list. Google asks again only if you choose a folder whose approval has expired."
                    : `Default is ${defaultFolderName}, created on first upload if needed. Google asks once for other folders, and this list keeps only that latest selection.`}
            </p>
            {error && <p className="folder-picker__error">{error}</p>}
        </div>
    );
};

export default FolderPicker;
