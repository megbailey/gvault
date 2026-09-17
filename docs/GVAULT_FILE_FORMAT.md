# GVault file format

Files end with `.gvault.json`. Version 1 is not supported.

Packages are encrypted in 1 MiB plaintext chunks. Each chunk has its own 12-byte IV. AES-GCM additional authenticated data binds the chunk index and the total chunk count as two big-endian `uint32` values (`index`, then `count`). Reordering, dropping, or duplicating chunks fails authentication.

```json
{
  "version": 2,
  "kdf": "Argon2id",
  "cipher": "AES-256-GCM",
  "salt": [16 bytes as numbers],
  "filename": "original-name.pdf",
  "chunkSize": 1048576,
  "chunks": [
    { "iv": [12 bytes as numbers], "cipherText": "<base64 AES-GCM ciphertext+tag>" }
  ]
}
```
