import React, { useCallback, useEffect, useRef, useState } from "react";
import { Form } from "informed";
import { Dropzone } from "@megbailey/ui";
import getAccessToken from "../utils/getAccessToken";
import uploadFile from "../utils/uploadFile";
import { packVaultFile, type VaultProgress } from "../utils/fileVault";
import { ensureDriveFolder, type DriveFolder } from "../utils/driveFolder";
import FolderPicker from "./FolderPicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import {
    DEFAULT_ENCRYPTED_FOLDER_NAME,
    DEFAULT_SETTINGS,
    loadSettings,
    validatePassphrase,
    type ExtensionSettings,
} from "../utils/settings";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const Upload = () => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);
    const [hasPendingFile, setHasPendingFile] = useState(false);
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<VaultProgress | null>(null);
    const pendingFileRef = useRef<File | null>(null);

    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    const folderName = settings?.encryptedFolderName || DEFAULT_ENCRYPTED_FOLDER_NAME;
    const currentSettings = settings ?? DEFAULT_SETTINGS;
    const passphraseError = validatePassphrase(passphrase, currentSettings);

    const encryptAndUpload = useCallback(
        async (file: File) => {
            const loadedSettings = settings ?? await loadSettings();
            const error = validatePassphrase(passphrase, loadedSettings);
            if (error) {
                throw new Error(error);
            }

            const vaultFile = await packVaultFile(file, passphrase, setProgress);
            const token = await getAccessToken();
            const parentFolderId = selectedFolder
                ? selectedFolder.id
                : await ensureDriveFolder(token, loadedSettings.encryptedFolderName);

            await uploadFile(token, vaultFile, parentFolderId, setProgress);
        },
        [passphrase, selectedFolder, settings]
    );

    const uploadFilePromise = useCallback(async (file: File) => {
        pendingFileRef.current = file;
        setHasPendingFile(true);
        setStatusMessage(null);
        return { src: file.name };
    }, []);

    const onSubmitPendingFile = async () => {
        const file = pendingFileRef.current;
        if (!file) {
            setStatusMessage("Select a document first.");
            return;
        }
        if (passphraseError) {
            setStatusMessage(passphraseError);
            return;
        }

        setIsEncrypting(true);
        setStatusMessage(null);
        setProgress(null);
        try {
            await encryptAndUpload(file);
            pendingFileRef.current = null;
            setHasPendingFile(false);
            setStatusMessage("Uploaded to Google Drive.");
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "Upload failed.");
        } finally {
            setIsEncrypting(false);
            setProgress(null);
        }
    };

    return (
        <Form className="upload-form" onSubmit={onSubmitPendingFile}>
            <Dropzone
                field="vaultFile"
                label="Select document"
                helperText="PDF, Word, Excel, PowerPoint, or CSV. Click Encrypt & Upload to encrypt locally and save as .gvault.json."
                accept="document"
                isRequired
                maxFileSize={MAX_FILE_SIZE}
                uploadsURL=""
                uploadFilePromise={uploadFilePromise}
                onItemRemove={() => {
                    pendingFileRef.current = null;
                    setHasPendingFile(false);
                    setStatusMessage(null);
                }}
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
                    selectedFolder={selectedFolder}
                    onSelect={setSelectedFolder}
                />
            </div>

            <div className="field">
                <button
                    className="primary-button"
                    type="submit"
                    disabled={isEncrypting || !hasPendingFile || Boolean(passphraseError)}
                >
                    {isEncrypting ? "Working…" : "Encrypt & Upload"}
                </button>
                <ProgressBar progress={progress} />
                {!hasPendingFile && (
                    <p className="field__help">Select a document, then click Encrypt & Upload.</p>
                )}
                {hasPendingFile && passphraseError && (
                    <p className="field__help">{passphraseError}</p>
                )}
            </div>

            {statusMessage && !passphraseError && (
                <p className={statusMessage.startsWith("Uploaded") ? "field__help" : "folder-picker__error"}>
                    {statusMessage}
                </p>
            )}
        </Form>
    );
};

export default Upload;
