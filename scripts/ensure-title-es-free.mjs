// scripts/ensure-title-es-free.mjs
// Traduce title_es si falta o es igual a title SIN DeepL.
// 1) MyMemory (en|es)  2) LibreTranslate (auto->es) si LIBRE_ENDPOINT válido.

import fs from 'fs';
import path from 'path';

// Entradas / salidas
const IN_PATH  = process.env.ARTICLES_IN  || 'public/articles_enriched.json';
const OUT_PATH = process.env.ARTICLES_OUT || IN_PATH;

// Control
const TITLES_PER_RUN = Number(process.env.TITLES_PER_RUN || 200);
const SLEEP_MS       = Number(process.env.SLEEP_MS || 800);
const FETCH_TIMEOUT  = Number(process.env.FETCH_TIMEOUT_MS || 15000);

// Identificación / endpoints
const USER_AGENT     = process.env.USER_AGENT || 'curioscience-bot/1.0 (+https://futurocientifico.vercel.app)';
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || '';
const RAW_LIBRE      = (process.env.LIBRE_ENDPOINT || '').toString().trim();

// --- Saneado de endpoint LibreTranslate ---
function sanitizeEndpoint(raw) {
  let s = (raw || '').trim();
  // quita comillas
  s = s.replace(/^['"]|['"]$/g, '').trim();
  if (!s) return '';
  // añade https:// si falta
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    // quita / finales y cualquier query/hash
    u.hash = '';
    u.search = '';
    const base = (u.origin + u.pathname).replace(/\/+$/,'');
    return base; // ej: https://libretranslate.de
  } catch {
    return '';
  }
}
const LIBRE_ENDPOINT = sanitizeEndpoint(RAW_LIBRE);

// Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = (s) => (s || '').toString().trim().toLowerCase();

async function fetchWithTO(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Heurística simple: ¿probablemente inglés?
const EN_SOURCES = new Set(['Nature','Science.org','arXiv','PubMed','Phys.org','Scientific American','New Scientist']);
function isProbablyEnglish(text, source) {
  if (EN_SOURCES.has((source || '').trim())) return true;
  const t = (text || '').toLowerCase();
  const enHints = [' the ', ' of ', ' and ', ' for ', ' with ', ' from ', ' in ', ' on ', ' to ', ' study', 'research', 'scientist', 'new '];
  if (/[áéíóúüñ]/i.test(t)) return false;
  const asciiShare = (t.replace(/[^\x00-\x7F]/g, '').length) / Math.max(1, t.length);
  if (asciiShare > 0.98 && enHints.some(h => t.includes(h))) return true;
  return false;
}

function needsTranslation(item) {
  const t  = (item.title || '').trim();
  const te = (item.title_es || '').trim();
  if (!t) return false;
  if (!te) return true;
  return norm(te) === norm(t);
}

// --- Traductores ---
// MyMemory (en -> es) para evitar el error de 'AUTO'
async function translateWithMyMemory(text) {
  try {
    const base = 'https://api.mymemory.translated.net/get';
    const qp = new URLSearchParams({ q: text, langpair: 'en|es' });
    if (MYMEMORY_EMAIL) qp.set('de', MYMEMORY_EMAIL);
    const res = await fetchWithTO(`${base}?${qp.toString()}`, { headers: { 'User-Agent': USER_AGENT }});
    if (!res.ok) return { ok:false, status:res.status, text:'' };
    const data = await res.json().catch(() => ({}));
    let candidate = (data?.responseData?.translatedText || '').trim();
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    const best = matches.filter(m => (m?.translation || '').trim())
                        .sort((a,b) => (Number(b.match)||0) - (Number(a.match)||0))[0];
    if (best && best.translation) candidate = best.translation.trim();
    if (!candidate) return { ok:false, status:200, text:'' };
    return { ok:true, text:candidate, same: norm(candidate) === norm(text) };
  } catch (e) {
    console.warn('[MyMemory] error:', e?.message || e);
    return { ok:false, text:'' };
  }
}

// LibreTranslate (auto -> es), sólo si endpoint válido
async function translateWithLibre(text) {
  if (!LIBRE_ENDPOINT) return { ok:false, text:'' };
  try {
    const url = `${LIBRE_ENDPOINT}/translate`;
    const res = await fetchWithTO(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ q:text, source:'auto', target:'es', format:'text' })
    });
    if (!res.ok) return { ok:false, status:res.status, text:'' };
    const data = await res.json().catch(() => ({}));
    const out = (data?.translatedText || '').trim();
    if (!out) return { ok:false, status:200, text:'' };
    return { ok:true, text:out, same: norm(out) === norm(text) };
  } catch (e) {
    console.warn('[LibreTranslate] error:', e?.message || e);
    return { ok:false, text:'' };
  }
}

// Carga
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));

// Log ligero del endpoint saneado (sólo host)
if (LIBRE_ENDPOINT) {
  try { const u = new URL(LIBRE_ENDPOINT); console.log('LibreTranslate:', u.origin); } catch {}
} else {
  console.log('LibreTranslate: desactivado (LIBRE_ENDPOINT vacío o inválido)');
}

// Proceso
let tried=0, translated=0, byMM=0, byLibre=0, unchanged=0, skipped=0;
const out = [];

for (const it of items) {
  const item = { ...it };
  if (!needsTranslation(item)) { skipped++; out.push(item); continue; }
  if (tried >= TITLES_PER_RUN) { out.push(item); continue; }
  tried++;

  const text = (item.title || '').trim();
  const source = item.source || '';
  const mmFirst = isProbablyEnglish(text, source);

  if (mmFirst) {
    let r = await translateWithMyMemory(text);
    if (r.ok && r.text) {
      item.title_es = r.text; translated++; byMM++;
      if (r.same) {
        const r2 = await translateWithLibre(text);
        if (r2.ok && r2.text && !r2.same) { item.title_es = r2.text; byLibre++; }
        else unchanged++;
      }
      out.push(item); await sleep(SLEEP_MS); continue;
    }
    const r2 = await translateWithLibre(text);
    if (r2.ok && r2.text) { item.title_es = r2.text; translated++; byLibre++; out.push(item); await sleep(SLEEP_MS); continue; }
  } else {
    const r2 = await translateWithLibre(text);
    if (r2.ok && r2.text && !r2.same) { item.title_es = r2.text; translated++; byLibre++; out.push(item); await sleep(SLEEP_MS); continue; }
    const r = await translateWithMyMemory(text);
    if (r.ok && r.text) { item.title_es = r.text; translated++; byMM++; out.push(item); await sleep(SLEEP_MS); continue; }
  }

  if (!item.title_es) item.title_es = item.title || '';
  unchanged++; out.push(item); await sleep(SLEEP_MS);
}

// Guardado
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log(`ensure-title-es-free: traducidos=${translated}, intentos=${tried}, mymemory=${byMM}, libre=${byLibre}, sin_cambio=${unchanged}, omitidos=${skipped}`);
console.log(`Archivo: ${OUT_PATH}`);
