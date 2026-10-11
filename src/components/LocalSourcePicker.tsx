import React from "react";
import Dropzone from "@megbailey/ui/dropzone";
import { relativePathForFile, summarizeInterceptedUpload } from "../utils/drivePage";

type LocalSourcePickerProps = {
    files: File[];
    onChange: (files: File[]) => void;
    disabled?: boolean;
};

const PREVIEW_LIMIT = 6;

const LocalSourcePicker = ({ files, onChange, disabled }: LocalSourcePickerProps) => {
    const summary = summarizeInterceptedUpload(files);

    return (
        <div className="field">
            <Dropzone
                label="Files or folder"
                helperText="Drop files or a folder here, or choose them below. Folders keep their structure on Drive."
                accept="any"
                isMulti
                allowDirectories
                disabled={disabled}
                files={files}
                onFilesChange={onChange}
                chooseFilesLabel="Choose files"
                chooseFolderLabel="Choose folder"
                clearLabel="Clear"
            />
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
