import { deriveKey, decrypt, encrypt } from './crypto';
import { GVaultFile } from "../GVaultFile";

function arrayBufferToBase64( buffer: ArrayBuffer ) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode( bytes[i] );
    return btoa(binary);
}

function base64ToArrayBuffer( value: string ): ArrayBuffer {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function isIncorrectPassphraseError(error: unknown): boolean {
    if (error instanceof DOMException) {
        return error.name === "OperationError" || error.name === "InvalidAccessError";
    }
    return error instanceof Error && /operationerror|decrypt/i.test(error.message);
}

export async function packVaultFile( file: File, passphrase: string ) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const data = await file.arrayBuffer();
    const ciphertext = await encrypt(data, key, iv);

    return new GVaultFile({        
        version: 1,
        kdf: 'Argon2id',
        cipher: 'AES-256-GCM',
        salt: Array.from(salt),
        iv: Array.from(iv),
        filename: file.name,
        cipherText: arrayBufferToBase64( ciphertext )
    })
}

export async function unpackVaultFile( vault: GVaultFile, passphrase: string ) {
    const salt = new Uint8Array(vault.salt);
    const iv = new Uint8Array(vault.iv);
    const key = await deriveKey(passphrase, salt);
    const ciphertext = base64ToArrayBuffer(vault.cipherText);

    try {
        const data = await decrypt(ciphertext, key, iv as Uint8Array<ArrayBuffer>);
        return {
            filename: vault.filename,
            data,
        };
    } catch (error) {
        if (isIncorrectPassphraseError(error)) {
            throw new Error("The passphrase was incorrect. Please try again.");
        }
        throw error;
    }
}
