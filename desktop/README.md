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

## Lecteur RFID USB S18 — test à la réception (v0.2.5)

1. Brancher le S18 au PC Windows et présenter une carte compatible.
2. Ouvrir **Cartes RFID** puis cliquer **Tester le lecteur** : le test capte les caractères saisis en mode clavier, sans sauvegarder ni transmettre le numéro de carte.
3. Si le test réussit, sélectionner **Enregistrer une carte**, choisir un séjour ayant effectué son check-in, cliquer **Activer le lecteur**, puis poser la carte. Si le lecteur transmet Entrée, la validation est automatique ; sinon utiliser le bouton **Enregistrer la carte**.
4. Utiliser **Vérifier une carte** pour contrôler l'attribution ; **Révoquer** pour retirer l'autorisation dans Seven Gestion.

Le module fonctionne avec les lecteurs USB qui transmettent le code en **émulation clavier HID**. Un lecteur exposé seulement en port COM/PC-SC nécessite un pilote ou protocole distinct. Si aucun caractère n'arrive, tester la lecture dans le Bloc-notes Windows et noter le mode du périphérique. Le test confirme un numéro lu, pas la compatibilité physique avec une serrure. **Le S18 photographié n'est pas identifié comme encodeur de cartes**, et l'application ne programme aucune serrure. Une révocation dans Seven Gestion ne désactive pas une carte déjà encodée dans une serrure autonome hors ligne. L'attribution et la vérification côté serveur requièrent une connexion et un compte autorisé ; le diagnostic USB seul fonctionne hors ligne.

## Préparation des cartes après check-in — intégration compatible S18

Le moteur natif **Seven RFID Studio 2.2** et les DLL du SDK P50 sont conservés sans modification. **CardLock.exe doit rester ouvert** pour que le S18 fonctionne.

Dans Seven Gestion Windows, après le check-in, la réception trouve le bouton « Préparer la carte » dans Séjours. Le responsable renseigne pour chaque chambre Seven son bâtiment, son étage et le **numéro interne de serrure** en six caractères hexadécimaux (par exemple `01020A`). Ces paramètres sont enregistrés **localement, chiffrés avec Windows safeStorage**, séparément par utilisateur et par établissement. Ils ne sont pas encore synchronisés entre différents PC : l'exploitation multi-postes demandera des tables sécurisées et une politique Supabase RLS.

La réception voit un récapitulatif de l'affectation et des dates, copie les paramètres et ouvre Seven RFID Studio 2.2. **Le transfert des paramètres dans le studio reste manuel.** Le logiciel ne revendique pas de réussite de programmation physique ; l'opérateur vérifie l'ID hôtel, les dates/heures et le numéro de serrure, puis contrôle le badge par relecture dans Studio et sur une serrure de test isolée.

Ne pas confondre la révocation informatique d'un enregistrement RFID avec l'invalidation physique d'une carte acceptée par une serrure hors ligne. Aucune commande de firmware, aucun encodage automatique et aucune intervention sur les cartes maîtresses n'ont été ajoutés.

Tests du code : `npm run check && npm test`. Une compilation Windows et la validation matérielle restent indispensables avant exploitation.

## Version 0.2.8 — RFID directement dans Seven Gestion Windows

**Plus d'ouverture de Seven RFID Studio à la réception.** Le module « Cartes RFID » propose **Lire**, **Écrire carte client** et **Effacer badge test** dans la fenêtre Seven. Les appels sont effectués par un processus .NET x86 invisible (`SevenRfidBridge.exe`) vers les DLL officielles P50. `CardLock.exe` reste une dépendance et doit être ouvert ; Seven peut lancer son exécutable installé.

L'hôtel configure l'identifiant fabricant, puis associe bâtiment, étage, chambre Seven et numéro interne de serrure. Ces paramètres sont conservés dans le stockage **chiffré local au PC Windows, par hôtel** et sont partagés entre collaborateurs du même profil Windows. **Ils ne se synchronisent pas entre machines.** Le client doit d'abord avoir effectué son check-in. L'interface permet une expiration exacte, le numéro de carte (0–15) et le DAI (0–255). La carte CLIENT est relue par le SDK après écriture, et seul un succès avec correspondance serrure/expiration déclenche l'enregistrement dans le registre Seven via `seven_rfid_issue`.

Cette nouvelle intégration n'a pas encore été testée physiquement sur le lecteur S18 ; **les mutations sont limitées aux badges de test et serrures de test isolées** tant que la validation n'est pas réalisée. La révocation informatique n'invalide pas un badge accepté par une serrure hors ligne ; l'effacement physique est séparé. L'interface historique et les DLL de Seven RFID Studio 2.2 ne sont ni modifiées ni supprimées, pour permettre un retour à la version validée.

Tests : `npm run check && npm test && npm run test:layout` sur Windows. La compilation du nouveau moteur x86 et l'intégration physique doivent être vérifiées dans GitHub Actions et sur un vrai poste S18.

## Seven Gestion 1.0 — accueil et cartes intégrés

L'écran principal du réceptionniste est **Accueil / Réception**. Il affiche un bouton **Nouveau client sur place**, un formulaire de saisie, la liste des chambres libres, les dates, le nombre d'occupants et la confirmation de l'arrivée. Après enregistrement d'un client arrivé, Seven offre immédiatement le bouton **Créer la carte du client**. Les clients présents figurent également dans un tableau pour retrouver leurs séjours.

Le module **Cartes de chambre** est intégré à la fenêtre Windows et ne lance pas Seven RFID Studio. Il permet lecture, création et effacement des cartes clients, avec confirmation, vérification par le SDK et association au séjour. Les réglages techniques sont masqués aux réceptionnistes et réservés à la configuration. Les correspondances entre chambres et serrures et le numéro fabricant restent chiffrés et locaux au poste Windows. Le lecteur S18 continue à nécessiter **CardLock ouvert en arrière-plan**. L'ancien Studio 2.2 et ses DLL restent préservés pour la maintenance.

Ce logiciel est livré avec vérification automatisée de ses composants et installateur Windows. La certification physique de tous les modèles de serrures ne peut pas être effectuée depuis un environnement cloud ; ne pas déclarer une carte utilisable sans relecture confirmée.

## Lecteur distinct de Seven 71 (version 1.0.3)

Le système de cartes Seven 47 déjà opérationnel **reste inchangé**. Seven Gestion possède maintenant une configuration **indépendante par hôtel** pour le type de lecteur, le port, le numéro d’encodeur et le type de cartes. Les valeurs observées dans le logiciel du Seven 71 sont : **CardLock 9.27C**, `proRFL.DLL: proUSB-V9-20171130`, **Encoder No. 2922**, **Card Type 57**. La valeur `2922` est le numéro matériel de l’encodeur ; elle **n’est pas l’identifiant hôtel fabricant** requis pour créer les badges.

En sélectionnant Seven 71, le directeur peut enregistrer ce profil dans l’écran Cartes de chambre. Celui-ci est conservé localement dans un fichier chiffré de l’application, sans modifier Seven 47. Il est possible d’essayer une **lecture de diagnostic non destructive** avec le SDK actuellement installé et le CardLock du Seven 71 lancé manuellement. **La compatibilité des cartes, du SDK et des serrures du Seven 71 n’a pas été validée**, donc **aucune écriture et aucun effacement** ne sont proposés pour cette famille de lecteur. L’ancien CardLock configuré pour Seven 47 n’est pas ouvert automatiquement en mode Seven 71.

Pour activer l’encodage réel du Seven 71, fournir et inspecter **les DLL et la documentation SDK de son installation propre**, puis valider lecture, écriture et ouverture sur badge/serrure de test isolés. Ne pas substituer la valeur de l’encodeur aux IDs hôtel, carte ou serrure. Aucun protocole de carte n'a été deviné ou remplacé.
