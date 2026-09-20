# GVault file format

Files end with `.gvault.json`. Version 1 is not supported.

Packages are encrypted in 1 MiB plaintext chunks with AES-256-GCM. [AES-256](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) is a 256-bit-key block cipher specified in [FIPS 197](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf). [GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) is an authenticated mode: it encrypts and also produces a tag so a modified ciphertext will not decrypt ([NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)). Each chunk IV is 12 bytes: an 8-byte random prefix chosen once per file, then the chunk index as a big-endian `uint32`. The prefix is generated with `crypto.getRandomValues` and stored as the first eight bytes of every chunk IV. Indexes cannot collide under that key ([SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) §8). GCM additional authenticated data binds the chunk index and the total chunk count as two big-endian `uint32` values (`index`, then `count`). Reordering, dropping, or duplicating chunks fails authentication. Decrypt uses the IV stored on the chunk. `chunkCount` is required in the header so encrypt, upload, and decrypt can stream the JSON one chunk at a time.

The 16-byte Argon2id salt and each chunk IV are stored next to the ciphertext. They are not secret; decrypt needs them to derive the same AES-256-GCM key and to run GCM with the original nonce. NIST requires this: a password-based KDF salt “shall be stored or transmitted along with the encrypted data” ([SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) §5.1), and a GCM IV is not a secret but must be distinct per encryption ([SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) §8). Argon2 likewise treats the salt as public ([RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)).

```json
{
  "version": 2,
  "kdf": "Argon2id",
  "cipher": "AES-256-GCM",
  "salt": [16 bytes as numbers],
  "filename": "original-name.pdf",
  "chunkSize": 1048576,
  "chunkCount": 1,
  "chunks": [
    { "iv": [12 bytes as numbers], "cipherText": "<base64 AES-GCM ciphertext+tag>" }
  ]
}
```

## Size

Google Drive’s [`files.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) upload cap is 5,120 GB (5 TiB). That limit is on the uploaded `.gvault.json`, not the original file.

Each 1 MiB plaintext chunk becomes AES-256-GCM ciphertext (plaintext plus a 16-byte tag), then base64, then a small JSON object (`iv` plus `cipherText`). That expansion is about 4/3. The header is a few hundred bytes.

The largest original file that still produces a vault at or under 5 TiB is **3.75 TB** (4,122,898,362,590 bytes, using worst-case IV digits). GVault rejects larger files before encrypt so Drive never sees an oversize upload.
