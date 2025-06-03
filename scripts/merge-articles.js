import fs from 'fs';

const noticiasPath = './public/temp-articles.json';
const revistasPath = './public/temp-revistas.json';
const salidaPath = './public/articles.json';

function leer(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
}

function quitarDuplicados(articulos) {
  const titulos = new Set();
  return articulos.filter(art => {
    const clave = art.titulo_en?.toLowerCase().trim();
    if (titulos.has(clave)) return false;
    titulos.add(clave);
    return true;
  });
}

function merge() {
  const noticias = leer(noticiasPath);
  const revistas = leer(revistasPath);
  const combinados = quitarDuplicados([...noticias, ...revistas]);
  fs.writeFileSync(salidaPath, JSON.stringify(combinados, null, 2));
  console.log(`✅ Artículos combinados: ${combinados.length}`);
}

merge();
