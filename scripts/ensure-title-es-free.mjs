// scripts/ensure-title-es-free.mjs

import fs from 'fs';
import path from 'path';

// === CONFIG ===
const IN_PATH  = process.env.ARTICLES_IN  || 'public/articles_enriched.json';
const OUT_PATH = process.env.ARTICLES_OUT || IN_PATH;

const TITLES_PER_RUN = Number(process.env.TITLES_PER_RUN || 200);
const SLEEP_MS       = Number(process.env.SLEEP_MS || 800);
const FETCH_TIMEOUT  = Number(process.env.FETCH_TIMEOUT_MS || 15000);

const PUBLIC_SITE = process.env.PUBLIC_SITE || 'https://futurocientifico.es';
const USER_AGENT  = process.env.USER_AGENT || `curioscience-bot/1.0 (+${PUBLIC_SITE})`;

const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || '';
const RAW_LIBRE      = (process.env.LIBRE_ENDPOINT || '').toString().trim();

// === ENDPOINT ===
function sanitizeEndpoint(raw) {
  let s = (raw || '').trim();
  s = s.replace(/^['"]|['"]$/g, '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;

  try {
    const u = new URL(s);
    u.hash = '';
    u.search = '';
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const LIBRE_ENDPOINT = sanitizeEndpoint(RAW_LIBRE);

// === UTILS ===
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = (s) => (s || '').toString().trim().toLowerCase();

function cleanText(text = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// === VALIDACIÓN ===
function isBadTranslation(text = '') {
  const t = cleanText(text).toLowerCase();

  if (!t) return true;

  if (t.includes('error 500')) return true;
  if (t.includes('server error')) return true;
  if (t.includes('try again later')) return true;
  if (t.includes('too many requests')) return true;

  if (t.includes('<a') || t.includes('href=')) return true;

  if (t.length < 3) return true;

  return false;
}

// 🔥 NUEVO: detector semántico
function isSuspiciousTranslation(original = '', translated = '', source = '') {
  const o = cleanText(original).toLowerCase();
  const t = cleanText(translated).toLowerCase();

  if (!t) return true;

  // palabras absurdas para ciencia
  const weirdWords = ['abrigo','chaqueta','falda','camiseta','pantalón'];
  if (weirdWords.some(w => t.includes(w))) return true;

  // mezcla rara inglés-español
  const englishWords = ['storm','flood','research','study','scientist','data'];
  const hasEnglish = englishWords.some(w => t.includes(w));

  const spanishCore = ['de','la','el','los','las','en','con','para'];
  const hasSpanish = spanishCore.some(w => t.includes(` ${w} `));

  if (hasEnglish && !hasSpanish) return true;

  // casos concretos conocidos
  if (o.includes('kona') && t.includes('abrigo')) return true;

  return false;
}

function applyTranslation(item, text) {
  const cleaned = cleanText(text);

  if (!cleaned || isBadTranslation(cleaned)) return false;
  if (isSuspiciousTranslation(item.title, cleaned, item.source)) return false;

  item.title_es = cleaned;
  return true;
}

// === IDIOMA ===
const EN_SOURCES = new Set([
  'Nature','Science.org','arXiv','PubMed','Phys.org',
  'Scientific American','New Scientist'
]);

function isProbablyEnglish(text, source) {
  if (EN_SOURCES.has((source || '').trim())) return true;

  const t = ` ${text.toLowerCase()} `;
  if (/[áéíóúüñ]/i.test(t)) return false;

  return [' the ',' of ',' and ',' for ',' with ',' from ',' in ',' on ',' to ']
    .some(w => t.includes(w));
}

function needsTranslation(item) {
  const t  = cleanText(item.title || '');
  const te = cleanText(item.title_es || '');
  if (!t) return false;
  if (!te) return true;
  return norm(te) === norm(t);
}

// === FETCH ===
async function fetchWithTO(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// === TRADUCTORES ===
async function translateWithMyMemory(text) {
  try {
    const base = 'https://api.mymemory.translated.net/get';
    const qp = new URLSearchParams({ q: text, langpair: 'en|es' });
    if (MYMEMORY_EMAIL) qp.set('de', MYMEMORY_EMAIL);

    const res = await fetchWithTO(`${base}?${qp.toString()}`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!res.ok) return { ok:false, text:'', same:false };

    const data = await res.json().catch(() => ({}));
    const out = cleanText(data?.responseData?.translatedText || '');

    return { ok: !!out, text: out, same: norm(out) === norm(text) };
  } catch {
    return { ok:false, text:'', same:false };
  }
}

async function translateWithLibre(text) {
  if (!LIBRE_ENDPOINT) return { ok:false, text:'', same:false };

  try {
    const res = await fetchWithTO(`${LIBRE_ENDPOINT}/translate`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json','User-Agent': USER_AGENT },
      body: JSON.stringify({ q:text, source:'auto', target:'es', format:'text' })
    });

    if (!res.ok) return { ok:false, text:'', same:false };

    const data = await res.json().catch(() => ({}));
    const out = cleanText(data?.translatedText || '');

    return { ok: !!out, text: out, same: norm(out) === norm(text) };
  } catch {
    return { ok:false, text:'', same:false };
  }
}

// === CARGA ===
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));

// === PROCESO ===
let tried=0, translated=0, byMM=0, byLibre=0, unchanged=0, skipped=0;
const out=[];

for (const it of items) {
  const item = { ...it };

  item.title = cleanText(item.title);
  item.title_es = cleanText(item.title_es);

  if (!needsTranslation(item)) {
    skipped++; out.push(item); continue;
  }

  if (tried >= TITLES_PER_RUN) {
    out.push(item); continue;
  }

  tried++;

  const text = item.title;
  const mmFirst = isProbablyEnglish(text, item.source);

  let ok = false;

  if (mmFirst) {
    const r = await translateWithMyMemory(text);
    if (r.ok) ok = applyTranslation(item, r.text);

    if (!ok) {
      const r2 = await translateWithLibre(text);
      if (r2.ok) ok = applyTranslation(item, r2.text);
    }
  } else {
    const r2 = await translateWithLibre(text);
    if (r2.ok) ok = applyTranslation(item, r2.text);

    if (!ok) {
      const r = await translateWithMyMemory(text);
      if (r.ok) ok = applyTranslation(item, r.text);
    }
  }

  if (ok) {
    translated++;
  } else {
    item.title_es = item.title;
    unchanged++;
  }

  out.push(item);
  await sleep(SLEEP_MS);
}

// === GUARDADO ===
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log(`traducidos=${translated}, intentos=${tried}, fallback=${unchanged}`);
