# Development

Chrome loads this extension from the built `dist/` folder. `npm run dev` starts webpack-dev-server on port 3000. That is useful for the popup as a normal web page, but Chrome cannot load an unpacked extension from that server, and the Drive content scripts and overlay do not run there.

## Layout

Webpack writes these entries into `dist/`:

| Source | Output | Role |
| --- | --- | --- |
| `src/index.tsx` | `index.html` + hashed popup bundle | Extension popup: Encrypt, Decrypt, Settings |
| `src/drive-overlay-index.tsx` | `drive-overlay-index.html` + `drive-overlay-index.js` | Overlay bootstrap; UI is `DriveOverlay.tsx` |
| `src/scripts/drive-page-main.ts` | `scripts/drive-page-main.js` | MAIN-world intercept of file input and drop |
| `src/scripts/drive-page.ts` | `scripts/drive-page.js` | Isolated-world header toggle, validation, overlay host |
| `src/scripts/background.ts` | `scripts/background.js` | Service worker: opens Google’s OAuth file picker and stores the selection |
| `manifest.json`, `src/assets/logo.png` | `manifest.json`, `logo.png` | Copied into `dist/` |

Shared logic lives under `src/utils/`:

- Argon2id / AES-256-GCM (`crypto.ts`, `fileVault.ts`)
- Drive API (`driveFolder.ts`, `uploadFile.ts`)
- encrypt-then-upload (`encryptUpload.ts`)
- intercept helpers (`drivePage.ts`), settings, limits, and local save paths.

The overlay is a `web_accessible_resource` on `https://drive.google.com/*`. Argon2id WASM needs `wasm-unsafe-eval` in the extension CSP (`manifest.json`).

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build once so `dist/` exists:

   ```bash
   npm run build
   ```

   Packaging a `.crx` during the build requires `gvault-key.pem` in the repo root (this file is gitignored). `npm run build` skips the `.crx` step when webpack-dev-server is running (`WEBPACK_SERVE`).

3. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `dist` folder.

4. Sign in with Google when the popup or overlay asks. Drive API calls use `chrome.identity` and the `drive.file` scope from `manifest.json`. Being signed into drive.google.com in the tab is not enough. After a scope change, remove GVault at [Google Account third-party apps](https://myaccount.google.com/permissions) and sign in again.

5. For ongoing work, rebuild on save instead of reinstalling the extension:

   ```bash
   npm run watch
   ```

Leave the unpacked extension loaded. After a rebuild:

| Change | What to do |
| --- | --- |
| Popup (`src/index.tsx`, `src/components/*`, popup CSS) | Close and reopen the popup. |
| Overlay (`src/drive-overlay-index.tsx`, `src/components/DriveOverlay.tsx`, `DriveEncryptDialog.tsx`) | Reload the extension, then refresh the Drive tab and trigger an encrypt again. |
| Isolated content script (`src/scripts/drive-page.ts`) | Reload the extension, then refresh the Drive tab. |
| MAIN intercept (`src/scripts/drive-page-main.ts`) | Reload the extension, then refresh the Drive tab. |
| Background worker (`src/scripts/background.ts`) | Click **Reload** on `chrome://extensions`. |
| `manifest.json` | Reload the extension. |

You do not need to remove and re-add the extension after each change.

## Tests

```bash
npm test
```

That runs Vitest (`vitest run`) against `tests/`. Unit tests cover vault pack/unpack, streamed binary `.gvault` encode/decode, the vault header schema, Drive intercept helpers, header placement, folder create/list, encrypt-then-upload, settings, limits, decrypt download paths, the OAuth picker URL and redirect, the shared approved-folder list, when an expired folder is asked for again, and the manifest scope. Argon2id WASM is mocked; WebCrypto AES-GCM still runs. `tests/driveHeader.test.ts`, `tests/settings.test.ts`, and `tests/uploadDestination.test.ts` opt into jsdom via `@vitest-environment jsdom`.

The suite does not drive a live Drive tab, `chrome.identity`, or the resumable upload HTTP session.

## Production builds

```bash
npm run build
```

That compiles the extension into `dist/` and packs `dist/gvault.crx` with `gvault-key.pem`. Use the unpacked `dist/` folder for local testing. Use the `.crx` when you need a packed local install.

For a Chrome Web Store upload, zip the contents of `dist/` (the unpacked extension files, not the `.crx`) and follow [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

## Google Cloud listing

Before a public OAuth / Chrome Web Store release, add application domain information to the Google Cloud OAuth client. These cannot be GitHub URLs:

- Application home page: https://megbailey.me/projects/gvault
- Application privacy policy: https://megbailey.me/projects/gvault/privacy
- Application terms of service: https://megbailey.me/projects/gvault/terms
- Authorized domain: `megbailey.me`

OAuth scope on the consent screen: `https://www.googleapis.com/auth/drive.file` only. Remove `https://www.googleapis.com/auth/drive` before you reply to verification. The reply is **Confirm Downscoping**. `drive.file` is non-sensitive, so the restricted-scope review and the annual security assessment do not apply.

## Drive file picker

Choosing a folder or a `.gvault` file uses Google’s OAuth picker (`trigger_onepick=true`) through `chrome.identity.launchWebAuthFlow`. There is no browser API key and no hosted picker page.

The client id in `manifest.json` is only for `chrome.identity.getAuthToken`. That Chrome Extension client cannot register a redirect URI, so the picker uses a separate **Web application** client in the same Cloud project. Create it under Google Auth Platform → Clients:

1. Application type: Web application.
2. Authorized redirect URI: `https://mojepdfcjcohdhdhpaaeiaidmclioici.chromiumapp.org` (no trailing slash, no path). Confirm the extension id on `chrome://extensions` matches `mojepdfcjcohdhdhpaaeiaidmclioici`.
3. Put that client id in `ONE_PICK_CLIENT_ID` in `src/utils/onePick.ts`.

Enable the Google Picker API on project `809805284793`. The consent screen must list only `drive.file`. Google shows the consent screen each time the picker opens.

The auth URL uses `response_type=token`. Google returns `access_token` and `picked_file_ids` on `https://<extension-id>.chromiumapp.org` (no trailing slash). The extension reads the names of those items, then drops the token. It does not call `https://oauth2.googleapis.com/token` and does not send a client secret, so `manifest.json` has no host permission for that host. Chrome opens the auth window itself, so `accounts.google.com` is not a host permission either.

Opening the picker closes the popup. The service worker writes the chosen ids and names to `chrome.storage.session` (`gvaultPickerResult`). The popup applies that record when it reopens. Records older than 10 minutes are ignored. The access token is not written to storage.

Google requires the consent screen every time the picker opens for a folder that is not already approved. Encrypt and Decrypt share one approved folder list (`chrome.storage.local`, `gvaultUploadFolders`). Both pickers show `Default (<encrypted folder name>)` and then the other saved folders. The folder whose name matches that default is kept in storage but omitted from the list, so it is not shown twice. Folders Decrypt can already list are written into that same list, so Encrypt shows them too.

Choosing a saved folder does not start OAuth while its approval is still valid. A remembered folder whose approval has expired stays in the list by name. Google asks for that folder again only when the user chooses it, or uploads or decrypts with it. Other saved folders are left alone. A `401` refreshes the Chrome identity token and retries. The Drive page uses the same check for the folder in the address bar.

If a browser API key was created for an earlier hosted picker page, delete that key under APIs & Services → Credentials.
