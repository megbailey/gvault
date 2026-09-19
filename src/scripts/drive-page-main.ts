import { DRIVE_PAGE_SOURCE_CONTENT, DRIVE_PAGE_SOURCE_MAIN } from "./drive-page-protocol";

type ContentToMainMessage =
    | { source: typeof DRIVE_PAGE_SOURCE_CONTENT; type: "set-enabled"; enabled: boolean }
    | { source: typeof DRIVE_PAGE_SOURCE_CONTENT; type: "set-busy"; busy: boolean };

let enabled = false;
let busy = false;

function isContentMessage(data: unknown): data is ContentToMainMessage {
    if (!data || typeof data !== "object") {
        return false;
    }
    const message = data as ContentToMainMessage;
    return message.source === DRIVE_PAGE_SOURCE_CONTENT;
}

function filesFromList(fileList: FileList | null | undefined): File[] {
    return Array.from(fileList ?? []);
}

function hasOsFiles(transfer: DataTransfer | null): boolean {
    if (!transfer) {
        return false;
    }
    return Array.from(transfer.types).includes("Files");
}

function fileInputFromEvent(event: Event): HTMLInputElement | null {
    for (const node of event.composedPath()) {
        if (node instanceof HTMLInputElement && node.type === "file") {
            return node;
        }
    }
    return null;
}

function isDirectoryInput(input: HTMLInputElement): boolean {
    return input.hasAttribute("webkitdirectory") || input.hasAttribute("directory");
}

function isDirectoryDrop(transfer: DataTransfer): boolean {
    const items = transfer.items;
    if (!items) {
        return false;
    }

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
            return true;
        }
    }

    return filesFromList(transfer.files).some(
        (file) => Boolean(file.webkitRelativePath && file.webkitRelativePath.includes("/"))
    );
}

function publishFiles(files: File[], unsupported?: "folder"): void {
    window.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_MAIN,
            type: unsupported ? "unsupported" : "files-selected",
            reason: unsupported,
            files: unsupported ? [] : files,
        },
        "*"
    );
}

function intercept(event: Event, files: File[], unsupported?: "folder"): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    busy = true;
    publishFiles(files, unsupported);
}

window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window || !isContentMessage(event.data)) {
        return;
    }

    if (event.data.type === "set-enabled") {
        enabled = Boolean(event.data.enabled);
        return;
    }

    if (event.data.type === "set-busy") {
        busy = Boolean(event.data.busy);
    }
});

document.addEventListener(
    "change",
    (event) => {
        if (!enabled || busy) {
            return;
        }

        const input = fileInputFromEvent(event);
        if (!input) {
            return;
        }

        const files = filesFromList(input.files);
        if (files.length === 0) {
            return;
        }

        if (isDirectoryInput(input) || files.some((file) => file.webkitRelativePath.includes("/"))) {
            intercept(event, files, "folder");
            input.value = "";
            return;
        }

        intercept(event, files);
        input.value = "";
    },
    true
);

document.addEventListener(
    "dragover",
    (event) => {
        if (!enabled || busy || !hasOsFiles(event.dataTransfer)) {
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
        }
    },
    true
);

document.addEventListener(
    "drop",
    (event) => {
        if (!enabled || busy || !hasOsFiles(event.dataTransfer) || !event.dataTransfer) {
            return;
        }

        if (isDirectoryDrop(event.dataTransfer)) {
            intercept(event, filesFromList(event.dataTransfer.files), "folder");
            return;
        }

        const files = filesFromList(event.dataTransfer.files);
        if (files.length === 0) {
            return;
        }

        intercept(event, files);
    },
    true
);
