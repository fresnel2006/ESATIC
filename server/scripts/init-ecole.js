// Prépare la VRAIE base de l'école, sans aucune donnée de démonstration :
// filières, classes, semestres de l'année, et un seul compte administrateur.
// Le mot de passe provisoire de l'administrateur est tiré au hasard et affiché une seule fois ;
// il devra être changé à la première connexion.
//
// Usage : npm run init-ecole -- --force --matricule ADM001 --prenom Awa --nom Kone [--email awa.kone@esatic.ci]
// Attention : efface tout le contenu actuel de Firestore (démonstration comprise).
import { hashPassword } from '../src/platform.js'
import { deleteEverything, writeInitialData } from '../src/data.js'
import { buildSchoolData, temporaryPassword } from '../src/school.js'

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const admin = { matricule: arg('matricule') || '', firstName: arg('prenom') || '', lastName: arg('nom') || '', email: arg('email') }
if (!process.argv.includes('--force') || !admin.matricule.trim() || !admin.firstName.trim() || !admin.lastName.trim()) {
  console.log('Cette commande efface toute la base Firestore et prépare la base de l\'école.')
  console.log('Usage : npm run init-ecole -- --force --matricule ADM001 --prenom Awa --nom Kone [--email awa.kone@esatic.ci]')
  process.exit(1)
}

const password = temporaryPassword()
const data = await buildSchoolData(admin, password, hashPassword)
await deleteEverything()
await writeInitialData(data)
const u = data.users[0]
console.log('Base de l\'école prête : aucune donnée de démonstration.')
console.log(`  ${data.filieres.length} filières, ${data.classes.length} classes, année ${data.school.settings.academicYear}, 2 semestres`)
console.log('')
console.log('Compte administrateur (à noter maintenant, il ne sera plus affiché) :')
console.log(`  Identifiant : ${u.matricule}  (ou ${u.email})`)
console.log(`  Mot de passe provisoire : ${password}`)
console.log('  À la première connexion, un nouveau mot de passe personnel sera demandé.')
console.log('')
console.log('Ensuite, dans la plateforme : Structure > Matières (et leurs outils), Utilisateurs (import des étudiants),')
console.log('Structure > Affectations enseignants.')
process.exit(0)
