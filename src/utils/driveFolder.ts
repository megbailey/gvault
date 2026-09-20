export type DriveFolder = {
    id: string;
    name: string;
};

export const MY_DRIVE_ROOT: DriveFolder = {
    id: "root",
    name: "My Drive",
};

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

function parseFolderList(body: { files?: Array<{ id?: string; name?: string }> }): DriveFolder[] {
    if (!Array.isArray(body.files)) {
        return [];
    }

    return body.files.flatMap((file) => {
        if (typeof file.id !== "string" || typeof file.name !== "string") {
            return [];
        }
        return [{ id: file.id, name: file.name }];
    });
}

export async function listDriveFolders(
    token: string,
    options: { parentId?: string; search?: string; pageToken?: string } = {}
): Promise<{ folders: DriveFolder[]; nextPageToken?: string }> {
    const search = options.search?.trim();
    const parentId = options.parentId || MY_DRIVE_ROOT.id;
    const query = search
        ? [
            `name contains '${escapeDriveQueryValue(search)}'`,
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ].join(" and ")
        : [
            `'${escapeDriveQueryValue(parentId)}' in parents`,
            "mimeType = 'application/vnd.google-apps.folder'",
            "trashed = false",
        ].join(" and ");

    const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
    listUrl.searchParams.set("q", query);
    listUrl.searchParams.set("fields", "nextPageToken,files(id,name)");
    listUrl.searchParams.set("orderBy", "name");
    listUrl.searchParams.set("pageSize", "50");
    listUrl.searchParams.set("spaces", "drive");
    listUrl.searchParams.set("includeItemsFromAllDrives", "false");
    if (options.pageToken) {
        listUrl.searchParams.set("pageToken", options.pageToken);
    }

    const listResponse = await fetch(listUrl.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!listResponse.ok) {
        throw await driveRequestError(listResponse, "Failed to look up Drive folders");
    }

    const listBody = await listResponse.json();
    return {
        folders: parseFolderList(listBody),
        nextPageToken: typeof listBody?.nextPageToken === "string" ? listBody.nextPageToken : undefined,
    };
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
        `'root' in parents`,
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

export async function ensureChildFolder(
    token: string,
    parentId: string,
    folderName: string
): Promise<string> {
    const name = folderName.trim();
    if (!name) {
        throw new Error("Folder name cannot be empty.");
    }

    const parent = parentId.trim() || MY_DRIVE_ROOT.id;
    const query = [
        `name = '${escapeDriveQueryValue(name)}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        "trashed = false",
        `'${escapeDriveQueryValue(parent)}' in parents`,
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
        throw await driveRequestError(listResponse, "Failed to look up folder");
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
            parents: [parent],
        }),
    });

    if (!createResponse.ok) {
        throw await driveRequestError(createResponse, "Failed to create folder");
    }

    const created = await createResponse.json();
    if (typeof created?.id !== "string" || created.id.length === 0) {
        throw new Error("Google Drive did not return a folder id.");
    }

    return created.id;
}

export async function ensureDriveFolderPath(
    token: string,
    parentId: string,
    segments: string[],
    cache: Map<string, string> = new Map()
): Promise<string> {
    let currentId = parentId;
    let pathKey = "";

    for (const segment of segments) {
        const name = segment.trim();
        if (!name) {
            continue;
        }
        pathKey = pathKey ? `${pathKey}/${name}` : name;
        const cached = cache.get(pathKey);
        if (cached) {
            currentId = cached;
            continue;
        }
        currentId = await ensureChildFolder(token, currentId, name);
        cache.set(pathKey, currentId);
    }

    return currentId;
}

export type DriveFile = {
    id: string;
    name: string;
};

export const VAULT_FILE_SUFFIX = ".gvault.json";

export async function listDriveVaultFiles(
    token: string,
    options: { parentId?: string; search?: string; pageToken?: string } = {}
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const search = options.search?.trim();
    // Drive's `name contains` operator is prefix-only, so suffix matching
    // for .gvault.json is applied after the response is returned.
    const clauses = [
        "trashed = false",
        "mimeType != 'application/vnd.google-apps.folder'",
    ];

    if (search) {
        clauses.push(`name contains '${escapeDriveQueryValue(search)}'`);
    } else if (options.parentId) {
        clauses.push(`'${escapeDriveQueryValue(options.parentId)}' in parents`);
    }

    const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
    listUrl.searchParams.set("q", clauses.join(" and "));
    listUrl.searchParams.set("fields", "nextPageToken,files(id,name)");
    listUrl.searchParams.set("orderBy", "name");
    listUrl.searchParams.set("pageSize", "100");
    listUrl.searchParams.set("spaces", "drive");
    listUrl.searchParams.set("includeItemsFromAllDrives", "false");
    if (options.pageToken) {
        listUrl.searchParams.set("pageToken", options.pageToken);
    }

    const listResponse = await fetch(listUrl.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!listResponse.ok) {
        throw await driveRequestError(listResponse, "Failed to look up encrypted files");
    }

    const listBody = await listResponse.json();
    const files = parseFolderList(listBody).filter((file) =>
        file.name.toLowerCase().endsWith(VAULT_FILE_SUFFIX)
    );

    return {
        files,
        nextPageToken: typeof listBody?.nextPageToken === "string" ? listBody.nextPageToken : undefined,
    };
}

export async function openDriveFileStream(token: string, fileId: string): Promise<ReadableStream<Uint8Array>> {
    const fileUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
    fileUrl.searchParams.set("alt", "media");

    const response = await fetch(fileUrl.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw await driveRequestError(response, "Failed to download encrypted file");
    }

    if (response.body) {
        return response.body;
    }

    const bytes = new TextEncoder().encode(await response.text());
    return new ReadableStream({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (response.ok || response.status === 404) {
        return;
    }

    throw await driveRequestError(response, "Failed to delete encrypted file");
}

export type DriveVaultTreeEntry = {
    file: DriveFile;
    relativePath: string;
};

async function listAllDriveFolders(token: string, parentId: string): Promise<DriveFolder[]> {
    const folders: DriveFolder[] = [];
    let pageToken: string | undefined;
    do {
        const result = await listDriveFolders(token, { parentId, pageToken });
        folders.push(...result.folders);
        pageToken = result.nextPageToken;
    } while (pageToken);
    return folders;
}

async function listAllDriveVaultFiles(token: string, parentId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
        const result = await listDriveVaultFiles(token, { parentId, pageToken });
        files.push(...result.files);
        pageToken = result.nextPageToken;
    } while (pageToken);
    return files;
}

export async function listDriveVaultTree(
    token: string,
    parentId: string,
    options: { maxFiles?: number; prefix?: string; depth?: number } = {}
): Promise<DriveVaultTreeEntry[]> {
    const maxFiles = options.maxFiles ?? 50;
    const prefix = options.prefix ?? "";
    const depth = options.depth ?? 0;
    if (depth > 20) {
        throw new Error("That folder is nested too deeply to decrypt in GVault.");
    }

    const [folders, files] = await Promise.all([
        listAllDriveFolders(token, parentId),
        listAllDriveVaultFiles(token, parentId),
    ]);

    const entries: DriveVaultTreeEntry[] = files.map((file) => ({
        file,
        relativePath: prefix ? `${prefix}/${file.name}` : file.name,
    }));

    if (entries.length > maxFiles) {
        throw new Error(`This folder has more than ${maxFiles} encrypted files.`);
    }

    for (const folder of folders) {
        const nested = await listDriveVaultTree(token, folder.id, {
            maxFiles,
            prefix: prefix ? `${prefix}/${folder.name}` : folder.name,
            depth: depth + 1,
        });
        entries.push(...nested);
        if (entries.length > maxFiles) {
            throw new Error(`This folder has more than ${maxFiles} encrypted files.`);
        }
    }

    return entries;
}
