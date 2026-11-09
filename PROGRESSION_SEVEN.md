# SEVEN — SUIVI DU PROJET
Date : 9 novembre 2026

## Périmètre validé
- Site vitrine public : hôtels Seven 7 / Seven 47 / Seven 71, appartements, chambres, suites, restaurant, salle de sport, espaces événementiels. Les espaces et services réservables disposeront de leurs créneaux et disponibilités.
- ERP de direction séparé sur une autre adresse. Direction : accès, équipes, entrées/sorties employés, budgets et rapports.
- Logiciel commun aux établissements : comptes rattachés à leur hôtel ou appartement; réservations, chambres, entrées/sorties clients, caisse, gestion locale.
- Superviseur global : accès au-dessus de toutes les directions.
- Offline : logiciel Windows avec base locale et synchronisation prudente, conflits de réservations contrôlés.
- RFID : cartes d'accès pour chambres et appartements, programmation/révocation à relier au matériel retenu.
- Aucun texte « en développement » dans le site public.
- Photos d'espaces : rechercher des images web réellement réutilisables et éviter de présenter des photos fictives comme celles des établissements.

## État réel
- Cahier des charges version 1.0 créé.
- Supabase 2 : projet « Gestion Chaine Hotels » disponible, 9 tables inspectées, aucune donnée ni changement de schéma.
- Kit graphique Seven v1 généré en local : 149 fichiers, 58 pictogrammes SVG, logos dark/light, favicon, app icons, cartes RFID, restaurant, fitness, événements.
- Dépôt existant : Nokscoding/sevenhoels.
- Netlify existants : sevenhotels et sevengestion (NE PAS créer de doublons). Connexion GitHub/déploiement à vérifier.

## Prochaine étape
1. Valider ou ajuster le logo Seven avant usage officiel.
2. Ajouter le kit graphique complet au dépôt et organiser public/assets/.
3. Auditer les sites Netlify Seven existants et leur liaison GitHub.
4. Intégrer le site public et les fonctionnalités de réservation des espaces.
5. Étendre la base Supabase pour ressources réservables, multi-établissements, RH, permissions.
6. Mettre en place le portail privé, le logiciel offline, puis le dispositif RFID.

## Discipline
À chaque session, mettre à jour ce fichier avec les fichiers changés, tests, obstacles et la prochaine action concrète. Ne pas modifier les données réelles ou masquer des limitations du système.
