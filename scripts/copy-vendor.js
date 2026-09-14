import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');
const destDir = join(root, 'public', 'vendor');
const dest = join(destDir, 'xlsx.full.min.js');

if (!existsSync(src)) {
  console.warn('[copy-vendor] xlsx не найден — выполните npm install');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[copy-vendor] public/vendor/xlsx.full.min.js обновлён');
