import React, { useState } from "react";
import { openDrivePicker, PickerCancelledError } from "../utils/openDrivePicker";
import { folderItem, type PickerResultRecord } from "../utils/pickerProtocol";
import { usePickerResult } from "../utils/usePickerResult";
import type { DriveFolder } from "../utils/driveFolder";
import { FolderIcon } from "./icons";

type FolderPickerProps = {
    defaultFolderName: string;
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

const FolderPicker = ({ defaultFolderName, selectedFolder, onSelect }: FolderPickerProps) => {
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const displayName = selectedFolder?.name ?? defaultFolderName;

    const applyRecord = (record: PickerResultRecord) => {
        const result = folderFromRecord(record);
        if (result.folder) {
            onSelect(result.folder);
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

    return (
        <div className="folder-picker">
            <div className="folder-picker__row">
                <button
                    type="button"
                    className="folder-picker__side-icon"
                    aria-label="Choose a Google Drive folder"
                    onClick={browse}
                    disabled={opening}
                >
                    <FolderIcon />
                </button>
                <button
                    type="button"
                    className="folder-picker__trigger"
                    aria-haspopup="dialog"
                    aria-labelledby="uploadDestinationLabel"
                    onClick={browse}
                    disabled={opening}
                >
                    <span className="folder-picker__name">{displayName}</span>
                    <span className="folder-picker__action">{opening ? "Opening…" : "Browse"}</span>
                </button>
            </div>
            <p className="field__help">
                {selectedFolder
                    ? "Uploads go to this Drive folder. GVault can add .gvault files there because you selected it."
                    : `Default is ${defaultFolderName}, created on first upload if needed. Browse to choose any other Drive folder.`}
            </p>
            {error && <p className="folder-picker__error">{error}</p>}
            {selectedFolder && (
                <button
                    type="button"
                    className="folder-picker__reset"
                    onClick={() => {
                        onSelect(null);
                        setError(null);
                    }}
                >
                    Use default ({defaultFolderName})
                </button>
            )}
        </div>
    );
};

export default FolderPicker;
