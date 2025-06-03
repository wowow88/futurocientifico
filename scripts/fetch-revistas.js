import fs from 'fs';
import fetch from 'node-fetch';
import Parser from 'rss-parser';
import { franc } from 'franc';
import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const parser = new Parser();

const SOURCES = [
  { name: 'arXiv', url: 'http://export.arxiv.org/rss/cs' },
  { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/rss/search/1G9yX0r5TrO6jPB23sOZJ8kPZt7OeEMeP3Wrxsk4NxlMVi4T5L/?limit=10' },
  { name: 'Science.org', url: 'https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science' },
  { name: 'Nature', url: 'https://www.nature.com/nature.rss' },
  { name: 'CNIC', url: 'https://www.cnic.es/es/rss.xml' },
  { name: 'CNIO', url: 'https://www.cnio.es/feed/' },
  { name: 'IAC', url: 'https://www.iac.es/en/rss.xml' }
];

async function traducir(texto) {
  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `auth_key=${DEEPL_API_KEY}&text=${encodeURIComponent(texto)}&target_lang=ES`
    });
    const data = await res.json();
    return data.translations[0].text;
  } catch (err) {
    console.error("❌ Error traduciendo:", texto, err);
    return texto;
  }
}

async function generarImagen(prompt) {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1
    });
    return response.data[0].url;
  } catch (err) {
    console.error("❌ Error generando imagen:", err);
    return "https://source.unsplash.com/featured/?science";
  }
}

async function fetchRevistas() {
  const today = new Date().toISOString().split("T")[0];
  const todos = [];

  for (const fuente of SOURCES) {
    try {
      const feed = await parser.parseURL(fuente.url);
      for (const item of feed.items.slice(0, 3)) {
        const tituloEn = item.title;
        const tituloEs = await traducir(tituloEn);
        const imagen = await generarImagen(tituloEs);
        const articulo = {
          tipo: "revista",
          titulo_en: tituloEn,
          titulo_es: tituloEs,
          imagen,
          url: item.link,
          tema: "ciencia",
          fuente: fuente.name,
          fecha: today
        };
        todos.push(articulo);
      }
    } catch (err) {
      console.error(`❌ Error con ${fuente.name}:`, err.message);
    }
  }

  fs.writeFileSync('./public/temp-revistas.json', JSON.stringify(todos, null, 2));
  console.log(`✅ Artículos reales generados: ${todos.length}`);
}

fetchRevistas();

