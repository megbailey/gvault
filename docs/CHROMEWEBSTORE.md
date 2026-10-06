# Chrome Web Store Listing — GVault

> Last Updated: 2026-10-05

## Store Listing

**Extension Name**  
GVault

**Short Description**  
Locally encrypt and upload documents securely to Google Drive using AES-256-GCM and Argon2id.

**Detailed Description**  
Protect your sensitive files before they ever leave your device. GVault provides a seamless, client-side encryption wrapper for your Google Drive uploads, ensuring your privacy is maintained from end to end.

Google Drive does have native client-side encryption, but only for Google Workspace (not personal Gmail), and only if your administrator enables it for your account. Anyone can create a Workspace account, but Workspace is not free beyond a 14-day trial.

Google’s documentation:

- About client-side encryption (Workspace, not personal Gmail): https://support.google.com/a/answer/10741897
- Administrators must turn CSE on for users: https://support.google.com/a/answer/10745596
- Sign up for a Workspace trial: https://support.google.com/a/answer/53926
- Workspace is a 14-day free trial, then paid: https://support.google.com/a/answer/6388094

GVault is for everyone else: personal Drive users, and Workspace users whose admin has not turned CSE on.

Key Features:

- Complete client-side encryption: Your files are encrypted locally in your browser before being uploaded to Google Drive.
- Strong cryptographic standards: Uses AES-256-GCM for file encryption and Argon2id for key derivation.
- Secure authentication: Direct integration with Google OAuth2 via the official Chrome Identity API.
- Zero-knowledge security: Your passphrase and unencrypted documents are never stored, transmitted, or seen by anyone—including the developers.

How to Use:

1. Click the GVault extension icon in your toolbar, or turn on Encrypt uploads in the Google Drive header.
2. Choose files or a folder (popup), or use Drive’s File upload / drop while the toggle is on.
3. Enter a strong, private passphrase.
4. GVault encrypts locally and uploads `.gvault` to the default encrypted folder, a folder you choose in the Google Picker, or the Drive folder you are viewing after you allow that folder.
5. To open a vault, pick a `.gvault` file or folder GVault created, or choose `.gvault` files in the Google Picker, and save the plaintext locally.

**Category**  
Productivity

**Single Purpose**  
Allows users to locally encrypt files using AES-256-GCM and Argon2id, upload the ciphertext to Google Drive as `.gvault` files, and decrypt those vaults locally.

**Primary Language**  
English

---

## Permissions Justification

| Permission | Type | Justification |
| ------------ | ------ | --------------- |
| `identity` | permissions | Required to obtain Google OAuth2 access tokens via `chrome.identity.getAuthToken` and to open Google’s file picker via `chrome.identity.launchWebAuthFlow`. Tokens authorize Drive API calls (upload, list, download, optional delete) from the client. |
| `storage` | permissions | Required to store settings (passphrase rules, default encrypted-folder name, delete-after-decrypt) and the Drive “Encrypt uploads” toggle in `chrome.storage.local`. Also holds the folder or `.gvault` files just chosen in the picker, in `chrome.storage.session`, until the popup reads them. The picker access token is not stored. |
| `downloads` | permissions | Required to save decrypted files under Downloads, including nested folder paths after a folder decrypt. |
| `https://www.googleapis.com/*` | host_permissions | Required for Google Drive API calls to create folders, upload `.gvault`, list vault files GVault can access, download vault files, and optionally delete them after decrypt. |
| `https://drive.google.com/*` | host_permissions | Required for content scripts on Drive: the header toggle, file-input / drop intercept, and the passphrase overlay. |

**OAuth scope:** `https://www.googleapis.com/auth/drive.file` — Lets the user create Drive files and choose any folder or `.gvault` file in Google’s OAuth file picker. GVault uses that access to create `_gvault_encrypted` or nested folders, upload encrypted files into the chosen folder, download vault files for local decrypt, and optionally delete a vault after decrypt. Plaintext file contents are not sent to Google.

**Content Security Policy:** `wasm-unsafe-eval` is required so Argon2id can run as WebAssembly in the extension. No remote scripts are loaded.

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes — only what is needed to sign in with Google and store encrypted files in the user's own Drive. There is no GVault server.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Authentication info | Yes | Yes (to Google only) | Chrome’s identity API obtains an OAuth access token for Drive API calls. The file picker returns a separate short-lived token on Google’s redirect. That token is sent back to Google only to read the names of the items just chosen, then discarded. GVault never sees the Google password, does not send a client secret, and does not send either token to a GVault server. | No |
| User files / content | Yes (ciphertext only) | Yes | Encrypted `.gvault` packages and their filenames are uploaded to **the user's** Google Drive. Plaintext never leaves the device. | No |
| Website content | Yes (Drive page only) | No | Content scripts on `drive.google.com` host the Encrypt uploads toggle and intercept File upload / drop. Page HTML is not sent to the developer. | No |
| Personally identifiable information | No | — | — | — |
| Health, financial, location, web history | No | — | — | — |

“Shared with third parties” here means sold or given to advertisers or other companies. Uploading into the user's own Google Drive is not a third-party share. Google’s handling of Drive data is governed by Google’s policies.

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Developer Info

**Visibility**: Public  
**Pricing**: Free  
**Homepage**: https://megbailey.me/projects/gvault  
**Privacy policy**: https://megbailey.me/projects/gvault/privacy  
**Terms of service**: https://megbailey.me/projects/gvault/terms  
**Security policy**: https://megbailey.me/projects/gvault/security  
