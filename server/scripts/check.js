// Vérifie que le serveur peut écrire, lire et supprimer dans Firestore
import { db } from '../src/firebase.js'

const ref = db.collection('_verification').doc('connexion')
await ref.set({ ok: true, at: new Date().toISOString() })
const snap = await ref.get()
await ref.delete()
console.log(snap.exists ? `Firestore OK (projet ${process.env.FIREBASE_PROJECT_ID})` : 'Échec de lecture')
process.exit(0)
