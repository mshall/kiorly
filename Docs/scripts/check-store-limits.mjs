#!/usr/bin/env node
// Checks Docs/store-copy.json against App Store / Google Play limits and that
// STORE_LISTING.md shows the same text. Run: node Docs/scripts/check-store-limits.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..');
const copy = JSON.parse(readFileSync(join(docs, 'store-copy.json'), 'utf8'));
const listing = readFileSync(join(docs, 'STORE_LISTING.md'), 'utf8');

const LIMITS = { title: 30, subtitle: 30, shortDescription: 80, description: 4000, whatsNew: 500, keywords: 100 };
// Apple counts characters (UTF-16 code points); spread handles non-BMP safely.
const len = (s) => [...s].length;
let failed = 0;

for (const [loc, f] of Object.entries(copy)) {
  if (loc.startsWith('_')) continue;
  for (const [key, max] of Object.entries(LIMITS)) {
    const v = f[key];
    if (typeof v !== 'string' || !v.length) { console.log(`FAIL ${loc}.${key}: missing`); failed++; continue; }
    const n = len(v);
    const ok = n <= max;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${loc}.${key}: ${n}/${max}`);
    if (!listing.includes(v)) { console.log(`FAIL ${loc}.${key}: text differs from STORE_LISTING.md`); failed++; }
  }
  if (/\s,|,\s/.test(f.keywords)) { console.log(`FAIL ${loc}.keywords: no spaces around commas (wastes characters)`); failed++; }
  const titleWords = new Set(`${f.title} ${f.subtitle}`.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const dup = f.keywords.toLowerCase().split(',').filter((k) => titleWords.has(k));
  if (dup.length) console.log(`warn ${loc}.keywords repeats title/subtitle words (Apple already indexes them): ${dup.join(', ')}`);
  if (/by kiorex|بواسطة كيوريكس/i.test(`${f.title}${f.subtitle}${f.keywords}`)) { console.log(`FAIL ${loc}: "by Kiorex" must not appear in title/subtitle/keywords`); failed++; }
}
console.log(failed ? `\n${failed} problem(s)` : '\nAll store text within limits');
process.exit(failed ? 1 : 0);
