// Remet la base Firestore aux données de démonstration (mêmes comptes et épreuves que le site).
// Usage : npm run seed -- --force   (efface tout puis recharge)
// Les serveurs déjà lancés le voient tout seuls au prochain appel (numéros de version changés).
import { core, requestContext } from '../src/platform.js'
import { deleteEverything, writeInitialData } from '../src/data.js'
import { db } from '../src/firebase.js'

if (!process.argv.includes('--force')) {
  console.log('Cette commande efface toutes les données de Firestore. Relancez avec : npm run seed -- --force')
  process.exit(1)
}

await deleteEverything()
const data = await requestContext.run({}, () => core.buildInitialData())
await writeInitialData(data)
for (const c of await db.listCollections()) {
  const n = (await c.count().get()).data().count
  console.log(c.id.padEnd(15), n)
}
console.log('Base remise à zéro avec les données de démonstration.')
process.exit(0)
