const POPUP_BASE_WIDTH = 380;
const POPUP_MAX_WIDTH = 800;
const POPUP_MAX_HEIGHT = 600;
const FIT_PAD = 12;

export type PopupBox = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

/** Grow the popup downward and rightward when the tip hangs past the visible edge. */
export function popupExtensionForTooltip(
    popup: PopupBox,
    tip: PopupBox,
    viewportHeight = popup.bottom,
    pad = FIT_PAD,
): { width: number; minHeight: number } {
    const visibleBottom = Math.min(popup.bottom, viewportHeight);
    const overflow = Math.max(0, tip.bottom + pad - visibleBottom);
    return {
        width: Math.min(
            POPUP_MAX_WIDTH,
            Math.max(popup.width, POPUP_BASE_WIDTH, Math.ceil(tip.right - popup.left + pad)),
        ),
        minHeight: Math.min(POPUP_MAX_HEIGHT, Math.ceil(popup.height + overflow)),
    };
}

/** Extend the popup shell without changing overflow, so the form does not jump. */
export function bindPopupTooltipExtend(popup: HTMLElement): () => void {
    let open = false;

    const reset = () => {
        open = false;
        popup.style.width = "";
        popup.style.minHeight = "";
    };

    const extend = () => {
        const tip = popup.querySelector<HTMLElement>(".c-tooltip__text.show.c-tooltip__text--placed");
        if (!tip) {
            if (open) reset();
            return;
        }
        if (open) return;

        const next = popupExtensionForTooltip(
            popup.getBoundingClientRect(),
            tip.getBoundingClientRect(),
            window.innerHeight,
        );
        popup.style.width = `${next.width}px`;
        popup.style.minHeight = `${next.minHeight}px`;
        open = true;
    };

    const observer = new MutationObserver(extend);
    observer.observe(popup, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
    });

    return () => {
        observer.disconnect();
        reset();
    };
}
