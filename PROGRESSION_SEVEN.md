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
