import { FOLDER_MIME, type PickerMode } from "./pickerProtocol";

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Web application OAuth client in the same Cloud project as the extension.
 * Chrome Extension clients have no redirect URI field, so launchWebAuthFlow
 * cannot use the client id in manifest.json.
 * Authorized redirect URI: https://<extension-id>.chromiumapp.org
 */
export const ONE_PICK_CLIENT_ID = "809805284793-g287552i32hf54ovtm5n3vbj4mlk3emc.apps.googleusercontent.com";

export type OnePickRedirect = {
    fileIds: string[];
    code?: string;
    token?: string;
    state?: string;
    error?: string;
    cancelled?: boolean;
};

export function onePickRedirectUri(extensionId: string): string {
    return `https://${extensionId}.chromiumapp.org`;
}

export function onePickAuthUrl(options: {
    clientId: string;
    redirectUri: string;
    mode: PickerMode;
    state: string;
    fileId?: string;
}): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", options.clientId);
    url.searchParams.set("redirect_uri", options.redirectUri);
    url.searchParams.set("response_type", "token");
    url.searchParams.set("scope", DRIVE_FILE_SCOPE);
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "false");
    url.searchParams.set("trigger_onepick", "true");
    url.searchParams.set("state", options.state);

    if (options.mode === "folder") {
        url.searchParams.set("allow_folder_selection", "true");
        url.searchParams.set("mimetypes", FOLDER_MIME);
    } else {
        url.searchParams.set("allow_multiple", "true");
        url.searchParams.set("mimetypes", "application/octet-stream");
    }

    if (options.fileId && options.fileId !== "root") {
        url.searchParams.set("file_ids", options.fileId);
    }

    return url.toString();
}

function readRedirectParam(url: URL, key: string): string | undefined {
    const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
    return url.searchParams.get(key) ?? hash.get(key) ?? undefined;
}

export function parseOnePickRedirect(redirectUrl: string): OnePickRedirect {
    const url = new URL(redirectUrl);
    const error = readRedirectParam(url, "error");
    const state = readRedirectParam(url, "state");
    if (error === "access_denied" || error === "interaction_required") {
        return { fileIds: [], cancelled: true, state };
    }
    if (error) {
        return {
            fileIds: [],
            error: readRedirectParam(url, "error_description") || error,
            state,
        };
    }

    const fileIds = (readRedirectParam(url, "picked_file_ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    return {
        fileIds,
        code: readRedirectParam(url, "code"),
        token: readRedirectParam(url, "access_token"),
        state,
    };
}
