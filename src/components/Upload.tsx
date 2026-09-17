import React, { useCallback, useEffect, useState } from "react";
import { Form } from "informed";
import { Dropzone } from "@megbailey/ui";
import getAccessToken from "../utils/getAccessToken";
import uploadFile from "../utils/uploadFile";
import { packVaultFile } from "../utils/fileVault";
import { ensureDriveFolder } from "../utils/driveFolder";
import {
    DEFAULT_ENCRYPTED_FOLDER_NAME,
    loadSettings,
    validatePassphrase,
    type ExtensionSettings,
} from "../utils/settings";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const Upload = () => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [uploadDestination, setUploadDestination] = useState("encrypted_folder");
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);

    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    const folderName = settings?.encryptedFolderName || DEFAULT_ENCRYPTED_FOLDER_NAME;

    const uploadFilePromise = useCallback(
        async (file: File) => {
            const currentSettings = settings ?? await loadSettings();
            const passphraseError = validatePassphrase(passphrase, currentSettings);
            if (passphraseError) {
                throw new Error(passphraseError);
            }

            const vaultFile = await packVaultFile(file, passphrase);
            const token = await getAccessToken() as string;
            const parentFolderId =
                uploadDestination === "encrypted_folder"
                    ? await ensureDriveFolder(token, currentSettings.encryptedFolderName)
                    : undefined;

            await uploadFile(token, vaultFile, parentFolderId);
            return { src: file.name };
        },
        [passphrase, settings, uploadDestination]
    );

    return (
        <Form className="upload-form">
            <Dropzone
                field="vaultFile"
                label="Select document"
                helperText="PDF, Word, Excel, PowerPoint, or CSV. Encrypted locally and saved as .gvault.json."
                accept="document"
                isRequired
                maxFileSize={MAX_FILE_SIZE}
                uploadsURL=""
                uploadFilePromise={uploadFilePromise}
            />

            <div className="field">
                <label className="field__label" htmlFor="passphrase">
                    Security passphrase
                </label>
                <div className="field__row">
                    <input
                        className="field__input"
                        type={showPassphrase ? "text" : "password"}
                        id="passphrase"
                        placeholder="Enter passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        className="field__text-button"
                        onClick={() => setShowPassphrase((visible) => !visible)}
                        aria-pressed={showPassphrase}
                    >
                        {showPassphrase ? "Hide" : "Show"}
                    </button>
                </div>
            </div>

            <div className="field">
                <label className="field__label" htmlFor="uploadDestination">
                    Upload destination
                </label>
                <select
                    className="field__input"
                    id="uploadDestination"
                    value={uploadDestination}
                    onChange={(e) => setUploadDestination(e.target.value)}
                >
                    <option value="encrypted_folder">{folderName}</option>
                    <option value="root">My Drive (root)</option>
                </select>
            </div>
        </Form>
    );
};

export default Upload;
