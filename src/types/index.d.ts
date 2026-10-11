declare module "*.css" {
    const content: string;
    export default content;
}

declare module "*.png" {
    const src: string;
    export default src;
}

declare module "@megbailey/ui/tooltip" {
    import type { FC, ReactNode } from "react";

    type TooltipProps = {
        className?: string;
        text: string;
        children?: ReactNode;
        type?: string;
        iconName?: string;
        position?: string;
        theme?: string;
        arrow?: boolean;
        showTip?: boolean;
    };

    const Tooltip: FC<TooltipProps>;
    export default Tooltip;
}
