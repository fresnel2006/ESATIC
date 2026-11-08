# Serveur ESATIC

Serveur Node.js de la plateforme. Il applique les règles (rôles, session unique, chronomètre,
sorties, notes, bulletins) et enregistre toutes les données dans Firebase (Firestore, projet `projet1-ee785`).

La logique est celle de `esatic/src/api/core.js` : le même fichier tourne sur le serveur et, en mode démo,
dans le navigateur. Le code des étudiants (Python, JavaScript, SQL) s'exécute toujours dans le navigateur,
jamais sur le serveur.

## Fichiers secrets (jamais publiés)

- `firebase-key.json` : clé du compte de service Firebase.
- `.env` : configuration, et `PASSWORD_PEPPER`, secret ajouté aux mots de passe. Ne pas le changer une fois
  des comptes créés, sinon plus personne ne peut se connecter.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le serveur et le relance à chaque modification |
| `npm start` | Lance le serveur (production) |
| `npm run check` | Vérifie la connexion à Firestore |
| `npm run seed -- --force` | Efface Firestore et remet les données de démonstration |
| `npm run init-ecole -- --force --matricule ADM001 --prenom Awa --nom Kone` | Efface Firestore et prépare la **vraie** base de l'école : classes, semestres, un seul administrateur (mot de passe provisoire affiché une fois), aucune donnée de démonstration |

## Mode test

`TEST_EXAMS_WITHOUT_CODE=true` (dans `.env`, sur le PC seulement) laisse entrer dans les examens sans code
d'accès, à toute heure et sans limite de tentatives. **Ne jamais définir cette variable en ligne** : sans elle,
codes d'accès, horaires et tentatives sont appliqués par le serveur.

`TEST_OPEN_TEACHER=true` (PC seulement) ajoute sur la page de connexion un bouton par enseignant pour entrer dans
l'espace enseignant **sans mot de passe**. **Ne jamais le définir en ligne** : n'importe qui pourrait modifier
les épreuves et les notes. Côté site : `VITE_TEST_OPEN_TEACHER=true` dans `esatic/.env.development`.

## Avant de confier la plateforme à l'école

1. Générer une nouvelle clé Firebase (l'ancienne a circulé) et supprimer l'ancienne dans la console.
2. Fermer la Realtime Database (non utilisée) : console Firebase > Realtime Database > Règles :
   `{ "rules": { ".read": false, ".write": false } }`.
3. Préparer la vraie base : `npm run init-ecole -- --force ...`, puis créer matières, enseignants et étudiants.
   Les comptes de démonstration (mots de passe connus) ne doivent jamais exister dans la base de l'école.
4. En ligne : ne définir aucune des variables `TEST_EXAMS_WITHOUT_CODE`, `TEST_OPEN_TEACHER`, `VITE_TEST_...`, `ALLOW_DEMO_RESET`.
5. Passer Firebase au forfait Blaze avec une alerte de budget, et programmer des sauvegardes (export Firestore).

## Développement

Une seule commande, dans le dossier `esatic` : elle lance le serveur (s'il ne tourne pas déjà) puis le site.

```
cd esatic
npm run dev
```

Le site (http://localhost:5173) envoie ses appels `/api/...` au serveur (port 4000).
Site seul : `npm run dev:site` dans `esatic`. Serveur seul : `npm run dev` dans ce dossier.

## Production

```
cd esatic
npm run build
cd ../server
npm start
```

Le serveur sert aussi le site compilé : tout est sur http://localhost:4000.

## Fonctionnement

Détail dans `src/data.js`.

- Données de référence (comptes, classes, matières, épreuves, sessions) gardées en mémoire par chaque copie du
  serveur et relues seulement quand `meta/versions` change. Copies, connexions, journal et notifications sont lus
  et écrits document par document.
- Chaque modification se fait dans une transaction Firestore : deux actions simultanées ne s'écrasent pas.
  Plusieurs copies du serveur peuvent tourner en même temps (Vercel) ; essai fait avec 30 étudiants en parallèle
  sur deux serveurs : aucune erreur, aucune réponse perdue.
- Si Firestore est vide au démarrage, il est rempli avec les données de démonstration (pour la vraie base,
  utiliser `init-ecole`). Les épreuves de démonstration ne sont jamais ajoutées à la base de l'école.
- Organisation : `<collection>/<id>`, `meta/<clé>`, `meta/versions`, `auth/<userId>`, `audit/<id>`, `inbox/<userId>`.
- Les règles Firestore doivent rester fermées (`allow read, write: if false;`) : seul le serveur, avec sa clé,
  accède aux données.
