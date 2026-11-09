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
"function canAssignRole(","seven-invite-staff","properties:[","state.hotels=leadership()?"]){
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
const icon=await fs.readFile(path.join(desktop,"assets","seven.ico"));
assert.equal(icon.readUInt16LE(2),1,"L'icône doit être un fichier ICO Windows");
assert.equal(icon.readUInt16LE(4),1,"L'icône doit avoir au moins une image");
const pkg=JSON.parse(await read("desktop/package.json"));
assert.equal(pkg.build.win.icon,"assets/seven.ico");
console.log("Seven smoke tests : ERP partagé, responsables, Windows, confidentialité et build — OK");
