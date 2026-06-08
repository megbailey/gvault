
export async function encrypt( data: ArrayBuffer, key: CryptoKey, iv: Uint8Array<ArrayBuffer> ) {
    return crypto.subtle.encrypt({ name:'AES-GCM',iv }, key, data );
}
