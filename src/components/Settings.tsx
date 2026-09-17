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

            <div className="settings-note">
                <p className="choice-row__label">Google Drive encryption</p>
                <p className="field__help">
                    Google Drive has native client-side encryption only for Google Workspace accounts, and only if your administrator enables it for your account. GVault encrypts files on this device so you can use Drive without that.
                </p>
            </div>

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

            <label className="choice-row" htmlFor="deleteEncryptedFileAfterDownload">
                <input
                    type="checkbox"
                    id="deleteEncryptedFileAfterDownload"
                    checked={settings.deleteEncryptedFileAfterDownload}
                    onChange={(event) => {
                        persist({
                            ...settings,
                            deleteEncryptedFileAfterDownload: event.target.checked,
                        });
                    }}
                />
                <span>
                    <span className="choice-row__label">Delete encrypted file after download</span>
                    <span className="field__help">
                        After a successful decrypt, remove the .gvault.json file from Google Drive.
                    </span>
                </span>
            </label>
        </div>
    );
};

export default Settings;
