import { deriveKey, encrypt } from './crypto';
import { GVaultFile } from "../GVaultFile";

function arrayBufferToBase64( buffer: ArrayBuffer ) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode( bytes[i] );
    return btoa(binary);
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

/* export async function unpackVaultFile( file: File, passphrase: string ) {

} */
