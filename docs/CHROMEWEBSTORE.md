# Chrome Web Store Listing — GVault

> Last Updated: 2026-09-16

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
1. Click the GVault extension icon in your toolbar.
2. Select the document you wish to upload.
3. Enter a strong, private passphrase.
4. Click "Encrypt & Upload". The file is instantly encrypted and uploaded to your Google Drive folder as a secure `.gvault.json` package.

**Category**  
Productivity

**Single Purpose**  
Allows users to locally encrypt files using AES-256-GCM and Argon2id before uploading them securely to Google Drive as `.gvault.json` files.

**Primary Language**  
English

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `identity` | permissions | Required to authenticate the user and obtain Google OAuth2 access tokens via `chrome.identity.getAuthToken`. These tokens are used securely on the client-side to authorize file uploads to the user's Google Drive account without exposing credentials. |
| `storage` | permissions | Required to store extension settings and metadata (such as the default encryption configuration, KDF settings, and temporary state) locally on the client device using `chrome.storage.local`. |
| `https://www.googleapis.com/*` | host_permissions | Required to make secure HTTPS API calls to Google Drive API endpoints to list folders, create the default encrypted folder if needed, and upload locally encrypted files. |
| `https://drive.google.com/*` | host_permissions | Required to support future inline uploads and content script integrations directly inside the Google Drive web interface. |

**OAuth scope:** `https://www.googleapis.com/auth/drive` — Required so GVault can look up real folders in the user's Google Drive, create `_gvault_encrypted` when it does not exist, and upload encrypted files into the chosen folder. File contents are never read except for the encrypted `.gvault.json` files this extension creates.

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
