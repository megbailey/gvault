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
        <Form>
            <div>
                <Dropzone
                    field="vaultFile"
                    label="Select Document"
                    helperText="PDF, Word, Excel, PowerPoint, or CSV. The file is encrypted locally, then uploaded to Google Drive as .gvault.json."
                    accept="document"
                    isRequired
                    maxFileSize={MAX_FILE_SIZE}
                    uploadsURL=""
                    uploadFilePromise={uploadFilePromise}
                />
            </div>

            <div style={{ marginTop: 16 }}>
                <label htmlFor="passphrase">Security Passphrase:</label>
                <br />
                <input
                    type={showPassphrase ? "text" : "password"}
                    id="passphrase"
                    placeholder="Passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                />
                <input
                    type="checkbox"
                    id="togglePassphrase"
                    checked={showPassphrase}
                    onChange={(e) => setShowPassphrase(e.target.checked)}
                />
                <label htmlFor="togglePassphrase" style={{ fontSize: "0.85em" }}>Show Passphrase</label>
            </div>

            <div style={{ marginTop: 16 }}>
                <label htmlFor="uploadDestination">Upload Destination:</label>
                <br />
                <select
                    id="uploadDestination"
                    value={uploadDestination}
                    onChange={(e) => setUploadDestination(e.target.value)}
                >
                    <option value="encrypted_folder">{folderName}</option>
                    <option value="root">My Drive (Root)</option>
                </select>
            </div>
        </Form>
    );
};

export default Upload;
