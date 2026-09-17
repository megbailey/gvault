import React, { useState } from "react";
import Upload from "./Upload";
import Settings from "./Settings";

type PopupView = "upload" | "settings";

const Popup = () => {
    const [view, setView] = useState<PopupView>("upload");

    return (
        <div>
            <nav className="popup-nav">
                <button
                    type="button"
                    className={view === "upload" ? "popup-nav__button popup-nav__button--active" : "popup-nav__button"}
                    onClick={() => setView("upload")}
                >
                    Upload
                </button>
                <button
                    type="button"
                    className={view === "settings" ? "popup-nav__button popup-nav__button--active" : "popup-nav__button"}
                    onClick={() => setView("settings")}
                >
                    Settings
                </button>
            </nav>
            {view === "upload" ? <Upload /> : <Settings />}
        </div>
    );
};

export default Popup;
