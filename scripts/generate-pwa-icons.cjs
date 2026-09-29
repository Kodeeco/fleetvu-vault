/**
 * Build PWA / iOS home-screen icons from the FleetVu Vault V badge.
 * Source: public/FleetVu-VaultBadge.jpg
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public', 'FleetVu-VaultBadge.jpg');
const outDir = path.join(root, 'public');

if (!fs.existsSync(src)) {
  console.error('Missing source badge:', src);
  process.exit(1);
}

const BG = { r: 15, g: 23, b: 42, alpha: 1 }; // slate-900 / vault chrome

async function loadBadge(inner) {
  // Source badge has a thin gold rule along the bottom edge — crop it out for app tiles
  const meta = await sharp(src).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const cropBottom = Math.round(h * 0.06);
  return sharp(src)
    .extract({ left: 0, top: 0, width: w, height: Math.max(1, h - cropBottom) })
    .resize(inner, inner, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
}

async function squareAny(size, filename) {
  // Fill most of the tile — looks correct as an unmasked app icon
  const inset = Math.round(size * 0.06);
  const inner = size - inset * 2;
  const badge = await loadBadge(inner);

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: badge, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, filename));
  console.log('wrote', filename);
}

async function squareMaskable(size, filename) {
  // Android maskable safe zone ≈ 40% diameter → keep artwork in center 80%
  const inset = Math.round(size * 0.18);
  const inner = size - inset * 2;
  const badge = await loadBadge(inner);

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: badge, left: inset, top: inset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, filename));
  console.log('wrote', filename);
}

async function main() {
  await squareAny(192, 'icon-192.png');
  await squareAny(512, 'icon-512.png');
  await squareMaskable(192, 'icon-192-maskable.png');
  await squareMaskable(512, 'icon-512-maskable.png');
  await squareAny(180, 'apple-touch-icon.png');
  // Keep webp siblings in sync for older manifest references / caches
  for (const [png, webp] of [
    ['icon-192.png', 'icon-192.webp'],
    ['icon-512.png', 'icon-512.webp'],
  ]) {
    await sharp(path.join(outDir, png))
      .webp({ quality: 90 })
      .toFile(path.join(outDir, webp));
    console.log('wrote', webp);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
