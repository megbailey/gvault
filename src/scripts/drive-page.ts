import {
    DRIVE_ENCRYPT_UPLOADS_KEY,
    DRIVE_PAGE_SOURCE_CONTENT,
    DRIVE_PAGE_SOURCE_MAIN,
    DRIVE_PAGE_SOURCE_OVERLAY,
} from "./drive-page-protocol";
import {
    interceptRejectionMessage,
    parseDriveUploadDestination,
    validateInterceptedFiles,
    findDriveHeaderInsertPoint,
    isDirectoryUpload,
    releaseDriveDropUi,
} from "../utils/drivePage";
import {
    formatFileSizeLimit,
    MAX_DRIVE_FOLDER_FILES,
    MAX_DRIVE_INTERCEPT_FILES,
    MAX_FILE_SIZE,
} from "../utils/limits";

const TOGGLE_HOST_ID = "gvault-drive-toggle-host";
const TOAST_HOST_ID = "gvault-drive-toast-host";
const OVERLAY_HOST_ID = "gvault-drive-overlay-host";

type MainToContentMessage = {
    source: typeof DRIVE_PAGE_SOURCE_MAIN;
    type: "files-selected" | "unsupported";
    files?: File[];
    relativePaths?: string[];
};

type OverlayToContentMessage = {
    source: typeof DRIVE_PAGE_SOURCE_OVERLAY;
    type: "ready" | "cancel" | "success";
    names?: string[];
};

let enabled = false;
let pendingFiles: File[] | null = null;
let pendingRelativePaths: string[] | null = null;
let overlayFrame: HTMLIFrameElement | null = null;
let toastTimer = 0;
let placeFrame = 0;
let headerObserver: MutationObserver | null = null;

function extensionOrigin(): string {
    return new URL(chrome.runtime.getURL("drive-overlay-index.html")).origin;
}

function postToMain(message: { type: "set-enabled" | "set-busy"; enabled?: boolean; busy?: boolean }): void {
    window.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_CONTENT,
            type: message.type,
            enabled: message.enabled,
            busy: message.busy,
        },
        "*"
    );
}

function setBusy(busy: boolean): void {
    postToMain({ type: "set-busy", busy });
}

function isMainMessage(data: unknown): data is MainToContentMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as MainToContentMessage;
    return message.source === DRIVE_PAGE_SOURCE_MAIN;
}

function isOverlayMessage(data: unknown): data is OverlayToContentMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as OverlayToContentMessage;
    return message.source === DRIVE_PAGE_SOURCE_OVERLAY;
}

function showToast(message: string, variant: "info" | "error" | "success" = "info"): void {
    const toast = document.getElementById(TOAST_HOST_ID);
    const toggle = document.getElementById(TOGGLE_HOST_ID);
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.setAttribute("data-variant", variant);
    toast.style.background = variant === "error" ? "#dc2626" : variant === "success" ? "#047857" : "#1c1c1e";
    toast.hidden = false;

    if (toggle) {
        const rect = toggle.getBoundingClientRect();
        toast.style.top = `${Math.round(rect.bottom + 8)}px`;
        toast.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
        toast.style.left = "auto";
    }

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toast.hidden = true;
    }, 5200);
}

function closeOverlay(): void {
    overlayFrame?.remove();
    overlayFrame = null;
    pendingFiles = null;
    pendingRelativePaths = null;
    releaseDriveDropUi();
    setBusy(false);
}

function sendStartToOverlay(): void {
    if (!overlayFrame?.contentWindow || !pendingFiles) {
        return;
    }

    const destination = parseDriveUploadDestination(window.location.href);
    overlayFrame.contentWindow.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_CONTENT,
            type: "start",
            files: pendingFiles,
            relativePaths: pendingRelativePaths ?? pendingFiles.map((file) => file.webkitRelativePath || file.name),
            folderId: destination.folderId,
            folderLabel: destination.label,
        },
        extensionOrigin()
    );
}

function openOverlay(files: File[], relativePaths: string[]): void {
    overlayFrame?.remove();
    overlayFrame = null;
    pendingFiles = files;
    pendingRelativePaths = relativePaths;
    setBusy(true);

    const iframe = document.createElement("iframe");
    iframe.id = OVERLAY_HOST_ID;
    iframe.src = chrome.runtime.getURL("drive-overlay-index.html");
    iframe.title = "GVault encrypt upload";
    iframe.setAttribute(
        "style",
        [
            "all: initial",
            "position: fixed",
            "inset: 0",
            "width: 100%",
            "height: 100%",
            "border: 0",
            "z-index: 2147483646",
            "background: transparent",
        ].join(";")
    );
    overlayFrame = iframe;
    document.documentElement.appendChild(iframe);
}

function handleInterceptedFiles(files: File[], relativePaths?: string[]): void {
    const alignedPaths = relativePaths && relativePaths.length === files.length
        ? relativePaths
        : files.map((file) => file.webkitRelativePath || file.name);
    const maxFiles = isDirectoryUpload(files, alignedPaths)
        ? MAX_DRIVE_FOLDER_FILES
        : MAX_DRIVE_INTERCEPT_FILES;
    const validation = validateInterceptedFiles(files, {
        maxFileSize: MAX_FILE_SIZE,
        maxFiles,
    });

    if (!validation.ok) {
        setBusy(false);
        releaseDriveDropUi();
        showToast(
            interceptRejectionMessage(validation.reason, {
                maxFileSizeLabel: formatFileSizeLimit(),
                maxFiles,
            }),
            "error"
        );
        return;
    }

    openOverlay(files, alignedPaths);
}

function updateToggleUi(): void {
    const host = document.getElementById(TOGGLE_HOST_ID)?.shadowRoot;
    const button = host?.getElementById("gvault-toggle");
    const state = host?.getElementById("gvault-toggle-state");
    if (!button || !state) {
        return;
    }

    button.setAttribute("aria-checked", enabled ? "true" : "false");
    button.classList.toggle("is-on", enabled);
    state.textContent = enabled ? "On" : "Off";
}

async function setEnabled(next: boolean, persist: boolean): Promise<void> {
    enabled = next;
    postToMain({ type: "set-enabled", enabled });
    updateToggleUi();
    if (persist) {
        await chrome.storage.local.set({ [DRIVE_ENCRYPT_UPLOADS_KEY]: next });
    }
}

function ensureToastHost(): void {
    if (document.getElementById(TOAST_HOST_ID)) {
        return;
    }

    const toast = document.createElement("div");
    toast.id = TOAST_HOST_ID;
    toast.hidden = true;
    toast.setAttribute(
        "style",
        [
            "position: fixed",
            "z-index: 2147483645",
            "max-width: 280px",
            "padding: 10px 12px",
            "border-radius: 10px",
            "background: #1c1c1e",
            "color: #fff",
            "font: 12px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif",
            "box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2)",
        ].join(";")
    );
    document.documentElement.appendChild(toast);
}

function createToggleHost(): HTMLElement {
    const existing = document.getElementById(TOGGLE_HOST_ID);
    if (existing) {
        return existing;
    }

    const host = document.createElement("div");
    host.id = TOGGLE_HOST_ID;
    host.setAttribute(
        "style",
        [
            "display: inline-flex",
            "align-items: center",
            "align-self: center",
            "flex: 0 0 auto",
            "margin: 0 8px",
            "max-height: 48px",
            "position: relative",
            "z-index: 1",
        ].join(";")
    );
    const shadow = host.attachShadow({ mode: "open" });
    const logoUrl = chrome.runtime.getURL("logo.png");

    shadow.innerHTML = `
        <style>
            :host { display: inline-flex; align-items: center; }
            .toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 5px 10px 5px 6px;
                border: 1px solid #d2d2d7;
                border-radius: 999px;
                background: #fff;
                color: #1c1c1e;
                font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
                cursor: pointer;
            }
            .toggle:focus-visible {
                outline: 2px solid #2563eb;
                outline-offset: 2px;
            }
            .toggle.is-on {
                border-color: #bfdbfe;
                background: #eff6ff;
            }
            img {
                width: 18px;
                height: 18px;
                display: block;
            }
            .copy {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                line-height: 1.1;
            }
            .label {
                font-size: 11px;
                font-weight: 700;
            }
            .state {
                font-size: 10px;
                color: #636366;
            }
            .toggle.is-on .state {
                color: #2563eb;
                font-weight: 650;
            }
        </style>
        <button type="button" class="toggle" id="gvault-toggle" role="switch" aria-checked="false" title="When on, GVault asks for a passphrase and encrypts files before they are uploaded">
            <img src="${logoUrl}" alt="" />
            <span class="copy">
                <span class="label">Encrypt uploads</span>
                <span class="state" id="gvault-toggle-state">Off</span>
            </span>
        </button>
    `;

    shadow.getElementById("gvault-toggle")?.addEventListener("click", () => {
        void setEnabled(!enabled, true);
    });

    return host;
}

function placeToggleInHeader(): void {
    const host = createToggleHost();
    const point = findDriveHeaderInsertPoint(document);
    if (!point) {
        return;
    }

    const alreadyPlaced = host.parentElement === point.parent && host.nextSibling === point.before;
    const alreadyFirst = host.parentElement === point.parent && host === point.parent.firstElementChild && point.before === host;
    if (alreadyPlaced || alreadyFirst) {
        return;
    }

    point.parent.insertBefore(host, point.before);
    updateToggleUi();
}

function startHeaderPlacement(): void {
    ensureToastHost();
    placeToggleInHeader();

    if (headerObserver) {
        return;
    }

    headerObserver = new MutationObserver(() => {
        if (placeFrame) {
            return;
        }
        placeFrame = window.requestAnimationFrame(() => {
            placeFrame = 0;
            placeToggleInHeader();
        });
    });
    headerObserver.observe(document.documentElement, { childList: true, subtree: true });
}

window.addEventListener("message", (event: MessageEvent) => {
    if (event.source === window && isMainMessage(event.data)) {
        if (event.data.type === "unsupported") {
            setBusy(false);
            releaseDriveDropUi();
            showToast("Could not read that folder. The original upload was cancelled so nothing was sent unencrypted.", "error");
            return;
        }

        handleInterceptedFiles(Array.from(event.data.files ?? []), event.data.relativePaths);
        return;
    }

    if (!isOverlayMessage(event.data) || event.origin !== extensionOrigin()) {
        return;
    }

    if (event.data.type === "ready") {
        sendStartToOverlay();
        return;
    }

    if (event.data.type === "cancel") {
        closeOverlay();
        showToast("Upload cancelled. The original file was not sent to Drive.");
        return;
    }

    if (event.data.type === "success") {
        const names = event.data.names ?? [];
        closeOverlay();
        const suffix = names.length === 1 ? names[0] : names.length === 0 ? "Files" : `${names.length} files`;
        showToast(`${suffix} encrypted and uploaded.`, "success");
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[DRIVE_ENCRYPT_UPLOADS_KEY]) {
        return;
    }
    void setEnabled(Boolean(changes[DRIVE_ENCRYPT_UPLOADS_KEY].newValue), false);
});

if (document.documentElement) {
    startHeaderPlacement();
} else {
    document.addEventListener("DOMContentLoaded", startHeaderPlacement, { once: true });
}
chrome.storage.local.get(DRIVE_ENCRYPT_UPLOADS_KEY).then((result) => {
    void setEnabled(Boolean(result[DRIVE_ENCRYPT_UPLOADS_KEY]), false);
});
