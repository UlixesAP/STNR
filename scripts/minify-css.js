import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'css', 'app.css');
const dest = join(root, 'css', 'app.min.css');

const css = readFileSync(src, 'utf8');

const min = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>~+])\s*/g, '$1')
  .replace(/;}/g, '}')
  .replace(/; /g, ';')
  .trim();

writeFileSync(dest, min);

const origKB = Math.round(css.length / 1024);
const minKB = Math.round(min.length / 1024);
console.log(`[minify-css] ${origKB}KB → ${minKB}KB (saved ${origKB - minKB}KB, ${Math.round((1 - min.length / css.length) * 100)}%)`);
