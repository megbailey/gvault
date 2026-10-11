import React, { useState } from "react";
import { type VaultProgress } from "../utils/fileVault";
import { downloadAndDecrypt } from "../utils/downloadDecrypt";
import VaultFilePicker, { type VaultPickerSelection } from "./VaultFilePicker";
import ProgressBar from "./ProgressBar";
import { EyeIcon, EyeOffIcon } from "./icons";
import Tooltip from "@megbailey/ui/tooltip";
import { APPROVED_FOLDERS_HELP } from "../utils/uploadDestination";

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
            const request = selected.kind === "folder"
                ? { kind: "folder" as const, folder: selected.folder }
                : {
                    kind: "files" as const,
                    files: selected.kind === "file" ? [selected.file] : selected.files,
                };
            const result = await downloadAndDecrypt(request, passphrase, {
                onProgress: setProgress,
                onFile: (index, total) => {
                    setCurrentIndex(index);
                    setCurrentTotal(total);
                },
            });
            if (result.clearSelection) {
                setSelected(null);
            }
            setStatusIsError(result.isError);
            setStatusMessage(result.message);
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
                <div className="field__label-row">
                    <span className="field__label" id="decryptFileLabel">
                        Encrypted file or folder
                    </span>
                    <Tooltip type="icon" position="bottom" arrow={true} extendHost text={APPROVED_FOLDERS_HELP} />
                </div>
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
