/* Seven Gestion Windows: true native RFID inside the ERP (P50 ProUSB, x86).
 * No separate Studio UI; hardware still needs original CardLock open.
 * All mutations require staff confirmation and a verified SDK read-back.
 */
(function(){
 "use strict";
 const api=window.sevenDesktop,page=document.getElementById("rfidPage");
 if(!api?.runNativeRfid||!api?.getRfidRoomLayout||!api?.saveRfidRoomLayout||!page)return;
 const panel=document.createElement("section");
 panel.className="panel seven-rfid-workflow";
 panel.id="sevenRfidWorkflow";
 panel.innerHTML=
  '<div class="panel-heading"><div><span class="overline">SEVEN · CARTES DE CHAMBRE</span>'
  +'<h2>Créer et gérer les cartes des clients</h2>'
  +'<p class="message-note">Remettez la carte d’accès au client après son arrivée. Toutes les opérations se font ici, sans ouvrir un autre écran.</p></div></div>'
  +'<div class="seven-rfid-inline-status" id="sevenRfidDeviceStatus" role="status">Vérification du lecteur…</div>'
  +'<div class="seven-rfid-section" id="sevenRfidConfiguration">'
  +'<h3>Paramètres des chambres et des serrures</h3>'
  +'<form id="sevenRfidVendorForm" class="seven-rfid-vendor-form">'
  +'<label>Numéro du système de serrures de cet hôtel<input type="number" min="1" max="2147483647" step="1" id="sevenRfidVendorId" required placeholder="Numéro communiqué par votre installateur"></label>'
  +'<button type="submit" class="outline">Enregistrer l’identifiant</button></form>'
  +'<p class="hint">À renseigner une seule fois par hôtel. Le numéro est conservé sur ce PC.</p>'
  +'<form id="sevenRfidLockForm" class="seven-rfid-workflow-grid" autocomplete="off">'
  +'<label>Chambre Seven<select id="sevenRfidRoom" required></select></label>'
  +'<label>Bâtiment<input id="sevenRfidBuilding" maxlength="60" required placeholder="Seven 71"></label>'
  +'<label>Étage<input id="sevenRfidFloor" maxlength="30" required placeholder="1"></label>'
  +'<label>Code de la serrure (6 caractères)<input id="sevenRfidLock" maxlength="6" pattern="[0-9A-Fa-f]{6}" required placeholder="01020A"></label>'
  +'<button class="primary" type="submit" id="sevenRfidSaveLock">Enregistrer la serrure</button>'
  +'</form><p id="sevenRfidLockStatus" class="hint" role="status"></p>'
  +'<div id="sevenRfidLayoutRows" class="seven-rfid-workflow-list"></div></div>'
  +'<div class="seven-rfid-handoff"><h3>Remettre la carte au client</h3>'
  +'<label>Client déjà arrivé<select id="sevenRfidBooking"></select></label>'
  +'<div id="sevenRfidCardSummary" class="seven-rfid-card-summary" role="status" aria-live="polite"></div>'
  +'<div class="seven-rfid-guest-fields"><label>Date et heure de fin de séjour<input type="datetime-local" id="sevenRfidExpiry" required></label></div>'
  +'<details class="seven-rfid-advanced"><summary>Réglages du lecteur</summary><div class="seven-rfid-workflow-grid">'
  +'<label>Connexion<select id="sevenRfidPort"><option value="Port1">Lecteur principal</option><option value="Port2">Autre lecteur</option></select></label>'
  +'<label>Numéro de carte (0–15)<input type="number" id="sevenRfidCardNo" min="0" max="15" value="0"></label>'
  +'<label>DAI<input type="number" id="sevenRfidDai" min="0" max="255" value="1"></label></div></details>'
  +'<label class="seven-rfid-test-confirm"><input type="checkbox" id="sevenRfidConfirmTest">'
  +'Je confirme avoir vérifié le client, sa chambre et la carte présentée.</label>'
  +'<div class="seven-rfid-workflow-actions">'
  +'<button type="button" id="sevenRfidRead" class="outline">Lire une carte</button>'
  +'<button type="button" id="sevenRfidIssue" class="primary">Créer la carte du client</button>'
  +'<button type="button" id="sevenRfidErase" class="outline">Effacer une carte</button>'
  +'<button type="button" id="sevenRfidCardLock" class="outline">Démarrer le lecteur</button></div>'
  +'<p id="sevenRfidHandoffStatus" class="seven-rfid-native-result" role="status" aria-live="polite">'
  +'Posez une carte sur le lecteur, choisissez le client et cliquez sur « Créer la carte ».</p>'
  +'<p class="hint">Pour une carte perdue, prévenez le responsable : la suppression dans Seven ne bloque pas automatiquement une ancienne carte sur une serrure hors ligne.</p>'
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
  get("sevenRfidErase").disabled=busy||!ctx||!vendorHotelId||!get("sevenRfidConfirmTest").checked;
  get("sevenRfidCardLock").disabled=busy;
 }
 function renderSummary(){
  const summary=get("sevenRfidCardSummary"),booking=bookingById(get("sevenRfidBooking").value);
  const room=booking&&roomById(booking.room_id),entry=room&&entryFor(room.id);
  summary.replaceChildren();
  if(!booking){summary.textContent="Choisissez un client qui a déjà été enregistré à son arrivée.";updateButtons();return;}
  const fields=[
   ["Hôtel",ctx.hotelName],["Séjour",booking.reference||"—"],
   ["Chambre",room?.number||"—"],["Bâtiment",entry?.building||"Non configuré"],
   ["Étage",entry?.floor||"Non configuré"],
   ["Code serrure",entry?.lockNo||"Non configuré"],
   ["Arrivée",booking.check_in||"—"],["Départ",booking.check_out||"—"],
   ["Configuration du lecteur",vendorHotelId?"Prête":"À compléter"]
  ];
  for(const [label,value] of fields){
   const row=document.createElement("div"),a=document.createElement("strong"),b=document.createElement("span");
   a.textContent=label;b.textContent=text(value);row.append(a,b);summary.append(row);
  }
  if(!entry||!vendorHotelId){
   const notice=document.createElement("p");notice.className="seven-rfid-warning";
   notice.textContent="Cette chambre doit être associée à une serrure avant la création de la carte.";
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
  if(!layout.length)list.textContent="Aucune chambre n’est encore reliée à une serrure.";
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
   get("sevenRfidDeviceStatus").textContent=!data.available?"Le lecteur est indisponible. Vérifiez l’installation de Seven sur Windows."
    :data.cardLockReady?"Lecteur prêt."
    :"Le lecteur n’est pas encore prêt. Cliquez sur « Démarrer le lecteur ».";
  }catch{get("sevenRfidDeviceStatus").textContent="Le lecteur est momentanément indisponible.";}
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
  if(name==="issue"&&!canWrite())return;
  if(name==="erase"&&(busy||!vendorHotelId||!get("sevenRfidConfirmTest").checked))return;
  if(name!=="read"&&!window.confirm(
     name==="issue"?"Créer maintenant une carte pour la chambre du client sélectionné ?":
     "Effacer définitivement les informations de cette carte client ? Vérifiez qu’il ne s’agit pas d’une carte encore utilisée."))return;
  busy=true;updateButtons();message.dataset.result="pending";
  message.textContent=name==="read"?"Lecture du badge en cours…":name==="issue"?"Création et vérification de la carte en cours…":"Effacement et relecture en cours…";
  const payload={operation:name,userId:ctx.userId,hotelId:ctx.hotelId,roomId,
   port:get("sevenRfidPort").value,expiresAt:get("sevenRfidExpiry").value,
   cardNo:Number(get("sevenRfidCardNo").value),dai:Number(get("sevenRfidDai").value),
   confirmAuthorization:name!=="read"&&get("sevenRfidConfirmTest").checked};
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
  message.textContent="Démarrage du lecteur…";
  try{const r=await api.openRfidCardLock();message.textContent=r.ok?"Lecteur démarré. Vous pouvez créer la carte directement dans Seven.":r.message||"Démarrage annulé.";}
  catch(error){message.textContent=error?.message||"Impossible de démarrer le lecteur.";}
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