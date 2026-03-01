import type { AppRepoConfig } from './config';
import { LocalProvider } from './providers/local';
import { AWSSSMProvider } from './providers/aws-ssm';

interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
  includeSecrets?: boolean;
  exclude?: string[];
}

interface SyncResult {
  changes: number;
  skipped: number;
  errors: Array<{ key: string; error: string }>;
  dryRun: boolean;
}

/**
 * Sync engine for propagating configuration changes between environments
 */
export class SyncEngine {
  private config: AppRepoConfig;

  constructor(config: AppRepoConfig) {
    this.config = config;
  }

  /**
   * Get provider instance for an environment
   * @private
   */
  private getProvider(envName: string): LocalProvider | AWSSSMProvider {
    const env = this.config.environments.find(e => e.name === envName);

    if (!env) {
      throw new Error(`Environment "${envName}" not found`);
    }

    switch (env.provider) {
      case 'local':
        return new LocalProvider(env);
      case 'aws-ssm':
        return new AWSSSMProvider(env);
      default:
        throw new Error(`Provider "${env.provider}" not supported for sync`);
    }
  }

  /**
   * Detect differences between two environments
   *
   * @param sourceEnv - Source environment name
   * @param targetEnv - Target environment name
   * @returns Map of keys with different values
   */
  async detectDifferences(
    sourceEnv: string,
    targetEnv: string
  ): Promise<Map<string, { source: string; target: string | null }>> {
    const sourceProvider = this.getProvider(sourceEnv);
    const targetProvider = this.getProvider(targetEnv);

    const differences = new Map<string, { source: string; target: string | null }>();

    // Get all keys from source
    const sourceKeys = await sourceProvider.list();

    for (const key of sourceKeys) {
      try {
        const sourceValue = await sourceProvider.get(key);
        let targetValue: any = null;

        try {
          targetValue = await targetProvider.get(key);
        } catch {
          // Key doesn't exist in target
          differences.set(key, { source: sourceValue.value, target: null });
          continue;
        }

        // Compare values
        if (sourceValue.value !== targetValue.value) {
          differences.set(key, {
            source: sourceValue.value,
            target: targetValue.value,
          });
        }
      } catch (error) {
        console.error(`Error comparing key "${key}":`, error);
      }
    }

    return differences;
  }

  /**
   * Sync configurations from source to target environment
   *
   * @param sourceEnv - Source environment name
   * @param targetEnv - Target environment name
   * @param options - Sync options
   * @returns Sync result with statistics
   */
  async sync(
    sourceEnv: string,
    targetEnv: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const sourceProvider = this.getProvider(sourceEnv);
    const targetProvider = this.getProvider(targetEnv);

    const result: SyncResult = {
      changes: 0,
      skipped: 0,
      errors: [],
      dryRun: options.dryRun || false,
    };

    const differences = await this.detectDifferences(sourceEnv, targetEnv);

    for (const [key, { source }] of differences.entries()) {
      // Check if key should be excluded
      if (options.exclude?.includes(key)) {
        result.skipped++;
        continue;
      }

      // Skip if dry run
      if (options.dryRun) {
        result.changes++;
        continue;
      }

      try {
        const sourceValue = await sourceProvider.get(key);

        // Skip secrets unless explicitly included
        if (sourceValue.encrypted && !options.includeSecrets) {
          result.skipped++;
          continue;
        }

        await targetProvider.set(key, source, {
          secret: sourceValue.encrypted,
        });

        result.changes++;
      } catch (error) {
        result.errors.push({
          key,
          error: (error as Error).message,
        });
      }
    }

    return result;
  }

  /**
   * Bidirectional sync - merge configurations from both environments
   *
   * @param env1 - First environment name
   * @param env2 - Second environment name
   * @param options - Sync options
   * @returns Sync result with statistics
   */
  async bidirectionalSync(
    env1: string,
    env2: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const provider1 = this.getProvider(env1);
    const provider2 = this.getProvider(env2);

    const result: SyncResult = {
      changes: 0,
      skipped: 0,
      errors: [],
      dryRun: options.dryRun || false,
    };

    // Get all keys from both environments
    const keys1 = await provider1.list();
    const keys2 = await provider2.list();
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      if (options.exclude?.includes(key)) {
        result.skipped++;
        continue;
      }

      try {
        let value1: any = null;
        let value2: any = null;

        try {
          value1 = await provider1.get(key);
        } catch {
          // Key doesn't exist in env1
        }

        try {
          value2 = await provider2.get(key);
        } catch {
          // Key doesn't exist in env2
        }

        // Sync based on most recent update
        if (value1 && !value2) {
          if (!options.dryRun) {
            await provider2.set(key, value1.value, { secret: value1.encrypted });
          }
          result.changes++;
        } else if (!value1 && value2) {
          if (!options.dryRun) {
            await provider1.set(key, value2.value, { secret: value2.encrypted });
          }
          result.changes++;
        } else if (value1 && value2 && value1.updatedAt > value2.updatedAt) {
          if (!options.dryRun) {
            await provider2.set(key, value1.value, { secret: value1.encrypted });
          }
          result.changes++;
        } else if (value1 && value2 && value2.updatedAt > value1.updatedAt) {
          if (!options.dryRun) {
            await provider1.set(key, value2.value, { secret: value2.encrypted });
          }
          result.changes++;
        }
      } catch (error) {
        result.errors.push({
          key,
          error: (error as Error).message,
        });
      }
    }

    return result;
  }
}

/**
 * Convenience function to sync environments
 *
 * @param config - App-repo configuration
 * @param sourceEnv - Source environment name
 * @param targetEnv - Target environment name
 * @param options - Sync options
 * @returns Sync result
 */
export async function syncEnvironments(
  config: AppRepoConfig,
  sourceEnv: string,
  targetEnv: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const engine = new SyncEngine(config);
  return engine.sync(sourceEnv, targetEnv, options);
}
