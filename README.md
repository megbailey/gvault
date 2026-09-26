# GVault

GVault is a Chrome extension that encrypts files on the device, then stores the ciphertext in Google Drive with the extension `.gvault`. Decryption happens locally as well. The passphrase never leaves the browser, and there is no GVault server.

Google Drive offers [native client-side encryption](https://support.google.com/a/answer/10741897) for Google Workspace, but Google does not offer it for personal Gmail accounts. [An administrator must enable encryption](https://support.google.com/a/answer/10745596) for Workspace accounts. [Workspace accounts](https://support.google.com/a/answer/53926) are available, but [not free after a 14-day trial](https://support.google.com/a/answer/6388094). GVault is for personal Drive users, and for Workspace users whose organization has not turned CSE on.

## Features

- **Encrypt and Upload** from the popup: choose files or a folder, a Drive destination, and a passphrase. Nested folders are recreated on Drive.
- **Encrypt on Drive** with an in-header toggle. When it is on, File upload and drop are intercepted so the original bytes are never sent. GVault asks for a passphrase, encrypts locally, and uploads `.gvault` into the folder you are viewing.
- **Download and Decrypt** from the popup: pick a vault file or folder. Folder decrypt walks the tree and writes files under Downloads with the same relative paths.
- **Passphrase settings** for minimum length, special characters, default encrypted-folder name, and optional deletion of the Drive vault after decrypt.

## How it works

Encryption uses [Argon2id](https://en.wikipedia.org/wiki/Argon2) to derive an AES-256-GCM key from the passphrase. Files are packed into 1 MiB chunks; each chunk IV is a per-file random prefix plus the chunk index, and GCM additional authenticated data binds chunk index and count so reordered or duplicated chunks fail to decrypt.

Drive access uses Google OAuth through `chrome.identity` (`drive` scope). That token authorizes Drive API calls only. It is not the encryption key.

The Drive page uses two content scripts: a MAIN-world interceptor that cancels native file selection, and an isolated-world script that hosts the header toggle and passphrase overlay.

## Encryption: Argon2id, AES-256-GCM, and technical information

[Argon2id](https://en.wikipedia.org/wiki/Argon2) is a memory-hard password-hashing function ([RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)). It mixes the passphrase with a per-file salt and is expensive in both time and memory, which slows offline guessing. GVault uses it as a key derivation function (KDF) to generate the AES-256-GCM key. A new random 16-byte salt is chosen for every vault file, so the same passphrase still produces a different encryption key.

[AES-256](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard) is the Advanced Encryption Standard with a 256-bit key ([FIPS 197](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)). It keeps file contents confidential. [GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode) (Galois/Counter Mode) adds authentication: each chunk gets a tag so decrypt fails if the ciphertext is altered ([NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)).

The per-file salt and IV prefix are not secret: they are stored in the `.gvault` header so decrypt can derive the same key and reconstruct each GCM invocation ([NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf), [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)). See the [vault file format](docs/GVAULT_FILE_FORMAT.md).

Each chunk IV is 12 bytes: eight random bytes chosen once per file, then the chunk index as a big-endian `uint32`. That prefix is stored in every chunk IV. Indexes stay unique under that key, which AES-GCM requires ([NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf) §8). Reusing an IV under the same key would repeat the keystream and can expose the authentication subkey. Encrypting the same document again chooses a new salt and a new IV prefix, so it gets a new key and a new nonce family; chunk indexes can start at 0. Those indexes may match a previous vault, but the key and prefix are different, which avoids GCM’s key-and-IV reuse pitfall.

## Limits

- **5,119.922 GB (5,497,474,188,499 bytes) per file.** Google Drive allows uploads up to 5,120 GB (5 TiB = 5,497,558,138,880 bytes). That cap applies to the `.gvault` package. With a worst-case 65,535-byte filename and a 16-byte GCM tag on each 1 MiB chunk, the largest original file that still fits is 5,119.922 GB / 5,497,474,188,499 bytes (the vault is then exactly the Drive cap). See the [size derivation](docs/GVAULT_FILE_FORMAT.md#size).
- The binary vault is streamed for both encrypt/upload and decrypt, so the full package is not held in memory.
- 10 files in a loose batch
- 50 files in a folder batch

Oversized Drive intercepts are cancelled so nothing is uploaded unencrypted.

## Documentation

- [Project page](https://megbailey.me/projects/gvault)
- [Privacy policy](https://megbailey.me/projects/gvault/privacy) ([source](docs/PRIVACY.md))
- [Terms of service](https://megbailey.me/projects/gvault/terms) ([source](docs/TERMS.md))
- [Security policy](https://megbailey.me/projects/gvault/security) ([source](.github/SECURITY.md))
- [Vault file format](docs/GVAULT_FILE_FORMAT.md)
- [Chrome Web Store listing](docs/CHROMEWEBSTORE.md)
- [Local development and production builds](docs/DEVELOPMENT.md)

## Stack

Manifest V3 · TypeScript · React · Webpack · `chrome.identity` · AES-256-GCM · Argon2id · Google Drive API · Vitest
