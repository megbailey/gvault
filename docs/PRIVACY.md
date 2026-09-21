# GVault Privacy Policy

**Last updated:** September 20, 2026

This Privacy Policy describes how GVault (“GVault,” “the extension,” “we,” or “us”) handles information when you use the GVault Chrome extension.

GVault is a client-side tool. It encrypts files in your browser (the client) and uploads the encrypted result to **your** Google Drive account. We do not operate a GVault backend that receives your documents or passphrases.

This document is provided for transparency and for Google Cloud / Chrome Web Store listing requirements. It is not legal advice.

## 1. Who we are

GVault is developed by **Megan Bailey**.

For privacy questions, contact: **[meganbailey@sandiego.edu](mailto:meganbailey@sandiego.edu)**

## 2. What GVault does

GVault lets you:

- Choose files or a folder on your device, or intercept File upload / drop on drive.google.com
- Encrypt locally with a passphrase you provide (Argon2id for key derivation; AES-256-GCM for encryption)
- Upload the encrypted package (`.gvault`) to a Google Drive folder you choose, or to the Drive folder you are viewing
- Optionally create a default folder named `_gvault_encrypted` if it does not exist
- Download a `.gvault` file or folder from Drive and decrypt it locally (including nested paths under Downloads)
- Optionally delete the encrypted Drive file after a successful decrypt

## 3. Information we process

### 3.1 Information we do **not** collect

GVault does **not** send the following to the developer or to any GVault server (none exists):

- Your passphrase or encryption key
- The unencrypted contents of your documents
- A GVault user account or profile (there is no GVault login)
- Any information in your Google Drive

Your passphrase is used only in memory on your device to derive an encryption key, then discarded.

### 3.2 Information stored on your device

Using Chrome’s `storage` permission, GVault stores **locally** on the device where the extension is installed:

- Settings you choose (for example: minimum passphrase length, whether a special character is required, your default encrypted-folder name, whether to delete a vault after decrypt)
- Whether Encrypt uploads is on for the Drive page

This data stays on that device until you change it or remove the extension. It is not synced by GVault to our systems.

Selected files may be held **temporarily in memory** in the extension popup or the Drive overlay until you encrypt and upload them or dismiss them. They are not uploaded unencrypted.

### 3.3 Information sent to Google

When you sign in and upload, GVault uses `chrome.identity` to obtain an OAuth access token from Google and calls the Google Drive API on your behalf.

Google may receive:

- Your Google authentication (handled by Google’s sign-in flow)
- Drive folder and file metadata needed to list folders and `.gvault` files (name and id) and to create folders
- The **encrypted** `.gvault` file and its filename, uploaded into the Drive folder you selected
- A request to download that encrypted file when you decrypt, and an optional delete of that Drive file after decrypt

OAuth scope used: `https://www.googleapis.com/auth/drive`.

GVault does not use that access to read your existing file contents for its own purposes. Listing requests are limited to folder name and id. Encrypted packages GVault creates are written to your Drive. Scope /auth/drive is needed rather than more limited scope /auth/drive.file so that files can be written to folders the extension did not create.

Google’s handling of that data is governed by [Google’s Privacy Policy](https://policies.google.com/privacy).

### 3.4 Authentication information

GVault uses Google OAuth so it can act on your Drive account. Access tokens are requested through Chrome’s identity API and are used only to authorize Drive API calls from your browser. GVault does not receive or store your Google password.

## 4. How we use information

Local settings are used only to remember your preferences.

Google Drive access is used only to:

- Sign you in with Google
- List folders so you can pick an upload or decrypt destination
- Create the default encrypted folder or nested folders if needed
- Upload encrypted `.gvault` files to your Drive
- Download encrypted `.gvault` files so they can be decrypted on your device
- Optionally delete an encrypted Drive file after decrypt

Decrypted bytes are written on your device (browser download or `chrome.downloads`). We do not sell your data. We do not use your data for advertising, credit decisions, or purposes unrelated to GVault’s encrypt, upload, and decrypt functions.

## 5. Sharing

We do not sell or share your documents, passphrases, or settings with third parties.

The only third party involved in normal use is **Google**, because uploads and folder operations go to Google Drive APIs you authorize.

## 6. Third-party services

| Service | Role |
| --- | --- |
| Google (Chrome Identity + Drive API) | Sign-in and storage of encrypted files in your Drive |
| Google Chrome / Chromium | Runs the extension; provides `chrome.storage`, `chrome.identity`, and `chrome.downloads` |

## 7. Data retention

- **Passphrases and plaintext files:** not retained by GVault after the popup or overlay session ends (except while a file is held in memory awaiting encrypt-and-upload or decrypt).
- **Local settings:** until you change them or uninstall GVault.
- **Encrypted files on Google Drive:** retained in **your** Drive according to your Google account and Drive settings. Uninstalling GVault does not delete those files. You can delete them in Drive.

## 8. Your choices

- You can decline Google sign-in. Folder listing and upload will not work without it.
- You can change or clear extension settings in GVault.
- You can remove GVault’s access in [Google Account third-party apps](https://myaccount.google.com/permissions).
- You can uninstall GVault in `chrome://extensions`, which removes local extension storage.
- You can delete `.gvault` files and folders in Google Drive yourself.

If you lose your passphrase, GVault cannot recover the plaintext. We do not hold a copy of your key.

## 9. Children

GVault is not directed at children under 13 (or under 16 where that is the applicable age). Do not use the extension if you are below the age required to consent to Google’s terms and to use Chrome extensions in your country.

## 10. International use

Processing happens on your device and, for Drive API calls, on Google’s systems. Google may process data in the United States or other countries as described in Google’s policies.

## 11. Changes

We may update this Privacy Policy when the extension’s data practices change. The “Last updated” date will change. Continued use after an update means you accept the revised policy.

## 12. Contact

Privacy questions: **[meganbailey@sandiego.edu](mailto:meganbailey@sandiego.edu)**

The [Terms of Service](https://megbailey.me/projects/gvault/terms) also apply to your use of GVault.

---

This policy is published at [https://megbailey.me/projects/gvault/privacy](https://megbailey.me/projects/gvault/privacy).
