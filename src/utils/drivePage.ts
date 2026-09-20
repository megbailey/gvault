export type DriveUploadDestination = {
    folderId: string;
    label: string;
};

export type InterceptedFileLike = {
    size: number;
    webkitRelativePath?: string;
};

export type InterceptValidation =
    | { ok: true }
    | { ok: false; reason: "empty" | "too-large" | "too-many" };

export type UploadSummary = {
    isFolder: boolean;
    rootNames: string[];
    fileCount: number;
};

const FOLDER_PATH_PATTERN = /\/folders\/([a-zA-Z0-9_-]+)/;

export function parseDriveUploadDestination(url: string): DriveUploadDestination {
    let pathname = "";
    try {
        pathname = new URL(url).pathname;
    } catch {
        return { folderId: "root", label: "My Drive" };
    }

    const folderMatch = FOLDER_PATH_PATTERN.exec(pathname);
    if (folderMatch) {
        return { folderId: folderMatch[1], label: "Current folder" };
    }

    return { folderId: "root", label: "My Drive" };
}

export function normalizeRelativePath(path: string, fallbackName: string): string {
    const cleaned = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();
    return cleaned || fallbackName;
}

export function relativePathForFile(
    file: { name: string; webkitRelativePath?: string },
    explicitPath?: string
): string {
    return normalizeRelativePath(explicitPath || file.webkitRelativePath || "", file.name);
}

export function parentFolderSegments(relativePath: string): string[] {
    const parts = relativePath.split("/").filter(Boolean);
    parts.pop();
    return parts;
}

export function isDirectoryUpload(
    files: InterceptedFileLike[],
    relativePaths?: string[],
    input?: { webkitdirectory?: boolean }
): boolean {
    if (input?.webkitdirectory) {
        return true;
    }

    if (relativePaths?.some((path) => path.includes("/"))) {
        return true;
    }

    return files.some((file) => {
        const relativePath = file.webkitRelativePath;
        return Boolean(relativePath && relativePath.includes("/"));
    });
}

export function summarizeInterceptedUpload(
    files: Array<{ name: string; webkitRelativePath?: string }>,
    relativePaths?: string[]
): UploadSummary {
    const paths = files.map((file, index) => relativePathForFile(file, relativePaths?.[index]));
    const isFolder = paths.some((path) => path.includes("/"));
    const rootNames = isFolder
        ? [...new Set(paths.map((path) => path.split("/").filter(Boolean)[0] ?? ""))]
            .filter(Boolean)
        : [];

    return {
        isFolder,
        rootNames,
        fileCount: files.length,
    };
}

export function validateInterceptedFiles(
    files: InterceptedFileLike[],
    options: { maxFileSize: number; maxFiles: number }
): InterceptValidation {
    if (files.length === 0) {
        return { ok: false, reason: "empty" };
    }

    if (files.length > options.maxFiles) {
        return { ok: false, reason: "too-many" };
    }

    if (files.some((file) => file.size > options.maxFileSize)) {
        return { ok: false, reason: "too-large" };
    }

    return { ok: true };
}

export function releaseDriveDropUi(from?: EventTarget | null, root: Document = document): void {
    const active = root.activeElement;
    if (active instanceof HTMLElement && active !== root.body && active !== root.documentElement) {
        active.blur();
    }

    const view = root.defaultView;
    try {
        const leave = new DragEvent("dragleave", {
            bubbles: true,
            cancelable: true,
            composed: true,
            relatedTarget: null,
            view,
        });
        if (from instanceof EventTarget) {
            from.dispatchEvent(leave);
        }
        root.documentElement.dispatchEvent(
            new DragEvent("dragleave", {
                bubbles: true,
                cancelable: true,
                composed: true,
                relatedTarget: null,
                view,
            })
        );
        root.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                composed: true,
                view,
            })
        );
    } catch {
        // DragEvent construction is unavailable in some test environments.
    }
}

export function interceptRejectionMessage(
    reason: Exclude<InterceptValidation, { ok: true }>["reason"],
    options: { maxFileSizeLabel: string; maxFiles: number }
): string {
    switch (reason) {
        case "too-large":
            return `Each file must be ${options.maxFileSizeLabel} or smaller. The original upload was cancelled so nothing was sent unencrypted.`;
        case "too-many":
            return `Upload up to ${options.maxFiles} files at a time while GVault is on. The original upload was cancelled so nothing was sent unencrypted.`;
        default:
            return "No files were selected.";
    }
}

export type HeaderInsertPoint = {
    parent: Element;
    before: Node | null;
};

const ACCOUNT_LABEL = /google account/i;
const APPS_LABEL = /google apps/i;
const SUPPORT_LABEL = /^(support|help)(\s+menu)?$/i;

function queryByAccessibleName(root: ParentNode, pattern: RegExp): HTMLElement | null {
    for (const node of root.querySelectorAll<HTMLElement>("[aria-label], [title]")) {
        const aria = node.getAttribute("aria-label") ?? "";
        const title = node.getAttribute("title") ?? "";
        if (pattern.test(aria) || pattern.test(title)) {
            return node;
        }
    }
    return null;
}

function isBanner(el: Element): boolean {
    return el.tagName === "HEADER" || el.getAttribute("role") === "banner" || el.id === "gb";
}

function hasSearch(el: Element): boolean {
    if (el.getAttribute("role") === "search") {
        return true;
    }
    if (el.querySelector('[role="search"]')) {
        return true;
    }
    for (const input of el.querySelectorAll("input")) {
        const label = `${input.getAttribute("aria-label") ?? ""} ${input.getAttribute("placeholder") ?? ""} ${input.type}`;
        if (/search/i.test(label)) {
            return true;
        }
    }
    return false;
}

function firstInDocumentOrder(nodes: Element[]): Element {
    return nodes.reduce((leftmost, node) =>
        leftmost.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING ? leftmost : node
    );
}

function ancestorsUntil(el: Element, stop: Element): Element[] {
    const list: Element[] = [];
    let node: Element | null = el;
    while (node && node !== stop) {
        list.push(node);
        node = node.parentElement;
    }
    return list;
}

function lowestCommonAncestor(a: Element, b: Element, stop: Element): Element | null {
    const fromA = new Set(ancestorsUntil(a, stop));
    let node: Element | null = b;
    while (node && node !== stop) {
        if (fromA.has(node)) {
            return node;
        }
        node = node.parentElement;
    }
    return null;
}

function clusterFromAnchor(anchor: HTMLElement, header: Element): Element {
    let node: HTMLElement = anchor;
    while (node.parentElement && node.parentElement !== header) {
        const parent = node.parentElement;
        if (hasSearch(parent) || isBanner(parent)) {
            return node;
        }
        node = parent;
    }
    return node;
}

function prependPoint(container: Element): HeaderInsertPoint {
    return { parent: container, before: container.firstChild };
}

function beforePoint(node: Element): HeaderInsertPoint | null {
    if (!node.parentElement) {
        return null;
    }
    return { parent: node.parentElement, before: node };
}

export function findDriveHeader(root: ParentNode = document): HTMLElement | null {
    return (
        root.querySelector<HTMLElement>("header[role='banner']") ||
        root.querySelector<HTMLElement>("[role='banner']") ||
        root.querySelector<HTMLElement>("header") ||
        root.querySelector<HTMLElement>("#gb")
    );
}

export function findDriveHeaderInsertPoint(root: ParentNode = document): HeaderInsertPoint | null {
    const header = findDriveHeader(root);
    if (!header) {
        return null;
    }

    const oneGoogleRight = header.querySelector("[data-ogsr-up]");
    if (oneGoogleRight) {
        return prependPoint(oneGoogleRight);
    }

    const uniqueAnchors = [
        queryByAccessibleName(header, ACCOUNT_LABEL),
        queryByAccessibleName(header, APPS_LABEL),
        queryByAccessibleName(header, SUPPORT_LABEL),
    ].filter((node): node is HTMLElement => node !== null);
    if (uniqueAnchors.length === 0) {
        return null;
    }

    if (uniqueAnchors.length >= 2) {
        const cluster = lowestCommonAncestor(uniqueAnchors[0], uniqueAnchors[1], header);
        if (cluster && cluster !== header) {
            return prependPoint(cluster);
        }
        return beforePoint(firstInDocumentOrder(uniqueAnchors));
    }

    const cluster = clusterFromAnchor(uniqueAnchors[0], header);
    if (cluster === uniqueAnchors[0]) {
        return beforePoint(cluster);
    }
    return prependPoint(cluster);
}
