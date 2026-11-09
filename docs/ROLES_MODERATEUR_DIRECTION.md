# Seven Gestion — Modérateur, directeurs et périmètres des établissements

## Organisation retenue

| Rôle Seven | Scope | Voir toutes les données | Créer établissement | Inviter / créer comptes | Accès aux modules |
|---|---|---|---|---|---|
| `supervisor` — Modérateur général | Toute la chaîne | Oui | Oui | Tous rôles, y compris modérateurs | Tous les modules autorisés |
| `director` — Directeur | Toute la chaîne | Oui, sauf administration des modérateurs | Oui | Directeur, gérant, réception, entretien, comptabilité | Tous les modules opérationnels |
| `manager` — Gérant | Un hôtel | Son hôtel | Non | Réception, entretien, comptabilité de son hôtel | Exploitation, personnel local, chambres, services |
| `reception` | Un hôtel | Données nécessaires à la réception | Non | Non | Demandes, séjours, chambres, présence |
| `housekeeping` | Un hôtel | Chambres et tâches de nettoyage | Non | Non | Chambres et pointage |
| `accountant` | Un hôtel | Finance et séjours autorisés | Non | Non | Comptabilité et pointage |

Les **directeurs sont des rôles globaux** dans `seven_roles` avec `hotel_id=NULL`, comme les modérateurs. Les autres rôles portent nécessairement un `hotel_id`, contrôlé par les politiques RLS.

Le modérateur est **au-dessus des directeurs** pour la gestion des autorisations : seul le modérateur peut créer ou modifier un accès de modérateur. Les directeurs peuvent créer d'autres directeurs. Les gérants ne peuvent pas se promouvoir.

## Établissements

Les modérateurs et directeurs disposent de l'écran **Établissements** dans l'ERP web et l'application Windows.

- Consulte tous les établissements, y compris inactifs.
- Bascule vers les modules d'un hôtel sans mélanger les données.
- Crée un établissement (nom, identifiant URL, ville, coordonnées et description).
- Modifie ses informations et son état actif / inactif.
- Un nouvel établissement commence **inactif**.
- L'activation de l'exploitation interne ne publie **pas automatiquement** une nouvelle page vitrine. Il faut configurer et approuver sa page publique séparément.
- Seven Apartments reste `Coming soon` et ne reçoit pas de demandes de réservation publiques.

## Comptes et invitations

L'écran **Comptes & autorisations** offre :
1. **Inviter un compte par e-mail** via la fonction Supabase `seven-invite-staff`. Cette fonction vérifie une session Auth, relit les rôles actifs et utilise le client administratif uniquement côté serveur. Après l'envoi, la création de `seven_roles` est soumise à RLS.
2. **Attribuer un rôle à un compte Auth existant** à partir de son UUID vérifié, procédure avancée.
3. **Désactiver ou réactiver un accès** sans supprimer l'historique de l'employé.

La fonction `seven-invite-staff` est déployée avec `verify_jwt=true`. Les e-mails ne pourront être reçus correctement qu'après vérification du fournisseur d'e-mail d'authentification et des URL autorisées dans le projet Supabase. Aucune invitation réelle n'a été envoyée pendant ce travail.

## Règles de sécurité essentielles

- `private.seven_can_access` : autorisation globale pour modérateur / directeur, sinon uniquement l'hôtel attribué.
- `private.seven_has_role` : contrôles sur les rôles réels de `seven_roles` en base ; les champs modifiables par l'utilisateur ne font jamais autorité.
- Les anciens `profiles.role=admin` **ne confèrent plus de privilèges automatiques** dans les politiques métier qui utilisent `public.is_admin()` ; une attribution Seven officielle est nécessaire.
- Les politiques d'accès aux paiements et réservations ont été resserrées : l'entretien ne peut ni consulter les données financières ni modifier les réservations.
- Les changements de chambre vers `occupied` et `available` restent contrôlés par la présence réelle d'un séjour ; même un directeur ne peut pas marquer arbitrairement une chambre comme occupée.
- Les suppressions définitives de paiements et réservations sont réservées au modérateur ; les directeurs disposent des actions métier d'annulation et de remboursement.
- Les modifications d'identité de rôle (`user_id`, `role`, `hotel_id`) sont interdites par UPDATE depuis une session Auth ; une nouvelle attribution autorisée puis la désactivation de l'ancienne est nécessaire.
- Le dernier modérateur actif ne peut pas être désactivé.

## Notifications

Les modérateurs **et directeurs** reçoivent les alertes de tous les hôtels. Les employés locaux reçoivent uniquement les alertes concernant leur rôle et leur établissement.

## Vérifications

Tests transactionnels SQL annulés après exécution (`ROLLBACK`) :
- Un directeur voit toutes les chambres, crée un établissement, crée un accès de direction, mais ne peut pas créer de modérateur.
- Un gérant ne peut pas créer un hôtel ou un accès de directeur et ne voit pas les chambres des autres hôtels.
- Un agent d'entretien ne voit pas les réservations et paiements, mais voit les chambres autorisées.
- Un directeur et le modérateur reçoivent les alertes inter-hôtels ; le gérant d'un autre hôtel ne les reçoit pas.
- Aucune chambre, personne, réservation ou propriété de test n'a été conservée.

Vérifications du code : syntaxe JavaScript, existence des éléments HTML et absence d'identifiants DOM dupliqués.

## Mise en service — étape encore nécessaire

**La table `seven_roles` ne contient actuellement aucun accès officiel.** Pour donner le rôle `supervisor` au propriétaire, il faut identifier et vérifier le **bon compte existant dans Supabase Auth**, puis effectuer l'attribution privilégiée depuis une session d'administration sûre. Ne jamais deviner quel compte lui appartient.

Ensuite : tester avec comptes de supervision, direction, gérance, réception, entretien et comptabilité, et vérifier l'envoi d'une vraie invitation.

**Aucun déploiement Netlify.** Les versions web et Windows réutilisent le même ERP du dépôt et recevront cette interface lors des prochaines publications / compilations. Les anciens avertissements Supabase sur certaines fonctions héritées et la protection des mots de passe compromis restent à examiner.
