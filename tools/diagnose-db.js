#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) {
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      out[m[1]] = val;
    }
  }
  return out;
}

function detectPrismaProvider(schemaPath) {
  if (!fs.existsSync(schemaPath)) return null;
  const s = fs.readFileSync(schemaPath, 'utf8');
  const m = s.match(/datasource\s+db\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function runSqlite(dbPath, sql) {
  const res = spawnSync('sqlite3', [dbPath, '-header', '-csv', sql], { encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(res.stderr || 'sqlite3 returned non-zero');
  return res.stdout.trim();
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  const prismaSchema = path.join(repoRoot, 'prisma', 'schema.prisma');

  const env = readEnv(envPath);
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL || '';
  const provider = detectPrismaProvider(prismaSchema);

  console.log('Detected prisma provider:', provider || 'UNKNOWN');
  console.log('DATABASE_URL:', dbUrl || '(not set)');

  if (provider && dbUrl) {
    if (provider === 'postgresql' && dbUrl.startsWith('file:')) {
      console.warn('\nWARNING: prisma provider is postgres but DATABASE_URL points to a sqlite file. This mismatch can cause runtime errors.');
      console.warn('Please set DATABASE_URL to a Postgres connection when using postgresql provider, or change provider to sqlite in prisma/schema.prisma.');
    }
  }

  if (dbUrl.startsWith('file:')) {
    const rel = dbUrl.slice('file:'.length);
    const dbPath = path.resolve(repoRoot, rel);
    console.log('\nLocal sqlite DB path:', dbPath);
    if (!fs.existsSync(dbPath)) {
      console.log('DB file does not exist. Nothing to inspect.');
      return;
    }

    try {
      const tables = runSqlite(dbPath, ".tables");
      console.log('\nTables:', tables || '(no tables)');
    } catch (e) {
      console.log('Failed to list sqlite tables:', e.message);
    }

    // Check for AuditLog existence
    try {
      const auditCheck = runSqlite(dbPath, "SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLog';");
      if (!auditCheck.trim()) {
        console.log('\nNo AuditLog table found in DB. Cannot attribute admin actions from audit logs.');
      } else {
        console.log('\nRecent audit entries (last 50):');
        const recent = runSqlite(dbPath, "SELECT adminId, action, targetType, targetId, details, createdAt FROM AuditLog ORDER BY createdAt DESC LIMIT 50;");
        console.log(recent);

        const byAdmin = runSqlite(dbPath, "SELECT adminId, COUNT(*) AS cnt FROM AuditLog GROUP BY adminId ORDER BY cnt DESC LIMIT 20;");
        console.log('\nAudit count by admin (top 20):');
        console.log(byAdmin);
      }
    } catch (e) {
      console.log('Error querying AuditLog:', e.message);
    }

    // Transactions summary
    try {
      const txTables = runSqlite(dbPath, "SELECT name FROM sqlite_master WHERE type='table' AND name='Transaction';");
      if (!txTables.trim()) {
        console.log('\nNo Transaction table found in DB.');
      } else {
        console.log('\nTop ADMIN_ADJUSTMENT sums by user:');
        const adj = runSqlite(dbPath, "SELECT userId, SUM(amount) AS sum_adj, COUNT(*) AS cnt FROM \"Transaction\" WHERE type='ADMIN_ADJUSTMENT' GROUP BY userId ORDER BY sum_adj DESC LIMIT 20;");
        console.log(adj);

        console.log('\nTop ORDER_DEBIT sums by user (most debited):');
        const debit = runSqlite(dbPath, "SELECT userId, SUM(amount) AS sum_debit, COUNT(*) AS cnt FROM \"Transaction\" WHERE type='ORDER_DEBIT' GROUP BY userId ORDER BY sum_debit ASC LIMIT 20;");
        console.log(debit);
      }
    } catch (e) {
      console.log('Error querying Transaction table:', e.message);
    }

    return;
  }

  console.log('\nDATABASE_URL is not a sqlite file. For Postgres, please run the following queries on your Postgres instance:');
  console.log('\n-- Recent audit logs');
  console.log("SELECT \"adminId\", action, \"targetType\", \"targetId\", details, \"createdAt\" FROM \"AuditLog\" ORDER BY \"createdAt\" DESC LIMIT 50;");
  console.log('\n-- Top admins by audit count');
  console.log("SELECT \"adminId\", COUNT(*) AS cnt FROM \"AuditLog\" GROUP BY \"adminId\" ORDER BY cnt DESC LIMIT 20;");
  console.log('\n-- Top admin adjustments sums by user');
  console.log("SELECT \"userId\", SUM(amount) AS sum_adj, COUNT(*) AS cnt FROM \"Transaction\" WHERE type='ADMIN_ADJUSTMENT' GROUP BY \"userId\" ORDER BY sum_adj DESC LIMIT 20;");
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
