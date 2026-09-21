
// @ts-ignore
import argon2 from 'argon2-browser/dist/argon2-bundled.min.js';

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const result = await argon2.hash({
        pass: passphrase,
        salt,
        time: 3,
        mem: 65536,
        hashLen: 32,
        type: 2 // Argon2id
    });

    return crypto.subtle.importKey(
        'raw',
        result.hash as Uint8Array<ArrayBuffer>,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encrypt(
    data: BufferSource,
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    additionalData?: BufferSource
) {
    const params: AesGcmParams = { name: "AES-GCM", iv };
    if (additionalData) {
        params.additionalData = additionalData;
    }
    return crypto.subtle.encrypt(params, key, data);
}

export async function decrypt(
    data: BufferSource,
    key: CryptoKey,
    iv: Uint8Array<ArrayBuffer>,
    additionalData?: BufferSource
) {
    const params: AesGcmParams = { name: "AES-GCM", iv };
    if (additionalData) {
        params.additionalData = additionalData;
    }
    return crypto.subtle.decrypt(params, key, data);
}
