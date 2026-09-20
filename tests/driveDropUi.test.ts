/**
 * @vitest-environment jsdom
 *
 * After an intercepted drop, Drive never sees the real drop event, so its
 * drop-target highlight has to be cleared by blurring focus and emitting
 * dragleave / dragend.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { releaseDriveDropUi } from "../src/utils/drivePage";

beforeAll(() => {
    if (typeof DragEvent !== "undefined") {
        return;
    }
    class FakeDragEvent extends Event {
        constructor(type: string, init?: EventInit) {
            super(type, init);
        }
    }
    Object.defineProperty(globalThis, "DragEvent", { value: FakeDragEvent });
});

describe("releaseDriveDropUi", () => {
    it("blurs the active drop target and emits dragleave and dragend", () => {
        const target = document.createElement("div");
        target.tabIndex = 0;
        document.body.appendChild(target);
        target.focus();
        expect(document.activeElement).toBe(target);

        const types: string[] = [];
        const onEvent = (event: Event) => {
            types.push(event.type);
        };
        target.addEventListener("dragleave", onEvent);
        document.documentElement.addEventListener("dragleave", onEvent);
        document.addEventListener("dragend", onEvent);

        releaseDriveDropUi(target);

        expect(document.activeElement).not.toBe(target);
        expect(types).toContain("dragleave");
        expect(types).toContain("dragend");
    });
});
