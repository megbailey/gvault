import { describe, it, expect, vi } from 'vitest';
import { deriveKey, encrypt, decrypt } from '../src/utils/crypto';

// Mock argon2-browser bundled version
vi.mock('argon2-browser/dist/argon2-bundled.min.js', () => ({
    default: {
        hash: vi.fn().mockResolvedValue({
            hash: new Uint8Array(32).fill(1),
            encoded: 'mocked-encoded'
        })
    }
}));

describe('crypto', () => {
    it('should derive a key from a passphrase', async () => {
        const passphrase = 'test-password';
        const salt = new Uint8Array(16);
        const key = await deriveKey(passphrase, salt);
        expect(key).toBeDefined();
        expect(key.type).toBe('secret');
        expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should encrypt and decrypt data', async () => {
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
});

