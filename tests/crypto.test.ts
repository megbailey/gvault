/**
 * Crypto primitives used by every encrypt/decrypt path.
 *
 * These tests verify that a passphrase + salt becomes an AES-256-GCM key,
 * that ciphertext round-trips to the original bytes, and that AES-GCM
 * additional authenticated data (used later as chunk index + count) is
 * actually bound into the tag. Argon2id is mocked so the suite does not
 * load WASM; WebCrypto AES-GCM still runs for real.
 */
import { describe, it, expect, vi } from 'vitest';
import { deriveKey, encrypt, decrypt } from '../src/utils/crypto';

vi.mock('argon2-browser/dist/argon2-bundled.min.js', () => ({
    default: {
        hash: vi.fn().mockResolvedValue({
            hash: new Uint8Array(32).fill(1),
            encoded: 'mocked-encoded'
        })
    }
}));

describe('crypto', () => {
    it('derives an AES-256-GCM key from a passphrase and salt', async () => {
        const passphrase = 'test-password';
        const salt = new Uint8Array(16);
        const key = await deriveKey(passphrase, salt);
        expect(key).toBeDefined();
        expect(key.type).toBe('secret');
        expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('encrypts bytes and decrypts them back to the original plaintext', async () => {
        const passphrase = 'test-password';
        const salt = new Uint8Array(16);
        const iv = new Uint8Array(12).fill(1);
        const key = await deriveKey(passphrase, salt);
        
        const data = new TextEncoder().encode('Hello World').buffer;
        const ciphertext = await encrypt(data, key, iv);
        
        expect(ciphertext).toBeDefined();
        expect(ciphertext.byteLength).toBeGreaterThan(0);

        const decrypted = await decrypt(ciphertext, key, iv);
        const decryptedText = new TextDecoder().decode(decrypted);
        
        expect(decryptedText).toBe('Hello World');
    });

    it('fails decrypt when chunk-binding additional data does not match', async () => {
        // Vault v2 stores chunk index + count as AAD. If someone reorders or
        // swaps chunks, GCM authentication must fail instead of silently
        // producing a scrambled file.
        const passphrase = 'test-password';
        const salt = new Uint8Array(16);
        const iv = new Uint8Array(12).fill(1);
        const key = await deriveKey(passphrase, salt);
        const data = new TextEncoder().encode('Hello World').buffer;
        const aad = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 2]);
        const ciphertext = await encrypt(data, key, iv, aad);
        const wrongAad = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]);

        await expect(decrypt(ciphertext, key, iv, wrongAad)).rejects.toMatchObject({ name: 'OperationError' });
    });
});
