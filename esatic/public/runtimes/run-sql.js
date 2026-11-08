// Exécution SQL dans le navigateur (mode test) : SQLite (sql.js) dans un Web Worker.
// Chaque exécution part d'une base de test neuve, créée à partir du schéma et des données de la question.
// Avec `expected`, la requête de référence est exécutée sur une autre base neuve et les résultats comparés
// (correction automatique : mêmes valeurs ; ordre des lignes pris en compte seulement si `orderMatters`).

importScripts('./vendor/sqljs/sql-wasm-browser.js')
const SQL = self.initSqlJs({ locateFile: (f) => './vendor/sqljs/' + f })
self.fetch = () => { throw new Error('Accès réseau désactivé') }

const MAX_ROWS = 200

function runOn(lib, schema, seed, query) {
  const db = new lib.Database()
  try {
    db.exec(schema)
    db.exec(seed)
    const results = db.exec(query)
    const last = results[results.length - 1]
    return { last, changes: db.getRowsModified() }
  } finally {
    db.close()
  }
}

function sameResult(a, b, orderMatters) {
  if (!a || !b) return !a && !b
  if (a.columns.length !== b.columns.length || a.values.length !== b.values.length) return false
  // Les nombres sont comparés arrondis (AVG peut donner 13.750000001)
  const norm = (rows) => rows.map((r) => JSON.stringify(r.map((v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))))
  const x = norm(a.values)
  const y = norm(b.values)
  if (!orderMatters) { x.sort(); y.sort() }
  return x.every((v, i) => v === y[i])
}

// ---------------------------------------------------------------------------
// Import d'une base par l'enseignant : fichier SQLite (.db) ou script SQL (y compris un export MySQL /
// phpMyAdmin, adapté à SQLite). Le résultat est remis en texte SQL propre : schéma (CREATE) et données (INSERT).
// ---------------------------------------------------------------------------

// Limite par défaut (la page envoie la valeur réglée, SQL_LIMITS.maxRows dans src/lib/format.js)
const DEFAULT_MAX_ROWS = 2000

// Syntaxe propre à MySQL que SQLite refuse (exports phpMyAdmin, mysqldump) : retirée ou adaptée
function mysqlToSqlite(sql) {
  return sql
    .replace(/\/\*![\s\S]*?\*\/;?/g, '')
    .replace(/^\s*(SET|LOCK TABLES|UNLOCK TABLES|START TRANSACTION|COMMIT|USE|DELIMITER)\b[^;]*;/gim, '')
    .replace(/^\s*(CREATE|DROP) DATABASE\b[^;]*;/gim, '')
    .replace(/^\s*ALTER TABLE[^;]*\b(ADD (PRIMARY |UNIQUE )?KEY|ADD INDEX|ADD CONSTRAINT|MODIFY|AUTO_INCREMENT)\b[^;]*;/gim, '')
    .replace(/\)\s*(ENGINE|DEFAULT CHARSET|CHARSET|COLLATE|AUTO_INCREMENT|ROW_FORMAT|COMMENT)\b[^;]*;/gi, ');')
    .replace(/^\s*(UNIQUE |FULLTEXT |SPATIAL )?(KEY|INDEX)\s+`?\w*`?\s*\([^)]*\),?\s*$/gim, '')
    .replace(/,(\s*\n\s*\))/g, '$1')
    .replace(/\bAUTO_INCREMENT\b/gi, '')
    .replace(/\b(CHARACTER SET|COLLATE)\s+\w+/gi, '')
    .replace(/\bCOMMENT\s+'(?:''|[^'])*'/gi, '')
    .replace(/\bunsigned\b/gi, '')
    .replace(/\\'/g, "''")
}

const quoteValue = (v) => {
  if (v === null) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (v instanceof Uint8Array) return "X'" + Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('') + "'"
  return "'" + String(v).replace(/'/g, "''") + "'"
}

// Base ouverte -> schéma et données en texte SQL, avec le nombre de lignes de chaque table.
// Au-delà de maxRows lignes (toutes tables), la base est refusée : on ne la tronque jamais sans le dire.
function exportDb(db, maxRows) {
  const objects = db.exec("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, rowid")[0]?.values ?? []
  const quoted = (name) => `"${name.replace(/"/g, '""')}"`
  const tables = objects.filter(([type]) => type === 'table').map(([, name]) => ({
    name, rows: db.exec(`SELECT COUNT(*) FROM ${quoted(name)}`)[0].values[0][0],
  }))
  const total = tables.reduce((s, t) => s + t.rows, 0)
  if (total > maxRows) {
    const detail = tables.map((t) => `${t.name} : ${t.rows}`).join(', ')
    throw new Error(`${total} lignes (${detail}), maximum ${maxRows}. Gardez seulement les lignes utiles à l'exercice.`)
  }
  const schema = objects.map(([, , sql]) => sql.trim() + ';').join('\n\n')
  const inserts = []
  for (const t of tables) {
    const res = db.exec(`SELECT * FROM ${quoted(t.name)}`)[0]
    for (const row of res ? res.values : []) inserts.push(`INSERT INTO ${quoted(t.name)} VALUES (${row.map(quoteValue).join(', ')});`)
  }
  return { schema, seed: inserts.join('\n'), tables, totalRows: total }
}

async function importOrInspect(data) {
  const lib = await SQL
  const db = data.dbBytes ? new lib.Database(new Uint8Array(data.dbBytes)) : new lib.Database()
  try {
    if (data.convertMysql) {
      db.exec(mysqlToSqlite(data.sqlText || ''))
    } else if (!data.dbBytes) {
      // Schéma puis données, exécutés séparément comme pendant l'épreuve (un ; final oublié ne gêne pas)
      db.exec(data.schema || '')
      db.exec(data.seed || '')
    }
    const out = exportDb(db, Number(data.maxRows) || DEFAULT_MAX_ROWS)
    if (!out.tables.length) throw new Error('aucune table trouvée')
    return out
  } finally {
    db.close()
  }
}

self.onmessage = async (e) => {
  if (e.data.importDb || e.data.inspect) {
    const { id } = e.data
    self.postMessage({ id, type: 'started' })
    try {
      self.postMessage({ id, type: 'done', ...(await importOrInspect(e.data)), stdout: '', stderr: '', exitCode: 0 })
    } catch (err) {
      self.postMessage({ id, type: 'done', stdout: '', stderr: `Base illisible : ${err.message}`, exitCode: 1 })
    }
    return
  }
  const { id, schema = '', seed = '', query = '', expected = null, orderMatters = false } = e.data
  try {
    const lib = await SQL
    self.postMessage({ id, type: 'started' })
    const t0 = performance.now()
    const mine = runOn(lib, schema, seed, query)
    const out = {
      id, type: 'done', stdout: '', stderr: '', exitCode: 0, durationMs: Math.round(performance.now() - t0),
      table: mine.last ? { columns: mine.last.columns, rows: mine.last.values.slice(0, MAX_ROWS), total: mine.last.values.length } : null,
      changes: mine.changes,
    }
    if (expected) out.match = sameResult(mine.last, runOn(lib, schema, seed, expected).last, orderMatters)
    self.postMessage(out)
  } catch (err) {
    self.postMessage({ id, type: 'done', stdout: '', stderr: `Erreur SQL : ${err.message}`, exitCode: 1, match: expected ? false : undefined })
  }
}
