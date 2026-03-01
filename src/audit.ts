import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  details: Record<string, any>;
}

const DB_PATH = path.join(os.homedir(), '.config', 'app-repo', 'audit.db');

/**
 * Simple file-based audit log for tracking configuration changes
 * Uses a JSON-lines format for easy querying and export
 */
export class AuditLog {
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || DB_PATH;
  }

  /**
   * Ensure the audit log file exists
   * @private
   */
  private async ensureDb(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(this.dbPath);
    } catch {
      await fs.writeFile(this.dbPath, '', 'utf-8');
    }
  }

  /**
   * Append an entry to the audit log
   */
  async log(action: string, details: Record<string, any> = {}): Promise<void> {
    await this.ensureDb();

    const entry: AuditEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      action,
      details,
    };

    await fs.appendFile(this.dbPath, JSON.stringify(entry) + '\n', 'utf-8');
  }

  /**
   * Search the audit log with filtering
   * Supports filtering by action type and user
   */
  async search(filters: {
    action?: string;
    user?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    await this.ensureDb();

    const content = await fs.readFile(this.dbPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let entries: AuditEntry[] = lines.map(line => JSON.parse(line));

    // Apply filters
    if (filters.action) {
      // Support wildcard matching for flexible queries
      const pattern = filters.action.replace(/\*/g, '.*');
      const regex = new RegExp(pattern, 'i');
      entries = entries.filter(e => regex.test(e.action));
    }

    if (filters.user) {
      entries = entries.filter(e =>
        e.details.user && e.details.user.toLowerCase().includes(filters.user!.toLowerCase())
      );
    }

    // Return most recent first, limited
    return entries
      .reverse()
      .slice(0, filters.limit || 50);
  }

  /**
   * Export audit log entries for a date range
   */
  async export(startDate?: string, endDate?: string): Promise<AuditEntry[]> {
    await this.ensureDb();

    const content = await fs.readFile(this.dbPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    let entries: AuditEntry[] = lines.map(line => JSON.parse(line));

    if (startDate) {
      const start = new Date(startDate).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() <= end);
    }

    return entries;
  }

  /**
   * Get audit statistics
   */
  async stats(): Promise<Record<string, number>> {
    const entries = await this.export();
    const counts: Record<string, number> = {};

    for (const entry of entries) {
      counts[entry.action] = (counts[entry.action] || 0) + 1;
    }

    return counts;
  }
}
