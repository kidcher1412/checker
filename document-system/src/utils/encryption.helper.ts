import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class EncryptionHelper {
    private static getAlgorithm() {
        return 'aes-256-cbc';
    }

    private static getKey() {
        // App secret should be 32 bytes (256 bits). For demo, using a fixed one if env is missing
        const secret = process.env.ENCRYPTION_SECRET || '12345678901234567890123456789012';
        return Buffer.from(secret, 'utf8');
    }

    static encrypt(text: string): string {
        try {
            const iv = randomBytes(16);
            const cipher = createCipheriv(this.getAlgorithm(), this.getKey(), iv);
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            // Return iv:encryptedString format
            return iv.toString('hex') + ':' + encrypted.toString('hex');
        } catch (e) {
            console.error('Encryption failed', e);
            throw e;
        }
    }

    static decrypt(text: string): string {
        try {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift()!, 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = createDecipheriv(this.getAlgorithm(), this.getKey(), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (e) {
            // Fallback just in case they old keys were hashed with bcrypt or corrupted
            return 'N/A: Cannot decrypt legacy or corrupted key';
        }
    }
}
