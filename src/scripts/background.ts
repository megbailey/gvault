import { folderContainsVaultFile, getDriveItems } from "../utils/driveFolder";
import getAccessToken from "../utils/getAccessToken";
import {
    DRIVE_PICKER_CLIENT_ID,
    drivePickerAuthUrl,
    drivePickerRedirectUri,
    parseDrivePickerRedirect,
} from "../utils/drivePicker";
import {
    PICKER_RESULT_KEY,
    parseDrivePickerRequest,
    resultFromDriveItems,
    type PickerResultRecord,
} from "../utils/pickerProtocol";

function notifyPickerResult(record: PickerResultRecord): void {
    chrome.runtime.sendMessage({ type: "gvault-picker-done", record }, () => {
        void chrome.runtime.lastError;
    });
}

async function publish(record: PickerResultRecord): Promise<void> {
    await chrome.storage.session.set({ [PICKER_RESULT_KEY]: record });
    notifyPickerResult(record);
}

function launchDrivePicker(url: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
            const message = chrome.runtime.lastError?.message;
            if (message) {
                if (/cancel|closed|did not approve|denied/i.test(message)) {
                    resolve(undefined);
                    return;
                }
                reject(new Error(message));
                return;
            }
            resolve(redirectUrl);
        });
    });
}

async function runDrivePicker(message: unknown): Promise<void> {
    const request = parseDrivePickerRequest(message);
    if (!request) {
        return;
    }

    const clientId = DRIVE_PICKER_CLIENT_ID;
    const redirectUri = drivePickerRedirectUri(chrome.runtime.id);
    if (!clientId) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            error: `Create a Web application OAuth client and set DRIVE_PICKER_CLIENT_ID. Authorized redirect URI: ${redirectUri}`,
        });
        return;
    }

    const authUrl = drivePickerAuthUrl({
        clientId,
        redirectUri,
        mode: request.mode,
        state: request.requestId,
        fileId: request.fileId,
    });

    let redirectUrl: string | undefined;
    try {
        redirectUrl = await launchDrivePicker(authUrl);
    } catch (error) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            error: error instanceof Error ? error.message : "Could not open Google Drive.",
        });
        return;
    }

    if (!redirectUrl) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            cancelled: true,
        });
        return;
    }

    const picked = parseDrivePickerRedirect(redirectUrl);
    if (picked.state && picked.state !== request.requestId) {
        return;
    }
    if (picked.cancelled) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            cancelled: true,
        });
        return;
    }
    if (picked.error) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            error: picked.error,
        });
        return;
    }
    if (!picked.token || picked.fileIds.length === 0) {
        await publish(resultFromDriveItems(request, []));
        return;
    }

    try {
        const items = await getDriveItems(picked.token, picked.fileIds);
        await publish(resultFromDriveItems(request, items));
    } catch (error) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            error: error instanceof Error ? error.message : "Could not open the selected Drive item.",
        });
    }
}

async function foldersContainingVaults(folderIds: unknown): Promise<string[]> {
    if (!Array.isArray(folderIds)) {
        return [];
    }
    const ids = folderIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    const token = await getAccessToken();
    const found: string[] = [];
    for (const id of ids) {
        if (await folderContainsVaultFile(token, id)) {
            found.push(id);
        }
    }
    return found;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
        return;
    }
    if (message?.type === "gvault-folders-with-vaults") {
        void foldersContainingVaults(message.folderIds).then(
            (folderIds) => sendResponse({ ok: true, folderIds }),
            (error: unknown) => sendResponse({
                ok: false,
                error: error instanceof Error ? error.message : "Could not check that folder.",
            })
        );
        return true;
    }
    if (message?.type !== "gvault-start-drive-picker") {
        return;
    }
    sendResponse({ ok: true });
    void runDrivePicker(message);
});
