import { VAULT_FILE_SUFFIX } from "./vaultBinary";

export const DOWNLOAD_AND_DECRYPT_LABEL = "Download & Decrypt";
export const DECRYPT_MENU_ATTR = "data-gvault-decrypt";

const DRIVE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;
const FILE_URL_PATTERN = /\/file\/d\/([a-zA-Z0-9_-]+)/;

export function menuItemLabel(item: Element): string {
    const aria = item.getAttribute("aria-label")?.replace(/\s+/g, " ").trim();
    if (aria) {
        return aria;
    }
    const tooltip = item.getAttribute("data-tooltip")?.replace(/\s+/g, " ").trim()
        || item.getAttribute("title")?.replace(/\s+/g, " ").trim();
    if (tooltip) {
        return tooltip;
    }
    const firstLine = (item.textContent ?? "")
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean);
    return firstLine ?? "";
}

function isShortcutSuffix(rest: string): boolean {
    return /^[\u2318\u2325\u2303\u21E7⌘⌥⌃⇧]/.test(rest)
        || /^(?:ctrl|cmd|alt|shift|command|option|control)\b/i.test(rest);
}

export function isDownloadMenuItem(item: Element): boolean {
    const label = menuItemLabel(item);
    if (/decrypt/i.test(label)) {
        return false;
    }
    if (label === "Download") {
        return true;
    }
    if (!label.startsWith("Download")) {
        return false;
    }
    const rest = label.slice("Download".length).trim().replace(/^[,·•|]\s*/, "");
    return rest.length > 0 && isShortcutSuffix(rest);
}

export function fileIdFromDriveUrl(url: string): string | null {
    const match = FILE_URL_PATTERN.exec(url);
    return match?.[1] ?? null;
}

function isVaultFileToken(token: string): boolean {
    const cleaned = token.replace(/[),.;:]+$/g, "");
    return cleaned.toLowerCase().endsWith(VAULT_FILE_SUFFIX);
}

function textIncludesVaultFile(value: string): boolean {
    return value
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .some((token) => token.length > 0 && isVaultFileToken(token));
}

function elementLooksLikeVault(element: Element): boolean {
    const row = element.closest("[data-id], [role='row'], [role='option']") ?? element;
    if (textIncludesVaultFile(row.textContent ?? "")) {
        return true;
    }
    const labelled = [row, ...row.querySelectorAll("[aria-label], [title], [data-tooltip]")];
    return labelled.some((node) => (
        ["aria-label", "title", "data-tooltip"] as const
    ).some((name) => textIncludesVaultFile(node.getAttribute(name) ?? "")));
}

function selectionScope(root: ParentNode): ParentNode {
    return root instanceof Document ? root : root.ownerDocument ?? root;
}

export function selectionIncludesVaultFile(root: ParentNode): boolean {
    return [...selectionScope(root).querySelectorAll('[aria-selected="true"]')].some(elementLooksLikeVault);
}

export function selectedNonVaultIds(root: ParentNode, extraIds: readonly string[] = []): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    const consider = (row: Element | null) => {
        if (!(row instanceof HTMLElement) || elementLooksLikeVault(row)) {
            return;
        }
        const id = row.getAttribute("data-id") ?? "";
        if (!DRIVE_ID_PATTERN.test(id) || seen.has(id)) {
            return;
        }
        seen.add(id);
        ids.push(id);
    };

    selectionScope(root).querySelectorAll<HTMLElement>('[aria-selected="true"], [aria-checked="true"]').forEach((element) => {
        consider(element.closest<HTMLElement>("[data-id]") ?? (element.hasAttribute("data-id") ? element : null));
    });
    for (const id of extraIds) {
        const row = selectionScope(root).querySelector<HTMLElement>(`[data-id="${id}"]`);
        consider(row ?? null);
        if (!row && DRIVE_ID_PATTERN.test(id) && !seen.has(id) && !selectionIncludesVaultFile(root)) {
            seen.add(id);
            ids.push(id);
        }
    }
    return ids;
}

export const MENU_HOVER_STYLE_ID = "gvault-menu-hover";

export function ensureDecryptMenuHoverStyle(doc: Document): void {
    if (doc.getElementById(MENU_HOVER_STYLE_ID)) {
        return;
    }
    const style = doc.createElement("style");
    style.id = MENU_HOVER_STYLE_ID;
    style.textContent = [
        `[${DECRYPT_MENU_ATTR}][role="menuitem"]:hover * { background-color: transparent !important; }`,
        `[${DECRYPT_MENU_ATTR}][role="menuitem"]:hover { background-color: #f1f3f4 !important; }`,
    ].join("\n");
    (doc.head ?? doc.documentElement).appendChild(style);
}

function decryptActionsVisible(root: ParentNode, foldersWithVaults?: ReadonlySet<string>): boolean {
    if (selectionIncludesVaultFile(root)) {
        return true;
    }
    if (!foldersWithVaults || foldersWithVaults.size === 0) {
        return false;
    }
    return selectedNonVaultIds(root).some((id) => foldersWithVaults.has(id));
}

export function readSelectedDriveIds(root: ParentNode): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    root.querySelectorAll<HTMLElement>('[aria-selected="true"][data-id]').forEach((element) => {
        const id = element.getAttribute("data-id") ?? "";
        if (!DRIVE_ID_PATTERN.test(id) || seen.has(id)) {
            return;
        }
        seen.add(id);
        ids.push(id);
    });
    return ids;
}

const DRIVE_BEHAVIOR_ATTRS = ["id", "jslog", "data-ved", "data-id"];

function stripDriveBehavior(root: HTMLElement): void {
    for (const node of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
        for (const name of DRIVE_BEHAVIOR_ATTRS) {
            node.removeAttribute(name);
        }
        node.removeAttribute("aria-keyshortcuts");
    }
}

function replaceDownloadLabel(root: HTMLElement): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        const text = node.textContent ?? "";
        if (text.trim() === "Download") {
            node.textContent = text.replace("Download", DOWNLOAD_AND_DECRYPT_LABEL);
            return;
        }
        node = walker.nextNode();
    }
}

function isShortcutLabel(value: string): boolean {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text || /download/i.test(text)) {
        return false;
    }
    return isShortcutSuffix(text);
}

function removeShortcut(item: HTMLElement): void {
    const leaves = [...item.querySelectorAll<HTMLElement>("*")].filter((node) => node.childElementCount === 0);
    for (const leaf of leaves) {
        if (!isShortcutLabel(leaf.textContent ?? "")) {
            continue;
        }
        let current: HTMLElement | null = leaf;
        while (current && current !== item) {
            const parent: HTMLElement | null = current.parentElement;
            current.remove();
            if (!parent || parent === item || (parent.textContent ?? "").trim().length > 0) {
                break;
            }
            current = parent;
        }
    }
}

function containsDownloadLabel(node: Element): boolean {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    return text === "Download" || text.includes(DOWNLOAD_AND_DECRYPT_LABEL) || /\bDownload\b/.test(text);
}

const BADGE_SIZE = 10;
const BADGE_OVERLAP = 2;

type BadgeAnchor = {
    loose: boolean;
    left: number;
    top: number;
};

type ScreenBox = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

function screenBox(rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">): ScreenBox {
    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
}

function safeBBox(graphic: SVGGraphicsElement): DOMRect | null {
    if (typeof graphic.getBBox !== "function") {
        return null;
    }
    try {
        const box = graphic.getBBox();
        return box.width > 0 && box.height > 0 ? box : null;
    } catch {
        return null;
    }
}

function svgDrawnBox(svg: SVGSVGElement): DOMRect | null {
    const full = safeBBox(svg);
    const view = svg.viewBox?.baseVal;
    const fillsView = Boolean(
        full
        && view
        && view.width > 0
        && view.height > 0
        && full.width >= view.width - 0.5
        && full.height >= view.height - 0.5
    );
    if (full && !fillsView) {
        return full;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    svg.querySelectorAll("path, circle, polygon, polyline, line, ellipse").forEach((shape) => {
        if (!(shape instanceof SVGGraphicsElement)) {
            return;
        }
        const box = safeBBox(shape);
        if (!box) {
            return;
        }
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
    });

    if (Number.isFinite(minX) && maxX > minX && maxY > minY) {
        return new DOMRect(minX, minY, maxX - minX, maxY - minY);
    }
    return full;
}

function svgContentBox(svg: SVGSVGElement): ScreenBox | null {
    if (typeof svg.getBBox !== "function") {
        return null;
    }

    const bbox = svgDrawnBox(svg);
    if (!bbox) {
        return null;
    }
    if (bbox.width <= 0 || bbox.height <= 0) {
        return null;
    }

    const element = svg.getBoundingClientRect();
    if (element.width < 1 || element.height < 1) {
        return null;
    }

    const view = svg.viewBox?.baseVal;
    const vbWidth = view && view.width > 0 ? view.width : element.width;
    const vbHeight = view && view.height > 0 ? view.height : element.height;
    const vbX = view && view.width > 0 ? view.x : 0;
    const vbY = view && view.height > 0 ? view.y : 0;
    if (vbWidth <= 0 || vbHeight <= 0) {
        return null;
    }
    if (bbox.width >= vbWidth - 0.5 && bbox.height >= vbHeight - 0.5) {
        return null;
    }

    const ctm = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
    if (ctm && typeof svg.createSVGPoint === "function") {
        try {
            const mapPoint = (x: number, y: number) => {
                const point = svg.createSVGPoint();
                point.x = x;
                point.y = y;
                return point.matrixTransform(ctm);
            };
            const start = mapPoint(bbox.x, bbox.y);
            const end = mapPoint(bbox.x + bbox.width, bbox.y + bbox.height);
            const left = Math.min(start.x, end.x);
            const top = Math.min(start.y, end.y);
            const right = Math.max(start.x, end.x);
            const bottom = Math.max(start.y, end.y);
            if (right - left >= 1 && bottom - top >= 1) {
                return { left, top, right, bottom, width: right - left, height: bottom - top };
            }
        } catch {
            // The viewBox scale below still maps the drawn paths into the icon.
        }
    }

    const left = element.left + ((bbox.x - vbX) / vbWidth) * element.width;
    const top = element.top + ((bbox.y - vbY) / vbHeight) * element.height;
    const width = (bbox.width / vbWidth) * element.width;
    const height = (bbox.height / vbHeight) * element.height;
    return { left, top, right: left + width, bottom: top + height, width, height };
}

function paintedIconBox(control: HTMLElement): ScreenBox | null {
    const svg = control.querySelector("svg");
    if (svg instanceof SVGSVGElement) {
        const content = svgContentBox(svg);
        if (content) {
            return content;
        }
        const rect = svg.getBoundingClientRect();
        if (rect.width >= 1 && rect.height >= 1) {
            return screenBox(rect);
        }
    }

    const image = control.querySelector("img:not([data-gvault-badge])");
    if (image) {
        const rect = image.getBoundingClientRect();
        if (rect.width >= 1 && rect.height >= 1) {
            return screenBox(rect);
        }
    }

    let best: ScreenBox | null = null;
    control.querySelectorAll<HTMLElement>("[aria-hidden='true']").forEach((node) => {
        if (node === control || node.closest("[data-gvault-badge]") || containsDownloadLabel(node)) {
            return;
        }
        const rect = node.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8 || rect.width > 36 || rect.height > 36) {
            return;
        }
        if (!best || rect.width * rect.height < best.width * best.height) {
            best = screenBox(rect);
        }
    });
    return best;
}

function badgeOffsetWithin(control: HTMLElement): { left: number; top: number } | null {
    const painted = paintedIconBox(control);
    const host = control.getBoundingClientRect();
    if (!painted || host.width < 1 || host.height < 1) {
        return null;
    }
    return {
        left: painted.right - host.left - control.clientLeft - BADGE_SIZE + BADGE_OVERLAP,
        top: painted.bottom - host.top - control.clientTop - BADGE_SIZE + BADGE_OVERLAP,
    };
}

function pinToolbarBadge(button: HTMLElement, offset: { left: number; top: number }): void {
    const frame = button.querySelector<HTMLElement>("[data-gvault-badge]");
    if (!frame) {
        return;
    }
    if (!button.style.position || button.style.position === "static") {
        button.style.position = "relative";
    }
    button.style.overflow = "visible";
    if (frame.parentElement !== button) {
        button.appendChild(frame);
    }
    frame.style.right = "auto";
    frame.style.bottom = "auto";
    frame.style.left = `${offset.left}px`;
    frame.style.top = `${offset.top}px`;
}

function measureBadgeAnchor(source: HTMLElement): BadgeAnchor | null {
    const graphic = source.querySelector("svg, img");
    const parent = graphic?.parentElement;
    if (!(graphic instanceof Element) || !(parent instanceof HTMLElement) || parent === source) {
        return null;
    }

    const graphicRect = graphic.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    if (graphicRect.width < 1 || parentRect.width < 1 || parentRect.height < 1) {
        return null;
    }

    const loose = parentRect.width - graphicRect.width > 6 || parentRect.height - graphicRect.height > 6;
    if (!loose) {
        return null;
    }

    return {
        loose: true,
        left: graphicRect.right - parentRect.left - BADGE_SIZE + BADGE_OVERLAP,
        top: graphicRect.bottom - parentRect.top - BADGE_SIZE + BADGE_OVERLAP,
    };
}

function findIconHost(item: HTMLElement): HTMLElement | null {
    const graphic = item.querySelector("svg, img:not([data-gvault-badge])");
    if (graphic instanceof Element) {
        const parent = graphic.parentElement;
        if (parent instanceof HTMLElement && parent !== item && !containsDownloadLabel(parent)) {
            return parent;
        }
        const wrap = document.createElement("span");
        wrap.setAttribute("data-gvault-icon", "true");
        wrap.style.position = "relative";
        wrap.style.display = "inline-flex";
        graphic.replaceWith(wrap);
        wrap.appendChild(graphic);
        return wrap;
    }

    return [...item.querySelectorAll<HTMLElement>("[aria-hidden='true']")]
        .find((node) => node !== item && !containsDownloadLabel(node)) ?? null;
}

function attachVaultBadge(item: HTMLElement, logoUrl: string, anchor: BadgeAnchor | null = null): void {
    const host = findIconHost(item);
    if (!host) {
        return;
    }
    if (!host.style.position || host.style.position === "static") {
        host.style.position = "relative";
    }
    host.style.overflow = "visible";

    const frame = document.createElement("span");
    frame.setAttribute("data-gvault-badge", "true");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = [
        "position: absolute",
        anchor?.loose ? `left: ${anchor.left}px` : "right: -2px",
        anchor?.loose ? `top: ${anchor.top}px` : "bottom: -2px",
        "width: 10px",
        "height: 10px",
        "border-radius: 2px",
        "overflow: hidden",
        "background: #041f1e",
        "box-shadow: 0 0 0 1px #fff",
        "pointer-events: none",
        "z-index: 1",
    ].join(";");

    const badge = document.createElement("img");
    badge.alt = "";
    badge.src = logoUrl;
    badge.draggable = false;
    badge.style.cssText = [
        "position: absolute",
        "left: 50%",
        "top: 50%",
        "width: 13px",
        "height: 13px",
        "transform: translate(-50%, -50%)",
        "pointer-events: none",
    ].join(";");
    frame.appendChild(badge);
    host.appendChild(frame);
}

function isHiddenControl(item: HTMLElement): boolean {
    let current: HTMLElement | null = item;
    while (current) {
        if (current.hidden || current.getAttribute("aria-hidden") === "true") {
            return true;
        }
        if (/display\s*:\s*none/i.test(current.getAttribute("style") ?? "")) {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

function isToolbarDownloadButton(item: HTMLElement): boolean {
    return item.getAttribute("role") === "button"
        && !item.hasAttribute(DECRYPT_MENU_ATTR)
        && !item.closest("[role='menu']")
        && !isHiddenControl(item)
        && isDownloadMenuItem(item);
}

function createDownloadAndDecryptControl(source: HTMLElement, logoUrl?: string): HTMLElement {
    const anchor = logoUrl && source.getAttribute("role") !== "button" ? measureBadgeAnchor(source) : null;
    const action = source.cloneNode(true) as HTMLElement;
    stripDriveBehavior(action);
    const role = source.getAttribute("role") === "button" ? "button" : "menuitem";
    action.setAttribute("role", role);
    action.setAttribute(DECRYPT_MENU_ATTR, "true");
    action.setAttribute("aria-label", DOWNLOAD_AND_DECRYPT_LABEL);
    if (role === "button") {
        action.setAttribute("data-tooltip", DOWNLOAD_AND_DECRYPT_LABEL);
        action.setAttribute("title", DOWNLOAD_AND_DECRYPT_LABEL);
    }
    replaceDownloadLabel(action);
    removeShortcut(action);
    if (logoUrl) {
        attachVaultBadge(action, logoUrl, anchor);
    }
    return action;
}

export function removeDownloadAndDecryptItems(root: ParentNode): void {
    root.querySelectorAll(`[${DECRYPT_MENU_ATTR}]`).forEach((node) => node.remove());
}

export function placeDownloadAndDecryptItems(
    root: ParentNode,
    logoUrl?: string,
    foldersWithVaults?: ReadonlySet<string>
): number {
    if (!decryptActionsVisible(root, foldersWithVaults)) {
        removeDownloadAndDecryptItems(root);
        return 0;
    }

    const doc = root instanceof Document ? root : root.ownerDocument;
    if (doc) {
        ensureDecryptMenuHoverStyle(doc);
    }

    let inserted = 0;
    const scope = root instanceof Element && root.getAttribute("role") === "menuitem"
        ? root.parentElement ?? root
        : root;
    scope.querySelectorAll<HTMLElement>('[role="menuitem"]').forEach((item) => {
        if (!isDownloadMenuItem(item) || item.hasAttribute(DECRYPT_MENU_ATTR)) {
            return;
        }
        const next = item.nextElementSibling;
        if (next?.hasAttribute(DECRYPT_MENU_ATTR)) {
            return;
        }

        item.insertAdjacentElement("afterend", createDownloadAndDecryptControl(item, logoUrl));
        inserted += 1;
    });
    return inserted;
}

export function placeDownloadAndDecryptToolbarButton(
    root: ParentNode,
    logoUrl?: string,
    foldersWithVaults?: ReadonlySet<string>
): number {
    const buttons = [...root.querySelectorAll<HTMLElement>(`[${DECRYPT_MENU_ATTR}][role="button"]`)];
    if (!decryptActionsVisible(root, foldersWithVaults)) {
        buttons.forEach((button) => button.remove());
        return 0;
    }

    let inserted = 0;
    root.querySelectorAll<HTMLElement>('[role="button"]').forEach((item) => {
        if (!isToolbarDownloadButton(item)) {
            return;
        }
        const next = item.nextElementSibling;
        if (next?.getAttribute("role") === "button" && next.hasAttribute(DECRYPT_MENU_ATTR)) {
            const existing = next as HTMLElement;
            const offset = badgeOffsetWithin(item) ?? badgeOffsetWithin(existing);
            if (offset) {
                pinToolbarBadge(existing, offset);
            }
            return;
        }
        const offset = badgeOffsetWithin(item);
        const action = createDownloadAndDecryptControl(item, logoUrl);
        item.insertAdjacentElement("afterend", action);
        if (offset) {
            pinToolbarBadge(action, offset);
        }
        inserted += 1;
    });
    return inserted;
}

export function isDownloadAndDecryptItem(node: EventTarget | null): boolean {
    return node instanceof Element && Boolean(node.closest(`[${DECRYPT_MENU_ATTR}]`));
}
