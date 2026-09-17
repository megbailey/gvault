import React, { useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { deleteDriveFile, downloadDriveFile, type DriveFile } from "../utils/driveFolder";
import { unpackVaultFile, type VaultProgress } from "../utils/fileVault";
import { GVaultFile } from "../GVaultFile";
import VaultFilePicker from "./VaultFilePicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import { loadSettings } from "../utils/settings";

function safeDownloadName(name: string) {
    const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
    return cleaned.slice(0, 255) || "decrypted-file";
}

function triggerLocalDownload(filename: string, data: ArrayBuffer) {
    const blob = new Blob([new Uint8Array(data)]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeDownloadName(filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const Decrypt = () => {
    const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusIsError, setStatusIsError] = useState(false);
    const [progress, setProgress] = useState<VaultProgress | null>(null);

    const canDecrypt = Boolean(selectedFile) && passphrase.trim().length > 0 && !isWorking;

    const onDownloadAndDecrypt = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedFile || !passphrase.trim()) {
            return;
        }

        setIsWorking(true);
        setStatusMessage(null);
        setStatusIsError(false);
        setProgress({ phase: "download", completed: 0, total: 1 });

        try {
            const token = await getAccessToken();
            const contents = await downloadDriveFile(token, selectedFile.id);
            setProgress({ phase: "download", completed: 1, total: 1 });
            let vaultFile: GVaultFile;
            try {
                vaultFile = GVaultFile.fromJsonString(contents);
            } catch (error) {
                if (error instanceof Error && error.message === "Unsupported vault file version.") {
                    throw error;
                }
                throw new Error("That file is not a valid .gvault.json package.");
            }
            const result = await unpackVaultFile(vaultFile, passphrase, setProgress);
            triggerLocalDownload(result.filename, result.data);

            const settings = await loadSettings();
            if (settings.deleteEncryptedFileAfterDownload) {
                try {
                    await deleteDriveFile(token, selectedFile.id);
                    setSelectedFile(null);
                    setStatusMessage(
                        `Downloaded and decrypted ${result.filename}. The encrypted Drive file was deleted.`
                    );
                    return;
                } catch (deleteError) {
                    setStatusIsError(true);
                    setStatusMessage(
                        `Downloaded and decrypted ${result.filename}, but the encrypted Drive file could not be deleted.`
                        + (deleteError instanceof Error ? ` ${deleteError.message}` : "")
                    );
                    return;
                }
            }

            setStatusMessage(`Downloaded and decrypted ${result.filename}.`);
        } catch (error) {
            setStatusIsError(true);
            setStatusMessage(
                error instanceof Error ? error.message : "Could not download and decrypt that file."
            );
        } finally {
            setIsWorking(false);
            setProgress(null);
        }
    };

    return (
        <form className="upload-form" onSubmit={onDownloadAndDecrypt}>
            <div className="field">
                <span className="field__label" id="decryptFileLabel">
                    Encrypted file
                </span>
                <VaultFilePicker
                    selectedFile={selectedFile}
                    onSelect={(file) => {
                        setSelectedFile(file);
                        setStatusMessage(null);
                    }}
                />
            </div>

            <div className="field">
                <label className="field__label" htmlFor="decryptPassphrase">
                    Security passphrase
                </label>
                <div className="field__input-wrap">
                    <input
                        className="field__input"
                        type={showPassphrase ? "text" : "password"}
                        id="decryptPassphrase"
                        placeholder="Enter passphrase"
                        value={passphrase}
                        onChange={(event) => {
                            setPassphrase(event.target.value);
                            setStatusMessage(null);
                        }}
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
                <button
                    className="primary-button"
                    type="submit"
                    disabled={!canDecrypt}
                >
                    {isWorking ? "Working…" : "Download & Decrypt"}
                </button>
                <ProgressBar progress={progress} />
                {!selectedFile && (
                    <p className="field__help">Select a .gvault.json file, then click Download & Decrypt.</p>
                )}
                {selectedFile && !passphrase.trim() && (
                    <p className="field__help">Enter the passphrase used to encrypt this file.</p>
                )}
            </div>

            {statusMessage && (
                <p
                    className={statusIsError ? "folder-picker__error" : "field__help"}
                    role={statusIsError ? "alert" : undefined}
                >
                    {statusMessage}
                </p>
            )}
        </form>
    );
};

export default Decrypt;
