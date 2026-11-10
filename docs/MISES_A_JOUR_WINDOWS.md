# Seven Gestion — mises à jour Windows

## Résultat pour les employés
Seven Gestion **installé sur Windows** vérifie les nouvelles versions au démarrage, puis affiche :
1. **Mise à jour disponible** : « Télécharger » ou « Plus tard ».
2. Progression du téléchargement dans la barre supérieure et dans la barre des tâches Windows.
3. **Mise à jour téléchargée** : « Installer et redémarrer » ou « Plus tard ».

L'installation ne se lance jamais sans accord. Fermer une boîte de dialogue ne valide pas l'installation. L'utilisateur peut aussi cliquer sur **Mises à jour** dans la barre supérieure pour vérifier manuellement. Les mises à jour attendent un accès Internet ; les données métiers restent dans Supabase.

## Première installation (obligatoire)
Le tout premier poste doit installer `Seven-Gestion-Setup-0.2.0.exe` généré depuis la branche Windows, **pas l'ancien ZIP Go portable ni un EXE Electron portable**. Les vieux EXE portables ne pourront pas se mettre à jour par ce mécanisme. Windows 10/11 64 bits est requis.

## Développement
L'application de bureau est dans `desktop/`. Le portail administrateur officiel est dans le dépôt séparé `Nokscoding/seven-hotels-gestion`. Le workflow de compilation télécharge cette interface automatiquement : le logiciel Windows et le site admin utilisent donc les mêmes écrans. La copie `erp/` sert d'alternative locale quand le dépôt externe n'a pas été téléchargé.

### Construire sur son propre PC Windows
Installe Node.js 22 puis, dans PowerShell :
```powershell
git clone https://github.com/Nokscoding/sevenhoels.git
git clone https://github.com/Nokscoding/seven-hotels-gestion.git
cd sevenhoels\desktop
$env:SEVEN_ADMIN_SOURCE_DIR = (Resolve-Path ..\..\seven-hotels-gestion).Path
npm install
npm run check
npm test
npm run dist:win
```
L'installateur est produit dans `sevenhoels/release/`. La commande locale `dist:win` ne met rien en ligne ; elle produit un exécutable pour test.

## Publier une nouvelle mise à jour
1. Terminer les modifications du portail `seven-hotels-gestion` et des fichiers du logiciel `desktop/` si nécessaire.
2. Modifier **`desktop/package.json` : `version`**, par exemple `0.2.0` → `0.2.1` (format SemVer). Commit sur `main`.
3. Ouvrir **GitHub → Nokscoding/sevenhoels → Actions → Seven Gestion Windows — installateur et mises à jour → Run workflow**.
4. Cocher **« Préparer une mise à jour »**. Le workflow compile l'installateur et publie un **brouillon GitHub Release** avec `latest.yml`, l'EXE NSIS et les données de vérification associées.
5. Tester manuellement ce nouvel installateur sur un **PC Windows de test**. Une fois validé, ouvrir GitHub **Releases** et **publier le brouillon**.
6. Au prochain lancement, les postes déjà installés détecteront la nouvelle version publiée, proposeront le téléchargement puis l'installation.

Les versions en brouillon **ne sont pas détectées** par les logiciels en circulation : cela protège les hôtels des déploiements accidentels. Ne jamais remplacer manuellement un `latest.yml` par un fichier d'une autre compilation.

## Signature et sécurité
- **Recommandé avant production** : obtenir un certificat Authenticode de signature de code Windows, puis stocker le P12 et son mot de passe dans les secrets GitHub Actions `WINDOWS_CERTIFICATE_P12` et `WINDOWS_CERTIFICATE_PASSWORD`. Ne pas committer ces secrets.
- Sans certificat, l'installateur peut déclencher une alerte Windows SmartScreen ; **ne pas publier une version non signée pour une exploitation hôtelière en production**.
- L'application ne reçoit aucune clé Supabase `service_role`, aucun jeton GitHub et aucune commande de téléchargement arbitraire du site.
- La mise à jour est une fonction du processus principal Electron, le contenu web ne contrôle pas l'URL du serveur.
- Utiliser le même `appId` et la même méthode d'installation NSIS sur toutes les versions ; ne pas changer de dépôt de mise à jour sans plan de migration.
- L'ancien installateur **Go portable V3** n'est pas directement migrable : il faut effectuer une première installation Electron.

## Limitations et vérifications nécessaires
L'interface, l'API de mises à jour et les tests ont été implémentés. Le **workflow GitHub Actions Windows doit encore terminer une exécution réussie**, et une **mise à jour réelle de 0.2.0 vers 0.2.1** doit être testée sur Windows avant de parler de déploiement validé.

En cas d'échec de GitHub Actions avant la première étape du job, vérifier les limites d'utilisation et la facturation GitHub Actions du compte, la configuration des permissions des workflows et l'activation des runners Windows. Une exécution non démarrée n'est **pas** une compilation validée.

## Solution de secours si GitHub Actions refuse de démarrer
Un script PowerShell est fourni pour compiler directement sur un PC Windows :

```powershell
cd sevenhoels
.\desktop\scripts\build-local.ps1
```

Ce script utilise la dernière copie locale du dépôt administrateur, installe les dépendances Node.js, vérifie le code et produit le **véritable installateur Windows NSIS**. Il n'envoie aucun fichier en ligne par défaut.

Pour créer un brouillon GitHub Releases depuis Windows **sans GitHub Actions**, configurer le jeton GitHub **uniquement dans l'environnement local** `GH_TOKEN` avec les droits nécessaires à ce dépôt, puis lancer :

```powershell
.\desktop\scripts\build-local.ps1 -PrepareRelease
```

Ne jamais envoyer ce jeton par e-mail ou dans une conversation et ne jamais le sauvegarder dans le dépôt. Testez puis publiez le brouillon GitHub Release ; les postes installés le détecteront au prochain démarrage.

**Incident constaté le 10 novembre 2026 :** les workflows Actions Windows *et* Linux échouent avant toute étape (liste de steps vide), sans journal de compilation. Cela suggère une restriction d'exécution des runners ou un problème de quotas, **pas une erreur de compilation démontrée**. Vérifier les annotations des exécutions Actions et les limites de facturation / permissions du dépôt avant d'essayer de nouveau.
