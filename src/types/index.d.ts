declare module "*.css" {
    const content: string;
    export default content;
}

declare module "*.png" {
    const src: string;
    export default src;
}

interface DataTransferItem {
    webkitGetAsEntry?: () => { readonly isDirectory: boolean } | null;
}
