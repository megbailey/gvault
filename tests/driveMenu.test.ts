/**
 * @vitest-environment jsdom
 *
 * "Download & Decrypt" is inserted immediately after Drive's Download item.
 */
import { describe, expect, it } from "vitest";
import {
    DECRYPT_MENU_ATTR,
    DOWNLOAD_AND_DECRYPT_LABEL,
    fileIdFromDriveUrl,
    isDownloadMenuItem,
    placeDownloadAndDecryptItems,
    placeDownloadAndDecryptToolbarButton,
    readSelectedDriveIds,
    selectionIncludesVaultFile,
} from "../src/utils/driveMenu";

function render(html: string): HTMLElement {
    document.body.innerHTML = html;
    return document.body;
}

describe("placeDownloadAndDecryptItems", () => {
    it("inserts Download & Decrypt directly under Download", () => {
        const root = render(`
            <div role="row" data-id="abc_def-1234" aria-selected="true">secret.gvault</div>
            <div role="menu" aria-label="More options">
                <div role="menuitem">Share</div>
                <div role="menuitem" aria-label="Download">Download</div>
                <div role="menuitem">Rename</div>
            </div>
        `);

        expect(placeDownloadAndDecryptItems(root)).toBe(1);
        const items = [...root.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent?.trim());
        expect(items).toEqual(["Share", "Download", DOWNLOAD_AND_DECRYPT_LABEL, "Rename"]);
        expect(root.querySelector(`[${DECRYPT_MENU_ATTR}]`)?.previousElementSibling?.getAttribute("aria-label")).toBe("Download");
    });

    it("copies the Download row, keeps its icon, and badges it with the GVault mark", () => {
        const root = render(`
            <div role="row" data-id="abc_def-1234" aria-selected="true">secret.gvault</div>
            <div role="menu" aria-label="More options">
                <div role="menuitem" class="drive-item" id="download-item" jsaction="click:drive.download" aria-label="Download ⌘D">
                    <div class="drive-icon" aria-hidden="true"><svg id="download-svg"></svg></div>
                    <div class="drive-label">Download</div>
                    <div class="drive-shortcut">⌘D</div>
                </div>
                <div role="menuitem">Rename</div>
            </div>
        `);

        expect(placeDownloadAndDecryptItems(root, "https://extension.example/logo.png")).toBe(1);
        const action = root.querySelector(`[${DECRYPT_MENU_ATTR}]`);
        expect(action?.className).toBe("drive-item");
        expect(action?.getAttribute("aria-label")).toBe(DOWNLOAD_AND_DECRYPT_LABEL);
        expect(action?.getAttribute("jsaction")).toBeNull();
        expect(action?.id).toBe("");
        expect(action?.querySelector("svg")).not.toBeNull();
        expect(action?.querySelector(".drive-shortcut")).toBeNull();
        expect(action?.textContent).toContain(DOWNLOAD_AND_DECRYPT_LABEL);
        expect(action?.textContent).not.toContain("⌘D");

        const badge = action?.querySelector("[data-gvault-badge]");
        expect(badge?.parentElement?.className).toBe("drive-icon");
        expect(badge?.querySelector("img")?.getAttribute("src")).toBe("https://extension.example/logo.png");
        expect(root.querySelector("#download-item")?.getAttribute("jsaction")).toBe("click:drive.download");
        expect(root.querySelector("#download-svg")).not.toBeNull();
    });

    it("does not insert a second item when placement runs again", () => {
        const root = render(`
            <div role="option" data-id="abc_def-1234" aria-selected="true" data-tooltip="notes.gvault"></div>
            <div role="menu">
                <div role="menuitem">Download</div>
            </div>
        `);

        placeDownloadAndDecryptItems(root);
        expect(placeDownloadAndDecryptItems(root)).toBe(0);
        expect(root.querySelectorAll(`[${DECRYPT_MENU_ATTR}]`)).toHaveLength(1);
    });

    it("matches Download when a shortcut follows the label and ignores Download all", () => {
        const root = render(`
            <div role="menu">
                <div role="menuitem" id="plain">Download</div>
                <div role="menuitem" id="shortcut" aria-label="Download ⌘D">Download</div>
                <div role="menuitem" id="all">Download all</div>
                <div role="menuitem" id="ours">${DOWNLOAD_AND_DECRYPT_LABEL}</div>
            </div>
        `);

        expect(isDownloadMenuItem(root.querySelector("#plain")!)).toBe(true);
        expect(isDownloadMenuItem(root.querySelector("#shortcut")!)).toBe(true);
        expect(isDownloadMenuItem(root.querySelector("#all")!)).toBe(false);
        expect(isDownloadMenuItem(root.querySelector("#ours")!)).toBe(false);
    });

    it("stays hidden unless a .gvault file is selected", () => {
        const root = render(`
            <div role="row" data-id="abc_def-1234" aria-selected="true">notes.pdf</div>
            <div role="menu">
                <div role="menuitem">Download</div>
                <div role="menuitem" ${DECRYPT_MENU_ATTR}="true">${DOWNLOAD_AND_DECRYPT_LABEL}</div>
            </div>
        `);

        expect(selectionIncludesVaultFile(root)).toBe(false);
        expect(placeDownloadAndDecryptItems(root)).toBe(0);
        expect(root.querySelector(`[${DECRYPT_MENU_ATTR}]`)).toBeNull();
    });

    it("appears when the selected name is only in the row tooltip", () => {
        const root = render(`
            <div role="gridcell" aria-selected="true">
                <div data-id="abc_def-1234" data-tooltip="Archive.GVAULT"></div>
            </div>
            <div role="menu">
                <div role="menuitem">Download</div>
            </div>
        `);

        expect(selectionIncludesVaultFile(root)).toBe(true);
        expect(placeDownloadAndDecryptItems(root)).toBe(1);
    });

    it("adds a Download & Decrypt button to the right of the toolbar Download button", () => {
        const root = render(`
            <div role="row" data-id="abc_def-1234" aria-selected="true">secret.gvault</div>
            <div role="toolbar" aria-label="Selection toolbar">
                <div role="button" aria-label="Share">Share</div>
                <div role="button" class="drive-download" aria-label="Download" jsaction="click:drive.download">
                    <div class="drive-icon" aria-hidden="true"><svg viewBox="0 0 24 24"></svg></div>
                </div>
                <div role="button" aria-label="Remove">Remove</div>
            </div>
            <div role="button" aria-label="Download" aria-hidden="true" style="display: none">Hidden download</div>
        `);

        const sourceButton = root.querySelector(".drive-download") as HTMLElement;
        const sourceSvg = root.querySelector(".drive-download svg") as SVGSVGElement;
        sourceButton.getBoundingClientRect = () => ({
            x: 100, y: 200, left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240, toJSON() { return {}; },
        });
        sourceSvg.getBoundingClientRect = () => ({
            x: 110, y: 208, left: 110, top: 208, width: 24, height: 24, right: 134, bottom: 232, toJSON() { return {}; },
        });
        sourceSvg.getBBox = () => ({
            x: 4, y: 4, width: 16, height: 16, top: 4, right: 20, bottom: 20, left: 4, toJSON() { return {}; },
        });

        expect(placeDownloadAndDecryptToolbarButton(root, "https://extension.example/logo.png")).toBe(1);
        const toolbar = root.querySelector("[role='toolbar']");
        const labels = [...toolbar!.querySelectorAll("[role='button']")].map((button) => button.getAttribute("aria-label"));
        expect(labels).toEqual(["Share", "Download", DOWNLOAD_AND_DECRYPT_LABEL, "Remove"]);

        const action = toolbar?.querySelector(`[${DECRYPT_MENU_ATTR}]`);
        expect(action?.getAttribute("role")).toBe("button");
        expect(action?.getAttribute("data-tooltip")).toBe(DOWNLOAD_AND_DECRYPT_LABEL);
        expect(action?.getAttribute("jsaction")).toBeNull();
        expect(action?.querySelector("svg")).not.toBeNull();
        const badge = action?.querySelector("[data-gvault-badge]") as HTMLElement | null;
        expect(badge?.querySelector("img")?.getAttribute("src")).toBe("https://extension.example/logo.png");
        expect(badge?.parentElement).toBe(action);
        expect(badge?.style.left).toBe("22px");
        expect(badge?.style.top).toBe("20px");
        const hidden = root.querySelector("[aria-hidden='true'][aria-label='Download']");
        expect(hidden?.nextElementSibling?.hasAttribute(DECRYPT_MENU_ATTR) ?? false).toBe(false);

        expect(placeDownloadAndDecryptToolbarButton(root, "https://extension.example/logo.png")).toBe(0);
        expect(toolbar?.querySelectorAll(`[${DECRYPT_MENU_ATTR}]`)).toHaveLength(1);
    });

    it("removes the toolbar button when the selection is not a .gvault file", () => {
        const root = render(`
            <div role="row" data-id="abc_def-1234" aria-selected="true">notes.pdf</div>
            <div role="toolbar">
                <div role="button" aria-label="Download">Download</div>
                <div role="button" ${DECRYPT_MENU_ATTR}="true" aria-label="${DOWNLOAD_AND_DECRYPT_LABEL}"></div>
            </div>
        `);

        expect(placeDownloadAndDecryptToolbarButton(root)).toBe(0);
        expect(root.querySelector(`[${DECRYPT_MENU_ATTR}]`)).toBeNull();
        expect(root.querySelector("[aria-label='Download']")).not.toBeNull();
    });

    it("reads selected Drive ids and a file preview url", () => {
        const root = render(`
            <div data-id="abc_def-1234" aria-selected="true"></div>
            <div data-id="abc_def-1234" aria-selected="true"></div>
            <div data-id="short" aria-selected="true"></div>
            <div data-id="secondFile1" aria-selected="false"></div>
            <div data-id="thirdFile12" aria-selected="true"></div>
        `);

        expect(readSelectedDriveIds(root)).toEqual(["abc_def-1234", "thirdFile12"]);
        expect(fileIdFromDriveUrl("https://drive.google.com/file/d/fileId_12345/view")).toBe("fileId_12345");
        expect(fileIdFromDriveUrl("https://drive.google.com/drive/my-drive")).toBeNull();
    });
});
