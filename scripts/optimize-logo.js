import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images');
const url = 'https://iili.io/CqJo5YJ.png';
const localCandidates = [
  join(outDir, 'logo-source.png'),
  join(outDir, 'logo.png'),
  join(process.env.USERPROFILE || '', 'Desktop', 'ЦФКСиЗ ЛОГО.png')
];

mkdirSync(outDir, { recursive: true });

async function loadSourceBuffer() {
  for (const path of localCandidates) {
    if (!existsSync(path)) continue;
    const buf = readFileSync(path);
    if (buf.length > 10000) {
      console.log(`Источник: ${path} (${buf.length} байт)`);
      return buf;
    }
    console.warn(`Пропуск ${path} — файл слишком маленький (${buf.length} байт), скачайте полный PNG`);
  }

  console.log('Скачивание с iili.io…');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const rawPath = join(outDir, 'logo-source.png');
  writeFileSync(rawPath, buf);
  console.log(`Сохранено: ${rawPath} (${buf.length} байт)`);
  return buf;
}

const buf = await loadSourceBuffer();

const sharpOpts = { limitInputPixels: false };

const logo128 = join(outDir, 'logo-128.webp');
const logo256 = join(outDir, 'logo-256.webp');

await sharp(buf, sharpOpts)
  .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 86 })
  .toFile(logo128);

await sharp(buf, sharpOpts)
  .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 86 })
  .toFile(logo256);

console.log(`OK: ${logo128} (${statSync(logo128).size} B)`);
console.log(`OK: ${logo256} (${statSync(logo256).size} B)`);
