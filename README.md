
# GVault Extension

Architecture:

- Manifest V3
- TypeScript
- Webpack
- Google OAuth via chrome.identity
- AES-256-GCM
- Argon2id
- .gvault.json encrypted file format
- Google Drive uploads
- Vitest unit tests

Google Drive has [native client-side encryption](https://support.google.com/a/answer/10741897) for Google Workspace, not personal Gmail. [An administrator must enable it](https://support.google.com/a/answer/10745596) for the account. [Anyone can create a Workspace account](https://support.google.com/a/answer/53926), but it is [not free beyond a 14-day trial](https://support.google.com/a/answer/6388094). GVault encrypts files locally (AES-256-GCM + Argon2id) before upload so personal Drive users, and Workspace users without CSE, can still keep file contents private.

## Local development

Chrome loads this extension from the built `dist/` folder. `npm run dev` starts webpack-dev-server on port 3000, which is useful for iterating on the popup UI as a normal web page, but Chrome cannot load an unpacked extension from that server.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build once so `dist/` exists:

   ```bash
   npm run build
   ```

   Packaging a `.crx` during the build requires `gvault-key.pem` in the repo root (this file is gitignored).

3. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `dist` folder.

4. For ongoing work, rebuild on save instead of reinstalling the extension:

   ```bash
   npm run watch
   ```

Leave the unpacked extension loaded. After a rebuild:

| Change | What to do |
|---|---|
| Popup UI (`src/index.tsx`, CSS, HTML) | Close and reopen the popup. That is often enough. |
| Background worker (`src/scripts/background.js`) | Click **Reload** on `chrome://extensions`. |
| Content script | Reload the extension, then refresh the Drive tab. |
| `manifest.json` | Reload the extension. |

You do not need to remove and re-add the extension after each change.

## Production builds

```bash
npm run build
```

That compiles the extension into `dist/` and packs `dist/gvault.crx` with `gvault-key.pem`. Use the unpacked `dist/` folder for local testing. Use the `.crx` when you need a packed local install.

For a Chrome Web Store upload, zip the contents of `dist/` (the unpacked extension files, not the `.crx`) and follow [docs/CHROMEWEBSTORE.md](docs/CHROMEWEBSTORE.md).

## Production work remaining

- add App domain information to Google Cloud registration:
  - Application home page
  - Provide users a link to your home page
  - Application privacy policy link
  - Provide users a link to your public privacy policy
  - Application terms of service link
  - Provide users a link to your public terms of service
