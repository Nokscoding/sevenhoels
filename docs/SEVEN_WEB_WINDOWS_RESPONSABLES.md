# Seven Gestion — Deux versions, un seul ERP

## Architecture retenue

**Portail web** : dossier `erp/`, à déployer séparément de `public/` sur le site privé `sevengestion` dès que l'accès Netlify sera rétabli.

**Application Windows** : dossier `desktop/`, construit avec Electron. Le script `desktop/scripts/build.mjs` copie la **même** interface ERP que la version web et embarque Supabase JS en local. Les responsables, réceptionnistes, personnels d'entretien, directeurs et superviseurs utilisent une seule logique de réservation et une seule base de données.

**Application publique** : dossier `public/`, vitrine Seven et pages Seven 7, 47, 71, appartements Coming soon. Elle reste distincte des outils privés.

## Espace Responsables

L'ERP web et la version Windows comportent la section `Espace responsables`. Elle est réservée aux rôles `manager`, `director` et `supervisor` et présente :
- Hôtel sélectionné, niveau de responsabilité et périmètre d'accès ;
- Demandes à traiter, arrivées du jour, chambres à préparer et effectifs autorisés ;
- Membres de l'équipe avec leur rôle opérationnel ;
- État de l'inventaire (disponibles, occupées, à nettoyer, maintenance) ;
- Accès directs aux demandes, chambres, employés, services et présences.

Les gérants disposent des modules déjà créés pour ajouter des chambres/catégories, attribuer les chambres aux réservations, faire check-in / check-out, gérer les collaborateurs subalternes et suivre le pointage. Les opérations sont encadrées par les politiques RLS de Supabase : la version Windows ne dispose d'aucun privilège supplémentaire.

La supervision globale peut changer d'établissement. Les responsables locaux ne voient que les établissements qui leur sont attribués.

## Expérience Windows

- Fenêtre native avec navigation et interface modernisées.
- Icône Seven Windows (ICO 256 × 256).
- Ressources ERP, CSS, JS et client Supabase intégrées dans le paquet Windows : ouverture de l'interface sans CDN.
- Connexion au même serveur Supabase que le portail web pour les données métier.
- Mode local en **consultation uniquement** : état des chambres enregistré depuis une connexion réussie, chiffré sous le profil utilisateur Windows. Aucune identité client, information financière ou mot de passe sauvegardé dans cet aperçu.
- Déconnexion explicite : effacement du cache local.
- Réservations, départs, arrivées, paiements et états de chambres : **connexion obligatoire pour modifier le serveur**. Il n'y a pas encore de file de synchronisation hors ligne permettant ces opérations.
- Protocole applicatif interne `seven://app/`, `contextIsolation`, `sandbox`, `nodeIntegration: false`, CSP restrictive, fenêtres externes et navigation bloquées.
- Aucun service_role ou mot de passe administrateur intégré.

## Compilation Windows

À la racine du dépôt :

```bash
cd desktop
npm install
npm test
npm start
```

Sur Windows, pour créer `.exe` :

```bash
cd desktop
npm run dist:win
```

Le workflow `.github/workflows/seven-windows.yml` peut compiler sous Windows et exporter l'installateur et le portable dans les artefacts GitHub Actions. La signature de code doit être configurée avant une distribution commerciale.

## État actuel, points non terminés

**Code préparé** : Espace responsables et interface fluide ; projet Windows, distribution prévue, icône, consultation locale chiffrée ; tests statiques et workflow de compilation.

**Toujours à tester** : installation sur Windows, écrans et navigation réels, authentification et permissions avec comptes valides, synchronisation des données, notification native et comportement en coupure réseau.

**À développer** : mode offline transactionnel avec résolution des conflits, RFID avec lecteurs/serrures réels, invitations sécurisées des employés, paie et RH avancées, caisse complète, réservation instantanée des services, factures, sauvegardes et procédure de reprise, code signing, tests QA approfondis.

**Pas de déploiement Netlify** effectué dans cette étape. Le lien Netlify reste bloqué tant que le dashboard et la connexion GitHub ne sont pas rétablis.

Ce document et `PROGRESSION_SEVEN.md` constituent les notes de reprise du développement.
