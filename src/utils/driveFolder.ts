async function driveRequestError(response: Response, fallback: string): Promise<Error> {
    try {
        const body = await response.json();
        const message = body?.error?.message;
        if (typeof message === "string" && message.length > 0) {
            return new Error(message);
        }
    } catch {
        // Ignore JSON parse failures and use the HTTP status text.
    }

    return new Error(`${fallback}: ${response.status} ${response.statusText}`);
}

function escapeDriveQueryValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function ensureDriveFolder(token: string, folderName: string): Promise<string> {
    const name = folderName.trim();
    if (!name) {
        throw new Error("Encrypted folder name cannot be empty.");
    }

    const query = [
        `name = '${escapeDriveQueryValue(name)}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
    ].join(" and ");

    const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
    listUrl.searchParams.set("q", query);
    listUrl.searchParams.set("fields", "files(id,name)");
    listUrl.searchParams.set("pageSize", "1");
    listUrl.searchParams.set("spaces", "drive");

    const listResponse = await fetch(listUrl.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!listResponse.ok) {
        throw await driveRequestError(listResponse, "Failed to look up encrypted folder");
    }

    const listBody = await listResponse.json();
    const existingId = listBody?.files?.[0]?.id;
    if (typeof existingId === "string" && existingId.length > 0) {
        return existingId;
    }

    const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name,
            mimeType: "application/vnd.google-apps.folder",
        }),
    });

    if (!createResponse.ok) {
        throw await driveRequestError(createResponse, "Failed to create encrypted folder");
    }

    const created = await createResponse.json();
    if (typeof created?.id !== "string" || created.id.length === 0) {
        throw new Error("Google Drive did not return a folder id.");
    }

    return created.id;
}
