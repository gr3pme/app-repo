/**
 * app-repo - Lightweight utility for managing environment configurations
 *
 * Main entry point for programmatic usage
 */

export { loadConfig, validateConfig, saveConfig, getEnvironment, mergeConfigs } from './config';
export type { AppRepoConfig, Environment } from './config';

export { LocalProvider } from './providers/local';
export { AWSSSMProvider } from './providers/aws-ssm';

export { SyncEngine, syncEnvironments } from './sync';

export { encrypt, decrypt, hash, generateSecret, encryptWithPassword, decryptWithPassword } from './utils/crypto';
