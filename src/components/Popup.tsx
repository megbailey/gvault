import React, { useState } from "react";
import Upload from "./Upload";
import Decrypt from "./Decrypt";
import Settings from "./Settings";
import logo from "../assets/logo.png";

type AppTab = "encrypt" | "decrypt";

const GearIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

const Popup = () => {
    const [tab, setTab] = useState<AppTab>("encrypt");
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <div className="popup">
            <header className="popup-header">
                <div className="popup-brand">
                    <img className="popup-logo" src={logo} alt="" width={22} height={22} />
                    <h1 className="popup-title">{settingsOpen ? "Settings" : "GVault"}</h1>
                </div>
                <button
                    type="button"
                    className={settingsOpen ? "icon-button icon-button--active" : "icon-button"}
                    aria-label={settingsOpen ? "Close settings" : "Open settings"}
                    aria-pressed={settingsOpen}
                    onClick={() => setSettingsOpen((open) => !open)}
                >
                    <GearIcon />
                </button>
            </header>
            {!settingsOpen && (
                <nav className="popup-tabs" aria-label="GVault modes">
                    <button
                        type="button"
                        className={tab === "encrypt" ? "popup-tab popup-tab--active" : "popup-tab"}
                        aria-current={tab === "encrypt" ? "page" : undefined}
                        onClick={() => setTab("encrypt")}
                    >
                        Encrypt
                    </button>
                    <button
                        type="button"
                        className={tab === "decrypt" ? "popup-tab popup-tab--active" : "popup-tab"}
                        aria-current={tab === "decrypt" ? "page" : undefined}
                        onClick={() => setTab("decrypt")}
                    >
                        Decrypt
                    </button>
                </nav>
            )}
            <main className="popup-body">
                {settingsOpen ? <Settings /> : tab === "encrypt" ? <Upload /> : <Decrypt />}
            </main>
        </div>
    );
};

export default Popup;
