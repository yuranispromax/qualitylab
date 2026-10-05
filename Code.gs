/**
 * QualityLab · MIRED IPS S.A.S · Subgerencia de Calidad - Profesional de Calidad
 * Laboratorio vivo de la calidad. Aplicación web (Apps Script).
 * Secciones: ?s=inicio | planeacion | biblioteca | herramientas | escuela | experiencias
 * Para incrustar en Google Sites sin menú propio: añadir &nav=0
 */
const QL = {
  FOLDER_ID: '1Yqwn7Yw2eROafgzTDIGr1iMYAlMXkeEt', // Carpeta "QualityLab · App" en Drive
  TZ: 'America/Bogota',
  SECCIONES: ['inicio', 'planeacion', 'biblioteca', 'herramientas', 'escuela', 'experiencias'],
  CACHE_SEG: 120
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const t = HtmlService.createTemplateFromFile('Index');
  t.seccion = QL.SECCIONES.indexOf(p.s) > -1 ? p.s : 'inicio';
  t.nav = p.nav !== '0';
  t.imgs = JSON.stringify(imagenes_());
  t.datos = JSON.stringify(datos_()).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('QualityLab · MiRed IPS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Arma las imágenes (data URI) desde los archivos Img1 e Img2 del proyecto. */
function imagenes_() {
  const out = {};
  ['Img1', 'Img2', 'Img3', 'Img4', 'Img5', 'Img6'].forEach(function (f) {
    include(f).split('\n').forEach(function (l) {
      const i = l.indexOf('|');
      if (i < 1) return;
      const k = l.slice(0, i).trim();
      out[k] = (out[k] || '') + l.slice(i + 1).trim();
    });
  });
  Object.keys(out).forEach(function (k) { out[k] = 'data:image/webp;base64,' + out[k]; });
  return out;
}

/** Lee la hoja de datos. Si aún no existe, usa los datos semilla. */
function datos_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('ql_datos');
  if (c) return JSON.parse(c);
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  let d;
  if (!id) {
    d = {};
    Object.keys(SEMILLA).forEach(function (h) { d[h.toLowerCase()] = aObjetos_(SEMILLA[h]); });
  } else {
    const ss = SpreadsheetApp.openById(id);
    d = {};
    Object.keys(SEMILLA).forEach(function (h) {
      const sh = ss.getSheetByName(h);
      d[h.toLowerCase()] = sh ? aObjetos_(sh.getDataRange().getValues()) : ((h === 'Pildoras' || h === 'Formula') ? aObjetos_(SEMILLA[h]) : []);
    });
  }
  const cf = cache.get('ql_fotos');
  if (cf) d.fotos = JSON.parse(cf);
  else {
    try { d.fotos = fotos_(); cache.put('ql_fotos', JSON.stringify(d.fotos), 1800); } catch (err) { d.fotos = { escuela: {}, experiencias: {}, error: String(err) }; }
  }
  try { cache.put('ql_datos', JSON.stringify(d), QL.CACHE_SEG); } catch (err) {}
  return d;
}


function aObjetos_(filas) {
  if (!filas || filas.length < 2) return [];
  const cab = filas[0].map(function (h) { return String(h).trim(); });
  return filas.slice(1).filter(function (f) { return f.join('').toString().trim() !== ''; }).map(function (f) {
    const o = {};
    cab.forEach(function (h, i) {
      let v = f[i];
      if (v instanceof Date) v = Utilities.formatDate(v, QL.TZ, 'yyyy-MM-dd');
      o[h] = v === null || v === undefined ? '' : v;
    });
    return o;
  });
}

/** Ejecutar UNA vez: crea la hoja "QualityLab · Datos" con los datos semilla en la carpeta del proyecto. */
function instalar() {
  const ss = SpreadsheetApp.create('QualityLab · Datos');
  Object.keys(SEMILLA).forEach(function (h, i) {
    const sh = i === 0 ? ss.getSheets()[0].setName(h) : ss.insertSheet(h);
    const v = SEMILLA[h].map(function (fila, r) {
      return fila.map(function (x, c) {
        if (h === 'Calendario' && r > 0 && c === 0) return new Date(x + 'T12:00:00');
        return x;
      });
    });
    sh.getRange(1, 1, v.length, v[0].length).setValues(v);
    sh.getRange(1, 1, 1, v[0].length).setFontWeight('bold').setBackground('#006081').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (h === 'Calendario') sh.getRange(2, 1, v.length - 1, 1).setNumberFormat('yyyy-mm-dd');
    sh.autoResizeColumns(1, v[0].length);
  });
  try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(QL.FOLDER_ID)); } catch (err) {}
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  limpiarCache();
  Logger.log('Hoja creada: ' + ss.getUrl());
  return ss.getUrl();
}

/** Ejecutar después de editar la hoja si quiere ver los cambios de inmediato. */
function limpiarCache() {
  CacheService.getScriptCache().removeAll(['ql_datos', 'ql_fotos', 'ql_ids']);
}


/* ================= Fotos (Drive) =================
 * Carpeta "QualityLab · App"
 *   └ Escuela de Calidad / 2023, 2024, 2025, 2026 ...   → fotos de cada ola
 *   └ Experiencias / "2025 · Foro Internacional OES 2025" → fotos de cada experiencia
*   └ Inicio / Herramientas / Planeación Estratégica / Biblioteca / <Álbum> → rollos de fotos del módulo
 * Basta con subir las fotos a la carpeta correcta: la app las muestra sola.
 */
function subcarpeta_(padre, nombre, crear) {
  const it = padre.getFoldersByName(nombre);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return crear ? padre.createFolder(nombre) : null;
}
function listarFotos_(carpeta) {
  const out = [];
  const props = PropertiesService.getScriptProperties();
  const hechos = JSON.parse(props.getProperty('COMPARTIDOS') || '{}');
  let nuevos = false;
  const it = carpeta.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (String(f.getMimeType()).indexOf('image/') !== 0) continue;
    const id = f.getId();
    if (!hechos[id]) {
      try {
        const acc = f.getSharingAccess();
        if (acc !== DriveApp.Access.DOMAIN_WITH_LINK && acc !== DriveApp.Access.DOMAIN && acc !== DriveApp.Access.ANYONE_WITH_LINK && acc !== DriveApp.Access.ANYONE) {
          f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        }
        hechos[id] = 1; nuevos = true;
      } catch (err) {}
    }
    const d = String(f.getDescription() || '').trim();
    out.push(d ? { id: id, n: f.getName(), d: d } : { id: id, n: f.getName() });
  }
  if (nuevos) { try { props.setProperty('COMPARTIDOS', JSON.stringify(hechos)); } catch (err) {} }
  out.sort(function (a, b) { return a.n.localeCompare(b.n); });
  return out;
}
/* Módulo del sitio → carpeta en Drive. Cada subcarpeta es un álbum (rollo de fotos). */
const MODULOS_FOTOS = [
  ['Inicio', 'inicio'], ['Planeación Estratégica', 'planeacion'], ['Biblioteca', 'biblioteca'],
  ['Herramientas', 'herramientas'], ['Escuela de Calidad', 'escuela'], ['Experiencias', 'experiencias']
];

function fotos_() {
  const raiz = DriveApp.getFolderById(QL.FOLDER_ID);
  const res = { _desc: {} };
  MODULOS_FOTOS.forEach(function (p) {
    res[p[1]] = {};
    const c = subcarpeta_(raiz, p[0], true);
    const it = c.getFolders();
    while (it.hasNext()) {
      const s = it.next();
      if (s.isTrashed()) continue;
      res[p[1]][s.getName().trim()] = listarFotos_(s);
      const dA = String(s.getDescription() || '').trim();
      if (dA) res._desc[p[1] + '/' + s.getName().trim()] = dA; // pie del álbum
    }
    const sueltas = listarFotos_(c);
    if (sueltas.length) res[p[1]]['General'] = (res[p[1]]['General'] || []).concat(sueltas);
  });
  return res;
}

/** Diagnóstico: ejecutar desde el editor para ver cuántas fotos tiene cada módulo y probar la entrega. */
function probarFotos() {
  limpiarCache();
  const f = datos_().fotos;
  Object.keys(f).forEach(function (m) {
    Object.keys(f[m] || {}).forEach(function (a) { if (Array.isArray(f[m][a])) Logger.log(m + ' / ' + a + ': ' + f[m][a].length + ' fotos'); });
  });
  const alb = f.inicio ? Object.keys(f.inicio).filter(function (a) { return (f.inicio[a] || []).length; }) : [];
  const uno = alb.length ? f.inicio[alb[0]][0] : null;
  if (uno) Logger.log('Prueba fotoB64: ' + fotoB64(uno.id).length + ' caracteres');
}

/** Entrega una foto de la carpeta QualityLab como data URI (google.script.run).
 *  Dentro de Google Sites el navegador bloquea las cookies de Drive y las miniaturas salen rotas. */
function fotoB64(id) {
  const cache = CacheService.getScriptCache();
  let ok = cache.get('ql_ids');
  if (!ok) {
    const ids = {};
    const f = datos_().fotos || {};
    Object.keys(f).forEach(function (m) {
      if (!f[m] || typeof f[m] !== 'object') return;
      Object.keys(f[m]).forEach(function (a) { if (Array.isArray(f[m][a])) f[m][a].forEach(function (x) { ids[x.id] = 1; }); });
    });
    ok = JSON.stringify(ids);
    try { cache.put('ql_ids', ok, 1800); } catch (err) {}
  }
  if (!JSON.parse(ok)[id]) throw new Error('Foto no disponible');
  const k = 'ql_f_' + id;
  const c = cache.get(k);
  if (c) return c;
  const b = DriveApp.getFileById(id).getBlob();
  const uri = 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes());
  if (uri.length < 99000) { try { cache.put(k, uri, 21600); } catch (err) {} }
  return uri;
}

/* Importador temporal de fotos (usado una sola vez para traer las fotos de Google Sites). */
const IMPORT_TOKEN = ''; // importador desactivado
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (!IMPORT_TOKEN || p.token !== IMPORT_TOKEN) return ContentService.createTextOutput('denegado');
    let c = DriveApp.getFolderById(QL.FOLDER_ID);
    String(p.ruta).split('/').forEach(function (n) { if (n.trim()) c = subcarpeta_(c, n.trim(), true); });
    if (p.descAlbum) c.setDescription(String(p.descAlbum));
    const ya = c.getFilesByName(p.nombre);
    const arch = ya.hasNext() ? ya.next() : (p.b64 ? c.createFile(Utilities.newBlob(Utilities.base64Decode(p.b64), p.mime || 'image/jpeg', p.nombre)) : null);
    if (arch && p.desc) arch.setDescription(String(p.desc));
    CacheService.getScriptCache().removeAll(['ql_datos', 'ql_fotos', 'ql_ids']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

/** Agrega a la hoja las pestañas nuevas (Olas, Instrucciones) sin tocar las existentes. */
function actualizarHoja() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  Object.keys(SEMILLA).forEach(function (h) {
    if (ss.getSheetByName(h)) return;
    const sh = ss.insertSheet(h);
    const v = SEMILLA[h];
    sh.getRange(1, 1, v.length, v[0].length).setValues(v);
    sh.getRange(1, 1, 1, v[0].length).setFontWeight('bold').setBackground('#006081').setFontColor('#ffffff');
    sh.setFrozenRows(1); sh.autoResizeColumns(1, v[0].length);
  });
  completarEnlaces_(ss);
  let ins = ss.getSheetByName('Instrucciones');
  if (!ins) ins = ss.insertSheet('Instrucciones', 0);
  ins.clear();
  const t = [
    ['CÓMO ACTUALIZAR QUALITYLAB (sin tocar código)'],
    [''],
    ['Calendario: una fila por evento. Fecha (aaaa-mm-dd), Evento ("Módulo 5 · Etapa de Definir"), Tipo, Lugar. Los eventos pasados se ocultan solos en Inicio.'],
    ['Noticias: una fila por noticia de la bitácora. Color: azul, verde, naranja o amarillo. El orden de las filas es el orden en la página.'],
    ['Experiencias: una fila por experiencia exitosa. Para sus fotos, cree en Drive la carpeta "QualityLab · App / Experiencias / Año · Título" (ej. "2025 · Foro Internacional OES 2025") y suba ahí las fotos.'],
    ['Herramientas: pegue la URL en la columna URL para que el tablero pase de "Por conectar" a "Abrir".'],
    ['Areas y Biblioteca: cada material se asocia a un área escribiendo el mismo nombre de área. La URL es el enlace del archivo en Drive.'],
    ['Olas: una fila por ola de la Escuela de Calidad. Estado "En curso" resalta la ola actual. Fotos: carpeta "QualityLab · App / Escuela de Calidad / Año". Fotos sin año: carpeta "Escuela de Calidad / General". Columna Enlace: video o memoria de la ola (botón "Ver video").'],
    ['Pildoras: una fila por slide de las Píldoras Calidosas (Inicio y Herramientas). Mensaje = frase principal; Detalle = texto corto; Color: azul, verde, naranja, amarillo o violeta; Activa: Sí o No; Orden define la secuencia; Seccion: General (slides grandes de Inicio), Herramientas slides (slides grandes de Herramientas) o inicio, biblioteca, herramientas, experiencias (tarjeta pequeña del encabezado de esa página). Todas cierran con "¡La mejora comienza contigo!".'],
    ['Enlaces: en Experiencias y Olas, la columna Enlace acepta el link de Drive de la presentación o video; la página muestra el botón automáticamente.'],
    ['Formula: "La Fórmula del Mes" en Inicio, reconoce a una persona de MiRed cada mes. Mes (ej. "Octubre 2026"), Nombre, Cargo, Cualidades separadas por coma (2 a 4, van sumando en la fórmula), Resultado (el logro al que suman esas cualidades, cierra la fórmula después del "="), Descripcion (una frase corta sobre su aporte), Activa: Sí o No (solo la fila Sí más reciente se muestra). La foto se sube aparte: avísele al asistente de QualityLab para incluirla.'],
    [''],
    ['Los cambios de la hoja se ven en máximo 2 minutos; las fotos nuevas de Drive, en máximo 30 minutos. Si los necesita al instante, ejecute limpiarCache en el editor de Apps Script.']
  ];
  ins.getRange(1, 1, t.length, 1).setValues(t);
  ins.getRange(1, 1).setFontWeight('bold').setFontSize(14).setFontColor('#006081');
  ins.setColumnWidth(1, 900); ins.getRange(1, 1, t.length, 1).setWrap(true);
  limpiarCache();
  return 'ok';
}

function completarEnlaces_(ss) {
  // Agrega la columna Enlace si falta y llena solo celdas vacías con los enlaces de SEMILLA.
  ['Olas', 'Experiencias'].forEach(function (h) {
    const sh = ss.getSheetByName(h); if (!sh) return;
    const sem = SEMILLA[h], cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    let col = cab.indexOf('Enlace') + 1;
    if (!col) { col = cab.length + 1; sh.getRange(1, col).setValue('Enlace').setFontWeight('bold').setBackground('#006081').setFontColor('#ffffff'); }
    const iA = cab.indexOf('Año'), iT = cab.indexOf(h === 'Olas' ? 'Ola' : 'Titulo');
    const sT = sem[0].indexOf(h === 'Olas' ? 'Ola' : 'Titulo'), sE = sem[0].indexOf('Enlace');
    const n = sh.getLastRow(); if (n < 2) return;
    const filas = sh.getRange(2, 1, n - 1, Math.max(col, cab.length)).getValues();
    filas.forEach(function (f, i) {
      if (String(f[col - 1] || '').trim()) return;
      const m = sem.slice(1).filter(function (r) { return String(r[0]) === String(f[iA]) && String(r[sT]) === String(f[iT]) && r[sE]; })[0];
      if (m) sh.getRange(i + 2, col).setValue(m[sE]);
    });
  });
}

const SEMILLA = {
  Calendario: [
    ['Fecha', 'Evento', 'Tipo', 'Lugar', 'Enlace'],
    ['2026-09-08', 'Módulo 1 · El ser & Humanización', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-09-15', 'Módulo 2 · Gestión de la Calidad y Riesgos', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-09-22', 'Módulos 3 y 4 · Fundamentos Lean Healthcare / Six Sigma', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-09-29', 'Módulo 5 · Etapa de Definir', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-10-13', 'Módulo 6 · Herramientas para medir', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-10-20', 'Sesión · Plan de medición', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-10-27', 'Sesión · Análisis: mínimo 2 herramientas de mejora', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-11-03', 'Sesión · Plan de acción', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-11-10', 'Sustentación · Evaluación de jurados (10 y 11 nov)', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', ''],
    ['2026-11-17', 'Cierre · Graduación 4ta Ola', 'Escuela de Calidad', 'Auditorio Rómulo Rodado, Adelita de Char', '']
  ],
  Noticias: [
    ['Etiqueta', 'Titulo', 'Texto', 'Color'],
    ['24 de julio de 2026 · Certificaciones', 'Doble logro: ISO 7101:2023 e ISO 9001:2015', 'MIRED IPS S.A.S. se certificó con ICONTEC en ISO 7101:2023, la norma de calidad en salud, y se recertificó en ISO 9001:2015. Pronto será la ceremonia de entrega del certificado.', 'amarillo'],
    ['11 de febrero · Día del Auditor', 'Celebramos el rol auditor', 'Una jornada dinámica y participativa, en conmemoración del 13 de febrero, que integró equipos, fortaleció conocimientos de auditoría y reconoció el aporte de los auditores a la mejora continua.', 'azul'],
    ['Formación · ISO 7101:2023', 'Capacitación a líderes de proceso', 'Preparamos a los líderes en la norma de calidad en salud expedida por ICONTEC, a la que buscamos acogernos en 2026 para sumar un logro más a nuestra certificación ISO 9001:2015.', 'verde'],
    ['Semana de la Calidad 2025 · CUD Adelita de Char', 'La ruta de la mejora continua', 'Los equipos de Seguridad del Paciente, SIAU y Gestión de Calidad compartieron la ruta de la mejora continua.', 'naranja'],
    ['Semana de la Calidad 2025 · CUD Adelita de Char', 'Experiencias exitosas con nuestros gestores', 'La Subgerente de Calidad, Dra. Elizabeth Iglesias Espinoza, compartió con los gestores las experiencias exitosas de la institución.', 'amarillo']
  ],
  Experiencias: [
    ['Año', 'Titulo', 'Escenario', 'Lugar', 'Enlace'],
    [2025, 'Foro Internacional OES 2025', 'OES', 'Cartagena', 'https://drive.google.com/file/d/1lIMF_oZzJqyuz6HRZy6SrKXjObofHEyP/view'],
    [2024, 'Foro Internacional OES 2024', 'OES', 'Cartagena', ''],
    [2024, 'IHI Brasil 2024', 'IHI', 'Brasil', ''],
    [2023, 'Estrategia de lavado de manos', 'OES', 'Cartagena', ''],
    [2022, 'Vivir para dar vida', 'OES', 'Cartagena', ''],
    [2022, 'Tasa de mortalidad', 'OES', 'Cartagena', ''],
    [2021, 'UCI Red Pública', 'OES', 'Cartagena', ''],
    [2021, 'Modelo de atención de la paciente obstétrica', 'OES', 'Cartagena', ''],
    [2020, 'Población migrante', 'OES', 'Cartagena', ''],
    [2020, 'Club Bench Seguridad del Paciente', 'Club Bench', '', 'https://drive.google.com/file/d/1IMmYsHiK35QoBt67FwjnwjLZTXptVLAJ/view']
  ],
  Herramientas: [
    ['Nombre', 'Descripcion', 'URL'],
    ['ALMERA', 'Software del Sistema de Gestión de Calidad', 'https://sgi.almeraim.com/sgi/?conid=sgimiredips'],
    ['Escuela de Calidad 4ta Ola', 'Aula virtual', 'https://script.google.com/a/macros/miredips.org/s/AKfycbzeGUK04w6lhUzOhzFlNcdzkjETqf030dk8rZp-Wxz-WedmeJmriul4RpHg2h5tqD_Q/exec'],
    ['Tablero de Indicadores', 'Indicadores institucionales', ''],
    ['DASH ISO', 'Auditorías internas y externas', ''],
    ['Cronograma de Auditorías 2026', 'Programa anual', ''],
    ['Revisión por la Gerencia 2025', 'Tablero gerencial', ''],
    ['Boletín SIAU 2026', 'PQRS · SIAU', ''],
    ['Tablero PQRS', 'Experiencia del usuario', ''],
    ['Respuestas PQRSD', 'SIAU', ''],
    ['SIRESP', 'Seguridad del paciente', ''],
    ['Tablero Habilitación SSD', 'Visitas Secretaría Distrital', ''],
    ['PAMEC 2026', 'Autoevaluación', ''],
    ['Auditoría HC Urgencias', 'F-GC-067', ''],
    ['Ruta en Caso de Discriminación', 'F-GC-040', ''],
    ['Pasaporte Digital', 'Rutas de atención', '']
  ],
  Olas: [
    ['Año', 'Ola', 'Descripcion', 'Estado', 'Enlace'],
    [2026, '4ta Ola · Yellow Belt Lean Six Sigma', 'Auditorio Rómulo Rodado, Adelita de Char · martes 2:00 a 5:00 p.m.', 'En curso'],
    [2025, '3ra Ola', '', 'Finalizada', 'https://drive.google.com/file/d/1O-SrmLqbWjziLa-Kge2LqaCoBFsJiyFo/view'],
    [2024, '2da Ola', '', 'Finalizada'],
    [2023, '1ra Ola', '', 'Finalizada']
  ],
  Formula: [
    ['Mes', 'Nombre', 'Cargo', 'Cualidades', 'Resultado', 'Descripcion', 'Foto', 'Activa'],
    ['Septiembre 2026', 'Sandra Paola Vargas Nazzar', 'Gerente General · MiRed IPS', 'Liderazgo, Visión estratégica, Compromiso, Cercanía', 'Doble certificación ISO 9001 e ISO 7101', 'Su gestión llevó a MiRed a certificarse en ISO 9001:2015 y ISO 7101:2023 el mismo día: la prueba de que la calidad se construye en equipo.', 'sandra_vargas', 'Sí'],
    ['Octubre 2026', 'Elizabeth Iglesias Espinoza', 'Subgerente de Calidad · MiRed IPS', 'Innovación, Excelencia, Constancia, Trabajo en equipo', 'Premiación IHI, concursos externos y doble ICONTEC', 'Su trabajo llevó a MiRed a la premiación IHI 2026, a ganar concursos externos de calidad en salud y a lograr, por partida doble, la certificación ICONTEC en ISO 9001:2015 e ISO 7101:2023.', 'elizabeth_iglesias', 'No']
  ],
  Pildoras: [
    ['Orden', 'Mensaje', 'Detalle', 'Color', 'Activa', 'Seccion'],
    [1, 'Cada usuario que atiendes es una oportunidad de hacerlo mejor.', 'La calidad no se revisa al final: se construye en cada atención, en cada registro y en cada saludo.', 'verde', 'Sí', 'General'],
    [2, 'Lo que no se mide, no se puede mejorar.', 'Registra tus datos con cuidado: son la base de las decisiones que protegen a nuestros usuarios.', 'azul', 'Sí', 'General'],
    [3, 'Un pequeño cambio hoy es una gran mejora mañana.', 'Propón una idea en tu proceso. La mejora continua avanza paso a paso, con el ciclo PHEA.', 'naranja', 'Sí', 'General'],
    [4, 'La seguridad del paciente es un compromiso de todos.', 'Reportar un evento no es buscar culpables: es aprender juntos para que no vuelva a ocurrir.', 'verde', 'Sí', 'General'],
    [5, 'Escuchar al usuario es el primer paso para mejorar.', 'Cada PQRS es información valiosa para transformar la experiencia de quienes confían en nosotros.', 'amarillo', 'Sí', 'General'],
    [6, 'La calidad es un trabajo en equipo.', 'Cuando los procesos asistenciales y administrativos se conectan, el resultado se nota en la atención.', 'azul', 'Sí', 'General'],
    [7, 'Hacerlo bien desde la primera vez ahorra tiempo, recursos y riesgos.', 'Seguir el procedimiento documentado en ALMERA es cuidar al usuario y a tu equipo.', 'violeta', 'Sí', 'General'],
    [8, 'Tú eres el cambio que tu proceso necesita.', 'No esperes a que la mejora llegue: empieza hoy con lo que está a tu alcance.', 'naranja', 'Sí', 'General'],
    [9, 'Dos certificaciones, un mismo equipo: gracias a cada colaborador.', 'En 2026 logramos la certificación en ISO 7101:2023 y la recertificación en ISO 9001:2015. Cada proceso bien hecho sumó.', 'amarillo', 'Sí', 'General'],
    [1, 'La calidad empieza con una pregunta: ¿cómo lo puedo hacer mejor?', '', 'verde', 'Sí', 'inicio'],
    [2, 'Cada proceso bien hecho es un paciente más seguro.', '', 'amarillo', 'Sí', 'inicio'],
    [3, 'Aquí aprendemos juntos para mejorar cada día.', '', 'naranja', 'Sí', 'inicio'],
    [1, 'Aprender algo nuevo hoy es mejorar la atención de mañana.', '', 'azul', 'Sí', 'biblioteca'],
    [2, 'El conocimiento compartido se multiplica.', '', 'verde', 'Sí', 'biblioteca'],
    [3, 'Consulta, aplica y enseña: así crece la calidad.', '', 'amarillo', 'Sí', 'biblioteca'],
    [1, 'Los datos cuentan historias: aprende a escucharlas.', '', 'verde', 'Sí', 'herramientas'],
    [2, 'Antes de actuar, busca la causa raíz.', '', 'naranja', 'Sí', 'herramientas'],
    [3, 'Una buena herramienta convierte un problema en una oportunidad.', '', 'azul', 'Sí', 'herramientas'],
    [1, 'Lo que hoy es una buena práctica, mañana puede ser una experiencia exitosa.', '', 'naranja', 'Sí', 'experiencias'],
    [2, 'Cada logro empezó con alguien que decidió mejorar.', '', 'verde', 'Sí', 'experiencias'],
    [3, 'Tu idea también puede llegar a un foro de calidad.', '', 'amarillo', 'Sí', 'experiencias'],
    [1, 'Un proceso estable es un proceso confiable.', 'El gráfico de control te muestra cuándo cambia tu proceso y cuándo actuar a tiempo.', 'azul', 'Sí', 'Herramientas slides'],
    [2, 'Detrás de cada problema hay una causa: encuéntrala.', 'Con el diagrama de causa-efecto el equipo mira el problema desde todos los ángulos antes de decidir.', 'naranja', 'Sí', 'Herramientas slides'],
    [3, 'Enfócate en lo que más impacta.', 'El diagrama de Pareto te ayuda a priorizar: pocas causas explican la mayoría de los problemas.', 'verde', 'Sí', 'Herramientas slides'],
    [4, 'Las herramientas no mejoran solas: tú las pones en acción.', 'Usa las 7 herramientas de la calidad en tu día a día y comparte tus resultados en QualityLab.', 'amarillo', 'Sí', 'Herramientas slides']
  ],
  Areas: [
    ['Area', 'Color', 'Texto'],
    ['Gestión de Calidad', 'azul', ''],
    ['Seguridad del paciente', 'verde', ''],
    ['SIAU · Atención al usuario', 'naranja', ''],
    ['Auditoría Médica', 'violeta', 'La auditoría médica es una de las prácticas que sostiene la mejora continua en MiRed IPS: revisamos historias clínicas, procesos de atención y resultados para identificar oportunidades y reconocer las buenas prácticas de nuestros equipos asistenciales. Muy pronto encontrarás aquí guías, formatos y experiencias del equipo de auditoría médica.'],
    ['Infecciones · PROA', 'amarillo', 'El Programa de Optimización de Antimicrobianos (PROA) reúne las estrategias, protocolos y capacitaciones que promueven el uso adecuado de antibióticos y la prevención de infecciones asociadas a la atención en salud. Se alimentará con guías prácticas, casos de éxito y aprendizajes de nuestros propios colaboradores.']
  ],
  Biblioteca: [
    ['Area', 'Material', 'URL'],
    ['Gestión de Calidad', 'Presentación de ALMERA', 'https://drive.google.com/file/d/1DQqHm5sBvwRzRIj-juw1bVLPnWEqZm11/view'],
    ['Gestión de Calidad', 'Conceptos ISO 9001:2015', 'https://drive.google.com/file/d/1C5rwbtQpoBkzYKG3mhV8ra3WOvrdU281/view'],
    ['Gestión de Calidad', 'ISO 7101:2023 · Numerales 8, 9 y 10', 'https://drive.google.com/file/d/1WQ-JXNRWRBfqB7QdeisIvVjKUO4SdZ4T/view'],
    ['Seguridad del paciente', 'Conceptos básicos de seguridad', 'https://drive.google.com/file/d/1X3BHrjHUdc-X8Ph16noXAAmpV1RWnKHT/view'],
    ['Seguridad del paciente', 'Parto humanizado', 'https://drive.google.com/file/d/1b8L_UVjTIVRytJSpEnFAsyR3KB4XkR11/view'],
    ['Seguridad del paciente', 'Manual y política de humanización · Empresas aliadas', 'https://drive.google.com/file/d/1AlO7uIoNR2RMIsbMbLxMSIPeXXeMZS41/view'],
    ['SIAU · Atención al usuario', 'Resolución 2237', 'https://drive.google.com/file/d/1jmSKkeelLxYXIk6XU0CZ9jP1oobNPWpT/view'],
    ['SIAU · Atención al usuario', 'Rol del SIAU', 'https://drive.google.com/file/d/1DCAtcK5CHJDBL81hphG3m2ZPlBhA0EPV/view']
  ]
};


function tmpActualizarFormulaOct2026() {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
      const nombres = ss.getSheets().map(function(s){ return s.getName(); });
        let sh = ss.getSheetByName('Formula');
          if (!sh) {
              sh = ss.getSheets().find(function(s){ return s.getName().trim().toLowerCase() === 'formula'; });
                }
                  if (!sh) {
                      return 'HOJAS_DISPONIBLES: ' + JSON.stringify(nombres);
                        }
                          const cab = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
                            const iNombre = cab.indexOf('Nombre'), iActiva = cab.indexOf('Activa');
                              const vals = sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues();
                                vals.forEach(function(r, idx) {
                                    if (String(r[iNombre]).indexOf('Elizabeth Iglesias') > -1) {
                                          sh.getRange(idx+2, iActiva+1).setValue('No');
                                              }
                                                  if (String(r[iNombre]).indexOf('Sandra Paola Vargas') > -1) {
                                                        sh.getRange(idx+2, iActiva+1).setValue('Sí');
                                                            }
                                                              });
                                                                limpiarCache();
Logger.log('DIAG: ' + JSON.stringify(sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues()));
                                                                  return 'ok: ' + JSON.stringify(sh.getRange(2,1,sh.getLastRow()-1, sh.getLastColumn()).getValues());
                                                                  }
