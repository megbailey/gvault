import {
    PICKER_RESULT_KEY,
    type PickerMode,
    type PickerResultRecord,
    type PickerTarget,
} from "./pickerProtocol";

export class PickerCancelledError extends Error {
    constructor() {
        super("Google Drive selection was cancelled.");
        this.name = "PickerCancelledError";
    }
}

function waitForPickerResult(requestId: string): Promise<PickerResultRecord> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const finish = (record: PickerResultRecord) => {
            if (settled) {
                return;
            }
            settled = true;
            chrome.runtime.onMessage.removeListener(onMessage);
            void chrome.storage.session.remove(PICKER_RESULT_KEY);
            if (record.cancelled) {
                reject(new PickerCancelledError());
                return;
            }
            if (record.error) {
                reject(new Error(record.error));
                return;
            }
            resolve(record);
        };

        const onMessage = (message: { type?: string; record?: PickerResultRecord }) => {
            if (message?.type !== "gvault-picker-done" || message.record?.requestId !== requestId) {
                return;
            }
            finish(message.record);
        };

        chrome.runtime.onMessage.addListener(onMessage);
    });
}

export async function openDrivePicker(options: {
    mode: PickerMode;
    target: PickerTarget;
    fileId?: string;
}): Promise<PickerResultRecord> {
    const requestId = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: "gvault-start-onepick",
            requestId,
            target: options.target,
            mode: options.mode,
            fileId: options.fileId,
        }, () => {
            const message = chrome.runtime.lastError?.message;
            if (message) {
                reject(new Error(message));
                return;
            }
            resolve();
        });
    });
    return waitForPickerResult(requestId);
}
