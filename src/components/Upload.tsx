import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import getAccessToken, { refreshAccessToken } from "../utils/getAccessToken";
import { encryptAndUploadFiles } from "../utils/encryptUpload";
import { ensureDriveFolder, type DriveFolder } from "../utils/driveFolder";
import { ensureGrantedFolder, isAccessTokenRejection, isFolderAccessRejection } from "../utils/folderAccess";
import { PickerCancelledError } from "../utils/openDrivePicker";
import { loadUploadFolders, rememberFolder, selectUploadFolder } from "../utils/uploadDestination";
import {
    isDirectoryUpload,
    summarizeInterceptedUpload,
    validateInterceptedFiles,
} from "../utils/drivePage";
import FolderPicker from "./FolderPicker";
import LocalSourcePicker from "./LocalSourcePicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import {
    DEFAULT_ENCRYPTED_FOLDER_NAME,
    DEFAULT_SETTINGS,
    loadSettings,
    validatePassphrase,
    type ExtensionSettings,
} from "../utils/settings";
import {
    formatFileSizeLimit,
    MAX_DRIVE_FOLDER_FILES,
    MAX_DRIVE_INTERCEPT_FILES,
    MAX_FILE_SIZE,
} from "../utils/limits";
import type { VaultProgress } from "../utils/fileVault";

const Upload = () => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [approvedFolders, setApprovedFolders] = useState<DriveFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<VaultProgress | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const destinationTouched = useRef(false);

    useEffect(() => {
        loadSettings().then(setSettings);
        loadUploadFolders().then((saved) => {
            if (destinationTouched.current) {
                return;
            }
            setApprovedFolders(saved.folders);
            setSelectedFolder(saved.folders.find((folder) => folder.id === saved.selectedId) ?? null);
        });
    }, []);

    const onSelectFolder = (folder: DriveFolder | null) => {
        destinationTouched.current = true;
        setApprovedFolders((current) => folder ? rememberFolder(current, folder) : current);
        setSelectedFolder(folder);
        void selectUploadFolder(folder);
    };

    const folderName = settings?.encryptedFolderName || DEFAULT_ENCRYPTED_FOLDER_NAME;
    const currentSettings = settings ?? DEFAULT_SETTINGS;
    const passphraseError = validatePassphrase(passphrase, currentSettings);
    const summary = useMemo(() => summarizeInterceptedUpload(pendingFiles), [pendingFiles]);
    const maxFiles = isDirectoryUpload(pendingFiles) ? MAX_DRIVE_FOLDER_FILES : MAX_DRIVE_INTERCEPT_FILES;
    const selectionError = pendingFiles.length
        ? validateInterceptedFiles(pendingFiles, {
            maxFileSize: MAX_FILE_SIZE,
            maxFiles,
        })
        : null;
    const selectionErrorMessage = selectionError && !selectionError.ok
        ? (selectionError.reason === "too-large"
            ? `Each file must be ${formatFileSizeLimit()} or smaller.`
            : selectionError.reason === "too-many"
                ? `Upload up to ${maxFiles} files at a time.`
                : "Select a file or folder first.")
        : null;

    const onFilesChange = useCallback((files: File[]) => {
        setPendingFiles(files);
        setStatusMessage(null);
    }, []);

    const onSubmitPendingFile = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pendingFiles.length === 0) {
            setStatusMessage("Select a file or folder first.");
            return;
        }
        if (selectionErrorMessage) {
            setStatusMessage(selectionErrorMessage);
            return;
        }
        if (passphraseError) {
            setStatusMessage(passphraseError);
            return;
        }

        setIsEncrypting(true);
        setStatusMessage(null);
        setProgress(null);
        setCurrentIndex(0);
        try {
            const loadedSettings = settings ?? await loadSettings();
            let token = await getAccessToken();
            let parentFolderId: string;
            let regranted = false;
            if (selectedFolder) {
                const granted = await ensureGrantedFolder({
                    token,
                    folder: selectedFolder,
                    target: "upload-folder",
                });
                if (granted.missing) {
                    setStatusMessage(`${selectedFolder.name} is no longer in Drive. Its name stays in your folder list.`);
                    return;
                }
                token = granted.token;
                parentFolderId = granted.folder.id;
                regranted = granted.regranted;
                onSelectFolder(granted.folder);
            } else {
                try {
                    parentFolderId = await ensureDriveFolder(token, loadedSettings.encryptedFolderName);
                } catch (error) {
                    if (!isAccessTokenRejection(error)) {
                        throw error;
                    }
                    token = await refreshAccessToken(token);
                    parentFolderId = await ensureDriveFolder(token, loadedSettings.encryptedFolderName);
                }
            }

            const upload = (accessToken: string, destinationFolderId: string) => encryptAndUploadFiles({
                files: pendingFiles,
                passphrase,
                token: accessToken,
                destinationFolderId,
                onProgress: setProgress,
                onFile: (index) => setCurrentIndex(index),
            });

            try {
                await upload(token, parentFolderId);
            } catch (error) {
                if (isAccessTokenRejection(error)) {
                    token = await refreshAccessToken(token);
                    await upload(token, parentFolderId);
                } else if (!regranted && isFolderAccessRejection(error)) {
                    const granted = await ensureGrantedFolder({
                        token,
                        folder: selectedFolder ?? { id: parentFolderId, name: loadedSettings.encryptedFolderName },
                        target: "upload-folder",
                    });
                    onSelectFolder(granted.folder);
                    await upload(granted.token, granted.folder.id);
                } else {
                    throw error;
                }
            }

            setPendingFiles([]);
            setStatusMessage(
                summary.isFolder && summary.rootNames.length === 1
                    ? `Uploaded ${summary.rootNames[0]} to Google Drive.`
                    : "Uploaded to Google Drive."
            );
        } catch (error) {
            const message = error instanceof PickerCancelledError
                ? "Upload cancelled. GVault needs permission for that folder before it can add encrypted files."
                : error instanceof Error ? error.message : "Upload failed.";
            setStatusMessage(message);
        } finally {
            setIsEncrypting(false);
            setProgress(null);
        }
    };

    return (
        <form className="upload-form" onSubmit={onSubmitPendingFile}>
            <LocalSourcePicker
                files={pendingFiles}
                onChange={onFilesChange}
                disabled={isEncrypting}
            />

            <div className="field">
                <label className="field__label" htmlFor="passphrase">
                    Security passphrase
                </label>
                <div className="field__input-wrap">
                    <input
                        className="field__input"
                        type={showPassphrase ? "text" : "password"}
                        id="passphrase"
                        placeholder="Enter passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        className="field__visibility"
                        onClick={() => setShowPassphrase((visible) => !visible)}
                        aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                        aria-pressed={showPassphrase}
                    >
                        {showPassphrase ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
            </div>

            <div className="field">
                <span className="field__label" id="uploadDestinationLabel">
                    Upload destination
                </span>
                <FolderPicker
                    defaultFolderName={folderName}
                    approvedFolders={approvedFolders}
                    selectedFolder={selectedFolder}
                    onSelect={onSelectFolder}
                />
            </div>

            <div className="field">
                <button
                    className="primary-button"
                    type="submit"
                    disabled={isEncrypting || pendingFiles.length === 0 || Boolean(passphraseError) || Boolean(selectionErrorMessage)}
                >
                    {isEncrypting
                        ? pendingFiles.length > 1
                            ? `Working… ${currentIndex + 1}/${pendingFiles.length}`
                            : "Working…"
                        : "Encrypt & Upload"}
                </button>
                <ProgressBar progress={progress} />
                {pendingFiles.length === 0 && (
                    <p className="field__help">Select a file or folder, then click Encrypt & Upload.</p>
                )}
                {selectionErrorMessage && (
                    <p className="field__help">{selectionErrorMessage}</p>
                )}
                {pendingFiles.length > 0 && !selectionErrorMessage && passphraseError && (
                    <p className="field__help">{passphraseError}</p>
                )}
            </div>

            {statusMessage && !passphraseError && (
                <p className={statusMessage.startsWith("Uploaded") ? "field__help" : "folder-picker__error"}>
                    {statusMessage}
                </p>
            )}
        </form>
    );
};

export default Upload;
