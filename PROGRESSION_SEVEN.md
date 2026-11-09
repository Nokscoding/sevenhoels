# SEVEN — JOURNAL DE PROGRESSION

**Dernière mise à jour : 9 novembre 2026**
**Branche de travail : develop/seven-foundation**
**Statut : première fondation développée, PAS EN PRODUCTION**

## Décisions à conserver
- Le site public et l'ERP privé sont deux déploiements / origines différents. Un lien secret ne suffit pas : contrôle réel par authentification et politiques RLS.
- Application métier commune avec données isolées par hôtel/appartement.
- La supervision globale est au-dessus des directions. Une direction peut déléguer uniquement des rôles subalternes dans son établissement.
- Le système RFID concerne l'ouverture des chambres et appartements. Matériel non encore choisi.
- Fonctionnement Windows hors ligne requis : **pas encore livré**. Aucune réservation ne peut être validée hors ligne sans stratégie de résolution des conflits.
- Pas de textes « en cours de développement », de prix ou d'adresses inventés sur le site public.
- Les photographies actuelles sont des photographies d'illustration (Unsplash), pas les vrais établissements.

## Terminé aujourd'hui
1. **Site public** sous `public/` : accueil responsive, établissements Seven 7, 47, 71 et appartements, services restaurant, salle de sport, événements, formulaire de demande client.
2. **ERP** sous `erp/` : connexion Supabase Auth, tableau de bord, lecture et traitement des demandes, état des chambres, liste des services, pointage, consultation RFID, gestion des rôles.
3. **Supabase** : nouvelles tables `seven_roles`, `seven_booking_requests`, `seven_service_resources`, `seven_attendance`, `seven_rfid_cards` avec politiques RLS ; règles de délégation locale.
4. Réutilisation des fiches historiques `seven7`, `47`, `71`, suppression sécurisée des 3 doublons nouvellement créés, maintien de `seven-apartments`.
5. Sécurité : contrôle RLS sur les nouveaux espaces; exécution anonyme de 12 fonctions privilégiées historiques révoquée (fonctions publiques historiques de recherche/réservation conservées).
6. Assets : symbole Seven intégré aux deux interfaces; pack visuel complet préparé séparément.
7. Contrôles : analyse syntaxique JS des deux applications, vérification des identifiants HTML, migration Supabase appliquée, insertion de réservation anonyme testée en transaction puis ROLLBACK.
8. **Aucun déploiement Netlify effectué.** Le code est sur la branche `develop/seven-foundation` du dépôt `Nokscoding/sevenhoels`.

## Ce qui reste à faire (priorités)
- [ ] Réaliser les tests utilisateur dans un vrai navigateur et corriger les parcours.
- [ ] Confirmer le compte Supabase Auth du superviseur et lui attribuer explicitement `supervisor` ; aucun rôle n'a encore été attribué.
- [ ] Inviter les directeurs/personnels de façon sécurisée (interface dédiée ou fonction serveur). Le formulaire actuel attribue seulement les rôles à des UUID Auth préexistants.
- [ ] Faire passer la gestion des demandes à la vraie réservation avec attribution des chambres, inventaire et vérification anti-chevauchement atomique.
- [ ] Créer de vraies fiches chambres, appartements, services, tarifs et disponibilités à partir de données Seven validées.
- [ ] Ajouter calendriers/capacités/horaires des restaurants, fitness et événements, réservations confirmées, paiements et états de caisse.
- [ ] ERP : droits de délégation à tester pour un vrai directeur; ajouter révocation d'accès et journaux d'audit métier.
- [ ] Windows : concevoir puis implémenter stockage chiffré local, journal de commandes, signatures/idempotence, file de synchronisation et arbitrage des conflits.
- [ ] RFID : choisir cartes/serrures/lecteurs compatibles, définir procédure d'encodage, renouvellement, révocation et intégration hors ligne.
- [ ] Compléter le dépôt avec le reste des assets dans `public/assets/` et tester tous les liens photo.
- [ ] Revoir les avertissements restants du conseiller sécurité Supabase, notamment la protection contre les mots de passe compromis.
- [ ] Configurer les deux projets Netlify existants seulement après tests, sans créer de projet supplémentaire.

## Blocages honnêtes
- Aucune connexion de personnel encore utilisable : `seven_roles` est vide, attribution superviseur nécessaire.
- Demande de réservation ≠ réservation confirmée ; aucune promesse de disponibilité immédiate.
- Les photos d'illustration ne doivent pas être présentées comme les vrais hôtels.
- Il n'y a pas encore de logiciel Windows hors ligne opérationnel ni de cartes physiques configurées.
- Pas de preuve de test complet dans un navigateur ni de déploiement en production.

## Reprise
Ouvrir le dépôt `Nokscoding/sevenhoels`, branche `develop/seven-foundation`. Inspecter `public/`, `erp/` et `supabase/migrations/`. Commencer par les tests fonctionnels et l'activation du superviseur après confirmation du bon utilisateur Auth.

## Déploiement d'aperçu — 9 novembre 2026
- **Site vitrine uniquement** publié sur : https://seven-hotels-preview.vercel.app
- Projet Vercel dédié : `seven-hotels-preview` (nks16), déploiement `dpl_FrWWNzfAJvAYSg1UoY6meeVmWeTQ`, état `READY`.
- Fichiers déployés : `public/index.html`, `style.css`, `app.js`, `config.js`, `favicon.svg`, `assets/seven-mark.svg`, tirés de la branche `develop/seven-foundation`.
- **Contrôle navigateur effectué** : accueil chargé, quatre cartes établissements visibles, images chargées, boutons ouvrant le formulaire, fermeture correcte. Aucune demande transmise pendant le contrôle ; les flux de soumission réels restent à tester séparément.
- Sites Netlify `sevenhotels` et `sevengestion` inchangés, ERP non publié.
- Prévisualisation publique ne constitue pas un lancement commercial : photos d'ambiance, demandes de réservation non confirmées, inventaire encore incomplet.

## Pages individuelles et préparation Netlify — 9 novembre 2026
- Pages créées : `/hotels/7/` (Seven 7), `/hotels/47/` (Seven 47), `/hotels/71/` (Seven 71).
- Chaque page dispose d'un visuel principal, d'une description, de trois aperçus de chambres avec images d'illustration, d'une galerie, des services et d'un formulaire de demande connecté à Supabase.
- Les chambres réellement publiées par la direction s'afficheront automatiquement grâce au nouveau champ `room_types.website_published` (false par défaut) et à la politique de lecture publique limitée.
- Page `/appartements/` : **COMING SOON**, sans formulaire ni possibilité de réservation des appartements.
- Accueil : chaque carte ouvre maintenant son établissement, tandis que Seven Apartments ouvre la page d'annonce. Les appartements ne figurent plus parmi les établissements réservables.
- Routes courtes Netlify dans `public/_redirects` : `/7`, `/47`, `/71`.
- Configuration `netlify.toml` : seule l'arborescence `public/` sera publiée ; en-têtes de sécurité et exclusion de l'indexation pendant la prévisualisation.
- Contrôles statiques : syntaxe JS des deux modules publics OK ; trois pages hôtels avec 3 aperçus chacune ; page Apartments avec Coming Soon vérifiée dans le code.
- **Netlify `sevenhotels` EXISTANT ENCORE NON ACTUALISÉ :** le connecteur Netlify disponible expose la consultation des sites mais pas une action de téléversement/déploiement. Son ancien déploiement est manuel et n'a pas de lien GitHub. Une action de liaison de dépôt depuis le dashboard Netlify reste nécessaire ; ne pas prétendre que la nouvelle version y est déjà en ligne.
- Aperçu Vercel précédemment déployé : ancienne version sans les pages détaillées ; ne pas le présenter comme une vérification de la nouvelle version.

## Développement opérationnel — 9 novembre 2026 (étape suivante)
- Création de la branche `feature/seven-reservations-operational` à partir de `main`.
- Migration `seven_atomic_stay_booking_and_access` appliquée à Supabase et enregistrée sous `supabase/migrations/` : anti-chevauchement GiST, création atomique de séjours à partir de demandes, refus, transitions check-in/check-out/annulation, états des chambres, droits de création des chambres et catégories, lecture de données personnelles limitée aux rôles métier.
- Migration `seven_manager_staff_access` appliquée : le gérant gère les accès subalternes de son établissement, pas les directeurs/superviseurs.
- Migration `seven_apartments_coming_soon_policy` appliquée : aucune demande publique pour les appartements avant l'ouverture.
- ERP `erp/` : sélection d'une chambre réellement libre, calendrier de disponibilité des chambres, séjours, check-in/out, ajout de chambres et catégories, revue du pointage, désactivation et réactivation des employés.
- Validations : syntaxe JS OK, références HTML présentes, base de données avec 15 chambres, 9 catégories, 1 réservation historique ; opérations de test effectuées en transaction ROLLBACK, aucune donnée fictive conservée.
- **IMPORTANT** : le stock et les comptes historiques n'ont pas été supprimés. Les privilèges des administrateurs hérités doivent être audités avant une utilisation en production.
- **Aucun déploiement Netlify**. L'ERP n'est pas encore mis à disposition des employés. Ne pas prétendre que le travail est visible sur les sites existants.
- Voir `docs/FONCTIONNEMENT_RESERVATIONS.md` pour la description précise des transitions, limites et tests.

## Notifications Seven — 9 novembre 2026
- Nouvelle branche `feature/seven-notifications` : centre d'alertes ERP (cloche, compteur, liste, lecture, flux temps réel, rafraîchissement de secours).
- Événements en base : nouvelle demande, réservation confirmée, check-in, chambre à nettoyer au check-out, chambre de nouveau prête, maintenance, paiement/remboursement, attribution/réactivation d'accès.
- Alertes par établissement et rôle, superviseur global autorisé ; pas de nom ni téléphone du client dans la notification.
- `public.notifications` : clé étrangère désormais sur `auth.users`, RLS par `auth.uid`, seule la colonne `read_at` peut être modifiée par l'utilisateur.
- Publication Realtime existante déjà active, vérifiée.
- Migrations Supabase appliquées : `seven_staff_notifications` et `seven_payment_notifications`.
- Tests transactionnels ROLLBACK : permissions RLS et impossible de lire les alertes des collègues, ciblage Seven 47 sans fuite vers Seven 71, notifications paiement/remboursement ; aucun enregistrement de test conservé.
- **Attention : zéro rôle actif dans `seven_roles`** : prévoir attribution officielle des rôles avant d'attendre de véritables alertes métier.
- Les alertes du navigateur fonctionnent seulement lorsque l'ERP reste ouvert ; Web Push de fond, email, SMS et WhatsApp ne sont pas implémentés.
- Pas de déploiement Netlify. Voir `docs/NOTIFICATIONS_SEVEN.md`.

## 9 novembre 2026 — Seven Gestion web et Windows / Espace responsables
- Branche `feature/seven-dual-platform-manager` : espace Responsables visible aux rôles `manager`, `director`, `supervisor`, avec données filtrées par établissement.
- Vue responsables : demandes à traiter, arrivées du jour, chambres à préparer, personnel autorisé, état opérationnel et raccourcis vers les modules existants.
- Interface web ERP modernisée via `erp/management.css` : sidebar, cartes, proportions, animations légères, affichage responsive.
- `desktop/` : application Windows Electron utilisant les mêmes fichiers ERP que la version web, build local Supabase JS, fenêtre sécurisée, IPC minimal, icône Seven en 256px.
- Première consultation hors connexion : aperçu local chiffré des chambres **sans informations clients**, lecture seule, cache effacé à la déconnexion explicite. Aucune opération de réservation/paiement hors ligne n'est encore validée ou synchronisée.
- Build : `desktop/package.json`, `desktop/scripts/build.mjs`, tests de contrôle statique `desktop/scripts/smoke.mjs` et workflow `.github/workflows/seven-windows.yml` pour générer installateur et EXE portable.
- Contrôles statiques : analyse syntaxique ERP / desktop OK, identifiants HTML présents et non dupliqués, rôles responsables et outils Windows branchés.
- **Aucun build natif ou test d'installation Windows vérifié à ce stade**, car la machine d'exécution locale n'a pas accès aux téléchargements npm. Le workflow Windows GitHub doit compiler l'application.
- **Pas de déploiement Netlify**. Ne pas prétendre que l'application est finalisée : invitation sécurisée, mode offline transactionnel, RFID, caisse, tests comptables restent à effectuer.
- Guide technique de reprise : `docs/SEVEN_WEB_WINDOWS_RESPONSABLES.md` et `desktop/README.md`.
