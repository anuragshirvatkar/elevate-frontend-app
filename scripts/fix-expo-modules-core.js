const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'adapters',
  'react',
  'permissions',
  'PermissionsService.kt'
);

if (!fs.existsSync(file)) {
  console.log('fix-expo-modules-core: file not found, skipping');
  process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

const original = 'return requestedPermissions.contains(permission)';
const fixed = 'return requestedPermissions?.contains(permission) ?: false';

if (content.includes(original)) {
  content = content.replace(original, fixed);
  fs.writeFileSync(file, content, 'utf8');
  console.log('fix-expo-modules-core: patched PermissionsService.kt for SDK 35 null safety');
} else if (content.includes(fixed)) {
  console.log('fix-expo-modules-core: already patched, skipping');
} else {
  console.warn('fix-expo-modules-core: expected line not found, skipping');
}
