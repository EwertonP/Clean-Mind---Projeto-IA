import crypto from 'crypto';

// Ensure we have a 32-byte key derived from a secure secret
const getEncryptionKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_SECRET || process.env.GOOGLE_CLIENT_SECRET || process.env.GEMINI_API_KEY || 'default-fallback-secure-key-cleanmind';
  return crypto.createHash('sha256').update(secret).digest();
};

const IV_LENGTH = 12; // AES-GCM standard IV size
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plain-text string using AES-256-GCM.
 * Returns a string formatted as: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  // Avoid encrypting mock strings or already encrypted strings
  if (text.startsWith('mock_')) return text;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

/**
 * Decrypts a cipher-text string using AES-256-GCM.
 * Gracefully falls back to plain-text if decryption fails or the input is unencrypted.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  if (encryptedText.startsWith('mock_')) return encryptedText;

  // Simple format check (iv:auth_tag:encrypted)
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // If it's not in the iv:auth_tag:encrypted format, assume it is legacy plain text
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.warn('Decryption failed, assuming legacy unencrypted data or incorrect key.', error);
    return encryptedText;
  }
}
