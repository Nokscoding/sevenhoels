# Seven Gestion — Notifications

## Fonctionnalités implémentées

- Centre de notifications intégré au portail ERP (cloche, compteur de non-lues, aperçu, liste complète, bouton « Tout marquer comme lu »).
- Messages consultables par l'utilisateur connecté seulement, sans mélanger les hôtels.
- Publication temps réel via Supabase Realtime `postgres_changes` sur `public.notifications`, publication `supabase_realtime` déjà active.
- Rafraîchissement de secours toutes les 60 secondes pendant que la page est visible, et à la reprise de connexion.
- Alertes facultatives du navigateur, uniquement après autorisation explicite. Elles s'affichent si l'ERP est encore ouvert en arrière-plan (autre onglet). **Ce n'est pas du Web Push avec service worker : aucune garantie de notification lorsque le navigateur / PC est fermé.**
- Ouverture de l'onglet métier depuis une alerte (demandes, séjours, chambres). Pour l'entretien, une alerte de séjour dirige vers les chambres autorisées.

## Événements et destinataires

| Événement | Directeur | Gérant | Réception | Entretien | Comptable | Superviseur |
|---|---|---|---|---|---|---|
| Nouvelle demande hôtel / restaurant / événement / sport | Oui | Oui | Oui | Non | Non | Oui |
| Réservation confirmée | Oui | Oui | Oui | Non | Non | Oui |
| Check-in / client arrivé | Oui | Oui | Oui | Oui | Non | Oui |
| Check-out / chambre à nettoyer | Oui | Oui | Oui | Oui | Non | Oui |
| Chambre à nouveau prête / maintenance | Oui | Oui | Oui | Non | Non | Oui |
| Paiement reçu / remboursement | Oui | Oui | Non | Non | Oui | Oui |
| Accès attribué ou réactivé | **Utilisateur concerné uniquement** | | | | | |

Les alertes n'incluent pas le nom ou le téléphone du client. Les détails personnels restent dans les interfaces métier protégées.

## Sécurité

- La table `public.notifications` existe déjà ; elle est réutilisée.
- La clé étrangère `notifications.user_id` pointe désormais sur `auth.users(id)` pour fonctionner sans ancien `profiles`.
- Politiques RLS : un utilisateur lit uniquement les notifications dont `user_id=auth.uid()`. L'utilisateur peut modifier uniquement `read_at`, jamais titre, texte, hôtel ni destinataire.
- Les événements ne ciblent que les rôles actifs de `seven_roles`, rattachés au bon hôtel, plus `supervisor`.
- L'ancien déclencheur de notifications de réservations, fondé sur les administrateurs de `profiles`, est remplacé par un routage Seven spécifique aux rôles.
- Les fonctions internes de diffusion ne sont pas exécutables directement par les comptes anonymes ou authentifiés.

## Migrations

- `supabase/migrations/20261109_seven_staff_notifications.sql` : sécurité, routage, déclencheurs demandes / réservations / chambres / accès.
- `supabase/migrations/20261109_seven_payment_notifications.sql` : paiements et remboursements.

Les migrations ont été appliquées au projet Supabase `Gestion Chaine Hotels`.

## Vérifications effectuées

- Test transactionnel annulé : demande de Seven 47 notifie un gérant de Seven 47 et le superviseur, **pas** le gérant de Seven 71.
- Test transactionnel annulé : l'attribution d'un rôle déclenche une notification personnelle.
- Test RLS transactionnel : un employé ne voit pas les notifications des autres et ne peut pas modifier un titre, mais peut marquer les siennes comme lues.
- Test transactionnel annulé : paiements et remboursements génèrent chacun une notification ciblée.
- Analyse syntaxique JS, ordre de chargement des fichiers, présence des éléments d'interface et absence d'identifiants HTML en double.
- Aucun faux hôtel, compte, réservation ou paiement créé définitivement pendant ces tests.

## Limitations restantes

1. Aucune ligne active dans `seven_roles` à l'issue des tests : **les notifications ne seront réellement destinées au personnel qu'après attribution des accès officiels**. Ne pas créer de superviseur sans confirmation de son compte.
2. Notifications mobiles en arrière-plan / navigateur fermé : nécessitent une solution Web Push sécurisée (service worker, clés VAPID, serveur d'envoi, gestion des abonnements), non livrée ici.
3. E-mails, SMS et WhatsApp transactionnels ne sont pas intégrés.
4. L'ERP n'est pas déployé tant que l'accès Netlify reste bloqué.
5. Les anciens avertissements du Supabase Security Advisor (fonctions héritées, mots de passe compromis) sont encore à examiner avant production.
