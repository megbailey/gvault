/** Let an open tooltip paint past the scrolling body without resizing the popup window. */
export function bindPopupTooltipOverflow(popup: HTMLElement): () => void {
    const sync = () => {
        const open = popup.querySelector(".c-tooltip__text.show") !== null;
        popup.classList.toggle("popup--tooltip-open", open);
    };

    const observer = new MutationObserver(sync);
    observer.observe(popup, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
    });

    return () => {
        observer.disconnect();
        popup.classList.remove("popup--tooltip-open");
    };
}
