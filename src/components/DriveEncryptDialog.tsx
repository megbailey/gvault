import React, { useEffect, useMemo, useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { encryptAndUploadFiles } from "../utils/encryptUpload";
import type { VaultProgress } from "../utils/fileVault";
import { DEFAULT_SETTINGS, loadSettings, validatePassphrase, type ExtensionSettings } from "../utils/settings";
import {
    relativePathForFile,
    summarizeInterceptedUpload,
} from "../utils/drivePage";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";

type DriveEncryptDialogProps = {
    files: File[];
    relativePaths?: string[];
    folderId: string;
    folderLabel: string;
    onCancel: () => void;
    onSuccess: (names: string[]) => void;
};

const PREVIEW_LIMIT = 8;

const DriveEncryptDialog = ({
    files,
    relativePaths,
    folderId,
    folderLabel,
    onCancel,
    onSuccess,
}: DriveEncryptDialogProps) => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [progress, setProgress] = useState<VaultProgress | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isWorking) {
                onCancel();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isWorking, onCancel]);

    const currentSettings = settings ?? DEFAULT_SETTINGS;
    const passphraseError = validatePassphrase(passphrase, currentSettings);
    const summary = useMemo(
        () => summarizeInterceptedUpload(files, relativePaths),
        [files, relativePaths]
    );
    const previewItems = useMemo(() => {
        return files.slice(0, PREVIEW_LIMIT).map((file, index) => {
            const relativePath = relativePathForFile(file, relativePaths?.[index]);
            return `${relativePath} → ${file.name}.gvault.json`;
        });
    }, [files, relativePaths]);
    const extraCount = Math.max(0, files.length - PREVIEW_LIMIT);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (passphraseError || files.length === 0) {
            setStatusMessage(passphraseError || "No files to encrypt.");
            return;
        }

        setIsWorking(true);
        setStatusMessage(null);
        setProgress(null);

        try {
            const token = await getAccessToken();
            const uploadedNames = await encryptAndUploadFiles({
                files,
                relativePaths,
                passphrase,
                token,
                destinationFolderId: folderId,
                onProgress: setProgress,
                onFile: (index) => setCurrentIndex(index),
            });

            if (summary.isFolder && summary.rootNames.length === 1) {
                onSuccess(summary.rootNames);
            } else {
                onSuccess(uploadedNames);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed.";
            setStatusMessage(message);
            setIsWorking(false);
            setProgress(null);
        }
    };

    return (
        <div
            className="drive-overlay"
            onMouseDown={(event) => {
                if (!isWorking && event.target === event.currentTarget) {
                    onCancel();
                }
            }}
        >
            <form
                className="drive-overlay__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gvault-encrypt-title"
                onSubmit={onSubmit}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h1 className="drive-overlay__title" id="gvault-encrypt-title">Encrypt before upload</h1>
                <p className="field__help">
                    {summary.isFolder
                        ? `Enter a passphrase to encrypt ${summary.fileCount} file${summary.fileCount === 1 ? "" : "s"} in ${summary.rootNames.join(", ")} locally. GVault will recreate the folder on Drive and upload ciphertext only.`
                        : files.length === 1
                            ? "Enter a passphrase to encrypt this file locally, then GVault will upload the ciphertext to the folder you are viewing."
                            : `Enter a passphrase to encrypt ${files.length} files locally, then GVault will upload the ciphertext to the folder you are viewing.`}
                </p>

                <ul className="drive-overlay__files">
                    {previewItems.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                    ))}
                    {extraCount > 0 && (
                        <li>and {extraCount} more</li>
                    )}
                </ul>

                <p className="field__help">Destination: {folderLabel}</p>

                <div className="field">
                    <label className="field__label" htmlFor="drive-passphrase">
                        Security passphrase
                    </label>
                    <div className="field__input-wrap">
                        <input
                            className="field__input"
                            type={showPassphrase ? "text" : "password"}
                            id="drive-passphrase"
                            placeholder="Enter passphrase"
                            value={passphrase}
                            onChange={(event) => setPassphrase(event.target.value)}
                            autoComplete="off"
                            autoFocus
                            disabled={isWorking}
                        />
                        <button
                            type="button"
                            className="field__visibility"
                            onClick={() => setShowPassphrase((visible) => !visible)}
                            aria-label={showPassphrase ? "Hide passphrase" : "Show passphrase"}
                            aria-pressed={showPassphrase}
                            disabled={isWorking}
                        >
                            {showPassphrase ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>
                </div>

                <div className="drive-overlay__actions">
                    <button
                        type="button"
                        className="field__text-button"
                        onClick={onCancel}
                        disabled={isWorking}
                    >
                        Cancel
                    </button>
                    <button
                        className="primary-button"
                        type="submit"
                        disabled={isWorking || Boolean(passphraseError)}
                    >
                        {isWorking
                            ? files.length > 1
                                ? `Working… ${currentIndex + 1}/${files.length}`
                                : "Working…"
                            : "Encrypt & Upload"}
                    </button>
                </div>
                <ProgressBar progress={progress} />
                {passphraseError && (
                    <p className="field__help">{passphraseError}</p>
                )}
                {statusMessage && !passphraseError && (
                    <p className="folder-picker__error">{statusMessage}</p>
                )}
            </form>
        </div>
    );
};

export default DriveEncryptDialog;
