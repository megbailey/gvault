import { deriveKey } from '../crypto/argon';
import { encrypt } from '../crypto/encrypt';
import { getAccessToken } from './oauth';
import { uploadToDrive } from './upload';

async function encryptFile(file: File, passphrase: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const data = await file.arrayBuffer();
    const ciphertext = await encrypt(data, key, iv);

    const header = {
        version: 1,
        kdf: 'Argon2id',
        cipher: 'AES-256-GCM',
        salt: Array.from(salt),
        iv: Array.from(iv),
        filename: file.name
    };

    // Use a delimiter or structured format as per GSEC_FILE_FORMAT.md
    // The format says Payload is { metadata, ciphertext }
    // But then says Files end with .gsec
    // Popup.js used: new Blob([JSON.stringify(header)+"\n", ciphertext])
    
    return new Blob([JSON.stringify(header) + "\n", ciphertext]);
}

const encryptUploadBtn = document.getElementById('encryptUpload') as HTMLButtonElement;
const fileInput = document.getElementById('file') as HTMLInputElement;
const passInput = document.getElementById('passphrase') as HTMLInputElement;

if (encryptUploadBtn) {
    encryptUploadBtn.onclick = async () => {
        const file = fileInput.files?.[0];
        const pass = passInput.value;

        if (!file || !pass) {
            alert('Select file and passphrase');
            return;
        }

        try {
            encryptUploadBtn.disabled = true;
            encryptUploadBtn.innerText = 'Encrypting...';

            const encryptedBlob = await encryptFile(file, pass);
            
            encryptUploadBtn.innerText = 'Uploading...';
            const token = await getAccessToken() as string;
            await uploadToDrive(token, encryptedBlob, file.name + '.gsec');

            alert('Upload successful!');
        } catch (error) {
            console.error(error);
            alert('Error: ' + (error as Error).message);
        } finally {
            encryptUploadBtn.disabled = false;
            encryptUploadBtn.innerText = 'Encrypt & Upload';
        }
    };
}
