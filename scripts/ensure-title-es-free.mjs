// scripts/ensure-title-es-free.mjs
// Traduce title_es si falta o es igual a title SIN DeepL.
// 1) MyMemory con langpair EN|ES (evita AUTO)
// 2) Fallback: LibreTranslate (auto->es) si está LIBRE_ENDPOINT

import fs from 'fs';
import path from 'path';

// Entradas / salidas (se pueden sobreescribir por ENV desde el workflow)
const IN_PATH  = process.env.ARTICLES_IN  || 'public/articles_enriched.json';
const OUT_PATH = process.env.ARTICLES_OUT || IN_PATH;

// Control
const TITLES_PER_RUN = Number(process.env.TITLES_PER_RUN || 200);
const SLEEP_MS       = Number(process.env.SLEEP_MS || 800);

// Identificación / endpoints
const USER_AGENT       = process.env.USER_AGENT || 'curioscience-bot/1.0 (+https://futurocientifico.vercel.app)';
const MYMEMORY_EMAIL   = process.env.MYMEMORY_EMAIL || '';
const LIBRE_ENDPOINT   = (process.env.LIBRE_ENDPOINT || '').replace(/\/+$/,''); // sin barra final

// Utilidades
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = (s) => (s || '').toString().trim().toLowerCase();

// Heurística simple: ¿probablemente inglés?
const EN_SOURCES = new Set(['Nature', 'Science.org', 'arXiv', 'PubMed', 'Phys.org', 'Scientific American', 'New Scientist']);
function isProbablyEnglish(text, source) {
  if (EN_SOURCES.has((source || '').trim())) return true;
  const t = (text || '').toLowerCase();
  const enHints = [' the ', ' of ', ' and ', ' for ', ' with ', ' from ', ' in ', ' on ', ' to ', ' study', 'research', 'scientist', 'new '];
  if (/[áéíóúüñ]/i.test(t)) return false;              // acentos típicos ES/PT
  const asciiShare = (t.replace(/[^\x00-\x7F]/g, '').length) / Math.max(1, t.length);
  if (asciiShare > 0.98) {
    if (enHints.some(h => t.includes(h))) return true; // pistas claras
  }
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
// MyMemory: usar SIEMPRE langpair=en|es para evitar el error de AUTO
async function translateWithMyMemory(text) {
  const base = 'https://api.mymemory.translated.net/get';
  const qp = new URLSearchParams({
    q: text,
    langpair: 'en|es' // <- clave: evitamos 'auto|es'
  });
  if (MYMEMORY_EMAIL) qp.set('de', MYMEMORY_EMAIL);

  const res = await fetch(`${base}?${qp.toString()}`, { headers: { 'User-Agent': USER_AGENT }});
  if (!res.ok) return { ok:false, status:res.status, text:'' };
  const data = await res.json();

  // principal
  let candidate = (data?.responseData?.translatedText || '').trim();

  // matches con mejor "match"
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const best = matches
    .filter(m => (m?.translation || '').trim())
    .sort((a,b) => (Number(b.match)||0) - (Number(a.match)||0))[0];
  if (best && best.translation) candidate = best.translation.trim();

  if (!candidate) return { ok:false, status:200, text:'' };
  return { ok:true, text:candidate, same: norm(candidate) === norm(text) };
}

// LibreTranslate: auto -> es (si hay endpoint)
async function translateWithLibre(text) {
  if (!LIBRE_ENDPOINT) return { ok:false, text:'' };
  const url = `${LIBRE_ENDPOINT}/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ q:text, source:'auto', target:'es', format:'text' })
  });
  if (!res.ok) return { ok:false, status:res.status, text:'' };
  const data = await res.json();
  const out = (data?.translatedText || '').trim();
  if (!out) return { ok:false, status:200, text:'' };
  return { ok:true, text:out, same: norm(out) === norm(text) };
}

// Carga
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));

// Proceso
let tried=0, translated=0, byMM=0, byLibre=0, unchanged=0, skipped=0;
const out = [];

for (const it of items) {
  const item = { ...it };
  if (!needsTranslation(item)) {
    skipped++;
    out.push(item);
    continue;
  }
  if (tried >= TITLES_PER_RUN) {
    out.push(item);
    continue;
  }
  tried++;

  const text = (item.title || '').trim();
  const source = item.source || '';

  // Si parece español, no fuerces MyMemory en EN -> intenta Libre primero
  let mmFirst = isProbablyEnglish(text, source);

  if (mmFirst) {
    let r = await translateWithMyMemory(text);
    if (r.ok && r.text) {
      item.title_es = r.text;
      translated++; byMM++;
      if (r.same && LIBRE_ENDPOINT) {
        await sleep(SLEEP_MS);
        const r2 = await translateWithLibre(text);
        if (r2.ok && r2.text && !r2.same) { item.title_es = r2.text; byLibre++; }
        else unchanged++;
      }
      out.push(item);
      await sleep(SLEEP_MS);
      continue;
    }
    // Si MyMemory falla, probar Libre
    if (LIBRE_ENDPOINT) {
      const r2 = await translateWithLibre(text);
      if (r2.ok && r2.text) { item.title_es = r2.text; translated++; byLibre++; out.push(item); await sleep(SLEEP_MS); continue; }
    }
  } else {
    // Libre primero
    const r2 = await translateWithLibre(text);
    if (r2.ok && r2.text && !r2.same) {
      item.title_es = r2.text; translated++; byLibre++; out.push(item); await sleep(SLEEP_MS); continue;
    }
    // y luego MyMemory en EN|ES por si acaso
    const r = await translateWithMyMemory(text);
    if (r.ok && r.text) { item.title_es = r.text; translated++; byMM++; out.push(item); await sleep(SLEEP_MS); continue; }
  }

  // Nada funcionó → deja como estaba (pero asegura que exista title_es)
  if (!item.title_es) item.title_es = item.title || '';
  unchanged++; out.push(item);
  await sleep(SLEEP_MS);
}

// Guardado
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log(`ensure-title-es-free: traducidos=${translated}, intentos=${tried}, mymemory=${byMM}, libre=${byLibre}, sin_cambio=${unchanged}, omitidos=${skipped}`);
console.log(`Archivo: ${OUT_PATH}`);
