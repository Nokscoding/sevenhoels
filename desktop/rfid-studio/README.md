# Seven RFID Studio 2.2 — mode compatible

La version 0.2.6 de Seven Gestion réintègre le moteur P50/proRFL 2.2 que l'utilisateur a confirmé fonctionnel en lecture, écriture et effacement avec CardLock ouvert. Le code C# et les DLL sont conservés octet pour octet. Les branches expérimentales 3.0 et 3.1 ne sont pas intégrées.

Le bundle contient les deux variantes du SDK de l'archive fournie par l'utilisateur, sans CardLock, base Access ni configuration d'hôtel. Les empreintes SHA-256 du bundle et du source sont vérifiées avant compilation. Sous Windows, `scripts/build-rfid.mjs` extrait le SDK et compile l'exécutable .NET x86. `extraResources` place l'ensemble hors de l'archive Electron.

Dans « Cartes RFID », le bouton d'ouverture démarre CardLock si nécessaire (choix initial du CardLock.exe installé), attend son service local, puis ouvre Seven RFID Studio. Le chemin fabricant est mémorisé seulement dans le profil Windows du poste. Le logiciel fabricant reste visible et ouvert ; il n'est ni modifié ni livré dans ce dépôt. Le studio conserve son bouton de changement de variante SDK ; les deux variantes de ce SDK utilisent le même serveur local.

Lecture, écriture client, effacement, confirmations de badge/serrure de test et relecture de vérification restent ceux de la 2.2. Cette intégration ne modifie aucun firmware et n'automatise aucune mutation de badge. Elle ne transforme pas le registre web RFID en encodeur de serrure : les opérations physiques sont réalisées dans le studio natif ouvert par l'application Windows.

La réussite des tests unitaires et de la compilation Windows ne remplace pas la vérification de la mise à jour sur le poste équipé du S18. Utiliser exclusivement les badges et serrures de test pendant cette validation.
