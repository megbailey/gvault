# GVault file format

Files end with `.gvault`. The MIME type is `application/octet-stream`.

Packages are encrypted in 1 MiB plaintext chunks with AES-256-GCM. [AES-256](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) is a 256-bit-key block cipher specified in [FIPS 197](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf). [GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) is an authenticated mode: it encrypts and also produces a tag so a modified ciphertext will not decrypt ([NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)). Each chunk IV is 12 bytes: an 8-byte random prefix chosen once per file, then the chunk index as a big-endian `uint32`. The prefix is generated with `crypto.getRandomValues` and stored once in the header. Decrypt reconstructs each IV from that prefix and the chunk index. Indexes cannot collide under that key ([SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) §8). GCM additional authenticated data binds the chunk index and the total chunk count as two big-endian `uint32` values (`index`, then `count`). Reordering, dropping, or duplicating chunks fails authentication.

Argon2id parameters used to derive the AES-256-GCM key: `time=3`, `mem=65536` (KiB), `hashLen=32`, type Argon2id. The 16-byte Argon2id salt and the 8-byte IV prefix are stored in the header next to the ciphertext. They are not secret; decrypt needs them to derive the same AES-256-GCM key and to run GCM with the original nonce. NIST requires this: a password-based KDF salt “shall be stored or transmitted along with the encrypted data” ([SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) §5.1), and a GCM IV is not a secret but must be distinct per encryption ([SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) §8). Argon2 likewise treats the salt as public ([RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)).

Ciphertext is raw binary. Encrypt writes the header, then each AES-GCM ciphertext+tag in order. Decrypt reads the header, derives chunk sizes from `plaintextSize` and `chunkSize`, then streams each ciphertext.

All multi-byte integers are big-endian.

```
Offset  Size  Field
0       4     magic: ASCII "GVLT" (0x47 0x56 0x4c 0x54)
4       4     version: uint32 = 3
8       16    Argon2id salt
24      8     IV prefix
32      4     chunkSize: uint32 (1,048,576)
36      8     plaintextSize: uint64
44      2     filenameLen: uint16
46      N     original filename, UTF-8
46+N    …     ciphertext: for each chunk, AES-256-GCM ciphertext || 16-byte tag
```

An empty file still writes one 16-byte tag (GCM of zero-length plaintext). Chunk plaintext sizes are `min(chunkSize, remaining)` until `plaintextSize` is consumed.

## Size

Google Drive’s [`files.create`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create) upload cap is 5,120 GB. That limit is on the uploaded `.gvault`, not the original file.

```
Drive cap          = 5,120 GB
                   = 5 TiB
                   = 5 × 1,099,511,627,776
                   = 5,497,558,138,880 bytes

vaultBytes         = 46 + filenameLen + plaintextSize + 16 × chunkCount
chunkCount         = 1 if plaintextSize == 0 else ceil(plaintextSize / 1,048,576)
worst filenameLen  = 65,535
worst header       = 46 + 65,535 = 65,581 bytes
tag budget         = 5,497,558,138,880 − 65,581
                   = 5,497,558,073,299
                   = plaintextSize + 16 × chunkCount
```

The largest plaintext that still fits, using that worst-case filename, is **5,497,474,188,499 bytes**:

```
5,242,799 × 1,048,576  = 5,497,473,204,224   (full 1 MiB chunks)
remainder              = 984,275             (final chunk)
chunkCount             = 5,242,800
GCM tags               = 5,242,800 × 16 = 83,884,800 bytes

vaultBytes = 65,581 + 5,497,474,188,499 + 83,884,800
           = 5,497,558,138,880
           = Drive cap exactly
```

A file one byte larger produces a 5,497,558,138,881-byte vault and is rejected before encrypt. GVault uses this plaintext cap for upload validation so Drive never sees an oversize package.
