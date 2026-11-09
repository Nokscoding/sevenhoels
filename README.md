# Seven Hotels & Apartments

Code de travail, version de fondation. **Aucun déploiement de cette branche en production.**

## Applications indépendantes

- `public/` : site vitrine, établissements, expériences et demandes de réservation des clients.
- `erp/` : espace privé de gestion, Supabase Auth et politiques d'accès par établissement.
- `supabase/migrations/` : évolutions PostgreSQL, politiques RLS, demandes, personnel, services et cartes RFID.

Le portail ERP doit être déployé sur un domaine différent du site public, avec authentification obligatoire. La séparation par domaine **n'est pas** un contrôle de sécurité à elle seule.

## Test local

Depuis un terminal :
- `python -m http.server 8000 -d public` puis ouvrir `http://localhost:8000`.
- `python -m http.server 8001 -d erp` puis ouvrir `http://localhost:8001`.

Les deux applications chargent la bibliothèque Supabase depuis un CDN et exigent donc une connexion pour les fonctions de données. Le portail ERP nécessite un compte Supabase Auth avec un rôle actif dans `seven_roles`.

## Publication

Sites Netlify existants : `sevenhotels` (vitrine) et `sevengestion` (ERP). Ne pas recréer de projets. Ne pas déclencher de déploiement tant que les tests de sécurité, le compte de supervision, les données d'établissement et les pages légales n'ont pas été validés.

## Important

- Une **demande** envoyée depuis le site ne vaut pas confirmation ou paiement.
- Les photos actuelles sont des images d'illustration et non les vraies photos des établissements Seven.
- Le mode offline Windows avec synchronisation et l'intégration des serrures RFID sont à développer et tester sur du matériel réel.
- Les utilisateurs doivent recevoir une invitation sûre ; aucun mot de passe administrateur ne figure dans le code.
- Lire `PROGRESSION_SEVEN.md` pour la reprise, les derniers changements et les blocages.
