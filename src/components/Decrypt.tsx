import React, { useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import {
    deleteDriveFile,
    openDriveFileStream,
    listDriveVaultTree,
} from "../utils/driveFolder";
import { unpackVaultFromByteStream, type VaultProgress } from "../utils/fileVault";
import VaultFilePicker, { type VaultPickerSelection } from "./VaultFilePicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import { loadSettings } from "../utils/settings";
import { decryptedOutputPath, saveDecryptedFile, triggerLocalDownload } from "../utils/localSave";
import { MAX_DRIVE_FOLDER_FILES } from "../utils/limits";

async function decryptVaultStream(
    stream: ReadableStream<Uint8Array>,
    passphrase: string,
    onProgress?: (progress: VaultProgress) => void
) {
    try {
        return await unpackVaultFromByteStream(stream, passphrase, onProgress);
    } catch (error) {
        if (error instanceof Error && (
            error.message === "Unsupported vault file version."
            || error.message === "The passphrase was incorrect. Please try again."
        )) {
            throw error;
        }
        throw new Error("That file is not a valid .gvault package.");
    }
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
        setCurrentTotal(selected.kind === "folder" ? 0 : selected.kind === "files" ? selected.files.length : 1);

        try {
            const token = await getAccessToken();
            const settings = await loadSettings();

            if (selected.kind === "file" || selected.kind === "files") {
                const pickedFiles = selected.kind === "file" ? [selected.file] : selected.files;
                if (pickedFiles.length === 0) {
                    throw new Error("Choose a .gvault file first.");
                }

                let deleteFailures = 0;
                const decryptedNames: string[] = [];

                for (let index = 0; index < pickedFiles.length; index++) {
                    const picked = pickedFiles[index];
                    setCurrentIndex(index);
                    setProgress({ phase: "download", completed: 0, total: 1 });
                    const stream = await openDriveFileStream(token, picked.id);
                    setProgress({ phase: "download", completed: 1, total: 1 });
                    const result = await decryptVaultStream(stream, passphrase, setProgress);
                    if (pickedFiles.length === 1) {
                        triggerLocalDownload(result.filename, result.data);
                    } else {
                        await saveDecryptedFile(result.filename, result.data);
                    }
                    decryptedNames.push(result.filename);

                    if (settings.deleteEncryptedFileAfterDownload) {
                        try {
                            await deleteDriveFile(token, picked.id);
                        } catch (deleteError) {
                            deleteFailures += 1;
                            if (pickedFiles.length === 1) {
                                setStatusIsError(true);
                                setStatusMessage(
                                    `Downloaded and decrypted ${result.filename}, but the encrypted Drive file could not be deleted.`
                                    + (deleteError instanceof Error ? ` ${deleteError.message}` : "")
                                );
                                return;
                            }
                        }
                    }
                }

                if (settings.deleteEncryptedFileAfterDownload && deleteFailures > 0) {
                    setStatusIsError(true);
                    setStatusMessage(
                        `Downloaded and decrypted ${decryptedNames.length} files, but ${deleteFailures} encrypted Drive file${deleteFailures === 1 ? "" : "s"} could not be deleted.`
                    );
                    return;
                }

                if (settings.deleteEncryptedFileAfterDownload) {
                    setSelected(null);
                    setStatusMessage(
                        pickedFiles.length === 1
                            ? `Downloaded and decrypted ${decryptedNames[0]}. The encrypted Drive file was deleted.`
                            : `Downloaded and decrypted ${decryptedNames.length} files. The encrypted Drive files were deleted.`
                    );
                    return;
                }

                setStatusMessage(
                    pickedFiles.length === 1
                        ? `Downloaded and decrypted ${decryptedNames[0]}.`
                        : `Downloaded and decrypted ${decryptedNames.length} files.`
                );
                return;
            }

            const entries = await listDriveVaultTree(token, selected.folder.id, {
                maxFiles: MAX_DRIVE_FOLDER_FILES,
            });
            if (entries.length === 0) {
                throw new Error("No .gvault files were found in that folder.");
            }

            setCurrentTotal(entries.length);
            let deleteFailures = 0;

            for (let index = 0; index < entries.length; index++) {
                const entry = entries[index];
                setCurrentIndex(index);
                setProgress({ phase: "download", completed: 0, total: 1 });
                const stream = await openDriveFileStream(token, entry.file.id);
                setProgress({ phase: "download", completed: 1, total: 1 });
                const result = await decryptVaultStream(stream, passphrase, setProgress);
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
                            : selected?.kind === "files"
                                ? "Download & Decrypt files"
                                : "Download & Decrypt"}
                </button>
                <ProgressBar progress={progress} />
                {!selected && (
                    <p className="field__help">Select a .gvault file or folder, then click Download & Decrypt.</p>
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
