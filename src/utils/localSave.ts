export function sanitizePathSegment(name: string): string {
    const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/g, "_").trim();
    return cleaned.slice(0, 255) || "untitled";
}

export function decryptedOutputPath(
    rootFolderName: string,
    vaultRelativePath: string,
    originalFilename: string
): string {
    const parts = vaultRelativePath.replace(/\\/g, "/").split("/").filter(Boolean);
    parts.pop();
    return [rootFolderName, ...parts, originalFilename].map(sanitizePathSegment).join("/");
}

export function triggerLocalDownload(filename: string, data: ArrayBuffer | Blob): void {
    const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sanitizePathSegment(filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export async function saveDecryptedFile(relativePath: string, data: ArrayBuffer | Blob): Promise<void> {
    const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)]);
    if (typeof chrome !== "undefined" && chrome.downloads?.download) {
        const url = URL.createObjectURL(blob);
        try {
            await new Promise<void>((resolve, reject) => {
                chrome.downloads.download(
                    {
                        url,
                        filename: relativePath,
                        saveAs: false,
                        conflictAction: "uniquify",
                    },
                    (downloadId) => {
                        if (chrome.runtime.lastError || typeof downloadId !== "number") {
                            reject(
                                new Error(
                                    chrome.runtime.lastError?.message || "Could not save the decrypted file."
                                )
                            );
                            return;
                        }
                        resolve();
                    }
                );
            });
        } finally {
            window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
        }
        return;
    }

    triggerLocalDownload(relativePath.split("/").pop() || "decrypted-file", data);
}
