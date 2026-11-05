# ESATIC - Plateforme d'évaluations (interface web)

Interface de la plateforme d'examens et de devoirs en ligne de l'ESATIC : les étudiants composent sur ordinateur en salle informatique, les enseignants créent et corrigent les épreuves, les surveillants suivent les sessions, l'administration gère l'école.

Cette version contient **toute l'interface de la phase 1**, qui fonctionne dès maintenant avec un **serveur de démonstration intégré au navigateur** (données stockées dans `localStorage`). Le vrai serveur sera branché ensuite, sans réécrire les pages (voir « Brancher le serveur »).

## Lancer le projet

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173. Les autres postes du réseau local peuvent ouvrir `http://ADRESSE-IP-DU-PC:5173`.

Version optimisée (pour la salle) :

```bash
npm run build      # produit le dossier dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Tout est servi localement : police Poppins, icônes et éditeur de code Monaco sont dans le paquet. Aucune connexion internet n'est nécessaire une fois `npm install` fait.

## Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `ADM001` | `Admin2026!` |
| Enseignant | `ENS001` | `Prof2026!` |
| Surveillant | `SUR001` | `Surv2026!` |
| Étudiant | `ETU24001` | `Etudiant2026!` |
| Étudiant (1re connexion, changement de mot de passe obligatoire) | `ETU24006` | `Provisoire1` |

On peut aussi se connecter avec l'email (par exemple `fresnel.traore@esatic.ci`).

**Code d'examen de démonstration : `PY4K2M`** (Contrôle continu - Python, session ouverte en salle informatique 2).

Pour repartir des données d'origine : Administrateur > Paramètres > Réinitialiser la démo.

## Mode test (activé pour l'instant)

Réglages dans `src/config.js` (mettre `false` pour revenir au fonctionnement normal) :

- `examsWithoutCode` : on entre dans n'importe quel examen avec le bouton « Commencer l'examen », sans code d'accès, sans attendre l'ouverture de la session, à toute heure et autant de fois que voulu. La durée compte à partir de l'entrée.
- `runCodeInBrowser` : le bouton « Lancer » exécute vraiment **Python, JavaScript et SQL** dans le navigateur (Web Worker isolé, sans réseau ni accès aux fichiers, arrêté au temps limite). Chaque exemple visible est vérifié (réussi/échoué, attendu/obtenu), puis le programme tourne avec l'entrée saisie par l'étudiant. Ce résultat sert à essayer son code : la note reste calculée par le serveur de correction. **C, C++, Java et PHP** affichent un message clair : ils s'exécuteront dans le bac à sable Docker du serveur.

Les moteurs (Pyodide pour Python, sql.js pour SQL) sont copiés de `node_modules` vers `public/runtimes/vendor/` automatiquement avant `npm run dev` et `npm run build` (script `scripts/copy-runtimes.mjs`). Ils sont servis par le PC lui-même : pas d'internet nécessaire. Le premier lancement de Python prend quelques secondes (préchargé dès l'ouverture de la question).

## Terminal, langage de l'épreuve, sorties

- **Terminal** : sous l'éditeur, chaque « Lancer » s'affiche comme dans un vrai terminal : invite `etudiant@esatic:~/examen$`, commande du langage (`python3 main.py`, `node main.js`, `javac Main.java && java Main`, `sqlite3 base_test.db < requete.sql`...), sorties du programme et entrée tapée (en jaune) dans l'ordre réel, erreurs en rouge, code de sortie et durée, puis `verifier-exemples` avec `[ OK ]` / `[ÉCHEC]` (attendu / obtenu). Historique des 10 derniers lancements, bouton « Effacer ».
- **Langage de l'épreuve** : à l'étape Informations de l'assistant, l'enseignant choisit le ou les langages de l'épreuve parmi ceux de la matière. Les questions de code sont limitées à ces langages ; chez l'étudiant, l'onglet du fichier (`main.py`, `Main.java`...), la coloration, le code de départ et la commande du terminal s'adaptent. Le langage est annoncé sur la carte et la page de l'épreuve.
- **Sorties de l'épreuve** (option « Envoyer la copie après un avertissement », activée par défaut pour les examens surveillés, désactivable par épreuve) : à la 1re sortie (plein écran quitté ou changement de fenêtre), un avertissement s'affiche ; à la 2e, la copie est envoyée automatiquement avec les réponses déjà saisies. Le surveillant et l'enseignant le voient dans les alertes et le journal. Un rechargement de la page ou une coupure ne compte pas comme une sortie. Ce choix remplace, pour les épreuves où l'option est activée, la règle initiale « signaler sans jamais exclure » ; désactivée, les sorties sont seulement signalées.

## Bulletins

Administrateur > Bulletins (choisir la période et la classe) :

- **Calcul et publication** : moyenne par matière (notes des épreuves dont les notes sont publiées et qui finissent dans la période, plus les notes saisies), moyenne générale pondérée par les coefficients de Structure > Matières, mention, appréciation, rang (si activé dans Paramètres), moyenne de la classe. Aperçu de chaque bulletin, puis publication : avant, l'étudiant ne voit rien.
- **Modifications tracées** : si les notes changent après publication, le bulletin passe « à republier » ; la republication exige un motif, crée une nouvelle version et conserve l'ancienne dans l'historique. L'appréciation générale peut aussi être modifiée (nouvelle version, motif obligatoire).
- **Notes saisies** : oraux, TP papier... (note sur 20 par étudiant et par matière).
- **Modèle** : titre, signataire, mention en bas de page.

Étudiant > Bulletins : notes par matière, moyennes, mention, appréciation, rang si l'école l'autorise, et **téléchargement en PDF** (logo, code de vérification). La page publique `/verifier` (lien sur la page de connexion) confirme l'authenticité d'un bulletin à partir de son code. En démo, les données étant dans le navigateur, la vérification se fait depuis le même navigateur ; avec le serveur, depuis n'importe quel poste.

## Aides à la correction (enseignant)

- **Corriger automatiquement** (page Corrections, épreuve choisie) : toutes les copies sont corrigées d'un coup : QCM, code exécuté sur tous les tests (cachés compris, points par test), SQL comparé au résultat de la requête de référence. Les copies entièrement automatiques sont validées ; les autres gardent les notes automatiques et attendent la partie manuelle. En mode test, l'exécution se fait dans le navigateur de l'enseignant (Python, JavaScript, SQL) ; C, C++, Java et PHP attendent le serveur.
- **Correction par question** : la même question pour toutes les copies à la suite, avec boutons de note rapide (0, moitié, maximum) et grille de critères pour le HTML. Le plus rapide pour les questions ouvertes.
- **Copie par copie** : résultat de chaque test, bouton « Corriger automatiquement », commentaires types insérables en un clic (et enregistrables), raccourci Ctrl+Entrée pour « Enregistrer et suivante », note finale décidée par l'enseignant.

## Examens de programmation de démonstration

En plus de l'« Examen d'essai - Programmation », cinq examens ouverts pendant 30 jours (classe L2 Informatique A) : TP Python (chaînes et listes), JavaScript (tableaux et boucles), Algorithmique en Python (tri, nombres premiers, dichotomie), SQL (jointures et agrégats), C/C++/Java. Ils sont ajoutés automatiquement aux données de démo existantes, sans rien effacer.

## Profils et emails

Le profil (matricule, nom, prénom, email institutionnel, classe) est fourni par l'école et n'est pas modifiable par l'utilisateur. L'email institutionnel est saisi par l'administration ou, s'il est laissé vide (création ou import CSV), attribué automatiquement : `prenom.nom@esatic.ci` (sans accents, numéroté en cas de doublon).

## Outils informatiques par matière

L'administrateur règle, dans Structure > Matières, les outils de chaque matière : C, C++, Java, Python, JavaScript, PHP, SQL, HTML/CSS (ou aucun : QCM et questions ouvertes seulement). Ensuite :

- dans l'assistant, l'enseignant ne voit que ces outils (langages du menu, boutons SQL et HTML/CSS) ; les questions de la banque qui utilisent un autre outil sont grisées ;
- l'enregistrement d'une épreuve qui utiliserait un outil non prévu est refusé ;
- un outil encore utilisé par une épreuve publiée ne peut pas être retiré de la matière ;
- Paramètres > Outils de programmation résume, pour chaque outil, les matières, les épreuves, s'il s'exécute déjà (navigateur) et **ce qu'il faudra installer sur le serveur de correction** (JDK 21 pour Java, gcc/g++, PHP 8...). Rien n'est à installer sur les PC des étudiants.

## Parcours à essayer

1. **Étudiant** (`ETU24001`) : Accueil > saisir le code `PY4K2M` > passer en plein écran > répondre. Essayer de coller un texte copié ailleurs (bloqué, message calme), puis copier-coller une ligne de son propre code (accepté). Sortir du plein écran (invitation calme à revenir). Recharger la page : la copie reprend là où elle était. Rendre la copie.
2. **Surveillant** (`SUR001`) : Sessions > Suivre en direct : avancement, temps restant, signalements, réinitialisation de mot de passe.
3. **Enseignant** (`ENS001`) : Mes épreuves > Nouvelle épreuve (assistant en 5 étapes) ; Corrections > copie d'Aminata Diallo (copie à côté du corrigé, journal, note finale) ; Résultats > Publier les notes.
4. **Administrateur** (`ADM001`) : Utilisateurs > Importer (CSV) avec le modèle téléchargeable ; Structure ; Journal d'activité.
5. **Session unique** : ouvrir deux onglets, se connecter avec le même étudiant dans chacun ; le premier onglet est déconnecté avec un message (chaque onglet joue le rôle d'un poste).

## Ce qui est fait (phase 1, interface)

- Connexion par matricule ou email, mot de passe provisoire avec changement obligatoire, réinitialisation par l'administrateur ou le surveillant, une seule session active par étudiant.
- Quatre espaces avec la navigation demandée, barre du haut (recherche, notifications, menu du compte avec thème clair/sombre), menu latéral repliable sur PC, barre du bas avec bouton « Plus » sur mobile, tableaux transformés en cartes sur mobile.
- **Étudiant** : accueil dans l'ordre demandé (deux colonnes sur PC, une sur mobile), devoirs (En cours / Annulés / Finis, comme la maquette), examens, résultats (onglets Notes et Bulletins), annonces, détail d'une épreuve.
- **Composition** : chronomètre, plein écran obligatoire, sauvegarde automatique toutes les 20 à 30 s seulement si une réponse a changé, brouillon local en cas de coupure et reprise, instantanés horodatés du code, blocage de copy/cut/paste/drop/clic droit avec presse-papiers interne, énoncé non sélectionnable, détection des gros blocs de code apparus d'un coup, journal d'événements horodaté, messages toujours calmes, questions de code/SQL/HTML remplacées sur téléphone par un message demandant un ordinateur.
- **Enseignant** : assistant en 5 étapes (Informations, Dates et durée, Questions, Sécurité, Aperçu et publication ou brouillon), types QCM, ouverte, code (C, C++, Python, Java, JavaScript, PHP avec tests cachés et barème par test), SQL (schéma, données, requête de référence), HTML/CSS (aperçu et grille de critères), duplication, banque de questions, corrections avec copie et corrigé côte à côte, note finale décidée par l'enseignant, publication des notes, export CSV.
- **Surveillant** : ouverture/fermeture de session avec code, nouveau code, suivi en direct, alertes, historique.
- **Administrateur** : tableau de bord, utilisateurs (création, modification, désactivation, réinitialisation, import CSV avec téléchargement des mots de passe provisoires), structure (classes, filières, matières, périodes, affectations), toutes les épreuves et leurs résultats, journal d'activité filtrable et exportable, paramètres.
- Score de risque simple calculé à partir des événements, affiché à l'enseignant et au surveillant (signalement uniquement, aucune exclusion automatique).

## Ce qui attend le serveur

Ces fonctions dépendent du backend et sont signalées clairement dans l'interface :

- **Correction automatique du code et du SQL** et **exécution de C, C++, Java, PHP** : dans un bac à sable isolé côté serveur (conteneur Docker sans réseau, avec limites de temps, de mémoire et de processus). En mode test, Python, JavaScript et SQL s'exécutent déjà dans le navigateur pour essayer son code, mais la note n'en dépend pas. En attendant, l'enseignant note le code à la main.
- **Vérification Safe Exam Browser** (l'option existe dans l'assistant ; la clé est vérifiée par le serveur).
- **Import Excel (.xlsx)** direct : pour l'instant, enregistrer le fichier Excel en CSV (séparateur point-virgule).
- Sécurité réelle des comptes : dans la démo, les mots de passe sont hachés dans le navigateur, ce qui ne protège rien. Le serveur fera le hachage et le contrôle des droits.

## Choix faits (à valider)

- **React + Vite** (le projet existait déjà ainsi) : composants réutilisables, une seule application pour tous les rôles, build statique servi par le futur serveur, sans dépendance en ligne. Routeur : `react-router-dom`. Icônes en trait fin : `lucide-react`. CSS écrit à la main avec des variables (léger, sans framework).
- **Monaco** est chargé uniquement sur les pages qui en ont besoin (composition et assistant) et avec les seuls langages utiles.
- **Vouvoiement** partout, comme sur la maquette de connexion (« Restez sur la page de l'épreuve », « Retournez en plein écran »).
- Dans la barre latérale étudiante, l'entrée s'appelle **Bulletins** comme sur la maquette ; la page contient les onglets Notes et Bulletins.
- Note sur 20 calculée à partir des points ; pour un devoir à plusieurs tentatives, la meilleure note corrigée est retenue.
- Une sortie de plein écran, un changement d'onglet ou un collage bloqué ne ferment jamais la copie : ils sont enregistrés et augmentent le score de risque.
- Statuts : vert (rendu, corrigé), bleu (en cours), gris (à faire, à venir) ; le rouge est réservé aux erreurs et aux signalements ; pas d'orange.

## Arborescence

```
esatic/
  index.html
  vite.config.js            alias Monaco, accès réseau local
  public/img/               logo (logo-esatic.svg redessiné en vectoriel d'après le fichier officiel,
                            logo-esatic-mark.svg = symbole seul), photo du campus (campus.jpg = version allégée de image.png)
  src/
    main.jsx                point d'entrée, police locale
    App.jsx                 routes et contrôle d'accès par rôle
    index.css               système de design (couleurs, boutons, champs, tableaux)
    App.css                 mise en page, connexion, accueil, composition, correction
    api/
      seed.js               données de démonstration
      index.js              « serveur » de démonstration : une fonction = une future route REST
    context/                session (AuthContext), notifications éphémères (ToastContext)
    lib/
      format.js             dates, libellés, CSV
      monaco.js             Monaco servi localement
      clipboard.js          presse-papiers interne de la composition
      useExamGuard.js       surveillance : plein écran, onglets, copier-coller, raccourcis
    components/             mise en page, navigation, éditeur de code, éditeur de question...
    pages/
      Login.jsx, account/   connexion, première connexion, mot de passe, profil
      student/              accueil, devoirs, examens, résultats, annonces, composition
      teacher/              accueil, épreuves, assistant, banque, corrections, résultats, classes
      proctor/              sessions, suivi en direct, alertes, historique
      admin/                tableau de bord, utilisateurs, structure, épreuves, bulletins, journal, paramètres
```

## Plan par phases

- **Phase 1 - interface (faite)** : tout ce qui est listé plus haut, avec le serveur de démonstration.
- **Phase 1 - serveur (prochaine étape)** : API (comptes, rôles, sessions, épreuves, copies, journal), base SQLite compatible PostgreSQL avec un identifiant d'école sur chaque table, bac à sable Docker pour C, C++, Python, Java, JavaScript et PHP, exécution SQL isolée, import Excel, vérification Safe Exam Browser.
- **Phase 2** : bulletins (fait côté interface : coefficients, périodes, modèle, PDF avec logo et code de vérification, historique des modifications), modélisation Merise/UML, tableau de bord surveillant enrichi, similarité entre copies, grilles de critères généralisées.
- **Phase 3** : mode à distance (détection du regard en signalement uniquement), multi-écoles complet, super administrateur.

## Brancher le serveur

Toutes les pages passent par `src/api/index.js`. Chaque fonction porte en commentaire la route REST prévue (par exemple `// POST /api/student/attempts/{id}/submit`). Pour brancher le backend, il suffit de remplacer le corps de ces fonctions par des appels `fetch` vers ces routes : les pages ne changent pas.
"# ESATIC" 
