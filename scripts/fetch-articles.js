// scripts/fetch-articles.js
import fs from 'fs';
const dummyData = [
  {
    title_es: "Ejemplo de artículo 1",
    url: "https://ejemplo.com/articulo1",
    image: "https://placekitten.com/400/200",
    source: "Fuente Demo",
    date: new Date().toISOString()
  },
  {
    title_es: "Ejemplo de artículo 2",
    url: "https://ejemplo.com/articulo2",
    image: "https://placekitten.com/401/200",
    source: "Fuente Demo",
    date: new Date().toISOString()
  }
];
fs.writeFileSync('./public/articles_js.json', JSON.stringify(dummyData, null, 2));
console.log("✅ Artículos de ejemplo guardados con imágenes.");

