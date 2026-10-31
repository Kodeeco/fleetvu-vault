/**
 * cPanel-safe build: writes full output to /build-log.txt so we can
 * read errors without SSH/Terminal.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logPath = path.join(root, 'build-log.txt');
const lines = [];

function log(msg) {
  const text = typeof msg === 'string' ? msg : String(msg);
  lines.push(text);
  try {
    console.log(text);
  } catch {
    /* ignore */
  }
}

function run(command, args) {
  log(`\n--- RUN: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1536',
    },
    // Avoid shell:true — Windows breaks on paths with spaces (e.g. Program Files)
    shell: false,
  });
  if (result.stdout) log(result.stdout);
  if (result.stderr) log(result.stderr);
  if (result.error) log('SPAWN ERROR: ' + result.error.message);
  log('exit=' + String(result.status));
  return result.status ?? 1;
}

log('=== FleetVu cPanel build ' + new Date().toISOString());
log('cwd=' + root);
log('node=' + process.version);
log('HOME=' + (process.env.HOME || ''));

let code = run(process.execPath, [path.join(__dirname, 'patch-radix-progress.cjs')]);
if (code !== 0) {
  log('Patch failed; continuing to next build anyway');
}

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
code = run(process.execPath, [nextBin, 'build']);

const nextDir = path.join(root, '.next');
const buildId = path.join(nextDir, 'BUILD_ID');
log('\n.next exists=' + fs.existsSync(nextDir));
log('BUILD_ID exists=' + fs.existsSync(buildId));
if (fs.existsSync(buildId)) {
  log('BUILD_ID=' + fs.readFileSync(buildId, 'utf8').trim());
}

// Windows → Linux path rewrite so cPanel can boot the bundle
if (code === 0 && fs.existsSync(nextDir)) {
  const patchCode = run(process.execPath, [path.join(__dirname, 'patch-next-linux-paths.cjs')]);
  if (patchCode !== 0) {
    log('Linux path patch failed');
    code = patchCode;
  }
}

fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
log('Wrote ' + logPath);
process.exit(code);
