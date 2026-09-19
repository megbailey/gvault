import React, { useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import {
    deleteDriveFile,
    downloadDriveFile,
    listDriveVaultTree,
} from "../utils/driveFolder";
import { unpackVaultFile, type VaultProgress } from "../utils/fileVault";
import { GVaultFile } from "../GVaultFile";
import VaultFilePicker, { type VaultPickerSelection } from "./VaultFilePicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import { loadSettings } from "../utils/settings";
import { decryptedOutputPath, saveDecryptedFile, triggerLocalDownload } from "../utils/localSave";
import { MAX_DRIVE_FOLDER_FILES } from "../utils/limits";

async function decryptVaultContents(contents: string, passphrase: string, onProgress?: (progress: VaultProgress) => void) {
    let vaultFile: GVaultFile;
    try {
        vaultFile = GVaultFile.fromJsonString(contents);
    } catch (error) {
        if (error instanceof Error && error.message === "Unsupported vault file version.") {
            throw error;
        }
        throw new Error("That file is not a valid .gvault.json package.");
    }
    return unpackVaultFile(vaultFile, passphrase, onProgress);
}

const Decrypt = () => {
    const [selected, setSelected] = useState<VaultPickerSelection | null>(null);
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusIsError, setStatusIsError] = useState(false);
    const [progress, setProgress] = useState<VaultProgress | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentTotal, setCurrentTotal] = useState(0);

    const canDecrypt = Boolean(selected) && passphrase.trim().length > 0 && !isWorking;

    const onDownloadAndDecrypt = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selected || !passphrase.trim()) {
            return;
        }

        setIsWorking(true);
        setStatusMessage(null);
        setStatusIsError(false);
        setProgress({ phase: "download", completed: 0, total: 1 });
        setCurrentIndex(0);
        setCurrentTotal(selected.kind === "file" ? 1 : 0);

        try {
            const token = await getAccessToken();
            const settings = await loadSettings();

            if (selected.kind === "file") {
                const contents = await downloadDriveFile(token, selected.file.id);
                setProgress({ phase: "download", completed: 1, total: 1 });
                const result = await decryptVaultContents(contents, passphrase, setProgress);
                triggerLocalDownload(result.filename, result.data);

                if (settings.deleteEncryptedFileAfterDownload) {
                    try {
                        await deleteDriveFile(token, selected.file.id);
                        setSelected(null);
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
                return;
            }

            const entries = await listDriveVaultTree(token, selected.folder.id, {
                maxFiles: MAX_DRIVE_FOLDER_FILES,
            });
            if (entries.length === 0) {
                throw new Error("No .gvault.json files were found in that folder.");
            }

            setCurrentTotal(entries.length);
            let deleteFailures = 0;

            for (let index = 0; index < entries.length; index++) {
                const entry = entries[index];
                setCurrentIndex(index);
                setProgress({ phase: "download", completed: 0, total: 1 });
                const contents = await downloadDriveFile(token, entry.file.id);
                setProgress({ phase: "download", completed: 1, total: 1 });
                const result = await decryptVaultContents(contents, passphrase, setProgress);
                const outputPath = decryptedOutputPath(
                    selected.folder.name,
                    entry.relativePath,
                    result.filename
                );
                await saveDecryptedFile(outputPath, result.data);

                if (settings.deleteEncryptedFileAfterDownload) {
                    try {
                        await deleteDriveFile(token, entry.file.id);
                    } catch {
                        deleteFailures += 1;
                    }
                }
            }

            if (settings.deleteEncryptedFileAfterDownload && deleteFailures > 0) {
                setStatusIsError(true);
                setStatusMessage(
                    `Downloaded and decrypted ${entries.length} files from ${selected.folder.name}, but ${deleteFailures} encrypted Drive file${deleteFailures === 1 ? "" : "s"} could not be deleted.`
                );
                return;
            }

            if (settings.deleteEncryptedFileAfterDownload) {
                setSelected(null);
            }

            setStatusMessage(
                `Downloaded and decrypted ${entries.length} files from ${selected.folder.name}.`
            );
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
                    Encrypted file or folder
                </span>
                <VaultFilePicker
                    selected={selected}
                    onSelect={(next) => {
                        setSelected(next);
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
                    {isWorking
                        ? currentTotal > 1
                            ? `Working… ${currentIndex + 1}/${currentTotal}`
                            : "Working…"
                        : selected?.kind === "folder"
                            ? "Download & Decrypt folder"
                            : "Download & Decrypt"}
                </button>
                <ProgressBar progress={progress} />
                {!selected && (
                    <p className="field__help">Select a .gvault.json file or folder, then click Download & Decrypt.</p>
                )}
                {selected && !passphrase.trim() && (
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
