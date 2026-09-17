# GVault Terms of Service

**Last updated:** September 16, 2026

These Terms of Service (“Terms”) govern your use of the GVault Chrome extension (“GVault,” “the extension,” “we,” or “us”).

By installing or using GVault, you agree to these Terms. If you do not agree, do not use the extension.

This document is a draft for listing and Google Cloud registration. It is not legal advice. Have counsel review it before you rely on it as a binding contract.

## 1. The service

GVault is a **free** Chrome extension that encrypts files **on your device** and uploads the encrypted result to **your Google Drive**.

You need:

- A compatible Chromium browser with the extension installed
- A Google account
- Permission for GVault to access Google Drive (OAuth)

GVault is provided as-is. Features may change as the extension is developed.

## 2. Operator

GVault is operated by **Megan Bailey**.

Contact: **[meganbailey@sandiego.edu](mailto:meganbailey@sandiego.edu)**

## 3. Eligibility

You must be allowed to use Google Chrome extensions and Google Drive under Google’s terms and the laws of your country. You must be old enough to form a binding contract (or use GVault only with a parent or guardian’s consent where required).

## 4. Your account and Google

GVault does not create a separate GVault account. You sign in with Google. Your relationship with Google is governed by [Google’s Terms of Service](https://policies.google.com/terms) and [Google’s Privacy Policy](https://policies.google.com/privacy).

You are responsible for:

- Keeping control of your Google account
- The files you choose to encrypt and upload
- Who can access your Google Drive

You may revoke GVault’s Drive access at any time in your Google Account permissions. Uploads will then fail until you authorize the extension again.

## 5. Encryption, passphrases, and lost keys

Files are encrypted locally with a passphrase you enter. The key for encryption is dervided from your passphrase + random SALT using Argon2id. The encryption used is AES-256-GCM.

**We do not store your passphrase. We cannot reset it or decrypt your files for you.**

If you forget the passphrase, the `.gvault.json` file cannot be recovered to plaintext through GVault. You accept that risk.

You are responsible for using a strong passphrase, remembering that passphrase and/or storing it safely.

## 6. Acceptable use

You agree not to use GVault to:

- Violate law or others’ rights
- Upload content you are not allowed to store or encrypt
- Interfere with Google’s services or the extension
- Attempt to reverse-engineer the extension except as allowed by law
- Circumvent security or access another person’s Drive without authorization

You must have the right to encrypt and store each file you process.

## 7. Your content

You retain whatever rights you already have in your documents.

By using GVault you instruct the extension, **on your device**, to encrypt a copy of a file you select and to send the encrypted copy to Google Drive using **your** credentials. We do not claim ownership of your documents.

Encrypted files in Drive are your Drive data. Managing, sharing, and deleting them is done in Google Drive under your account.

## 8. Privacy

Our data practices are described in the [GVault Privacy Policy](PRIVACY.md). You agree that we may process information as described there.

## 9. Intellectual property

The GVault name, logos, and extension code are owned by the operator or its licensors. These Terms do not transfer any IP rights to you except the limited right to use the extension as a Chrome add-on in accordance with these Terms and the Chrome Web Store terms (if you installed it from there).

## 10. Third-party services

GVault depends on Google Chrome and Google Drive. Outages, API changes, quota limits, or account suspension by Google may make GVault unavailable. We are not responsible for Google’s services.

## 11. No warranty

GVault is provided **“as is” and “as available.”** To the fullest extent permitted by law, we disclaim all warranties, including merchantability, fitness for a particular purpose, and non-infringement.

We do not warrant that:

- Encryption will be free of defects or immune to all attacks
- Uploads will always succeed
- The extension will be error-free or uninterrupted
- Lost passphrases can be recovered

You use GVault at your own risk, including the risk of data loss.

## 12. Limitation of liability

To the fullest extent permitted by law, the operator will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost data, or lost passphrase access, arising from your use of GVault.

To the extent liability cannot be excluded, it is limited to the greater of (a) the amount you paid us for GVault in the 12 months before the claim (currently $0, because GVault is free) and (b) USD $50.

Some jurisdictions do not allow certain limitations. In those places, the limits apply only as far as the law allows.

## 13. Indemnity

You will defend and indemnify the operator against claims arising from your content, your misuse of GVault, or your violation of these Terms or of law, except to the extent caused by our willful misconduct.

## 14. Changes and termination

We may update these Terms or the extension. The “Last updated” date will change. Continued use after a change means you accept the new Terms.

We may stop offering GVault at any time.

You may stop using GVault by uninstalling it. Uninstalling does not delete encrypted files already in your Google Drive.

## 15. Governing law

These Terms are governed by the laws of the State of California, excluding conflict-of-law rules, unless mandatory consumer law in your country says otherwise.

## 16. Contact

Questions about these Terms: **[meganbailey@sandiego.edu](mailto:meganbailey@sandiego.edu)**

---

Host this document at a stable public HTTPS URL (and link it from the Privacy Policy) for Google Cloud OAuth consent screen and Chrome Web Store fields.
