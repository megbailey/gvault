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
        return <p>Loading settings…</p>;
    }

    return (
        <div>
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <p style={{ fontSize: "0.85em", color: "#3a3a3c" }}>
                These stay on this device until GVault is removed.
            </p>

            <div>
                <label htmlFor="minPassphraseLength">Minimum passphrase length</label>
                <br />
                <input
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
                <div style={{ fontSize: "0.8em", color: "#3a3a3c", marginTop: 4 }}>
                    Leave blank for no length requirement.
                </div>
            </div>

            <div style={{ marginTop: 16 }}>
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
                <label htmlFor="requireSpecialCharacters">
                    Require at least one special character
                </label>
            </div>

            <div style={{ marginTop: 16 }}>
                <label htmlFor="encryptedFolderName">Encrypted documents folder</label>
                <br />
                <input
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
                <div style={{ fontSize: "0.8em", color: "#3a3a3c", marginTop: 4 }}>
                    Created in Google Drive on first upload if it does not already exist.
                </div>
            </div>
        </div>
    );
};

export default Settings;
