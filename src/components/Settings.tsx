import React, { useCallback, useEffect, useState } from "react";
import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    type ExtensionSettings,
} from "../utils/settings";

const GOOGLE_HELP = {
    cse: "https://support.google.com/a/answer/10741897",
    cseAdmin: "https://support.google.com/a/answer/10745596",
    signup: "https://support.google.com/a/answer/53926",
    trial: "https://support.google.com/a/answer/6388094",
} as const;

const SITE = {
    home: "https://megbailey.me/projects/gvault",
    terms: "https://megbailey.me/projects/gvault/terms",
    privacy: "https://megbailey.me/projects/gvault/privacy",
} as const;

function GoogleHelpLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a
            className="settings-note__link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    );
}

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
                        After a successful decrypt, remove the .gvault file from Google Drive.
                    </span>
                </span>
            </label>

            <div className="settings-note">
                <p className="choice-row__label">Google Drive encryption</p>
                <p className="field__help">
                    Google Drive has{" "}
                    <GoogleHelpLink href={GOOGLE_HELP.cse}>native client-side encryption</GoogleHelpLink>
                    {" "}for Google Workspace, and {" "}
                    <GoogleHelpLink href={GOOGLE_HELP.cseAdmin}>an administrator must enable it</GoogleHelpLink>
                    {" "}for your account.{" "}
                    <GoogleHelpLink href={GOOGLE_HELP.signup}>Anyone can create a Workspace account</GoogleHelpLink>
                    {", but it is "}
                    <GoogleHelpLink href={GOOGLE_HELP.trial}>not free beyond a 14-day trial</GoogleHelpLink>
                    . GVault enables free client-side encryption (CSE) for personal accounts or those within a Google Workspace without CSE enabled.
                </p>
            </div>

            <nav className="settings-legal" aria-label="GVault legal">
                <GoogleHelpLink href={SITE.home}>About GVault</GoogleHelpLink>
                <GoogleHelpLink href={SITE.terms}>Terms of service</GoogleHelpLink>
                <GoogleHelpLink href={SITE.privacy}>Privacy policy</GoogleHelpLink>
            </nav>
        </div>
    );
};

export default Settings;
