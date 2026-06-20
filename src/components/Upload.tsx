import React, { useRef, useState } from "react";
import getAccessToken from "../utils/getAccessToken";
import uploadFile from "../utils/uploadFile";

import { packVaultFile } from "../utils/fileVault";

const Upload = () => {
    const [passphrase, setPassphrase] = useState("");
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [uploadDestination, setUploadDestination] = useState("root");
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const encryptUploadBtnRef = useRef<HTMLButtonElement | null>(null);


    const onUploadClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const file = fileInputRef.current?.files?.[0];
        const pass = passphrase;

        if (!file || !pass) {
            alert('Select file and passphrase');
            return;
        }

        try {
            if (encryptUploadBtnRef.current) {
                encryptUploadBtnRef.current.disabled = true;
                encryptUploadBtnRef.current.innerText = 'Encrypting...';
            }

            const vaultFile = await packVaultFile(file, pass);
            
            if (encryptUploadBtnRef.current) {
                encryptUploadBtnRef.current.innerText = 'Uploading...';
            }

            const token = await getAccessToken() as string;
            const result = await uploadFile( token, vaultFile );

            alert(`Upload successful! ${JSON.stringify( result )} ${vaultFile.filename}`);
        } catch (error) {
            console.error(error);
            alert('Error: ' + (error as Error).message);
        } finally {
            if (encryptUploadBtnRef.current) {
                encryptUploadBtnRef.current.disabled = false;
                encryptUploadBtnRef.current.innerText = 'Encrypt & Upload';
            }
        }
    }

    return (
        <div>
            <div>
                <label htmlFor="file">Select Document:</label>
                <br />
                <input type="file" id="file" ref={fileInputRef} />
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
                { /* Optionally, toggle the visibility of the passphrase */ }
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
                <option value="root">My Drive (Root)</option>
                <option value="encrypted_folder">Encrypted Documents Folder</option>
                </select>
            </div>

            <div style={{ marginTop: 16 }}>
                <button 
                    id="encryptUpload" 
                    type="button"
                    onClick={onUploadClick}
                >
                    Encrypt & Upload
                </button>
            </div>
        </div>
    );
}

export default Upload;

function uploadToDrive(token: string, encryptedFile: any) {
    throw new Error("Function not implemented.");
}
