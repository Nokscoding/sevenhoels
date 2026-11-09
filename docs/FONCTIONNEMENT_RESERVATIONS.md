# Seven — Réservations, chambres et opérations

## Règle centrale
- **Une demande** de séjour (`seven_booking_requests.status='pending'`) ne bloque pas de chambre.
- La réception ou le gérant **choisit une chambre** et confirme via `seven_accept_booking_request`.
- La demande devient `approved`, une réservation réelle `reservations.status='confirmed'` est créée et reliée à la demande par `reservation_id`.
- Les dates de la chambre deviennent indisponibles pour toute autre réservation **qui les chevauche**.
- La chambre n'est **pas** marquée occupée dès la confirmation d'un séjour futur : son statut opérationnel peut toujours être `available`.
- À l'arrivée, `seven_transition_stay(id,'check_in')` enregistre la présence et déclenche `rooms.operational_status='occupied'`.
- Au départ, `seven_transition_stay(id,'check_out')` passe la chambre à `cleaning`. L'entretien ou un responsable autorisé la marque ensuite `available`.
- La date de départ est **exclue** de l'intervalle réservé : départ le 18 / prochaine arrivée le 18 possible après préparation.

## Protection contre les doubles réservations
La contrainte Postgres `seven_reservations_no_overlap` interdit les intervalles chevauchants pour un même `room_id` lorsque le statut est `pending`, `confirmed` ou `checked_in`. Elle s'applique **dans la base**, y compris entre requêtes simultanées. La validation historique utilise aussi un verrou par chambre.

La fonction `seven_accept_booking_request` exécute la création de réservation et la modification de la demande dans **une même transaction**. Un nouvel appel pour une demande déjà approuvée retourne la même réservation, sans en créer une seconde.

## Permissions
| Fonction | Superviseur | Directeur local | Gérant local | Réception | Entretien | Comptable |
|---|---|---|---|---|---|---|
| Lire les demandes | Oui | Oui | Oui | Oui | Non | Non |
| Attribuer une chambre | Oui | Oui | Oui | Oui | Non | Non |
| Check-in / check-out | Oui | Oui | Oui | Oui | Non | Non |
| Ajouter chambres et catégories | Oui | Oui | Oui | Non | Non | Non |
| Marquer une chambre prête | Oui | Oui | Oui | Oui | Oui | Non |
| Créer/désactiver des accès subalternes | Oui | Oui | Oui | Non | Non | Non |
| Attribuer la direction | Oui | Non | Non | Non | Non | Non |
| Suivi des réservations financières | Oui | Oui | Oui | Oui | Non | Lecture seule |

Les accès sont systématiquement **rattachés à l'établissement** dans `seven_roles`. Le superviseur seul est global.

## Interface ERP (dossier `erp/`)
- Demandes : choisir une chambre filtrée par capacité, état et calendrier ; confirmer via RPC atomique ; refuser une demande.
- Séjours : voir le statut, faire un check-in, check-out ou annuler avant arrivée.
- Chambres : planning daté **distinct du statut physique**, édition des états, création des catégories et chambres pour le gérant.
- Personnel : vue des entrées/sorties, désactivation/réactivation des rôles. Les employés doivent déjà exister dans Supabase Auth : un système d'invitation sécurisé reste à livrer.
- Carte RFID : infrastructure SQL préexistante, aucun contrôle de serrure physique opérationnel.
- Mode hors ligne Windows : **non livré**.

## Site public
Les pages Seven 7, 47 et 71 proposent des demandes de réservation. Les appartements sont « Coming soon » et ne peuvent pas créer de demande publique même en appelant directement l'API.

Les demandes de restaurant, salle événementielle et salle de sport restent à organiser manuellement : le calendrier détaillé des services reste à développer avant une confirmation instantanée.

## Validation effectuée
- Analyse syntaxique JavaScript et intégrité des identifiants d'interface.
- SQL : approbation, rejeu idempotent, tentative de réservation concurrente rejetée, check-in, check-out et retour après nettoyage.
- SQL : permissions gérant pour création d'inventaire, gestion d'accès subalternes et refus d'une modification d'un autre hôtel ou d'une promotion en directeur.
- Les enregistrements de test ont été exécutés dans des transactions annulées (`ROLLBACK`). Les données métier initiales ont été conservées.

## À traiter avant ouverture au personnel
1. Vérifier les **rôles administrateur historiques** de `profiles` : les politiques de compatibilité anciennes accordent encore des droits transversaux ; identifier les comptes légitimes et planifier leur migration sans interrompre le travail existant.
2. Attribuer le rôle `supervisor` au bon compte Supabase Auth après vérification humaine.
3. Mettre en place les invitations d'employés via serveur sécurisé (jamais de mot de passe administrateur dans le navigateur).
4. Tester l'ERP avec de vrais comptes de gérant, réception, entretien et direction.
5. Mettre en œuvre réservations de services par créneaux, caisse, paiement, factures, disponibilité publique réelle et annulations clients.
6. Contrôler les avertissements Supabase Security Advisor restants : fonctions héritées `SECURITY DEFINER` et protection des mots de passe compromis.
7. Pas de déploiement Netlify tant que le dashboard est inaccessible et que le projet Netlify historique n'est pas relié à GitHub.
