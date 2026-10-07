import React from "react";
import { MY_DRIVE_ROOT, type DriveFolder } from "../utils/driveFolder";
import { foldersAt } from "../utils/uploadDestination";
import { ChevronIcon, FolderIcon } from "./icons";

type ApprovedFolderTreeProps = {
    folders: DriveFolder[];
    defaultFolderName: string;
    path: DriveFolder[];
    onPathChange: (path: DriveFolder[]) => void;
    selectedId?: string | null;
    defaultSelected?: boolean;
    onChoose: (folder: DriveFolder | null) => void;
    showFolders?: boolean;
    trailing?: React.ReactNode;
};

const ApprovedFolderTree = ({
    folders,
    defaultFolderName,
    path,
    onPathChange,
    selectedId,
    defaultSelected = false,
    onChoose,
    showFolders = true,
    trailing,
}: ApprovedFolderTreeProps) => {
    const current = path[path.length - 1] ?? MY_DRIVE_ROOT;
    const atRoot = current.id === MY_DRIVE_ROOT.id;
    const rows = foldersAt(folders, atRoot ? null : current.id, atRoot ? defaultFolderName : undefined);

    return (
        <>
            {showFolders && path.length > 1 && (
                <nav className="folder-picker__crumbs" aria-label="Folder path">
                    {path.map((folder, index) => (
                        <button
                            key={`${folder.id}-${index}`}
                            type="button"
                            className="folder-picker__crumb"
                            onClick={() => onPathChange(path.slice(0, index + 1))}
                        >
                            {folder.name}
                        </button>
                    ))}
                </nav>
            )}
            <ul className="folder-picker__list">
                {showFolders && atRoot && (
                    <li className="folder-picker__item">
                        <button
                            type="button"
                            className={defaultSelected
                                ? "folder-picker__item-main folder-picker__item-main--current"
                                : "folder-picker__item-main"}
                            onClick={() => onChoose(null)}
                        >
                            <FolderIcon />
                            <span>Default ({defaultFolderName})</span>
                        </button>
                    </li>
                )}
                {showFolders && rows.map((folder) => (
                    <li key={folder.id} className="folder-picker__item">
                        <button
                            type="button"
                            className={selectedId === folder.id
                                ? "folder-picker__item-main folder-picker__item-main--current"
                                : "folder-picker__item-main"}
                            onClick={() => onChoose(folder)}
                        >
                            <FolderIcon />
                            <span>{folder.name}</span>
                        </button>
                        <button
                            type="button"
                            className="folder-picker__open"
                            aria-label={`Browse ${folder.name}`}
                            onClick={() => onPathChange([...path, folder])}
                        >
                            <ChevronIcon />
                        </button>
                    </li>
                ))}
                {trailing}
            </ul>
        </>
    );
};

export default ApprovedFolderTree;
