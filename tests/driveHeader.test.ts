/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { findDriveHeaderInsertPoint } from "../src/utils/drivePage";

function render(html: string): HTMLElement {
    document.body.innerHTML = html;
    return document.body;
}

describe("findDriveHeaderInsertPoint", () => {
    it("prepends into the One Google Bar right cluster so the toggle sits left of existing icons", () => {
        const root = render(`
            <header role="banner">
                <div>Drive</div>
                <input aria-label="Search in Drive" />
                <div data-ogsr-up>
                    <a aria-label="Support">Support</a>
                    <a aria-label="Google apps">Apps</a>
                    <a aria-label="Google Account: Ada (ada@gmail.com)">Account</a>
                </div>
            </header>
        `);

        const point = findDriveHeaderInsertPoint(root);
        expect(point?.parent.getAttribute("data-ogsr-up")).not.toBeNull();
        expect(point?.before).toBe(point?.parent.firstChild);
    });

    it("uses the shared parent of Account and Apps when data-ogsr-up is absent", () => {
        const root = render(`
            <header role="banner">
                <div role="search"><input aria-label="Search in Drive" /></div>
                <div class="right-cluster">
                    <a aria-label="Google apps">Apps</a>
                    <a aria-label="Google Account: Ada (ada@gmail.com)">Account</a>
                </div>
            </header>
        `);

        const point = findDriveHeaderInsertPoint(root);
        expect((point?.parent as HTMLElement).className).toBe("right-cluster");
        expect(point?.before).toBe(point?.parent.firstChild);
    });

    it("inserts immediately before the account control when it is a header sibling", () => {
        const root = render(`
            <header role="banner">
                <input aria-label="Search in Drive" />
                <a aria-label="Google Account: Ada (ada@gmail.com)">Account</a>
            </header>
        `);

        const point = findDriveHeaderInsertPoint(root);
        expect(point?.parent.getAttribute("role")).toBe("banner");
        expect((point?.before as HTMLElement).getAttribute("aria-label")).toBe(
            "Google Account: Ada (ada@gmail.com)"
        );
    });

    it("returns null when the Drive header has not rendered yet", () => {
        const root = render(`<main>Loading Drive</main>`);
        expect(findDriveHeaderInsertPoint(root)).toBeNull();
    });
});
