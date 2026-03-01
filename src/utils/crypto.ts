import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get or create the encryption key for this machine
 * Stored in ~/.config/app-repo/encryption.key
 * @private
 */
function getEncryptionKey(): Buffer {
  const keyPath = path.join(os.homedir(), '.config', 'app-repo', 'encryption.key');

  try {
    // Try to read existing key
    return fs.readFileSync(keyPath);
  } catch {
    // Generate new key if doesn't exist
    const key = crypto.randomBytes(KEY_LENGTH);

    // Ensure directory exists
    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Write key with restricted permissions
    fs.writeFileSync(keyPath, key, { mode: 0o600 });

    return key;
  }
}

/**
 * Encrypt a value using AES-256-GCM
 *
 * @param plaintext - Value to encrypt
 * @param keyOverride - Optional encryption key (uses machine key if not provided)
 * @returns Base64-encoded encrypted value with IV and auth tag
 */
export function encrypt(plaintext: string, keyOverride?: Buffer): string {
  const key = keyOverride || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV + AuthTag + Encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a value encrypted with AES-256-GCM
 *
 * @param ciphertext - Base64-encoded encrypted value
 * @param keyOverride - Optional encryption key (uses machine key if not provided)
 * @returns Decrypted plaintext value
 * @throws Error if decryption fails or auth tag is invalid
 */
export function decrypt(ciphertext: string, keyOverride?: Buffer): string {
  const key = keyOverride || getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract IV, auth tag, and encrypted data
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash a value using SHA-256
 * Useful for creating deterministic identifiers or checksums
 *
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a random secret suitable for use as API key or token
 *
 * @param length - Length of the secret in bytes (default: 32)
 * @param encoding - Encoding for output (default: 'base64')
 * @returns Random secret
 */
export function generateSecret(
  length = 32,
  encoding: BufferEncoding = 'base64'
): string {
  return crypto.randomBytes(length).toString(encoding);
}

/**
 * Derive a key from a password using PBKDF2
 *
 * @param password - Password to derive key from
 * @param salt - Salt for key derivation (generates random if not provided)
 * @param iterations - Number of iterations (default: 100000)
 * @returns Derived key and salt used
 */
export function deriveKey(
  password: string,
  salt?: Buffer,
  iterations = 100000
): { key: Buffer; salt: Buffer } {
  const actualSalt = salt || crypto.randomBytes(16);

  const key = crypto.pbkdf2Sync(
    password,
    actualSalt,
    iterations,
    KEY_LENGTH,
    'sha256'
  );

  return { key, salt: actualSalt };
}

/**
 * Encrypt a value with a password (uses PBKDF2 key derivation)
 *
 * @param plaintext - Value to encrypt
 * @param password - Password for encryption
 * @returns Base64-encoded encrypted value with salt
 */
export function encryptWithPassword(plaintext: string, password: string): string {
  const { key, salt } = deriveKey(password);
  const encrypted = encrypt(plaintext, key);

  // Prepend salt to encrypted data
  const combined = Buffer.concat([salt, Buffer.from(encrypted, 'base64')]);

  return combined.toString('base64');
}

/**
 * Decrypt a value encrypted with a password
 *
 * @param ciphertext - Base64-encoded encrypted value with salt
 * @param password - Password for decryption
 * @returns Decrypted plaintext value
 */
export function decryptWithPassword(ciphertext: string, password: string): string {
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract salt and encrypted data
  const salt = combined.subarray(0, 16);
  const encrypted = combined.subarray(16);

  const { key } = deriveKey(password, salt);

  return decrypt(encrypted.toString('base64'), key);
}

/**
 * Check if a value is encrypted (basic heuristic)
 *
 * @param value - Value to check
 * @returns True if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  try {
    const decoded = Buffer.from(value, 'base64');
    // Check if it's valid base64 and has minimum length
    return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
