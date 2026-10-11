/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { bindPopupTooltipOverflow } from "../src/utils/popupTooltipFit";

describe("bindPopupTooltipOverflow", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("lets the tooltip paint outside the body without resizing the popup", async () => {
        document.body.innerHTML = `<div class="popup"><span class="c-tooltip__text"></span></div>`;
        const popup = document.querySelector(".popup") as HTMLElement;
        const tip = popup.querySelector(".c-tooltip__text") as HTMLElement;
        const stop = bindPopupTooltipOverflow(popup);

        tip.classList.add("show");
        await Promise.resolve();

        expect(popup.classList.contains("popup--tooltip-open")).toBe(true);
        expect(popup.style.width).toBe("");
        expect(popup.style.minHeight).toBe("");

        tip.classList.remove("show");
        await Promise.resolve();

        expect(popup.classList.contains("popup--tooltip-open")).toBe(false);
        stop();
    });
});