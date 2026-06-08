
export async function decrypt( data: ArrayBuffer, key: CryptoKey, iv: Uint8Array<ArrayBuffer> ) {
    return crypto.subtle.decrypt({ name:'AES-GCM',iv }, key, data );
}
