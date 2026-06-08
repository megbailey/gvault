
# GSEC v1

Header:
- magic: GSEC
- version: 1
- cipher: AES-256-GCM
- kdf: Argon2id
- salt: 16 bytes
- iv: 12 bytes

Payload:
{
  metadata,
  ciphertext
}

Files end with .gsec
