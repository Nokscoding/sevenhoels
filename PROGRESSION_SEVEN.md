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

## 9 novembre 2026 — Modérateur / directeurs globaux / comptes par rôle
- Branche `feature/seven-global-directors-access`.
- Nouvelle hiérarchie : `supervisor` (modérateur) et `director` (directeur) sont des rôles **globaux** (`hotel_id=NULL`) ; `manager`, `reception`, `housekeeping`, `accountant` restent rattachés à un seul établissement par attribution.
- Les directeurs peuvent consulter / gérer tous les établissements, créer des établissements inactifs, affecter des collaborateurs et créer des accès de direction. **Ils ne peuvent pas créer/modifier les modérateurs.** Le modérateur peut créer tous les accès.
- Anciennes politiques `public.is_admin` et `public.can_access_hotel` recâblées sur les rôles Seven actifs, sans recours au statut `profiles.role=admin` historique. Attention : anciens comptes doivent recevoir une attribution Seven vérifiée.
- Politiques de réservations, paiements et chambres resserrées : entretien sans accès aux données financières ou coordonnées des clients, gérant isolé dans son établissement. Modifications de chambre occupée / disponible contrôlées par le séjour.
- Les alertes de tous les hôtels sont destinées aux modérateurs et directeurs globaux. Les équipes locales restent filtrées.
- ERP partagé web + Windows : écran **Établissements** pour direction/modérateur, création et activation des établissements, sélection d'un établissement, écran **Comptes & autorisations**, invitation par e-mail et rattachement des comptes existants ; menus, indicateurs et vues conditionnels au rôle.
- Edge Function Supabase `seven-invite-staff` déployée et active, JWT obligatoire, autorisation relue en base, client secret seulement côté serveur. Aucune invitation réelle envoyée pendant ces tests.
- Tests SQL transactionnels réussis et annulés : directeur peut créer hôtel/directeur mais pas modérateur ; gérant ne voit pas chambres d'un autre hôtel ni ne crée établissement / directeur ; entretien ne peut lire réservations ou paiements ; notifications globales directeurs sans fuite vers autres gérants.
- Vérification JavaScript et identifiants HTML, tests statiques Windows enrichis pour les nouvelles vues.
- Les quatre hôtels, quinze chambres et une réservation historique sont conservés. `seven_roles` reste vide : **attribuer le premier modérateur au compte Auth vérifié** avant de pouvoir utiliser les nouveaux formulaires.
- Nouvel établissement créé en mode inactif ; la page vitrine publique dédiée n'est pas encore générée automatiquement.
- Les avertissements Supabase sur les fonctions SECURITY DEFINER héritées et la protection de mots de passe compromis restent présents.
- **Aucun déploiement Netlify ni nouvel EXE compilé.** Le workflow GitHub Actions Windows a précédemment échoué avant le démarrage des étapes : vérifier le compte/runner Actions avant de considérer l'installateur prêt.
- Détails : `docs/ROLES_MODERATEUR_DIRECTION.md`.

## 9 novembre 2026 — Livraison Windows portable de vérification (hors GitHub Actions)
- Un programme Windows x64 autonome **Seven_Gestion_Windows.exe** a été compilé localement avec Go 1.23 (`GOOS=windows GOARCH=amd64`, interface Windows GUI), pour contourner l'échec des jobs GitHub Actions avant démarrage.
- Il s'agit d'un **lanceur local distinct de l'application Electron de desktop/** : il embarque une interface web compacte Seven dans le binaire, démarre un serveur seulement sur `127.0.0.1` à port aléatoire, ouvre Microsoft Edge/Chrome en fenêtre application, et communique avec le même projet Supabase Seven.
- Interface fonctionnelle préparée : 12 modules (dashboard, responsables, hôtels, demandes, séjours, chambres, employés, services, paiements, pointage, notifications, registre RFID) ; login Supabase Auth, navigation selon rôles et mode découverte visuel sans écritures réelles.
- Réservations, check-in/out, chambres, rôles et autres mutations utilisent PostgREST/RPC/RLS existants. Tous les comptes Seven nécessitent encore une attribution officielle dans `seven_roles` (table toujours vide au moment du build).
- Contrôles : `go test` OK, binaire `PE32+ Windows x86-64 GUI` reconnu, ZIP intègre, tests Chromium via Playwright sans erreurs JavaScript pour les 12 modules et formulaires principaux.
- Fichiers de livraison générés dans l'environnement de conversation : `/mnt/data/Seven_Gestion_Windows.exe`, `/mnt/data/Seven_Gestion_Windows_Portable.zip`, `/mnt/data/Seven_Gestion_Windows_Source.zip` et `/mnt/data/Seven_Gestion_Apercu.png`. **Ces chemins sont propres à cette session**, ne pas inventer de liens dans d'autres tours sans vérification.
- **Important : PAS UNE RELEASE FINALE**. Impossible de tester physiquement le binaire Windows ici, launcher non signé, RFID physique non programmé, offline transactionnel non livré, réservation instantanée services non livrée. Version source Go distincte non fusionnée dans GitHub ; l'ERP web/desktop Electron de GitHub reste la base canonique du projet.
- En attente : compte Supabase Auth vérifié à attribuer au superviseur général, validation de l'exécutable sur PC Windows Seven, signature du programme, reprise de la compilation Electron et synchronisation des interfaces.

## 9 novembre 2026 — Refonte Windows 0.2 : interface, comptabilité et galeries
- Maquettes éditables Figma : https://www.figma.com/design/Mox40uS24IpKbD7fS5R8K9 (3 écrans : dashboard, caisse/comptabilité, fiche chambre + galerie)
- Migrations réellement appliquées au projet Supabase `ylhdlaunnyqrpceeyaki` : description individuelle `rooms.description`, `seven_media` avec couvertures uniques / photos multiples et bucket public de photos limité à 6 MiB, fonction invoker `seven_set_gallery_cover` vérifiant les rôles ; `seven_accounting_entries` en partie double avec RLS, imputation des paiements (et contrepassation sur remboursement), droits manager/comptable/superviseur/directeur, séparation par établissement et USD/CDF.
- Interface Windows portable Go mise à niveau : CSS professionnel `premium.css`, édition des descriptions hôtels/chambres, téléversement et gestion des galeries, sélection couverture, suppression images, comptabilité avec journal, balances, indicateurs recettes/charges/résultat/trésorerie, export CSV, formulaire de saisie débit/crédit, références et date.
- Compilation locale `GOOS=windows GOARCH=amd64` : `Seven_Gestion_2026.exe` (PE32+ GUI x64) ; livraison ZIP `Seven_Gestion_2026_Windows.zip` et sources `Seven_Gestion_2026_Source.zip` en pièces jointes de la conversation. **Ne pas inventer de lien sandbox dans un autre tour si le fichier n'existe plus.**
- Tests : Go unitaires OK, JS syntaxe OK, 12 modules démo sans exception JS, formulaires galerie/photo et comptabilité ouverts, UI mobile 390 px sans débordement, SQL RLS avec utilisateur modérateur, écritures débits/crédits, photos par hôtel et chambre, traitement automatique des paiements et couverts ; chaque écriture SQL de test `ROLLBACK`, aucune fausse donnée persistée.
- **À ne pas confondre avec une release finale** : le .exe Windows n'a pas été exécuté physiquement sur un poste Windows dans cette session ; upload Storage via session utilisateur non testé bout en bout ; transactions sans connexion, clôture fiscale OHADA/TVA, matériel RFID non finalisés. Code de cette édition Go fourni en archive et **pas encore fusionné** dans le code principal Electron `desktop/` / Web `erp/`. Les droits `henock@nks.com` modérateur restent en place.

## 9 novembre 2026 — Seven Gestion V3 Windows (édition portable)
- Livraison utilisateur : Seven_Gestion_V3_Installation.zip (EXE Windows x64 et guide), Seven_Gestion_V3_Code_Source.zip, aperçus capture des modules. Les fichiers sont joints à la conversation et non déposés dans le dépôt GitHub ; vérifier leur chemin runtime avant de fournir un nouveau lien.
- Logiciel Go avec UI Edge/Chrome dédiée (pas un installateur Electron natif), option « Tous les établissements » pour modérateur/directeur (lecture consolidée, écritures par hôtel et devise), navigation et modules étoffés.
- Supabase : seven_employees (poste, date d'embauche, salaire + devise), seven_attendance_register (pointage manager), seven_payroll (génération mensuelle et paiement), écritures en partie double : charge salariale / dette salariale, puis paiement caisse/banque/mobile ; demandes de service confirmables via RPC, ancien pointage libre-service désactivé.
- Chambre et hôtel : descriptions, galeries photo multiples, choix couverture, import d'images lors de la création. Notifications bureau via API Notification de Edge/Chrome et permission demandée par utilisateur, seulement tant que l'application reste ouverte.
- Vérification : go test, node --check, 13 modules et 17 formulaires sans exception JS, responsive petit écran, SQL de paie 250 USD : 2 écritures + présence puis rollback, tests RLS inter-hôtels réussis, archive ZIP CRC OK, binaire PE32+ GUI x64. Les tests ont utilisé une simulation navigateur/headless et des requêtes SQL en transactions, pas un vrai PC Windows ni un vrai login de bout en bout.
- Limites : pas de service de notifications lorsqu'appli fermée, pas de matériel RFID piloté, pas de synchronisation complète hors ligne, pas de paie réglementaire OHADA/CNSS; certaines routes de l'app attendent validation bout en bout sur poste utilisateur et avec de vraies photos. Aucun salarié/presence/paie réel n'a été créé. Code de cette édition Go distinct du code Electron canonique `desktop/`.


## 13 novembre 2026 — retour RFID compatible, Seven Windows 0.2.6

- Décision utilisateur : accepter la dépendance à CardLock et revenir au moteur 2.2 qui a fonctionné sur son matériel. Les prototypes autonomes 3.0/3.1 ne sont pas retenus dans Seven Gestion.
- Code C# 2.2 et SDK P50 Port1/Port2 intégrés sans modification métier, empreintes vérifiées. Compilation .NET x86 pendant la construction Windows ; ressources en dehors d'asar.
- Accès depuis Cartes RFID dans l'application Windows : ouverture du studio, choix initial du CardLock.exe installé, conservation locale du chemin et attente du service fabricant.
- Lecture/écriture client/effacement gardent les confirmations et vérifications originales sur badges et serrures de test. Aucun firmware ni base de données fabricant modifié ; aucune mutation automatisée depuis le renderer.
- Tests locaux : syntaxe, smoke ERP, mise à jour et 10 tests du lanceur compatibles réussis. Rendu Windows préparé depuis le dépôt administrateur courant.
- La diffusion est préparée sous forme de brouillon GitHub Release après les tests Windows du workflow. La validation d'une mise à jour réelle et du matériel sur le poste utilisateur reste distincte des tests unitaires.
