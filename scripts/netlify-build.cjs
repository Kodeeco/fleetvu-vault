/**
 * Netlify production build (Windows + Linux).
 * - Plain Next build (no cPanel Linux path rewrite)
 * - Ensure standalone includes next's package "main" entry (NFT omits it;
 *   @netlify/plugin-nextjs resolve('next') needs dist/server/next.js)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
    shell: false,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

// Local Windows CLI fixes for @netlify/plugin-nextjs:
// 1) createRequire('.../:internal:') breaks on Windows drive-letter colons
// 2) patchNextModules can resolve into site node_modules and overwrite next telemetry
const pluginServer = path.join(
  root,
  'node_modules',
  '@netlify',
  'plugin-nextjs',
  'dist',
  'build',
  'content',
  'server.js',
);
if (fs.existsSync(pluginServer)) {
  let src = fs.readFileSync(pluginServer, 'utf8');
  let changed = false;
  const broken = 'createRequire(posixJoin(ctx.serverHandlerDir, ":internal:"))';
  const fixed = 'createRequire(join(ctx.serverHandlerDir, "package.json"))';
  if (src.includes(broken)) {
    src = src.replace(broken, fixed);
    changed = true;
  }
  // Skip module shims on local CLI — they can clobber the real Next install.
  const patchCall =
    'if (ctx.nextVersion) {\n      await patchNextModules(ctx, ctx.nextVersion, serverHandlerRequire.resolve);\n    }';
  const patchSkip =
    'if (ctx.nextVersion && !ctx.constants.IS_LOCAL) {\n      await patchNextModules(ctx, ctx.nextVersion, serverHandlerRequire.resolve);\n    }';
  if (src.includes(patchCall)) {
    src = src.replace(patchCall, patchSkip);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(pluginServer, src, 'utf8');
    console.log('netlify-build: patched @netlify/plugin-nextjs for local Windows deploy');
  }
}

let code = run(process.execPath, [path.join(__dirname, 'patch-radix-progress.cjs')]);
if (code !== 0) process.exit(code);

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
code = run(process.execPath, [nextBin, 'build']);
if (code !== 0) process.exit(code);

const src = path.join(root, 'node_modules', 'next', 'dist', 'server', 'next.js');
const dest = path.join(
  root,
  '.next',
  'standalone',
  'node_modules',
  'next',
  'dist',
  'server',
  'next.js',
);
if (fs.existsSync(src) && !fs.existsSync(dest)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('netlify-build: restored standalone next/dist/server/next.js');
}

process.exit(0);
