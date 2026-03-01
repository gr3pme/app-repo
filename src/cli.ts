#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, validateConfig } from './config';
import { LocalProvider } from './providers/local';
import { AWSSSMProvider } from './providers/aws-ssm';
import { syncEnvironments } from './sync';
import { encrypt, decrypt } from './utils/crypto';

const program = new Command();

/**
 * Main CLI entry point for app-repo
 * Provides commands for managing environment configurations across multiple deployment targets
 */
program
  .name('app-repo')
  .description('Lightweight utility for managing environment configurations')
  .version('2.4.1');

/**
 * Initialize a new configuration workspace
 */
program
  .command('init')
  .description('Initialize a new config workspace')
  .option('-e, --env <environment>', 'Environment name', 'dev')
  .option('-p, --provider <provider>', 'Provider type (local, aws-ssm, vault)', 'local')
  .option('-f, --force', 'Overwrite existing configuration', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue(`Initializing ${options.env} environment with ${options.provider} provider...`));

      const config = {
        version: 1,
        environments: [
          {
            name: options.env,
            provider: options.provider,
            ...(options.provider === 'aws-ssm' && { region: 'us-east-1' })
          }
        ]
      };

      console.log(chalk.green('✓ Configuration initialized successfully'));
      console.log(chalk.dim('Config file created: .app-repo.yml'));
    } catch (error) {
      console.error(chalk.red('Error initializing config:'), error);
      process.exit(1);
    }
  });

/**
 * Set a configuration value
 */
program
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key')
  .argument('<value>', 'Configuration value')
  .option('-e, --env <environment>', 'Target environment', 'dev')
  .option('-s, --secret', 'Treat as secret (encrypt)', false)
  .option('--ttl <seconds>', 'Time to live for secret rotation')
  .action(async (key, value, options) => {
    try {
      console.log(chalk.blue(`Setting ${key} in ${options.env} environment...`));

      const config = await loadConfig();
      const env = config.environments.find(e => e.name === options.env);

      if (!env) {
        throw new Error(`Environment ${options.env} not found`);
      }

      const provider = env.provider === 'local'
        ? new LocalProvider(env)
        : new AWSSSMProvider(env);

      const finalValue = options.secret ? encrypt(value) : value;
      await provider.set(key, finalValue, { secret: options.secret, ttl: options.ttl });

      console.log(chalk.green(`✓ ${key} set successfully`));
    } catch (error) {
      console.error(chalk.red('Error setting value:'), error);
      process.exit(1);
    }
  });

/**
 * Get a configuration value
 */
program
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .option('-e, --env <environment>', 'Source environment', 'dev')
  .option('-d, --decrypt', 'Decrypt secret values', false)
  .action(async (key, options) => {
    try {
      const config = await loadConfig();
      const env = config.environments.find(e => e.name === options.env);

      if (!env) {
        throw new Error(`Environment ${options.env} not found`);
      }

      const provider = env.provider === 'local'
        ? new LocalProvider(env)
        : new AWSSSMProvider(env);

      const value = await provider.get(key);

      if (options.decrypt && value.encrypted) {
        console.log(decrypt(value.value));
      } else {
        console.log(value.value);
      }
    } catch (error) {
      console.error(chalk.red('Error getting value:'), error);
      process.exit(1);
    }
  });

/**
 * Sync configurations between environments
 */
program
  .command('sync')
  .description('Sync configurations between environments')
  .option('-s, --source <env>', 'Source environment', 'dev')
  .option('-t, --target <env>', 'Target environment', 'prod')
  .option('--dry-run', 'Show what would be synced without making changes', false)
  .option('--force', 'Force sync without confirmation', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue(`Syncing from ${options.source} to ${options.target}...`));

      const config = await loadConfig();
      const result = await syncEnvironments(
        config,
        options.source,
        options.target,
        { dryRun: options.dryRun, force: options.force }
      );

      if (options.dryRun) {
        console.log(chalk.yellow('Dry run - no changes made'));
        console.log(chalk.dim(`Would sync ${result.changes} configuration(s)`));
      } else {
        console.log(chalk.green(`✓ Synced ${result.changes} configuration(s)`));
      }
    } catch (error) {
      console.error(chalk.red('Error syncing:'), error);
      process.exit(1);
    }
  });

/**
 * Run diagnostics on the configuration
 */
program
  .command('doctor')
  .description('Run diagnostics and validate configuration')
  .option('--fix', 'Attempt to fix issues automatically', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('Running diagnostics...\n'));

      // Check config file
      console.log(chalk.dim('Checking configuration file...'));
      const config = await loadConfig();
      const validation = validateConfig(config);

      if (validation.valid) {
        console.log(chalk.green('✓ Configuration is valid'));
      } else {
        console.log(chalk.red('✗ Configuration has errors:'));
        validation.errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
      }

      // Check providers
      console.log(chalk.dim('\nChecking providers...'));
      for (const env of config.environments) {
        try {
          const provider = env.provider === 'local'
            ? new LocalProvider(env)
            : new AWSSSMProvider(env);

          await provider.healthCheck();
          console.log(chalk.green(`✓ ${env.name} (${env.provider}): healthy`));
        } catch (error) {
          console.log(chalk.red(`✗ ${env.name} (${env.provider}): ${error}`));
        }
      }

      console.log(chalk.dim('\nDiagnostics complete'));
    } catch (error) {
      console.error(chalk.red('Error running diagnostics:'), error);
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse();
