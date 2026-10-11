import { describe, expect, it } from "vitest";
import { popupExtensionForTooltip, type PopupBox } from "../src/utils/popupTooltipFit";

const popup: PopupBox = { left: 0, top: 0, right: 380, bottom: 420, width: 380, height: 420 };

describe("popupExtensionForTooltip", () => {
    it("adds space below the form when the tip hangs past the bottom", () => {
        expect(popupExtensionForTooltip(popup, { left: 48, top: 300, right: 304, bottom: 520, width: 256, height: 220 })).toEqual({
            width: 380,
            minHeight: 532,
        });
    });

    it("keeps the current size when the tip already fits", () => {
        expect(popupExtensionForTooltip(popup, { left: 40, top: 80, right: 280, bottom: 200, width: 240, height: 120 })).toEqual({
            width: 380,
            minHeight: 420,
        });
    });

    it("grows only up to the window when the tip hangs past the visible bottom", () => {
        const tall = { left: 0, top: 0, right: 380, bottom: 666, width: 380, height: 666 };
        expect(popupExtensionForTooltip(tall, { left: 48, top: 466, right: 304, bottom: 616, width: 256, height: 150 }, 600)).toEqual({
            width: 380,
            minHeight: 600,
        });
    });
});
