import React, { useCallback, useEffect, useRef, useState } from "react";
import DriveEncryptDialog from "./DriveEncryptDialog";
import DriveDecryptDialog from "./DriveDecryptDialog";
import { DRIVE_PAGE_SOURCE_CONTENT, DRIVE_PAGE_SOURCE_OVERLAY } from "../scripts/drive-page-protocol";

const DRIVE_ORIGIN = "https://drive.google.com";

type OverlayStartMessage = {
    source: typeof DRIVE_PAGE_SOURCE_CONTENT;
    type: "start";
    files: File[];
    relativePaths?: string[];
    folderId: string;
    folderLabel: string;
};

type OverlayDecryptMessage = {
    source: typeof DRIVE_PAGE_SOURCE_CONTENT;
    type: "start-decrypt";
    fileIds: string[];
};

function isStartMessage(data: unknown): data is OverlayStartMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as OverlayStartMessage;
    return message.source === DRIVE_PAGE_SOURCE_CONTENT && message.type === "start" && Array.isArray(message.files);
}

function isDecryptMessage(data: unknown): data is OverlayDecryptMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as OverlayDecryptMessage;
    return message.source === DRIVE_PAGE_SOURCE_CONTENT
        && message.type === "start-decrypt"
        && Array.isArray(message.fileIds);
}

function postToParent(message: { type: "ready" | "cancel" | "success"; names?: string[]; message?: string }): void {
    window.parent.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_OVERLAY,
            ...message,
        },
        DRIVE_ORIGIN
    );
}

const DriveOverlay = () => {
    const [session, setSession] = useState<OverlayStartMessage | null>(null);
    const [decryptIds, setDecryptIds] = useState<string[] | null>(null);
    const startedRef = useRef(false);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== DRIVE_ORIGIN) {
                return;
            }
            if (isStartMessage(event.data)) {
                startedRef.current = true;
                setDecryptIds(null);
                setSession(event.data);
                return;
            }
            if (isDecryptMessage(event.data)) {
                startedRef.current = true;
                setSession(null);
                setDecryptIds(event.data.fileIds);
            }
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

    const onDecryptSuccess = useCallback((message: string) => {
        postToParent({ type: "success", message });
    }, []);

    if (decryptIds) {
        return (
            <DriveDecryptDialog
                fileIds={decryptIds}
                onCancel={onCancel}
                onSuccess={onDecryptSuccess}
            />
        );
    }

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

export default DriveOverlay;
