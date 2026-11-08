# Mettre la plateforme en ligne sur Vercel

Tout est prêt dans le projet : `vercel.json`, le point d'entrée `api/[name].js`, `.vercelignore`.
Vercel héberge le site et le serveur ; les données restent dans Firebase (Firestore).

## Ce qui marche en ligne

| Langage | En ligne |
|---|---|
| Python, JavaScript, PHP, SQL, Web | Exécutés dans le navigateur de l'étudiant |
| C | Exécuté dans le navigateur (C de base) |
| C++, Java, OCaml | L'étudiant écrit son code, sans pouvoir le lancer ; l'enseignant corrige à la main |
| Pseudo-code (algorithme) | Écrit seulement, corrigé par l'enseignant |

Tout le code s'exécute dans le navigateur des étudiants : aucun serveur d'exécution n'est nécessaire.

## Avant la première mise en ligne (une seule fois)

1. **Nouvelle clé Firebase.** L'ancienne a circulé pendant le développement.
   Console Firebase > Paramètres du projet > Comptes de service > « Générer une nouvelle clé privée ».
   Remplacez `server/firebase-key.json` par ce nouveau fichier, puis supprimez l'ancienne clé dans
   Google Cloud > IAM > Comptes de service > clés.
2. **Fermer la Realtime Database** (non utilisée) : Console Firebase > Realtime Database > Règles :
   `{ "rules": { ".read": false, ".write": false } }`.
3. **Créer un compte Vercel** sur https://vercel.com (avec une adresse e-mail ou GitHub).

## Mise en ligne avec la commande `vercel` (sans GitHub)

Dans PowerShell :

```powershell
npm install -g vercel
cd C:\Users\fresnel\Desktop\ESATIC
vercel login
vercel link
```

Pour `vercel link`, répondez : créer un nouveau projet, nom par exemple `esatic-evaluations`, dossier `./`.
Ne changez pas les réglages proposés : ils viennent de `vercel.json`.

### Les variables secrètes (une seule fois)

```powershell
# 1. Clé Firebase, encodée (copiée dans le presse-papiers)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("server\firebase-key.json")) | Set-Clipboard
vercel env add FIREBASE_SERVICE_ACCOUNT_BASE64 production
#    -> collez (Ctrl+V) puis Entrée

# 2. Le « poivre » des mots de passe : EXACTEMENT la valeur de PASSWORD_PEPPER dans server\.env
vercel env add PASSWORD_PEPPER production
#    -> collez la valeur puis Entrée
```

**Important** : `PASSWORD_PEPPER` doit être identique à celui de `server\.env`. Avec une autre valeur,
plus aucun mot de passe existant ne fonctionne.

Facultatif, pour une démonstration (par exemple devant le jury) : `VITE_DEMO_TOOLS` = `true` affiche les
comptes de démonstration sur la page de connexion. **À retirer** quand la plateforme sert à l'école.

À ne **jamais** définir en ligne : `TEST_EXAMS_WITHOUT_CODE`, `TEST_OPEN_TEACHER`, `VITE_TEST_EXAMS_WITHOUT_CODE`,
`VITE_TEST_OPEN_TEACHER`, `ALLOW_DEMO_RESET`. Sans elles, les examens demandent leur code d'accès et l'espace
enseignant demande un mot de passe.

### Publier

```powershell
vercel --prod
```

Vercel installe, compile (2 à 3 minutes) et donne l'adresse du site, par exemple `https://esatic-evaluations.vercel.app`.
Pour chaque mise à jour, relancez simplement `vercel --prod`.

## Vérifier après la mise en ligne

1. Ouvrir l'adresse sur un PC **et** sur un téléphone.
2. Se connecter avec chaque rôle (administrateur, enseignant, surveillant, éducateur, étudiant).
3. Étudiant : ouvrir une épreuve, lancer du Python et du C, vérifier qu'une question C++ affiche le message calme.
4. Éducateur : déposer un bulletin ; étudiant : le télécharger.
5. Vercel > projet > **Logs** : aucune erreur rouge.

## Bon à savoir

- **Région** : les fonctions tournent à Washington (`iad1`), près de la base Firestore, qui est aux États-Unis (`nam5`).
  L'emplacement de la base ne peut pas être changé ; pour une base en Europe, il faudrait un nouveau projet Firebase.
- **Erreurs** : les utilisateurs voient seulement « Erreur interne du serveur. Réessayez dans un instant. ».
  Le détail est dans Vercel > Logs, visible par vous seul.
- **Offre Vercel** : l'offre gratuite (Hobby) est prévue pour un usage personnel non commercial. Elle suffit pour
  les essais et la démonstration ; pour la plateforme officielle de l'école, vérifiez les conditions de Vercel.
- **Firebase** : gratuit jusqu'à 50 000 lectures et 20 000 écritures par jour. Pour un usage réel, passer au forfait
  Blaze (le quota gratuit reste inclus) avec une alerte de budget.
- **Secrets** : `server/.env` et `server/firebase-key.json` ne sont jamais envoyés (fichier `.vercelignore`).
