# Seven 71 — proUSB V9.27C : analyse technique

Documentation d'intégration — Seven Gestion Windows 1.0.5, 14 novembre 2026.

## Conclusion

Le logiciel du **Seven 71** est **proUSB Card Lock V9.27C**, distinct de l'édition du Seven 47. Le fichier exécutable s'appelle **CardLock.Exe** dans les deux cas, mais leur taille et leurs empreintes cryptographiques sont différentes.

| Élément | Résultat |
|---|---|
| Programme Seven 71 : LockV9.27C / CardLock.Exe | 4 166 144 octets ; SHA-256 : ea255d6430db13e4f4557fee66c57c6f3d9485c1f6ddfe421805a8254e31dfd6 |
| Programme ancien pour Seven 47 | 5 809 152 octets ; SHA-256 : 471ce803d3f74a9f253ed6da22e97eb987e70563a81189225564bf37fe954958 |
| proRFL.dll du Seven 71 | SHA-256 : a694dbde0338e5b72ac77a2df49871404b3c8f43a8d01b1ac4a3d6955dd96e44 ; identique au SDK fourni précédemment |
| d12.dll et d12c.dll | Identiques aux copies antérieures |
| Numéro d'encodeur affiché | 2922 (n'est pas automatiquement l'identifiant hôtel) |
| Type de carte affiché | 57 |
| Version affichée | proUSB-V9-20171130 |
| System.ini | Chemin de sauvegarde D:\proUSB_DBBak ; indicateur LOCKNOHEX=0 |

## Installation indiquée par la notice chinoise fournie

Copier le dossier **LockV9.27C sur le disque D:**, puis utiliser le programme **D:\LockV9.27C\CardLock.Exe**. Si la copie se trouve ailleurs, Seven permet de sélectionner le chemin réel de ce programme. **Ne pas sélectionner le CardLock.exe différent de Seven 47.** Pour éviter toute confusion, Seven vérifie l'empreinte de l'exécutable et la présence des DLL de cette édition.

Le manuel anglais fourni présente la connexion USB du lecteur, la gestion d'hôtel, des bâtiments, étages et chambres, la configuration des serrures, la réception individuelle et en groupe, la consultation des cartes, les changements de chambre et de dates, puis l'effacement. Il précise que le changement de lecteur peut nécessiter un nouvel enregistrement à partir de son code machine.

## Intégration dans Seven Gestion

- Profil séparé pour Seven 71, conservé localement et chiffré.
- Lancer **proUSB V9.27C de Seven 71** à partir de son dossier, avec ce dossier comme répertoire de travail.
- Si l'édition de Seven 47 est ouverte, refuser le lancement de celle du 71 pour éviter un mélange des configurations.
- Une fois proUSB démarré, l'opérateur doit ouvrir sa session dans le programme constructeur. Le simple démarrage de l'exécutable ne signifie pas que le lecteur est prêt.
- Les fonctions de lecture, d'émission de carte client et d'effacement restent accessibles dans Seven, selon les autorisations et les identifiants fabricant du Seven 71. Le résultat doit être relu pour confirmation.

## Sécurité et limites de validation

- Les bases Access **CardLock.MDB** et les archives **proUSB_DBBak** n'ont pas été importées ni ajoutées au dépôt ; elles peuvent contenir des informations de clients et des paramètres d'accès.
- L'édition V9.27C et les DLL fournies ont été analysées **statiquement** ; aucun exécutable du fabricant n'a été exécuté durant cette analyse.
- Le rôle précis de **LOCKNOHEX=0** reste à vérifier avant de modifier le format des codes de serrure.
- Les DLL exportent notamment **initializeUSB, ReadCard, ReadCardID_T5557, GuestCard, CardErase et Buzzer**. Cette liste ne garantit pas, à elle seule, la compatibilité des opérations de carte sur le matériel réel.
- Il faut confirmer la lecture, l'écriture, l'effacement, l'expiration et l'ouverture d'une **serrure de test isolée** avant toute émission destinée à un client.
- La procédure officielle de pose ou d'autorisation des cartes système doit rester séparée de l'utilisation quotidienne ; ne pas modifier le firmware.

## Sources étudiées

PROUSB CARD LOCK V9.27(1).zip ; LockV9.27C(1).zip ; lock(1).zip ; proUSB_DBBak(1).zip ; logiciel d'installation en chinois (软件安装使用说明.doc) ; manuel anglais proUSB fourni.
