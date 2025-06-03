import fs from 'fs';
import fetch from 'node-fetch';
import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

const API_PLOS = "https://api.plos.org/search?q=everything:*&wt=json&rows=5";

async function traducir(texto) {
  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  console.log("📡 Consultando API de PLOS...");
  try {
    const res = await fetch(API_PLOS);
    const data = await res.json();
    const articulos = [];

    for (const doc of data.response.docs) {
      const tituloEn = doc.title_display;
      const tituloEs = await traducir(tituloEn);
      const imagen = await generarImagen(tituloEs);
      const url = doc.id;
      const tema = "ciencia general";
      const fuente = "PLOS ONE";
      const fecha = new Date().toISOString().split("T")[0];

      articulos.push({ tipo: "revista", titulo_en: tituloEn, titulo_es: tituloEs, imagen, url, tema, fuente, fecha });
    }

    console.log(`✅ Artículos reales obtenidos: ${articulos.length}`);
    fs.writeFileSync('./public/temp-revistas.json', JSON.stringify(articulos, null, 2));
  } catch (err) {
    console.error("❌ Error consultando PLOS:", err);
  }
}

fetchRevistas();
