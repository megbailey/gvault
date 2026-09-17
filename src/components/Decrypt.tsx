import React, { useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import { downloadDriveFile, type DriveFile } from "../utils/driveFolder";
import { unpackVaultFile } from "../utils/fileVault";
import { GVaultFile } from "../GVaultFile";
import VaultFilePicker from "./VaultFilePicker";
import { EyeIcon, EyeOffIcon } from "./icons";

function triggerLocalDownload(filename: string, data: ArrayBuffer) {
    const blob = new Blob([new Uint8Array(data)]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
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

    const canDecrypt = Boolean(selectedFile) && passphrase.trim().length > 0 && !isWorking;

    const onDownloadAndDecrypt = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedFile || !passphrase.trim()) {
            return;
        }

        setIsWorking(true);
        setStatusMessage(null);
        setStatusIsError(false);

        try {
            const token = await getAccessToken();
            const contents = await downloadDriveFile(token, selectedFile.id);
            let vaultFile: GVaultFile;
            try {
                vaultFile = GVaultFile.fromJsonString(contents);
            } catch {
                throw new Error("That file is not a valid .gvault.json package.");
            }
            const result = await unpackVaultFile(vaultFile, passphrase);
            triggerLocalDownload(result.filename, result.data);
            setStatusMessage(`Downloaded and decrypted ${result.filename}.`);
        } catch (error) {
            setStatusIsError(true);
            setStatusMessage(
                error instanceof Error ? error.message : "Could not download and decrypt that file."
            );
        } finally {
            setIsWorking(false);
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
                    {isWorking ? "Decrypting…" : "Download & Decrypt"}
                </button>
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
