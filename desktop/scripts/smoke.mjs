import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repo=path.resolve(desktop,"..");
const read=async p=>fs.readFile(path.join(repo,p),"utf8");

const html=await read("erp/index.html");
const app=await read("erp/app.js");
const notices=await read("erp/notifications.js");
const style=await read("erp/management.css");
const offline=await read("desktop/offline.js");
const build=await read("desktop/scripts/build.mjs");
const main=await read("desktop/main.cjs");
const preload=await read("desktop/preload.cjs");

for(const [name,src] of [["ERP",app],["Notifications",notices],["Mode local",offline],["Processus Windows",main],["Pont IPC",preload]]){
 assert.doesNotThrow(()=>new Function(src),name+" doit être syntaxiquement valide");
}
for(const id of ["managementPage","managementTeam","managementRoomHealth","managementPending",
"managementArrivals","managementCleaning","managementStaffCount","managementPropertyTitle"]){
 assert.ok(html.includes('id="'+id+'"'),"Champ ERP manquant : "+id);
}
for(const expression of [
 'data-view="management"','roleNav()','function renderManagement()','if(canManage())renderManagement()',
 'seven_accept_booking_request','seven_transition_stay','SevenNotifications'
]){
 assert.ok((html+app).includes(expression),"Module partagé absent : "+expression);
}
for(const id of ["propertiesPage","propertiesGrid","propertyCreateForm","propertyUpdateForm","inviteForm",
"inviteRole","inviteHotel","roleForm","roleSelect"]){
 assert.ok(html.includes('id="'+id+'"'),"Élément de direction manquant : "+id);
}
for(const expression of ["function director(){","function leadership(){","function renderProperties(){",
"function canAssignRole(","seven-create-staff","properties:[","state.hotels=leadership()?"]){
 assert.ok(app.includes(expression),"Droits hiérarchiques absents : "+expression);
}
assert.ok(style.includes("management-cards"),"Style du module responsables absent");
assert.ok(main.includes("contextIsolation:true")&&main.includes("sandbox:true"),"Isolation Electron absente");
assert.ok(main.includes("nodeIntegration:false"),"Node.js ne doit pas être exposé au renderer");
assert.ok(main.includes("safeStorage.encryptStringAsync"),"Chiffrement de stockage non intégré");
assert.ok(preload.includes("contextBridge.exposeInMainWorld"),"Pont IPC manquant");
assert.ok(!preload.includes("ipcRenderer.send("),"Ne pas exposer l'IPC brut");
assert.ok(offline.includes("readSnapshot"),"Consultation hors connexion non branchée");
assert.ok(build.includes("vendor/supabase.js"),"Bundle Supabase local absent");
assert.ok(build.includes("desktop-ui.css"),"Bundled CSS for desktop absent");
for(const key of ["roomPresentationPanel","roomPhotoGallery","selectedBookingsTable"]){
 assert.ok(html.includes('id="'+key+'"'),"Missing room and booking component: "+key);
}
for(const key of ["seven_media","decideDirectBooking","uploadRoomPhotos","data-type-publish"]){
 assert.ok(app.includes(key),"Missing room and booking behavior: "+key);
}
assert.ok(build.includes("inventory.css"),"Windows build must copy the new hotel photo gallery stylesheet");
assert.ok(build.includes("SEVEN_ADMIN_SOURCE_DIR"),"Source du portail admin séparé absente");
const updateController=await read("desktop/updates.cjs");
const updateUI=await read("desktop/update-ui.js");
const pkg=JSON.parse(await read("desktop/package.json"));
for(const [name,src] of [["Contrôleur des mises à jour",updateController],["Interface des mises à jour",updateUI]]){
 assert.doesNotThrow(()=>new Function(src),name+" contient une erreur de syntaxe");
}
assert.ok(main.includes("updateController.start()"),"Recherche automatique au démarrage absente");
assert.ok(preload.includes("checkForUpdates:"),"Bouton de mise à jour non relié");
assert.ok(updateController.includes("autoInstallOnAppQuit=false"),"Une mise à jour ne doit pas s'installer sans consentement");
assert.ok(pkg.build.publish.some(item=>item.provider==="github"),"Flux de distribution GitHub absent");
assert.ok(pkg.build.win.target.some(x=>x.target==="nsis"),"Installateur NSIS manquant");
const icon=await fs.readFile(path.join(desktop,"assets","seven.ico"));
assert.equal(icon.readUInt16LE(2),1,"L'icône doit être un fichier ICO Windows");
assert.equal(icon.readUInt16LE(4),1,"L'icône doit avoir au moins une image");
assert.equal(pkg.build.win.icon,"assets/seven.ico");
console.log("Seven smoke tests : ERP partagé, responsables, Windows, confidentialité et build — OK");
