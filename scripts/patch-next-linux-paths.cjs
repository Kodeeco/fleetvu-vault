/**
 * Rewrite Windows absolute paths inside .next so a Windows-built
 * bundle can boot on cPanel Linux (CloudLinux / LiteSpeed).
 *
 * Override target with: CPANEL_APP_ROOT=/home/user/app
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nextDir = path.join(root, '.next');
const linuxRoot = (process.env.CPANEL_APP_ROOT || '/home/global/fleetvu-app').replace(/\/$/, '');

const winRoot = root; // e.g. C:\project-web\project
const winRootFwd = winRoot.replace(/\\/g, '/');
// JSON / JS string form: C:\\project-web\\project
const winRootJson = winRoot.replace(/\\/g, '\\\\');

if (!fs.existsSync(nextDir)) {
  console.error('No .next folder — run build first');
  process.exit(1);
}

let patched = 0;
let scanned = 0;

function fixNextDistBackslashes(text) {
  // Webpack-on-Windows emits: next/dist\\client\\components\\file.js
  return text.replace(/next\/dist(?:\\+|\/)[A-Za-z0-9_.@\\\/\-]+/g, (m) => m.replace(/\\+/g, '/'));
}

function rewriteText(text) {
  let out = fixNextDistBackslashes(text);
  // Absolute Windows paths — longest/most-specific forms first
  out = out.split(winRootJson).join(linuxRoot);
  out = out.split(winRootFwd).join(linuxRoot);
  out = out.split(winRoot).join(linuxRoot);
  return out;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'cache') continue;
      walk(full);
      continue;
    }
    if (!/\.(js|json|nft\.json)$/i.test(name)) continue;
    if (name === 'required-server-files.json') continue; // handled below
    scanned += 1;
    const before = fs.readFileSync(full, 'utf8');
    if (!before.includes('project-web') && !before.includes('C:') && !before.includes('next/dist\\')) {
      continue;
    }
    const after = rewriteText(before);
    if (after !== before) {
      fs.writeFileSync(full, after, 'utf8');
      patched += 1;
    }
  }
}

walk(nextDir);

// Fix required-server-files via structured JSON (never blind-replace backslashes)
const rsfPath = path.join(nextDir, 'required-server-files.json');
if (fs.existsSync(rsfPath)) {
  scanned += 1;
  let raw = fs.readFileSync(rsfPath, 'utf8');
  raw = rewriteText(raw);
  const rsf = JSON.parse(raw);
  rsf.appDir = linuxRoot;
  rsf.relativeAppDir = '';
  if (rsf.config && rsf.config.experimental) {
    rsf.config.experimental.outputFileTracingRoot = linuxRoot;
  }
  if (Array.isArray(rsf.files)) {
    rsf.files = rsf.files.map((f) => String(f).replace(/\\/g, '/'));
  }
  if (Array.isArray(rsf.ignore)) {
    rsf.ignore = rsf.ignore.map((f) => String(f).replace(/\\/g, '/'));
  }
  fs.writeFileSync(rsfPath, JSON.stringify(rsf), 'utf8');
  patched += 1;
}

console.log(
  `patch-next-linux-paths: scanned=${scanned} patched=${patched} linuxRoot=${linuxRoot}`,
);
