import React from "react";
import type { VaultProgress } from "../utils/fileVault";

const PHASE_LABEL: Record<VaultProgress["phase"], string> = {
    encrypt: "Encrypting",
    decrypt: "Decrypting",
    upload: "Uploading",
    download: "Downloading",
};

type ProgressBarProps = {
    progress: VaultProgress | null;
};

const ProgressBar = ({ progress }: ProgressBarProps) => {
    if (!progress || progress.total <= 0) {
        return null;
    }

    const percent = Math.min(100, Math.round((progress.completed / progress.total) * 100));

    return (
        <div className="progress">
            <div
                className="progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={`${PHASE_LABEL[progress.phase]} ${percent} percent`}
            >
                <div className="progress__bar" style={{ width: `${percent}%` }} />
            </div>
            <p className="field__help">
                {PHASE_LABEL[progress.phase]}… {percent}%
            </p>
        </div>
    );
};

export default ProgressBar;
