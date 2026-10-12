// Zero-dependency build: inlines src/styles.css and every <script src> of src/index.html (in order) into the
// single self-contained root index.html. Usage: node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SRC = fileURLToPath(new URL('./src/', import.meta.url));
const OUT = fileURLToPath(new URL('./index.html', import.meta.url));
const read = (p) => readFileSync(join(SRC, p), 'utf8').replace(/\s+$/, '');

let html = readFileSync(join(SRC, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (m, href) => `<style>\n${read(href)}\n</style>`);
const scriptRe = /(?:<script src="([^"]+)"><\/script>\s*)+/;
html = html.replace(scriptRe, (block) => {
  const files = [...block.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const code = files.map((f) => `/* ===== src/${f} ===== */\n${read(f)}`).join('\n\n');
  if (code.includes('</script')) throw new Error('"</script" inside source code');
  return `<script>\n${code}\n</script>\n`;
});
writeFileSync(OUT, html);
console.log(`built index.html (${(html.length / 1024).toFixed(0)} KB)`);
