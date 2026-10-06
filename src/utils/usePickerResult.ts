import { useEffect, useRef } from "react";
import {
    PICKER_RESULT_KEY,
    PICKER_RESULT_MAX_AGE_MS,
    takeMatchingResult,
    type PickerResultRecord,
    type PickerTarget,
} from "./pickerProtocol";

export function usePickerResult(
    target: PickerTarget,
    onResult: (record: PickerResultRecord) => void
): void {
    const onResultRef = useRef(onResult);
    onResultRef.current = onResult;

    useEffect(() => {
        if (!chrome.storage?.session || !chrome.storage.onChanged) {
            return;
        }

        const apply = (record: PickerResultRecord | undefined) => {
            if (record?.target === target && Date.now() - record.createdAt > PICKER_RESULT_MAX_AGE_MS) {
                void chrome.storage.session.remove(PICKER_RESULT_KEY);
                return;
            }
            const match = takeMatchingResult(record, target);
            if (!match) {
                return;
            }
            void chrome.storage.session.remove(PICKER_RESULT_KEY);
            onResultRef.current(match);
        };

        void chrome.storage.session.get(PICKER_RESULT_KEY).then((stored) => {
            apply(stored[PICKER_RESULT_KEY] as PickerResultRecord | undefined);
        });

        const onChanged = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: chrome.storage.AreaName
        ) => {
            if (areaName !== "session" || !changes[PICKER_RESULT_KEY]) {
                return;
            }
            apply(changes[PICKER_RESULT_KEY].newValue as PickerResultRecord | undefined);
        };

        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
    }, [target]);
}
