/* Seven Gestion Windows — room / encoder preparation.
 * Only prepares a handoff to the proven Seven RFID Studio 2.2.
 * Never claims that the physical card was encoded until verified in the native Studio.
 */
(function(){
 "use strict";
 const api=window.sevenDesktop, page=document.getElementById("rfidPage");
 if(!api?.getRfidRoomLayout||!api?.saveRfidRoomLayout||!page)return;
 const panel=document.createElement("section");
 panel.className="panel seven-rfid-workflow";
 panel.id="sevenRfidWorkflow";
 panel.innerHTML=
  '<div class="panel-heading"><div><span class="overline">SEVEN · CONFIGURATION DES SERRURES</span>'
  +'<h2>Bâtiments, étages, chambres et serrures</h2>'
  +'<p class="message-note">Associez le numéro de serrure du fabricant à une chambre déjà créée dans Seven. '
  +'La configuration reste chiffrée sur ce poste Windows.</p></div></div>'
  +'<form id="sevenRfidLockForm" class="seven-rfid-workflow-grid" autocomplete="off">'
  +'<label>Chambre Seven<select id="sevenRfidRoom" required></select></label>'
  +'<label>Bâtiment<input id="sevenRfidBuilding" maxlength="60" required placeholder="Seven 71"></label>'
  +'<label>Étage<input id="sevenRfidFloor" maxlength="30" required placeholder="1"></label>'
  +'<label>Numéro interne de serrure (6 chiffres HEX)<input id="sevenRfidLock" maxlength="6" pattern="[0-9A-Fa-f]{6}" required placeholder="01020A"></label>'
  +'<button class="primary" type="submit" id="sevenRfidSaveLock">Enregistrer cette serrure</button>'
  +'</form><p id="sevenRfidLockStatus" class="hint" role="status" aria-live="polite"></p>'
  +'<div id="sevenRfidLayoutRows" class="seven-rfid-workflow-list"></div>'
  +'<div class="seven-rfid-handoff"><h3>Préparer la carte après l’arrivée</h3>'
  +'<label>Séjour avec check-in effectué<select id="sevenRfidBooking"></select></label>'
  +'<div id="sevenRfidCardSummary" class="seven-rfid-card-summary" role="status" aria-live="polite"></div>'
  +'<div class="seven-rfid-workflow-actions"><button type="button" id="sevenRfidCopy" class="outline">Copier les paramètres</button>'
  +'<button type="button" class="primary" id="sevenRfidLaunch">Ouvrir Seven RFID Studio 2.2</button></div>'
  +'<p class="hint">CardLock doit rester ouvert. Saisissez dans le Studio le numéro de serrure, l’ID hôtel autorisé '
  +'et les dates vérifiées, puis utilisez sa relecture de contrôle. Cette page ne programme pas le badge et '
  +'ne confirme pas physiquement son émission. Ne pas utiliser sur une serrure en service durant les tests.</p>'
  +'<p id="sevenRfidHandoffStatus" class="hint" role="status" aria-live="polite"></p>'
  +'</div>';
 page.insertBefore(panel,page.querySelector(".seven-rfid-intro")||page.firstElementChild);
 // The S18 is not a keyboard emulator; retain this legacy form only in the web edition.
 const keyboardPanel=page.querySelector(".seven-rfid-intro");
 if(keyboardPanel)keyboardPanel.hidden=true;
 const get=id=>panel.querySelector("#"+id);
 const status=get("sevenRfidLockStatus"),progress=get("sevenRfidHandoffStatus");
 let context=null,layout=[],loadedKey="",selectedBookingId="";
 const text=(value)=>String(value??"");
 const option=(value,label)=>{
  const el=document.createElement("option");el.value=value;el.textContent=label;return el;
 };
 function updateSelect(select,values,preserved){
  select.replaceChildren(...values.map(row=>option(row.value,row.label)));
  if(values.some(row=>row.value===preserved))select.value=preserved;
 }
 function manager(){return ["supervisor","director","manager"].includes(context?.role);}
 function roomById(id){return context?.rooms?.find(r=>r.id===id);}
 function bookingById(id){return context?.stays?.find(s=>s.id===id&&s.status==="checked_in");}
 function entryFor(roomId){return layout.find(r=>r.roomId===roomId);}
 function setLockFields(){
  const room=roomById(get("sevenRfidRoom").value),entry=room&&entryFor(room.id);
  get("sevenRfidBuilding").value=entry?.building||"";
  get("sevenRfidFloor").value=entry?.floor||text(room?.floor||"");
  get("sevenRfidLock").value=entry?.lockNo||"";
 }
 function renderSummary(){
  const summary=get("sevenRfidCardSummary"),booking=bookingById(get("sevenRfidBooking").value);
  const room=booking&&roomById(booking.room_id),entry=room&&entryFor(room.id);
  summary.replaceChildren();
  if(!booking){
   summary.textContent="Sélectionnez un séjour en cours pour préparer une carte.";return;
  }
  const lines=[
   ["Établissement",context.hotelName],
   ["Séjour",booking.reference||"—"],
   ["Chambre",room?.number||"Chambre non identifiée"],
   ["Bâtiment",entry?.building||"Non configuré"],
   ["Étage",entry?.floor||"Non configuré"],
   ["Numéro interne de serrure",entry?.lockNo||"Non configuré"],
   ["Date d’arrivée",booking.check_in||"—"],
   ["Date de départ",booking.check_out||"—"]
  ];
  for(const [label,value] of lines){
   const line=document.createElement("div"),a=document.createElement("strong"),b=document.createElement("span");
   a.textContent=label;b.textContent=text(value);line.append(a,b);summary.append(line);
  }
  if(!entry){
   const warning=document.createElement("p");warning.textContent="Configuration manquante : demandez au responsable d’associer cette chambre à sa serrure.";
   warning.className="seven-rfid-warning";summary.append(warning);
  }
  const allowed=!!entry&&!!room&&["checked_in"].includes(booking.status);
  get("sevenRfidCopy").disabled=!allowed;
  get("sevenRfidLaunch").disabled=!allowed;
 }
 function render(){
  if(!context){panel.hidden=true;return;}
  panel.hidden=false;
  const roomSelect=get("sevenRfidRoom"),prevRoom=roomSelect.value;
  updateSelect(roomSelect,[{value:"",label:"Choisir une chambre"}].concat(context.rooms.map(r=>({value:r.id,label:"Chambre "+r.number}))),prevRoom);
  const staySelect=get("sevenRfidBooking"),prevStay=selectedBookingId||staySelect.value;
  const checked=context.stays.filter(s=>s.status==="checked_in"&&roomById(s.room_id));
  updateSelect(staySelect,[{value:"",label:"Choisir un séjour en cours"}].concat(checked.map(s=>({
   value:s.id,label:(s.reference||"Séjour")+" · chambre "+(roomById(s.room_id)?.number||"")
  }))),prevStay);
  selectedBookingId=staySelect.value;
  const editable=manager();
  get("sevenRfidLockForm").hidden=!editable;
  const list=get("sevenRfidLayoutRows");
  list.replaceChildren();
  for(const entry of layout){
   const room=roomById(entry.roomId);if(!room)continue;
   const line=document.createElement("div");
   line.textContent="Chambre "+room.number+" · "+entry.building+" · étage "+entry.floor+" · serrure "+entry.lockNo;
   list.append(line);
  }
  if(!layout.length)list.textContent="Aucune serrure configurée sur ce poste.";
  setLockFields();
  renderSummary();
 }
 async function refresh(){
  const next=window.SevenRfidContext?.();
  if(!next){context=null;render();return;}
  const key=next.userId+":"+next.hotelId;
  context=next;
  if(key!==loadedKey){
   try{
    layout=await api.getRfidRoomLayout({userId:next.userId,hotelId:next.hotelId});
    loadedKey=key;
    status.textContent="";
   }catch(error){layout=[];loadedKey="";status.textContent="Configuration inaccessible : "+(error.message||"stockage chiffré indisponible");}
  }
  render();
 }
 get("sevenRfidRoom").addEventListener("change",setLockFields);
 get("sevenRfidBooking").addEventListener("change",()=>{
  selectedBookingId=get("sevenRfidBooking").value;renderSummary();
 });
 get("sevenRfidLockForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!context||!manager())return;
  const roomId=get("sevenRfidRoom").value;
  if(!roomById(roomId))return void(status.textContent="Sélectionnez une chambre de l’établissement.");
  const payload={userId:context.userId,hotelId:context.hotelId,roomId,
   building:get("sevenRfidBuilding").value,floor:get("sevenRfidFloor").value,
   lockNo:get("sevenRfidLock").value};
  const submit=get("sevenRfidSaveLock");submit.disabled=true;status.textContent="Enregistrement sécurisé…";
  try{
   const stored=await api.saveRfidRoomLayout(payload);
   layout=layout.filter(x=>x.roomId!==roomId).concat(stored);
   status.textContent="Serrure enregistrée sur ce poste Windows.";
   render();
   get("sevenRfidRoom").value=roomId;setLockFields();
  }catch(error){status.textContent=error?.message||"Configuration non enregistrée.";}
  finally{submit.disabled=false;}
 });
 get("sevenRfidCopy").addEventListener("click",async()=>{
  const stay=bookingById(get("sevenRfidBooking").value);
  const room=stay&&roomById(stay.room_id),entry=room&&entryFor(room.id);
  if(!stay||!entry)return;
  const value=[
   "Seven RFID — préparation (ne confirme PAS l’encodage)",
   "Établissement : "+context.hotelName,
   "Bâtiment : "+entry.building,
   "Étage : "+entry.floor,
   "Chambre : "+room.number,
   "Serrure : "+entry.lockNo,
   "Arrivée : "+stay.check_in,
   "Départ : "+stay.check_out,
   "Vérifier l’heure de départ, l’ID hôtel et la relecture dans Seven RFID Studio 2.2."
  ].join("\n");
  try{await navigator.clipboard.writeText(value);progress.textContent="Paramètres copiés (sans clé hôtel ni données du badge).";}
  catch{progress.textContent="Copie impossible ; consultez le récapitulatif affiché.";}
 });
 get("sevenRfidLaunch").addEventListener("click",async()=>{
  if(!bookingById(get("sevenRfidBooking").value))return;
  progress.textContent="Ouverture de CardLock et de Seven RFID Studio 2.2…";
  try{
   const result=await api.openRfidStudio();
   progress.textContent=result.ok?"Studio ouvert. Renseignez les paramètres affichés, encodez puis relisez le badge de test.":result.message||"Ouverture annulée.";
  }catch(error){progress.textContent=error?.message||"Ouverture du Studio impossible.";}
 });
 window.addEventListener("seven:rfid-context",()=>{refresh();});
 document.addEventListener("click",event=>{
  const nav=event.target.closest?.('[data-view="rfid"]');
  if(nav){setTimeout(refresh,0);return;}
  const prepare=event.target.closest?.("[data-rfid-prepare]");
  if(!prepare)return;
  const id=prepare.getAttribute("data-rfid-prepare");
  document.querySelector('[data-view="rfid"]')?.click();
  selectedBookingId=id;
  refresh().then(()=>{get("sevenRfidBooking").value=id;renderSummary();panel.scrollIntoView({block:"start",behavior:"smooth"});});
 });
 refresh();
})();