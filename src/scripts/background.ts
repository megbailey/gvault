import { getDriveItems } from "../utils/driveFolder";
import {
    ONE_PICK_CLIENT_ID,
    onePickAuthUrl,
    onePickRedirectUri,
    parseOnePickRedirect,
} from "../utils/onePick";
import {
    PICKER_RESULT_KEY,
    parseOnePickRequest,
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

function launchOnePick(url: string): Promise<string | undefined> {
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

async function runOnePick(message: unknown): Promise<void> {
    const request = parseOnePickRequest(message);
    if (!request) {
        return;
    }

    const clientId = ONE_PICK_CLIENT_ID;
    const redirectUri = onePickRedirectUri(chrome.runtime.id);
    if (!clientId) {
        await publish({
            requestId: request.requestId,
            target: request.target,
            createdAt: Date.now(),
            error: `Create a Web application OAuth client and set ONE_PICK_CLIENT_ID. Authorized redirect URI: ${redirectUri}`,
        });
        return;
    }

    const authUrl = onePickAuthUrl({
        clientId,
        redirectUri,
        mode: request.mode,
        state: request.requestId,
        fileId: request.fileId,
    });

    let redirectUrl: string | undefined;
    try {
        redirectUrl = await launchOnePick(authUrl);
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

    const picked = parseOnePickRedirect(redirectUrl);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "gvault-start-onepick" || sender.id !== chrome.runtime.id) {
        return;
    }
    sendResponse({ ok: true });
    void runOnePick(message);
});
