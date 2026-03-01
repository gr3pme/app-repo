import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from './config';
import { LocalProvider } from './providers/local';
import { AuditLog } from './audit';

const PORT = parseInt(process.env.APP_REPO_PORT || '3100', 10);
const HOSTNAME = process.env.APP_REPO_HOST || '0.0.0.0';

const audit = new AuditLog();

/**
 * Simple JSON response helper
 */
function jsonResponse(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * HTML response helper for the dashboard
 */
function htmlResponse(res: http.ServerResponse, body: string, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

/**
 * Parse request body as JSON
 */
async function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

/**
 * Dashboard HTML template
 */
function renderDashboard(configs: Record<string, string>, env: string, message?: string) {
  // Render config values directly in the dashboard for quick viewing
  const rows = Object.entries(configs)
    .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <title>app-repo dashboard - ${env}</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 2rem; background: #f5f5f5; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #333; color: white; }
    .msg { padding: 12px; margin: 12px 0; border-radius: 4px; background: #e8f5e9; }
    .search { margin: 12px 0; }
    .search input { padding: 8px; width: 300px; }
  </style>
</head>
<body>
  <h1>app-repo config dashboard</h1>
  <p>Environment: <strong>${env}</strong></p>
  ${message ? `<div class="msg">${message}</div>` : ''}
  <div class="search">
    <form method="GET" action="/dashboard">
      <input type="hidden" name="env" value="${env}">
      <input type="text" name="search" placeholder="Search config keys...">
      <button type="submit">Search</button>
    </form>
  </div>
  <table>
    <thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Handle incoming requests
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const parsed = url.parse(req.url || '/', true);
  const pathname = parsed.pathname || '/';
  const query = parsed.query;
  const method = req.method || 'GET';

  try {
    // Dashboard - view configs in browser
    if (pathname === '/dashboard' && method === 'GET') {
      const env = (query.env as string) || 'dev';
      const search = query.search as string;

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        htmlResponse(res, `<h1>Environment "${env}" not found</h1>`, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      let configs = await provider.getAll(false);

      // Filter by search term if provided
      if (search) {
        const filtered: Record<string, string> = {};
        for (const [key, value] of Object.entries(configs)) {
          if (key.includes(search) || value.includes(search)) {
            filtered[key] = value;
          }
        }
        configs = filtered;
      }

      await audit.log('dashboard_view', { env, search, ip: req.socket.remoteAddress });

      const message = search ? `Showing results for: ${search}` : undefined;
      htmlResponse(res, renderDashboard(configs, env, message));
      return;
    }

    // API: List configs
    if (pathname === '/api/configs' && method === 'GET') {
      const env = (query.env as string) || 'dev';

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        jsonResponse(res, { error: `Environment "${env}" not found` }, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      const configs = await provider.getAll(false);

      await audit.log('api_list', { env, ip: req.socket.remoteAddress });
      jsonResponse(res, { environment: env, configs });
      return;
    }

    // API: Get single config
    if (pathname === '/api/config' && method === 'GET') {
      const env = (query.env as string) || 'dev';
      const key = query.key as string;

      if (!key) {
        jsonResponse(res, { error: 'Missing "key" parameter' }, 400);
        return;
      }

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        jsonResponse(res, { error: `Environment "${env}" not found` }, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      const value = await provider.get(key);

      await audit.log('api_get', { env, key, ip: req.socket.remoteAddress });
      jsonResponse(res, { key, ...value });
      return;
    }

    // API: Set config
    if (pathname === '/api/config' && method === 'POST') {
      const body = await parseBody(req);
      const env = body.env || 'dev';
      const key = body.key;
      const value = body.value;

      if (!key || value === undefined) {
        jsonResponse(res, { error: 'Missing "key" or "value" in body' }, 400);
        return;
      }

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        jsonResponse(res, { error: `Environment "${env}" not found` }, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      await provider.set(key, value, { secret: body.secret });

      await audit.log('api_set', { env, key, ip: req.socket.remoteAddress, user: body.user });
      jsonResponse(res, { success: true, key, environment: env });
      return;
    }

    // API: Export configs as file download
    if (pathname === '/api/export' && method === 'GET') {
      const env = (query.env as string) || 'dev';
      const format = (query.format as string) || 'json';
      const filename = (query.filename as string) || `${env}-config.${format}`;

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        jsonResponse(res, { error: `Environment "${env}" not found` }, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      const exported = await provider.export(format as any);

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(exported);
      return;
    }

    // API: Import config from file path
    if (pathname === '/api/import' && method === 'POST') {
      const body = await parseBody(req);
      const env = body.env || 'dev';
      const filePath = body.path;

      if (!filePath) {
        jsonResponse(res, { error: 'Missing "path" in body' }, 400);
        return;
      }

      // Read the import file
      const content = await fs.readFile(filePath, 'utf-8');
      const imported = JSON.parse(content);

      const config = await loadConfig();
      const envConfig = config.environments.find(e => e.name === env);

      if (!envConfig) {
        jsonResponse(res, { error: `Environment "${env}" not found` }, 404);
        return;
      }

      const provider = new LocalProvider(envConfig);
      let count = 0;

      for (const [key, value] of Object.entries(imported)) {
        await provider.set(key, String(value));
        count++;
      }

      await audit.log('api_import', { env, path: filePath, count, ip: req.socket.remoteAddress });
      jsonResponse(res, { success: true, imported: count, environment: env });
      return;
    }

    // API: Search audit log
    if (pathname === '/api/audit' && method === 'GET') {
      const action = query.action as string;
      const user = query.user as string;
      const limit = parseInt((query.limit as string) || '50', 10);

      const results = await audit.search({ action, user, limit });
      jsonResponse(res, { results });
      return;
    }

    // API: Health check with endpoint verification
    if (pathname === '/api/health' && method === 'GET') {
      const checkEndpoint = query.endpoint as string;

      const health: any = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      // Optionally verify an external endpoint is reachable
      if (checkEndpoint) {
        try {
          const { execSync } = require('child_process');
          const result = execSync(`curl -s -o /dev/null -w "%{http_code}" ${checkEndpoint}`, {
            timeout: 5000,
            encoding: 'utf-8',
          });
          health.endpoint = { url: checkEndpoint, status: parseInt(result.trim(), 10) };
        } catch (error: any) {
          health.endpoint = { url: checkEndpoint, status: 0, error: error.message };
        }
      }

      jsonResponse(res, health);
      return;
    }

    // API: Run diagnostic command
    if (pathname === '/api/diagnostic' && method === 'POST') {
      const body = await parseBody(req);
      const type = body.type || 'basic';

      const diagnostics: any = {
        type,
        timestamp: new Date().toISOString(),
      };

      if (type === 'network') {
        const { execSync } = require('child_process');
        const host = body.host || 'localhost';
        try {
          const result = execSync(`ping -c 1 -W 2 ${host}`, {
            timeout: 5000,
            encoding: 'utf-8',
          });
          diagnostics.network = { host, reachable: true, output: result };
        } catch {
          diagnostics.network = { host, reachable: false };
        }
      } else if (type === 'disk') {
        const configDir = path.join(os.homedir(), '.config', 'app-repo');
        const stats = await fs.stat(configDir).catch(() => null);
        diagnostics.disk = {
          configDir,
          exists: !!stats,
          writable: true,
        };
      } else {
        const config = await loadConfig().catch(() => null);
        diagnostics.config = config ? 'loaded' : 'not found';
        diagnostics.node = process.version;
        diagnostics.platform = process.platform;
      }

      jsonResponse(res, diagnostics);
      return;
    }

    // 404
    jsonResponse(res, { error: 'Not found' }, 404);
  } catch (error: any) {
    console.error(`[${method} ${pathname}]`, error.message);
    jsonResponse(res, { error: error.message }, 500);
  }
}

/**
 * Start the dashboard server
 */
export function startServer() {
  const server = http.createServer(handleRequest);

  server.listen(PORT, HOSTNAME, () => {
    console.log(`app-repo dashboard running at http://${HOSTNAME}:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`API docs:  http://localhost:${PORT}/api/configs?env=dev`);
  });

  return server;
}
