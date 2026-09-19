import React, { useEffect, useMemo, useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import uploadFile from "../utils/uploadFile";
import { packVaultFile, type VaultProgress } from "../utils/fileVault";
import { DEFAULT_SETTINGS, loadSettings, validatePassphrase, type ExtensionSettings } from "../utils/settings";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";

type DriveEncryptDialogProps = {
    files: File[];
    folderId: string;
    folderLabel: string;
    onCancel: () => void;
    onSuccess: (names: string[]) => void;
};

const DriveEncryptDialog = ({
    files,
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
    const fileNames = useMemo(() => files.map((file) => file.name), [files]);

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
            const uploadedNames: string[] = [];

            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                setCurrentIndex(index);
                const vaultFile = await packVaultFile(file, passphrase, setProgress);
                await uploadFile(token, vaultFile, folderId, setProgress);
                uploadedNames.push(`${file.name}.gvault.json`);
            }

            onSuccess(uploadedNames);
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
                    {files.length === 1
                        ? "Enter a passphrase to encrypt this file locally, then GVault will upload the ciphertext to the folder you are viewing."
                        : `Enter a passphrase to encrypt ${files.length} files locally, then GVault will upload the ciphertext to the folder you are viewing.`}
                </p>

                <ul className="drive-overlay__files">
                    {fileNames.map((name, index) => (
                        <li key={`${index}-${name}`}>{name} → {name}.gvault.json</li>
                    ))}
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
