/**
 * One-shot migrator: apply supabase/migrations in order via Management API.
 * Node 16 compatible (no fetch).
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const migDir = path.join(root, 'supabase', 'migrations');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.PROJECT_REF || 'xjmfslpipjhttwqcmdxe';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN required');
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function runQuery(sql) {
  const body = JSON.stringify({ query: sql });
  const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 120000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${typeof json === 'object' ? JSON.stringify(json) : data}`));
          return;
        }
        resolve(json);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function versionFromName(name) {
  return name.split('_')[0];
}

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.value)) return result.value;
  return [];
}

async function main() {
  console.log('Bootstrapping migration tracking…');
  await runQuery(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);

  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migrations for ${projectRef}`);

  for (const file of files) {
    const version = versionFromName(file);
    const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
    if (!sql.trim()) {
      console.log(`SKIP empty ${file}`);
      continue;
    }

    const existing = await runQuery(
      `select version from supabase_migrations.schema_migrations where version = '${version}' limit 1;`,
    );
    if (asRows(existing).length > 0) {
      console.log(`SKIP ${file}`);
      continue;
    }

    process.stdout.write(`APPLY ${file} … `);
    try {
      await runQuery(sql);
      const nameEsc = file.replace(/'/g, "''");
      await runQuery(
        `insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${nameEsc}') on conflict (version) do nothing;`,
      );
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      console.error(err.message || err);
      process.exit(1);
    }
  }

  const applied = await runQuery(
    `select version, name from supabase_migrations.schema_migrations order by version;`,
  );
  console.log('\nApplied versions:');
  for (const row of asRows(applied)) {
    console.log(`  ${row.version}  ${row.name || ''}`);
  }
  console.log('\nDONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
