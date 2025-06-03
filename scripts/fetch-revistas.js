import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const DEEPL_KEY = process.env.DEEPL_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const PLOS_API = 'https://api.plos.org/search?q=doc_type:full&wt=json&rows=5&fl=id,title_display,journal,publication_date';

async function traducirTitulo(texto) {
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`
    },
    body: new URLSearchParams({
      text: texto,
      target_lang: 'ES'
    })
  });
  const data = await res.json();
  return data.translations?.[0]?.text || texto;
}

async function generarImagen(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      prompt: `Ilustración científica de: ${prompt}`,
      n: 1,
      size: '512x512'
    })
  });
  const data = await res.json();
  return data.data?.[0]?.url || '';
}

async function obtenerArticulos() {
  const res = await fetch(PLOS_API);
  const { response } = await res.json();
  const articulos = response.docs;

  const resultado = await Promise.all(articulos.map(async (art) => {
    const titulo_en = art.title_display;
    const titulo_es = await traducirTitulo(titulo_en);
    const imagen = await generarImagen(titulo_es);
    return {
      tipo: 'revista',
      titulo_en,
      titulo_es,
      url: `https://journals.plos.org/plosone/article?id=${art.id}`,
      imagen,
      tema: 'biología',
      fuente: art.journal || 'PLOS ONE',
      fecha: art.publication_date?.split('T')[0] || new Date().toISOString().split('T')[0]
    };
  }));

  fs.writeFileSync('./public/articles.json', JSON.stringify(resultado, null, 2));
  console.log('Artículos de revistas actualizados correctamente.');
}

obtenerArticulos();
