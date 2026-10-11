import React, { useEffect, useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { getDriveItems } from "../utils/driveFolder";
import { downloadAndDecrypt, type DownloadDecryptRequest } from "../utils/downloadDecrypt";
import { VAULT_FILE_SUFFIX } from "../utils/vaultBinary";
import type { VaultProgress } from "../utils/fileVault";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveDecryptDialogProps = {
    fileIds: string[];
    onCancel: () => void;
    onSuccess: (message: string) => void;
};

const DriveDecryptDialog = ({ fileIds, onCancel, onSuccess }: DriveDecryptDialogProps) => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusIsError, setStatusIsError] = useState(false);
    const [progress, setProgress] = useState<VaultProgress | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentTotal, setCurrentTotal] = useState(0);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isWorking) {
                onCancel();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isWorking, onCancel]);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!passphrase.trim() || fileIds.length === 0) {
            return;
        }

        setIsWorking(true);
        setStatusMessage(null);
        setStatusIsError(false);
        setProgress({ phase: "download", completed: 0, total: 1 });

        try {
            const token = await getAccessToken();
            const items = await getDriveItems(token, fileIds);
            if (items.length === 0) {
                throw new Error("GVault could not open that Drive selection. It can decrypt .gvault files it uploaded.");
            }

            const folders = items.filter((item) => item.mimeType === FOLDER_MIME);
            const files = items.filter((item) => item.name.toLowerCase().endsWith(VAULT_FILE_SUFFIX));
            if (folders.length === 0 && files.length === 0) {
                throw new Error("Select a .gvault file or a folder of encrypted files.");
            }

            const requests: DownloadDecryptRequest[] = [
                ...(files.length > 0 ? [{ kind: "files" as const, files }] : []),
                ...folders.map((folder) => ({ kind: "folder" as const, folder })),
            ];
            const messages: string[] = [];
            let isError = false;
            for (const request of requests) {
                const result = await downloadAndDecrypt(request, passphrase, {
                    onProgress: setProgress,
                    onFile: (index, total) => {
                        setCurrentIndex(index);
                        setCurrentTotal(total);
                    },
                });
                messages.push(result.message);
                if (result.isError) {
                    isError = true;
                    break;
                }
            }

            const message = messages.join(" ");
            if (isError) {
                setStatusIsError(true);
                setStatusMessage(message);
                return;
            }
            onSuccess(message);
        } catch (error) {
            setStatusIsError(true);
            setStatusMessage(error instanceof Error ? error.message : "Could not download and decrypt that file.");
        } finally {
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
                aria-labelledby="gvault-decrypt-title"
                onSubmit={onSubmit}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h1 className="drive-overlay__title" id="gvault-decrypt-title">Download & Decrypt</h1>
                <p className="field__help">
                    Enter the passphrase used to encrypt {fileIds.length === 1 ? "this selection" : "these selections"}. GVault downloads the ciphertext and decrypts it on this device.
                </p>
                <div className="field">
                    <label className="field__label" htmlFor="drive-decrypt-passphrase">
                        Security passphrase
                    </label>
                    <div className="field__input-wrap">
                        <input
                            className="field__input"
                            type={showPassphrase ? "text" : "password"}
                            id="drive-decrypt-passphrase"
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
                    <button type="button" className="field__text-button" onClick={onCancel} disabled={isWorking}>
                        Cancel
                    </button>
                    <button className="primary-button" type="submit" disabled={isWorking || passphrase.trim().length === 0}>
                        {isWorking
                            ? currentTotal > 1
                                ? `Working… ${currentIndex + 1}/${currentTotal}`
                                : "Working…"
                            : "Download & Decrypt"}
                    </button>
                </div>
                <ProgressBar progress={progress} />
                {statusMessage && (
                    <p className={statusIsError ? "folder-picker__error" : "field__help"} role={statusIsError ? "alert" : undefined}>
                        {statusMessage}
                    </p>
                )}
            </form>
        </div>
    );
};

export default DriveDecryptDialog;
