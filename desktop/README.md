# Seven Gestion — Application Windows

Cette application fait fonctionner **le même ERP Seven** que le portail web, sous forme d'application Windows (Electron). Les modules d'exploitation, les permissions, les réservations et le centre de notifications ne sont pas dupliqués : les fichiers `erp/` sont intégrés lors de la compilation.

## Architecture

- `../erp/` : interface commune (réception, gérants, direction, supervision, chambres, séjours, employés, services, notifications).
- `desktop/main.cjs` : fenêtre native, protocole local sécurisé `seven://app/`, protection de la navigation et du stockage local.
- `desktop/preload.cjs` : pont IPC minimal, sans accès direct aux API Node.js depuis les écrans.
- `desktop/scripts/build.mjs` : copie les fichiers communs et embarque localement Supabase JS.
- `desktop/offline.js` / `offline.css` : consultation locale des états des chambres, chiffrée sous le compte Windows.

## Installer et démarrer en développement

Pré-requis : Node.js 22+ et Windows 10/11.

```bash
cd desktop
npm install
npm start
```

Pour créer un **installateur Windows NSIS**, capable de recevoir les mises à jour GitHub Releases :

```bash
cd desktop
npm run dist:win
```

L’installateur est écrit dans le dossier `release/` de la racine du dépôt.

**Mises à jour intégrées :** vérification au lancement, proposition de téléchargement, progression et installation avec redémarrage après consentement. Le processus complet de publication est décrit dans [`../docs/MISES_A_JOUR_WINDOWS.md`](../docs/MISES_A_JOUR_WINDOWS.md).

Le workflow `.github/workflows/seven-windows.yml` est également prévu pour construire les deux éditions via GitHub Actions Windows. L’installateur doit être signé avant diffusion commerciale pour limiter les alertes Windows SmartScreen.

## Responsables et directions

L'espace **Responsables** est intégré au logiciel Windows et à l'ERP web. Il donne accès aux demandes, arrivées, états des chambres, membres du personnel, présences et raccourcis métiers. Les droits sont vérifiés dans la base avec Supabase RLS :

- `supervisor` : accès global à tous les établissements autorisés.
- `director` : supervision du site et création des accès subalternes.
- `manager` : gestion des chambres, catégories, réservations et employés de son établissement.
- `reception` : réception et gestion des séjours, check-in/check-out.
- `housekeeping` : état des chambres et entretien.
- `accountant` : suivi comptable selon permissions.

Les comptes doivent d'abord être créés dans Supabase Auth et recevoir un rôle `seven_roles` valide. Aucun compte administrateur de démonstration ni mot de passe n'est inclus.

## Mode hors connexion : première base

La fenêtre Windows et les ressources statiques sont disponibles sans réseau (le client Supabase est embarqué localement). Après une connexion en ligne, l'application sauvegarde une **vue chiffrée des numéros et états des chambres**, sans identité des clients, dans le stockage utilisateur de Windows. Cette vue peut être relue sur le même profil Windows après coupure réseau. Elle est effacée en cas de déconnexion explicite.

**Ce n'est pas encore un mode offline complet.** Les réservations, annulations, paiements, check-in/check-out et changements d'état sont bloqués tant que la connexion serveur est absente. Cela évite les doubles réservations et décisions à partir de données périmées.

La prochaine étape sera un journal local chiffré d'opérations autorisées, avec identifiants idempotents, conflits contrôlés et synchronisation atomique avant mise en production. Les lecteurs/serrures RFID nécessitent le fabricant et le protocole choisis.

## Sécurité

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Rejet de la navigation externe et des fenêtres pop-up.
- Protocole local privilégié et vérification du chemin servi.
- Politique de sécurité du contenu (CSP) dédiée au poste Windows.
- Stockage `safeStorage` asynchrone avec protection du compte Windows (DPAPI).
- Aucune clé Supabase service_role ni autre secret serveur dans l'application.
- Le code de l'ERP utilise les permissions Supabase et ne peut pas outrepasser les RLS du serveur.
- Le stockage chiffré ne protège pas contre les autres processus déjà exécutés sous le même compte Windows : chaque employé doit posséder sa propre session Windows.

## État de validation

Le code source, l'interface et la compilation sont configurés. Les tests de syntaxe peuvent être lancés via `npm run check`. **Un véritable build Windows, l'installation sur un PC Seven et les tests fonctionnels sur comptes réels sont nécessaires avant l'exploitation.** Ne pas annoncer le logiciel comme final ou le diffuser comme tel.
