import React, { useRef } from "react";
import { FileIcon, FolderIcon } from "./icons";
import { relativePathForFile, summarizeInterceptedUpload } from "../utils/drivePage";

type LocalSourcePickerProps = {
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
};

const PREVIEW_LIMIT = 6;

const LocalSourcePicker = ({ files, onChange, disabled }: LocalSourcePickerProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const summary = summarizeInterceptedUpload(files);

    const applyFileList = (list: FileList | null) => {
        onChange(Array.from(list ?? []));
    };

    return (
        <div className="field">
            <span className="field__label" id="localSourceLabel">
                Files or folder
            </span>
            <div
                className="local-picker"
                onDragOver={(event) => {
                    if (disabled || !event.dataTransfer.types.includes("Files")) {
                        return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                    if (disabled) {
                        return;
                    }
                    event.preventDefault();
                    applyFileList(event.dataTransfer.files);
                }}
            >
                <p className="field__help">
                    Drop files or a folder here, or choose them below. Folders keep their structure on Drive as encrypted .gvault files.
                </p>
                <div className="local-picker__actions">
                    <button
                        type="button"
                        className="field__text-button"
                        disabled={disabled}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileIcon />
                        Choose files
                    </button>
                    <button
                        type="button"
                        className="field__text-button"
                        disabled={disabled}
                        onClick={() => folderInputRef.current?.click()}
                    >
                        <FolderIcon />
                        Choose folder
                    </button>
                    {files.length > 0 && (
                        <button
                            type="button"
                            className="folder-picker__reset"
                            disabled={disabled}
                            onClick={() => onChange([])}
                        >
                            Clear
                        </button>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    className="local-picker__input"
                    type="file"
                    multiple
                    aria-labelledby="localSourceLabel"
                    disabled={disabled}
                    onChange={(event) => {
                        applyFileList(event.target.files);
                        event.target.value = "";
                    }}
                />
                <input
                    ref={folderInputRef}
                    className="local-picker__input"
                    type="file"
                    multiple
                    aria-labelledby="localSourceLabel"
                    disabled={disabled}
                    onChange={(event) => {
                        applyFileList(event.target.files);
                        event.target.value = "";
                    }}
                    {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                />
            </div>
            {files.length > 0 && (
                <ul className="drive-overlay__files">
                    {summary.isFolder && (
                        <li>
                            Folder: {summary.rootNames.join(", ")} ({summary.fileCount} files)
                        </li>
                    )}
                    {files.slice(0, PREVIEW_LIMIT).map((file, index) => (
                        <li key={`${index}-${file.name}`}>
                            {relativePathForFile(file)} → {file.name}.gvault
                        </li>
                    ))}
                    {files.length > PREVIEW_LIMIT && (
                        <li>and {files.length - PREVIEW_LIMIT} more</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default LocalSourcePicker;
