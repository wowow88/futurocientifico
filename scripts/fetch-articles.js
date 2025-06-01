// scripts/fetch-articles.js
import fs from 'fs';
const dummyData = [
  {
    title_es: "Ejemplo de artículo 1",
    url: "https://ejemplo.com/articulo1",
    source: "Fuente Demo",
    date: new Date().toISOString()
  },
  {
    title_es: "Ejemplo de artículo 2",
    url: "https://ejemplo.com/articulo2",
    source: "Fuente Demo",
    date: new Date().toISOString()
  }
];
fs.writeFileSync('./workspace/astro/public/articles_js.json', JSON.stringify(dummyData, null, 2));
console.log("✅ Artículos de ejemplo guardados.");
