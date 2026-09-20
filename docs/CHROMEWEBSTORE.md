# Chrome Web Store Listing — GVault

> Last Updated: 2026-09-20

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
- Zero-knowledge security: Your passwords and unencrypted documents are never stored, transmitted, or seen by anyone—including the developers.

How to Use:

1. Click the GVault extension icon in your toolbar, or turn on Encrypt uploads in the Google Drive header.
2. Choose files or a folder (popup), or use Drive’s File upload / drop while the toggle is on.
3. Enter a strong, private passphrase.
4. GVault encrypts locally and uploads `.gvault.json` to the folder you chose or the Drive folder you are viewing.
5. To open a vault, pick a `.gvault.json` file or folder in the popup Decrypt tab and save the plaintext locally.

**Category**  
Productivity

**Single Purpose**  
Allows users to locally encrypt files using AES-256-GCM and Argon2id before uploading them securely to Google Drive as `.gvault.json` files.

**Primary Language**  
English

---

## Permissions Justification

| Permission | Type | Justification |
| ------------ | ------ | --------------- |
| `identity` | permissions | Required to obtain Google OAuth2 access tokens via `chrome.identity.getAuthToken`. Tokens authorize Drive API calls (upload, list, download, optional delete) from the client. |
| `storage` | permissions | Required to store settings (passphrase rules, default encrypted-folder name, delete-after-decrypt) and the Drive “Encrypt uploads” toggle in `chrome.storage.local`. |
| `downloads` | permissions | Required to save decrypted files under Downloads, including nested folder paths after a folder decrypt. |
| `https://www.googleapis.com/*` | host_permissions | Required for Google Drive API calls to list folders and vault files, create folders, upload `.gvault.json`, download vault files, and optionally delete them after decrypt. |
| `https://drive.google.com/*` | host_permissions | Required for content scripts on Drive: the header toggle, file-input / drop intercept, and the passphrase overlay. |

**OAuth scope:** `https://www.googleapis.com/auth/drive` — Required so GVault can list folders and `.gvault.json` files, create `_gvault_encrypted` or nested folders, upload encrypted files, download vault files for local decrypt, and optionally delete a vault after decrypt. Plaintext file contents are not sent to Google.

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Authentication info | Yes | Yes | Used solely to authorize file uploads directly to the user's own Google Drive account via Google APIs. | No |

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Developer Info

**Visibility**: Public  
**Pricing**: Free  
