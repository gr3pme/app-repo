import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration types for app-repo
 */
export interface Environment {
  name: string;
  provider: 'local' | 'aws-ssm' | 'vault' | 'gcp-secret-manager';
  region?: string;
  endpoint?: string;
  prefix?: string;
  encryptionKey?: string;
}

export interface AppRepoConfig {
  version: number;
  environments: Environment[];
  sync?: {
    auto?: boolean;
    interval?: number;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

const CONFIG_FILENAMES = [
  '.app-repo.yml',
  '.app-repo.yaml',
  '.app-repo.json',
];

/**
 * Parse a simple YAML config file (supports the subset we need)
 * @private
 */
function parseSimpleYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');
  const stack: Array<{ indent: number; obj: Record<string, any> }> = [
    { indent: -1, obj: result },
  ];
  let currentArray: any[] | null = null;
  let currentArrayKey = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');

    // Skip comments and empty lines
    if (/^\s*(#|$)/.test(line)) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();

      // Is it a key: value on the array item line?
      if (value.includes(': ')) {
        const obj: Record<string, any> = {};
        const parts = value.split(': ');
        const k = parts[0].trim();
        const v = parts.slice(1).join(': ').trim();
        obj[k] = parseValue(v);

        // Look ahead for more keys at deeper indent
        if (!currentArray) {
          currentArray = [];
          // Find parent
          while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
          }
          const parent = stack[stack.length - 1].obj;
          parent[currentArrayKey] = currentArray;
        }
        currentArray.push(obj);
        stack.push({ indent: indent + 2, obj });
      } else {
        if (currentArray) {
          currentArray.push(parseValue(value));
        }
      }
      continue;
    }

    // Key: value pair
    const match = trimmed.match(/^([^:]+):\s*(.*)/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      // Pop stack to correct level
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;
      currentArray = null;

      if (value === '' || value === '|' || value === '>') {
        // Nested object or upcoming array
        const nested: Record<string, any> = {};
        parent[key] = nested;
        stack.push({ indent, obj: nested });
        currentArrayKey = key;
      } else {
        parent[key] = parseValue(value);
      }
    }
  }

  return result;
}

/**
 * Parse a YAML scalar value
 * @private
 */
function parseValue(raw: string): any {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  // Strip quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Stringify a config object to simple YAML
 * @private
 */
function toSimpleYaml(obj: Record<string, any>, indent = 0): string {
  let result = '';
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      result += `${prefix}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const entries = Object.entries(item);
          const first = entries[0];
          result += `${prefix}  - ${first[0]}: ${first[1]}\n`;
          for (const [k, v] of entries.slice(1)) {
            result += `${prefix}    ${k}: ${v}\n`;
          }
        } else {
          result += `${prefix}  - ${item}\n`;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      result += `${prefix}${key}:\n`;
      result += toSimpleYaml(value, indent + 1);
    } else {
      result += `${prefix}${key}: ${value}\n`;
    }
  }

  return result;
}

/**
 * Search for and load the app-repo configuration file
 *
 * @param searchDir - Directory to search from (defaults to cwd)
 * @returns Parsed configuration
 * @throws Error if no config file found
 */
export async function loadConfig(searchDir?: string): Promise<AppRepoConfig> {
  const dir = searchDir || process.cwd();

  for (const filename of CONFIG_FILENAMES) {
    const filepath = path.join(dir, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');

      if (filename.endsWith('.json')) {
        return JSON.parse(content) as AppRepoConfig;
      }

      return parseSimpleYaml(content) as unknown as AppRepoConfig;
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  throw new Error(
    'No app-repo configuration found. Run "app-repo init" to create one.'
  );
}

/**
 * Validate configuration structure
 *
 * @param config - Configuration object to validate
 * @returns Validation result with errors if invalid
 */
export function validateConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const cfg = config as Record<string, any>;

  if (!cfg || typeof cfg !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  if (typeof cfg.version !== 'number' || cfg.version < 1) {
    errors.push('version: must be a positive integer');
  }

  if (!Array.isArray(cfg.environments)) {
    errors.push('environments: must be an array');
  } else {
    const validProviders = ['local', 'aws-ssm', 'vault', 'gcp-secret-manager'];

    for (let i = 0; i < cfg.environments.length; i++) {
      const env = cfg.environments[i];
      if (!env.name || typeof env.name !== 'string') {
        errors.push(`environments[${i}].name: must be a non-empty string`);
      }
      if (!validProviders.includes(env.provider)) {
        errors.push(`environments[${i}].provider: must be one of ${validProviders.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Save configuration to file
 *
 * @param config - Configuration to save
 * @param configPath - Optional path (defaults to .app-repo.yml)
 */
export async function saveConfig(
  config: AppRepoConfig,
  configPath = '.app-repo.yml'
): Promise<void> {
  const validation = validateConfig(config);

  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  const content = configPath.endsWith('.json')
    ? JSON.stringify(config, null, 2)
    : toSimpleYaml(config as unknown as Record<string, any>);

  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Get environment by name
 *
 * @param config - App-repo configuration
 * @param envName - Environment name
 * @returns Environment configuration
 */
export function getEnvironment(
  config: AppRepoConfig,
  envName: string
): Environment {
  const env = config.environments.find(e => e.name === envName);

  if (!env) {
    throw new Error(
      `Environment "${envName}" not found. Available: ${config.environments
        .map(e => e.name)
        .join(', ')}`
    );
  }

  return env;
}

/**
 * Merge two configurations with override taking precedence
 */
export function mergeConfigs(
  base: AppRepoConfig,
  override: Partial<AppRepoConfig>
): AppRepoConfig {
  return {
    ...base,
    ...override,
    environments: override.environments || base.environments,
    sync: { ...base.sync, ...override.sync },
    logging: { ...base.logging, ...override.logging },
  };
}
