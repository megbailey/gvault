import { DRIVE_PAGE_SOURCE_CONTENT, DRIVE_PAGE_SOURCE_MAIN } from "./drive-page-protocol";

type ContentToMainMessage =
    | { source: typeof DRIVE_PAGE_SOURCE_CONTENT; type: "set-enabled"; enabled: boolean }
    | { source: typeof DRIVE_PAGE_SOURCE_CONTENT; type: "set-busy"; busy: boolean };

type FileSystemEntryLike = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
    file?: (success: (file: File) => void, error?: (error: Error) => void) => void;
    createReader?: () => {
        readEntries: (
            success: (entries: FileSystemEntryLike[]) => void,
            error?: (error: Error) => void
        ) => void;
    };
};

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

function relativePathsFromFiles(files: File[]): string[] {
    return files.map((file) => file.webkitRelativePath || file.name);
}

function publishFiles(files: File[], unsupported = false): void {
    window.postMessage(
        {
            source: DRIVE_PAGE_SOURCE_MAIN,
            type: unsupported ? "unsupported" : "files-selected",
            files: unsupported ? [] : files,
            relativePaths: unsupported ? [] : relativePathsFromFiles(files),
        },
        "*"
    );
}

function intercept(event: Event, files: File[]): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    busy = true;
    publishFiles(files);
}

function fileFromEntry(entry: FileSystemEntryLike): Promise<File> {
    return new Promise((resolve, reject) => {
        if (!entry.file) {
            reject(new Error("Could not read file."));
            return;
        }
        entry.file(resolve, reject);
    });
}

function readAllEntries(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
    const reader = entry.createReader?.();
    if (!reader) {
        return Promise.resolve([]);
    }

    const collected: FileSystemEntryLike[] = [];
    return new Promise((resolve, reject) => {
        const pull = () => {
            reader.readEntries((batch) => {
                if (batch.length === 0) {
                    resolve(collected);
                    return;
                }
                collected.push(...batch);
                pull();
            }, reject);
        };
        pull();
    });
}

function withRelativePath(file: File, relativePath: string): File {
    const next = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
    });
    Object.defineProperty(next, "webkitRelativePath", {
        configurable: true,
        enumerable: true,
        value: relativePath,
    });
    return next;
}

async function collectEntry(
    entry: FileSystemEntryLike,
    parentPath: string,
    output: File[]
): Promise<void> {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
        const file = await fileFromEntry(entry);
        output.push(withRelativePath(file, path));
        return;
    }

    if (!entry.isDirectory) {
        return;
    }

    const children = await readAllEntries(entry);
    for (const child of children) {
        await collectEntry(child, path, output);
    }
}

async function filesFromDataTransfer(transfer: DataTransfer): Promise<File[]> {
    const items = transfer.items;
    if (items && items.length > 0) {
        const entries: FileSystemEntryLike[] = [];
        for (let index = 0; index < items.length; index++) {
            const entry = items[index].webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined;
            if (entry) {
                entries.push(entry);
            }
        }

        if (entries.length > 0) {
            const collected: File[] = [];
            for (const entry of entries) {
                await collectEntry(entry, "", collected);
            }
            return collected;
        }
    }

    return filesFromList(transfer.files);
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

        event.preventDefault();
        event.stopImmediatePropagation();
        busy = true;
        const transfer = event.dataTransfer;
        void filesFromDataTransfer(transfer)
            .then((files) => {
                if (files.length === 0) {
                    publishFiles([], true);
                    return;
                }
                publishFiles(files);
            })
            .catch(() => {
                publishFiles([], true);
            });
    },
    true
);
