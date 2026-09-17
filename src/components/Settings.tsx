import React, { useCallback, useEffect, useState } from "react";
import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    type ExtensionSettings,
} from "../utils/settings";

const Settings = () => {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        loadSettings().then((loaded) => {
            setSettings(loaded);
            setReady(true);
        });
    }, []);

    const persist = useCallback(async (next: ExtensionSettings) => {
        const saved = await saveSettings(next);
        setSettings(saved);
    }, []);

    if (!ready) {
        return <p className="settings-status">Loading settings…</p>;
    }

    return (
        <div className="settings">
            <p className="settings-intro">
                Saved on this device until GVault is removed.
            </p>

            <div className="field">
                <label className="field__label" htmlFor="minPassphraseLength">
                    Minimum passphrase length
                </label>
                <input
                    className="field__input"
                    id="minPassphraseLength"
                    type="number"
                    min={1}
                    placeholder="No minimum"
                    value={settings.minPassphraseLength ?? ""}
                    onChange={(event) => {
                        const raw = event.target.value;
                        persist({
                            ...settings,
                            minPassphraseLength: raw === "" ? null : Number(raw),
                        });
                    }}
                />
                <p className="field__help">Leave blank for no length requirement.</p>
            </div>

            <label className="choice-row" htmlFor="requireSpecialCharacters">
                <input
                    type="checkbox"
                    id="requireSpecialCharacters"
                    checked={settings.requireSpecialCharacters}
                    onChange={(event) => {
                        persist({
                            ...settings,
                            requireSpecialCharacters: event.target.checked,
                        });
                    }}
                />
                <span>
                    <span className="choice-row__label">Require a special character</span>
                    <span className="field__help">At least one character that is not a letter or number.</span>
                </span>
            </label>

            <div className="field">
                <label className="field__label" htmlFor="encryptedFolderName">
                    Encrypted documents folder
                </label>
                <input
                    className="field__input"
                    id="encryptedFolderName"
                    type="text"
                    value={settings.encryptedFolderName}
                    onChange={(event) => {
                        setSettings({
                            ...settings,
                            encryptedFolderName: event.target.value,
                        });
                    }}
                    onBlur={(event) => {
                        persist({
                            ...settings,
                            encryptedFolderName: event.target.value,
                        });
                    }}
                />
                <p className="field__help">
                    Created in Google Drive on first upload if it does not already exist.
                </p>
            </div>
        </div>
    );
};

export default Settings;
