#!/usr/bin/env node

/**
 * Post-install script for app-repo
 * Detects AI coding assistants and provides setup instructions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

/**
 * Check if various AI assistants are configured
 */
function detectAIAssistants() {
  const assistants = [];

  // Check for Claude Code
  const claudeConfigPath = path.join(HOME, '.claude.json');
  if (fs.existsSync(claudeConfigPath)) {
    assistants.push('Claude Code');
  }

  // Check for Cursor
  const cursorDir = path.join(HOME, '.cursor');
  if (fs.existsSync(cursorDir)) {
    assistants.push('Cursor');
  }

  // Check for Windsurf
  const windsurfDir = path.join(HOME, '.windsurf');
  if (fs.existsSync(windsurfDir)) {
    assistants.push('Windsurf');
  }

  // Check for Continue
  const continueDir = path.join(HOME, '.continue');
  if (fs.existsSync(continueDir)) {
    assistants.push('Continue');
  }

  // Check for VS Code with AI extensions
  const vscodeDir = path.join(HOME, '.vscode', 'extensions');
  if (fs.existsSync(vscodeDir)) {
    const extensions = fs.readdirSync(vscodeDir);
    if (
      extensions.some(
        ext =>
          ext.includes('github.copilot') ||
          ext.includes('anthropic') ||
          ext.includes('continue')
      )
    ) {
      assistants.push('VS Code');
    }
  }

  return assistants;
}

/**
 * Main post-install logic
 */
function main() {
  console.log('\n✨ app-repo installed successfully!\n');

  const assistants = detectAIAssistants();

  if (assistants.length > 0) {
    console.log(
      `🤖 Detected AI assistant${assistants.length > 1 ? 's' : ''}: ${assistants.join(', ')}`
    );
    console.log('\n📦 Enable AI-powered config management:');
    console.log('\n   Run the following command to connect the hosted MCP server:\n');
    console.log(
      '   \x1b[36mnpx @anthropic-ai/claude-code mcp add app-repo-manager --transport sse https://mcp.gr3me.co.uk/sse\x1b[0m\n'
    );
    console.log(
      '   This gives your AI assistant direct access to config management tools,'
    );
    console.log(
      '   allowing it to set/get configs, rotate secrets, and sync environments.\n'
    );
  } else {
    console.log('📝 Next steps:\n');
    console.log('   1. Initialize a config workspace: \x1b[36mapp-repo init\x1b[0m');
    console.log('   2. Add configuration values:     \x1b[36mapp-repo set KEY value\x1b[0m');
    console.log('   3. Run health check:             \x1b[36mapp-repo doctor\x1b[0m\n');
  }

  console.log('📖 Documentation: https://github.com/gr3pme/app-repo#readme\n');
}

main();
