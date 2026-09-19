/// <reference path="./types/index.d.ts" />
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import DriveEncryptDialog from "./components/DriveEncryptDialog";
import { DRIVE_PAGE_SOURCE_CONTENT, DRIVE_PAGE_SOURCE_OVERLAY } from "./scripts/drive-page-protocol";
import "./index.css";

const DRIVE_ORIGIN = "https://drive.google.com";

type OverlayStartMessage = {
    source: typeof DRIVE_PAGE_SOURCE_CONTENT;
    type: "start";
    files: File[];
    relativePaths?: string[];
    folderId: string;
    folderLabel: string;
};

function isStartMessage(data: unknown): data is OverlayStartMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as OverlayStartMessage;
    return message.source === DRIVE_PAGE_SOURCE_CONTENT && message.type === "start" && Array.isArray(message.files);
}

function postToParent(message: { type: "ready" | "cancel" | "success"; names?: string[] }): void {
    window.parent.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_OVERLAY,
            ...message,
        },
        DRIVE_ORIGIN
    );
}

const OverlayApp = () => {
    const [session, setSession] = useState<OverlayStartMessage | null>(null);
    const startedRef = useRef(false);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== DRIVE_ORIGIN || !isStartMessage(event.data)) {
                return;
            }
            startedRef.current = true;
            setSession(event.data);
        };

        window.addEventListener("message", onMessage);
        postToParent({ type: "ready" });
        const timer = window.setInterval(() => {
            if (!startedRef.current) {
                postToParent({ type: "ready" });
            }
        }, 80);

        return () => {
            window.removeEventListener("message", onMessage);
            window.clearInterval(timer);
        };
    }, []);

    const onCancel = useCallback(() => {
        postToParent({ type: "cancel" });
    }, []);

    const onSuccess = useCallback((names: string[]) => {
        postToParent({ type: "success", names });
    }, []);

    if (!session) {
        return null;
    }

    return (
        <DriveEncryptDialog
            files={session.files}
            relativePaths={session.relativePaths}
            folderId={session.folderId}
            folderLabel={session.folderLabel}
            onCancel={onCancel}
            onSuccess={onSuccess}
        />
    );
};

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(<OverlayApp />);
