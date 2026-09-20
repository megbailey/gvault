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
| `src/scripts/background.js` | `scripts/background.js` | Service worker (copied as-is) |
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

4. Sign in with Google when the popup or overlay asks. Drive API calls use `chrome.identity` and the `drive` scope from `manifest.json`. Being signed into drive.google.com in the tab is not enough.

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
| Background worker (`src/scripts/background.js`) | Click **Reload** on `chrome://extensions`. |
| `manifest.json` | Reload the extension. |

You do not need to remove and re-add the extension after each change.

## Tests

```bash
npm test
```

That runs Vitest (`vitest run`) against `tests/`. Unit tests cover vault pack/unpack, the `.gvault.json` schema, Drive intercept helpers, header placement, folder create/list, encrypt-then-upload, settings, limits, and decrypt download paths. Argon2id WASM is mocked; WebCrypto AES-GCM still runs. `tests/driveHeader.test.ts` and `tests/settings.test.ts` opt into jsdom via `@vitest-environment jsdom`.

The suite does not drive a live Drive tab, `chrome.identity`, or the resumable upload HTTP session.

## Production builds

```bash
npm run build
```

That compiles the extension into `dist/` and packs `dist/gvault.crx` with `gvault-key.pem`. Use the unpacked `dist/` folder for local testing. Use the `.crx` when you need a packed local install.

For a Chrome Web Store upload, zip the contents of `dist/` (the unpacked extension files, not the `.crx`) and follow [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md).

## Google Cloud listing

Before a public OAuth / Chrome Web Store release, add application domain information to the Google Cloud OAuth client:

- Application home page (cannot be a GitHub URL)
- Application privacy policy link
- Application terms of service link
