/* Seven Gestion Windows: true native RFID inside the ERP (P50 ProUSB, x86).
 * No separate Studio UI; hardware still needs original CardLock open.
 * All mutations require explicit test-card confirmation and SDK read-back.
 */
(function(){
 "use strict";
 const api=window.sevenDesktop,page=document.getElementById("rfidPage");
 if(!api?.runNativeRfid||!api?.getRfidRoomLayout||!api?.saveRfidRoomLayout||!page)return;
 const panel=document.createElement("section");
 panel.className="panel seven-rfid-workflow";
 panel.id="sevenRfidWorkflow";
 panel.innerHTML=
  '<div class="panel-heading"><div><span class="overline">SEVEN · ENCODEUR RFID S18</span>'
  +'<h2>Cartes clients · Directement dans Seven</h2>'
  +'<p class="message-note">Lecture, émission et effacement depuis cette fenêtre. Le logiciel CardLock doit rester ouvert pour initialiser le lecteur.</p></div></div>'
  +'<div class="seven-rfid-inline-status" id="sevenRfidDeviceStatus" role="status">Vérification du lecteur…</div>'
  +'<div class="seven-rfid-section" id="sevenRfidConfiguration">'
  +'<h3>1 · Configuration des bâtiments, étages et serrures</h3>'
  +'<form id="sevenRfidVendorForm" class="seven-rfid-vendor-form">'
  +'<label>Identifiant hôtel du fabricant (P50)<input type="number" min="1" max="2147483647" step="1" id="sevenRfidVendorId" required placeholder="ID autorisé du système CardLock"></label>'
  +'<button type="submit" class="outline">Enregistrer l’identifiant</button></form>'
  +'<p class="hint">Utiliser uniquement le numéro autorisé de votre installation. Cet identifiant est chiffré localement.</p>'
  +'<form id="sevenRfidLockForm" class="seven-rfid-workflow-grid" autocomplete="off">'
  +'<label>Chambre Seven<select id="sevenRfidRoom" required></select></label>'
  +'<label>Bâtiment<input id="sevenRfidBuilding" maxlength="60" required placeholder="Seven 71"></label>'
  +'<label>Étage<input id="sevenRfidFloor" maxlength="30" required placeholder="1"></label>'
  +'<label>Numéro interne de serrure (6 caractères HEX)<input id="sevenRfidLock" maxlength="6" pattern="[0-9A-Fa-f]{6}" required placeholder="01020A"></label>'
  +'<button class="primary" type="submit" id="sevenRfidSaveLock">Enregistrer la serrure</button>'
  +'</form><p id="sevenRfidLockStatus" class="hint" role="status"></p>'
  +'<div id="sevenRfidLayoutRows" class="seven-rfid-workflow-list"></div></div>'
  +'<div class="seven-rfid-handoff"><h3>2 · Enregistrement du client et encodage</h3>'
  +'<label>Séjour avec check-in effectué<select id="sevenRfidBooking"></select></label>'
  +'<div id="sevenRfidCardSummary" class="seven-rfid-card-summary" role="status" aria-live="polite"></div>'
  +'<div class="seven-rfid-workflow-grid">'
  +'<label>SDK<select id="sevenRfidPort"><option value="Port1">Port1 (S18)</option><option value="Port2">Port2</option></select></label>'
  +'<label>Expiration de la carte<input type="datetime-local" id="sevenRfidExpiry" required></label>'
  +'<label>Numéro de carte (0–15)<input type="number" id="sevenRfidCardNo" min="0" max="15" value="0"></label>'
  +'<label>DAI<input type="number" id="sevenRfidDai" min="0" max="255" value="1"></label>'
  +'</div>'
  +'<label class="seven-rfid-test-confirm"><input type="checkbox" id="sevenRfidConfirmTest">'
  +'Je confirme utiliser uniquement un badge de test et une serrure de test isolée.</label>'
  +'<div class="seven-rfid-workflow-actions">'
  +'<button type="button" id="sevenRfidRead" class="outline">Lire le badge</button>'
  +'<button type="button" id="sevenRfidIssue" class="primary">Écrire la carte client</button>'
  +'<button type="button" id="sevenRfidErase" class="outline">Effacer le badge test</button>'
  +'<button type="button" id="sevenRfidCardLock" class="outline">Ouvrir CardLock</button></div>'
  +'<p id="sevenRfidHandoffStatus" class="seven-rfid-native-result" role="status" aria-live="polite">'
  +'Présentez une carte sur le S18 pour commencer. L’encodage est confirmé uniquement après relecture.</p>'
  +'<p class="hint">Les cartes de serrures hors ligne ne sont pas annulées par une simple révocation du registre Seven. Vérifiez toujours le badge sur la serrure de test.</p>'
  +'</div>';
 page.insertBefore(panel,page.querySelector(".seven-rfid-intro")||page.firstElementChild);
 const legacy=page.querySelector(".seven-rfid-intro");if(legacy)legacy.hidden=true;
 const get=id=>panel.querySelector("#"+id);
 const message=get("sevenRfidHandoffStatus"),saveMsg=get("sevenRfidLockStatus");
 let ctx=null,layout=[],vendorHotelId=null,loadedKey="",selectedBookingId="",busy=false;
 const text=value=>String(value??"");
 const option=(value,label)=>{const o=document.createElement("option");o.value=value;o.textContent=label;return o;};
 function updateSelect(select,options,preserve){
  select.replaceChildren(...options.map(item=>option(item.value,item.label)));
  if(options.some(x=>x.value===preserve))select.value=preserve;
 }
 const manager=()=>["supervisor","director","manager"].includes(ctx?.role);
 const roomById=id=>ctx?.rooms?.find(r=>r.id===id);
 const bookingById=id=>ctx?.stays?.find(s=>s.id===id&&s.status==="checked_in");
 const entryFor=id=>layout.find(e=>e.roomId===id);
 function setLockFields(){
  const room=roomById(get("sevenRfidRoom").value),entry=room&&entryFor(room.id);
  get("sevenRfidBuilding").value=entry?.building||"";
  get("sevenRfidFloor").value=entry?.floor||text(room?.floor||"");
  get("sevenRfidLock").value=entry?.lockNo||"";
 }
 function canWrite(){
  const booking=bookingById(get("sevenRfidBooking").value);
  return !busy&&!!booking&&!!entryFor(booking.room_id)&&!!vendorHotelId&&get("sevenRfidConfirmTest").checked;
 }
 function updateButtons(){
  get("sevenRfidRead").disabled=busy||!ctx;
  get("sevenRfidIssue").disabled=!canWrite();
  get("sevenRfidErase").disabled=!canWrite();
  get("sevenRfidCardLock").disabled=busy;
 }
 function renderSummary(){
  const summary=get("sevenRfidCardSummary"),booking=bookingById(get("sevenRfidBooking").value);
  const room=booking&&roomById(booking.room_id),entry=room&&entryFor(room.id);
  summary.replaceChildren();
  if(!booking){summary.textContent="Choisissez un séjour ayant effectué son check-in.";updateButtons();return;}
  const fields=[
   ["Hôtel",ctx.hotelName],["Séjour",booking.reference||"—"],
   ["Chambre",room?.number||"—"],["Bâtiment",entry?.building||"Non configuré"],
   ["Étage",entry?.floor||"Non configuré"],
   ["Serrure fabricant",entry?.lockNo||"Non configuré"],
   ["Arrivée",booking.check_in||"—"],["Départ",booking.check_out||"—"],
   ["ID fabricant",vendorHotelId?"Configuré":"Non configuré"]
  ];
  for(const [label,value] of fields){
   const row=document.createElement("div"),a=document.createElement("strong"),b=document.createElement("span");
   a.textContent=label;b.textContent=text(value);row.append(a,b);summary.append(row);
  }
  if(!entry||!vendorHotelId){
   const notice=document.createElement("p");notice.className="seven-rfid-warning";
   notice.textContent="Configurez le numéro de serrure et l’identifiant fabricant avant toute émission.";
   summary.append(notice);
  }
  updateButtons();
 }
 function render(){
  if(!ctx){panel.hidden=true;return;}
  panel.hidden=false;
  const rooms=ctx.rooms,select=get("sevenRfidRoom"),oldRoom=select.value;
  updateSelect(select,[{value:"",label:"Choisir une chambre"}].concat(rooms.map(r=>({value:r.id,label:"Chambre "+r.number}))),oldRoom);
  const stays=ctx.stays.filter(s=>s.status==="checked_in"&&roomById(s.room_id));
  const staySelect=get("sevenRfidBooking"),oldStay=selectedBookingId||staySelect.value;
  updateSelect(staySelect,[{value:"",label:"Choisir un séjour"}].concat(stays.map(s=>({
   value:s.id,label:(s.reference||"Séjour")+" · chambre "+roomById(s.room_id).number
  }))),oldStay);
  selectedBookingId=staySelect.value;
  get("sevenRfidConfiguration").hidden=!manager();
  get("sevenRfidVendorId").value=vendorHotelId||"";
  const list=get("sevenRfidLayoutRows");list.replaceChildren();
  for(const entry of layout){
   const room=roomById(entry.roomId);if(!room)continue;
   const line=document.createElement("div");
   line.textContent="Chambre "+room.number+" · "+entry.building+" · étage "+entry.floor+" · serrure "+entry.lockNo;
   list.append(line);
  }
  if(!layout.length)list.textContent="Aucune serrure configurée sur ce PC.";
  setLockFields();renderSummary();
 }
 async function refresh(){
  const next=window.SevenRfidContext?.();
  if(!next){ctx=null;render();return;}
  const key=next.hotelId;
  ctx=next;
  if(key!==loadedKey){
   try{
    const common={userId:next.userId,hotelId:next.hotelId};
    [layout,vendorHotelId]=await Promise.all([api.getRfidRoomLayout(common),api.getRfidVendorId(common)]);
    loadedKey=key;saveMsg.textContent="";
   }catch(error){layout=[];vendorHotelId=null;loadedKey="";saveMsg.textContent="Configuration inaccessible : "+(error.message||"erreur");}
  }
  render();
 }
 async function deviceStatus(){
  try{
   const data=await api.getNativeRfidStatus();
   get("sevenRfidDeviceStatus").textContent=!data.available?"Moteur natif indisponible : vérifiez l'installation Windows."
    :data.cardLockReady?"Lecteur compatible : service CardLock détecté."
    :"Lecteur non initialisé : ouvrez CardLock. Seven utilisera directement son SDK.";
  }catch{get("sevenRfidDeviceStatus").textContent="Impossible de vérifier le moteur RFID.";}
 }
 get("sevenRfidRoom").addEventListener("change",setLockFields);
 get("sevenRfidBooking").addEventListener("change",()=>{
  selectedBookingId=get("sevenRfidBooking").value;
  const s=bookingById(selectedBookingId);
  if(s?.check_out)get("sevenRfidExpiry").value=s.check_out+"T12:00";
  renderSummary();
 });
 get("sevenRfidConfirmTest").addEventListener("change",updateButtons);
 get("sevenRfidVendorForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!ctx||!manager())return;
  const vendorHotelIdValue=Number(get("sevenRfidVendorId").value);
  try{
   vendorHotelId=await api.saveRfidVendorId({userId:ctx.userId,hotelId:ctx.hotelId,vendorHotelId:vendorHotelIdValue});
   saveMsg.textContent="Identifiant hôtel fabricant enregistré dans le stockage chiffré de Windows.";
   renderSummary();
  }catch(error){saveMsg.textContent=error?.message||"Enregistrement refusé.";}
 });
 get("sevenRfidLockForm").addEventListener("submit",async event=>{
  event.preventDefault();if(!ctx||!manager())return;
  const roomId=get("sevenRfidRoom").value;
  if(!roomById(roomId))return void(saveMsg.textContent="Sélectionnez une chambre Seven.");
  const data={userId:ctx.userId,hotelId:ctx.hotelId,roomId,
   building:get("sevenRfidBuilding").value,floor:get("sevenRfidFloor").value,
   lockNo:get("sevenRfidLock").value};
  try{
   const item=await api.saveRfidRoomLayout(data);
   layout=layout.filter(e=>e.roomId!==roomId).concat(item);
   saveMsg.textContent="Correspondance chambre / serrure enregistrée.";
   render();get("sevenRfidRoom").value=roomId;setLockFields();
  }catch(error){saveMsg.textContent=error?.message||"Enregistrement impossible.";}
 });
 async function operation(name){
  if(!ctx||busy)return;
  const stay=bookingById(get("sevenRfidBooking").value),roomId=stay?.room_id;
  if(name!=="read"&&!canWrite())return;
  if(name!=="read"&&!window.confirm(
     name==="issue"?"Confirmer l’écriture physique sur un badge et une serrure de TEST isolés ?":
     "Confirmer l’effacement physique irréversible du badge CLIENT de TEST ?"))return;
  busy=true;updateButtons();message.dataset.result="pending";
  message.textContent=name==="read"?"Lecture du badge en cours…":name==="issue"?"Encodage et relecture de contrôle en cours…":"Effacement et relecture en cours…";
  const payload={operation:name,userId:ctx.userId,hotelId:ctx.hotelId,roomId,
   port:get("sevenRfidPort").value,expiresAt:get("sevenRfidExpiry").value,
   cardNo:Number(get("sevenRfidCardNo").value),dai:Number(get("sevenRfidDai").value),
   confirmTest:name!=="read"&&get("sevenRfidConfirmTest").checked};
  try{
   const result=await api.runNativeRfid(payload);
   message.dataset.result=result.ok?"success":"error";
   message.textContent=result.message||"Le moteur RFID n'a pas répondu.";
   if(name==="read"&&result.ok){
    message.textContent+=" Type : "+(result.type||"inconnu")+", séquence : "+(result.sequence||"—")
     +(result.lockNo?", serrure : "+result.lockNo:"")+(result.expiry?", expiration : "+result.expiry:"")+".";
   }
   if(name==="issue"&&result.ok&&result.verified===true&&result.sequence&&stay){
    const recorded=await window.SevenRfidRecordIssued?.({stayId:stay.id,sequence:result.sequence});
    message.textContent+=" "+(recorded?.message||"Registre non synchronisé.");
    if(recorded&&!recorded.ok)message.dataset.result="warning";
   }
   await deviceStatus();
  }catch(error){message.textContent=error?.message||"Lecteur non disponible.";message.dataset.result="error";}
  finally{busy=false;updateButtons();}
 }
 get("sevenRfidRead").addEventListener("click",()=>operation("read"));
 get("sevenRfidIssue").addEventListener("click",()=>operation("issue"));
 get("sevenRfidErase").addEventListener("click",()=>operation("erase"));
 get("sevenRfidCardLock").addEventListener("click",async()=>{
  if(busy)return;
  message.textContent="Ouverture du logiciel fabricant…";
  try{const r=await api.openRfidCardLock();message.textContent=r.ok?"CardLock lancé. Gardez-le ouvert ; utilisez ici les boutons de Seven.":r.message||"Démarrage annulé.";}
  catch(error){message.textContent=error?.message||"Impossible d'ouvrir CardLock.";}
  await deviceStatus();
 });
 window.addEventListener("seven:rfid-context",()=>refresh());
 document.addEventListener("click",event=>{
  if(event.target.closest?.('[data-view="rfid"]')){setTimeout(refresh,0);return;}
  const prepare=event.target.closest?.("[data-rfid-prepare]");
  if(!prepare)return;
  selectedBookingId=prepare.getAttribute("data-rfid-prepare");
  document.querySelector('[data-view="rfid"]')?.click();
  refresh().then(()=>{
   get("sevenRfidBooking").value=selectedBookingId;
   const s=bookingById(selectedBookingId);
   if(s?.check_out)get("sevenRfidExpiry").value=s.check_out+"T12:00";
   renderSummary();panel.scrollIntoView({block:"start",behavior:"smooth"});
  });
 });
 refresh();deviceStatus();
})();