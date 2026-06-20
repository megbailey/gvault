
# GDrive Cryptography Extension

Architecture:

- Manifest V3
- TypeScript
- Vite
- Google OAuth via chrome.identity
- AES-256-GCM
- Argon2id
- .gdc.enc encrypted file format
- Google Drive uploads
- Vitest unit tests

Production work remaining:

- Drive resumable uploads
- Streaming encryption
- Security review
- Full UI wiring
- add App domain information to GoogleCloud registration:
-- Application home page
-- Provide users a link to your home page
-- Application privacy policy link
-- Provide users a link to your public privacy policy
-- Application terms of service link
-- Provide users a link to your public terms of service
