import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../assets/elevate-logo.png');
const assetDst = path.join(__dirname, '../assets/notification-icon.png');
const resDir = path.join(__dirname, '../android/app/src/main/res');

// Android notification small-icon densities (px)
const densities = [
  { dir: 'drawable-mdpi', size: 24 },
  { dir: 'drawable-hdpi', size: 36 },
  { dir: 'drawable-xhdpi', size: 48 },
  { dir: 'drawable-xxhdpi', size: 72 },
  { dir: 'drawable-xxxhdpi', size: 96 },
];

// Build a white silhouette on a transparent background.
// Android draws the small icon using only the alpha channel, so the
// background MUST be transparent — an opaque square shows as a white block.
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const isDark = r < 48 && g < 48 && b < 48;

  if (isDark) {
    data[i + 3] = 0; // transparent
  } else {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255; // opaque white
  }
}

const silhouette = sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
});

// Keep the Expo-managed asset (used on prebuild) in sync.
await silhouette
  .clone()
  .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(assetDst);
console.log('Wrote', assetDst);

// Overwrite the native Android drawables directly so existing builds pick it up
// without a full prebuild.
for (const { dir, size } of densities) {
  const dst = path.join(resDir, dir, 'notification_icon.png');
  await silhouette
    .clone()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dst);
  console.log('Wrote', dst);
}
