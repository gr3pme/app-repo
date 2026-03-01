import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { encrypt, decrypt } from '../utils/crypto';
import type { Environment } from '../config';

interface ConfigValue {
  value: string;
  encrypted: boolean;
  ttl?: number;
  createdAt: number;
  updatedAt: number;
}

interface LocalStore {
  [key: string]: ConfigValue;
}

/**
 * Local file-based configuration provider
 * Stores encrypted configuration values in the user's home directory
 */
export class LocalProvider {
  private storePath: string;
  private environment: Environment;

  constructor(environment: Environment) {
    this.environment = environment;
    this.storePath = path.join(
      os.homedir(),
      '.config',
      'app-repo',
      'environments',
      `${environment.name}.json`
    );
  }

  /**
   * Load the local store from disk
   * @private
   */
  private async loadStore(): Promise<LocalStore> {
    try {
      const content = await fs.readFile(this.storePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  /**
   * Save the local store to disk
   * @private
   */
  private async saveStore(store: LocalStore): Promise<void> {
    const dir = path.dirname(this.storePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  /**
   * Set a configuration value
   *
   * @param key - Configuration key
   * @param value - Configuration value
   * @param options - Additional options (secret, ttl)
   */
  async set(
    key: string,
    value: string,
    options?: { secret?: boolean; ttl?: number }
  ): Promise<void> {
    const store = await this.loadStore();

    const configValue: ConfigValue = {
      value: options?.secret ? encrypt(value) : value,
      encrypted: options?.secret || false,
      ttl: options?.ttl,
      createdAt: store[key]?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    store[key] = configValue;
    await this.saveStore(store);
  }

  /**
   * Get a configuration value
   *
   * @param key - Configuration key
   * @returns Configuration value with metadata
   * @throws Error if key not found
   */
  async get(key: string): Promise<ConfigValue> {
    const store = await this.loadStore();

    if (!(key in store)) {
      throw new Error(`Configuration key "${key}" not found`);
    }

    const configValue = store[key];

    // Check TTL expiration
    if (configValue.ttl) {
      const expiresAt = configValue.updatedAt + configValue.ttl * 1000;
      if (Date.now() > expiresAt) {
        throw new Error(`Configuration key "${key}" has expired`);
      }
    }

    return configValue;
  }

  /**
   * Delete a configuration value
   *
   * @param key - Configuration key
   */
  async delete(key: string): Promise<void> {
    const store = await this.loadStore();

    if (!(key in store)) {
      throw new Error(`Configuration key "${key}" not found`);
    }

    delete store[key];
    await this.saveStore(store);
  }

  /**
   * List all configuration keys
   *
   * @returns Array of configuration keys
   */
  async list(): Promise<string[]> {
    const store = await this.loadStore();
    return Object.keys(store);
  }

  /**
   * Get all configuration values
   *
   * @param includeSecrets - Whether to include encrypted values (defaults to false)
   * @returns Map of all configuration key-value pairs
   */
  async getAll(includeSecrets = false): Promise<Record<string, string>> {
    const store = await this.loadStore();
    const result: Record<string, string> = {};

    for (const [key, configValue] of Object.entries(store)) {
      if (!includeSecrets && configValue.encrypted) {
        result[key] = '***ENCRYPTED***';
      } else if (configValue.encrypted) {
        result[key] = decrypt(configValue.value);
      } else {
        result[key] = configValue.value;
      }
    }

    return result;
  }

  /**
   * Health check for local provider
   *
   * @returns Promise that resolves if provider is healthy
   * @throws Error if provider is unhealthy
   */
  async healthCheck(): Promise<void> {
    const dir = path.dirname(this.storePath);

    try {
      await fs.access(dir, fs.constants.W_OK);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Write and delete a test file
    const testPath = path.join(dir, '.health-check');
    await fs.writeFile(testPath, 'ok', 'utf-8');
    await fs.unlink(testPath);
  }

  /**
   * Export configuration to environment file format
   *
   * @param format - Export format ('dotenv', 'json', 'yaml')
   * @returns Exported configuration as string
   */
  async export(format: 'dotenv' | 'json' | 'yaml' = 'dotenv'): Promise<string> {
    const configs = await this.getAll(false);

    switch (format) {
      case 'dotenv':
        return Object.entries(configs)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

      case 'json':
        return JSON.stringify(configs, null, 2);

      case 'yaml': {
        return Object.entries(configs)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n');
      }

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
