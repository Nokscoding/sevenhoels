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
  +'<section class="seven-rfid-reader-profile" id="sevenRfidReaderProfile">'
  +'<div class="seven-rfid-reader-head"><h3 id="sevenRfidReaderTitle">Lecteur de cet hôtel</h3><span id="sevenRfidReaderBadge">À configurer</span></div>'
  +'<p id="sevenRfidReaderInfo" class="hint"></p>'
  +'<form id="sevenRfidReaderForm" class="seven-rfid-reader-form">'
  +'<label>Famille de lecteur<select id="sevenRfidReaderDriver"><option value="p50">Lecteur Seven 47 (P50 / S18)</option><option value="pro-usb-v9">Lecteur Seven 71 (proUSB V9)</option></select></label>'
  +'<label>Numéro de l’encodeur<input id="sevenRfidEncoderNo" maxlength="8" inputmode="numeric" placeholder="2922"></label>'
  +'<label>Type de carte affiché<input id="sevenRfidCardType" maxlength="4" inputmode="numeric" placeholder="57"></label>'
  +'<label>Version du lecteur<input id="sevenRfidReaderVersion" maxlength="48" placeholder="proUSB-V9-20171130"></label>'
  +'<label>Connexion SDK<select id="sevenRfidReaderPort"><option value="Port1">Port principal</option><option value="Port2">Port secondaire</option></select></label>'
  +'<button type="submit" class="outline">Enregistrer le lecteur de cet hôtel</button>'
  +'</form><p id="sevenRfidReaderMessage" class="hint" role="status"></p></section>'
  +'<div class="seven-rfid-section" id="sevenRfidConfiguration">'
  +'<h3>Paramètres des chambres et des serrures</h3>'
  +'<form id="sevenRfidVendorForm" class="seven-rfid-vendor-form">'
  +'<label>Numéro du système de serrures de cet hôtel<input type="number" min="1" max="2147483647" step="1" id="sevenRfidVendorId" required placeholder="Numéro communiqué par votre installateur"></label>'
  +'<button type="submit" class="outline">Enregistrer l’identifiant</button></form>'
  +'<p class="hint">Il s’agit de l’identifiant de votre hôtel dans le logiciel des serrures. Attention : le numéro d’encodeur 2922 du Seven 71 n’est pas cet identifiant.</p>'
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
  +'<section id="sevenRfidCardDetails" class="seven-rfid-read-card" hidden aria-live="polite">'
  +'<div class="seven-rfid-read-head"><div><span class="overline">LECTURE DU BADGE</span><h3 id="sevenRfidReadTitle">Informations de la carte</h3></div><span id="sevenRfidReadStatus" class="seven-rfid-read-state"></span></div>'
  +'<p id="sevenRfidReadNotice" class="seven-rfid-read-notice"></p>'
  +'<div id="sevenRfidReadFields" class="seven-rfid-read-fields"></div>'
  +'</section>'
  +'<p class="hint">Pour une carte perdue, prévenez le responsable : la suppression dans Seven ne bloque pas automatiquement une ancienne carte sur une serrure hors ligne.</p>'
  +'</div>';
 page.insertBefore(panel,page.querySelector(".seven-rfid-intro")||page.firstElementChild);
 const legacy=page.querySelector(".seven-rfid-intro");if(legacy)legacy.hidden=true;
 const get=id=>panel.querySelector("#"+id);
 const message=get("sevenRfidHandoffStatus"),saveMsg=get("sevenRfidLockStatus");
 let ctx=null,layout=[],vendorHotelId=null,readerProfile=null,loadedKey="",selectedBookingId="",busy=false,readerWasReady=false;
 const text=value=>String(value??"");
 const option=(value,label)=>{const o=document.createElement("option");o.value=value;o.textContent=label;return o;};
 function updateSelect(select,options,preserve){
  select.replaceChildren(...options.map(item=>option(item.value,item.label)));
  if(options.some(x=>x.value===preserve))select.value=preserve;
 }
 const manager=()=>["supervisor","director","manager"].includes(ctx?.role);
 const isHotel71=()=>/(^|[^0-9])71($|[^0-9])/.test(String(ctx?.hotelName||""));
 const specialReader=()=>isHotel71()||readerProfile?.driver==="pro-usb-v9";
 const readerConfigured=()=>!specialReader()||!!(
  readerProfile?.driver==="pro-usb-v9"&&readerProfile?.cardType==="57"
  &&/^[0-9]{1,8}$/.test(readerProfile?.encoderNo||"")
 );
 function renderReaderProfile(){
  const special=specialReader(),profile=readerProfile||{
   driver:special?"pro-usb-v9":"p50",
   port:"Port1",encoderNo:special?"2922":"",cardType:special?"57":"",
   dllVersion:special?"proUSB-V9-20171130":""
  };
  get("sevenRfidReaderTitle").textContent="Lecteur de "+(ctx?.hotelName||"cet hôtel");
  const badge=get("sevenRfidReaderBadge");
  badge.textContent=special?"Lecteur RF57 · T5557":"Configuration habituelle";
  badge.dataset.state=special?"pending":"ready";
  get("sevenRfidReaderInfo").textContent=special
   ?"Lecteur proUSB V9.27C du Seven 71 · encodeur 2922 · type de carte 57. Seven lance le logiciel propre à cet hôtel ; connectez-vous dans sa fenêtre avant de lire ou créer des cartes."
   :"Le lecteur du Seven 47 garde sa configuration déjà opérationnelle. Chaque hôtel possède des paramètres distincts.";
  get("sevenRfidReaderForm").hidden=!manager();
  for(const [id,value] of [
   ["sevenRfidReaderDriver",profile.driver],["sevenRfidEncoderNo",profile.encoderNo],
   ["sevenRfidCardType",profile.cardType],["sevenRfidReaderVersion",profile.dllVersion],
   ["sevenRfidReaderPort",profile.port]
  ])get(id).value=value||"";
  get("sevenRfidReaderDriver").disabled=isHotel71();
  get("sevenRfidReaderPort").disabled=!manager();
  get("sevenRfidPort").value=profile.port||"Port1";
  get("sevenRfidPort").disabled=!!readerProfile||special;
  get("sevenRfidCardLock").textContent=special?"Ouvrir proUSB V9.27C":"Démarrer le lecteur";
 }
 const roomById=id=>ctx?.rooms?.find(r=>r.id===id);
 const bookingById=id=>ctx?.stays?.find(s=>s.id===id&&s.status==="checked_in");
 const entryFor=id=>layout.find(e=>e.roomId===id);
 function setLockFields(){
  const room=roomById(get("sevenRfidRoom").value),entry=room&&entryFor(room.id);
  get("sevenRfidBuilding").value=entry?.building||ctx?.hotelName||"";
  get("sevenRfidFloor").value=entry?.floor||text(room?.floor||"");
  get("sevenRfidLock").value=entry?.lockNo||"";
 }
 function clearRead(){
  const panel=get("sevenRfidCardDetails");
  panel.hidden=true;
  get("sevenRfidReadFields").replaceChildren();
  get("sevenRfidReadNotice").textContent="";
 }
 function formattedDate(value){
  if(!value)return "—";
  const v=String(value).trim();
  // SDK timestamp: YYMMDDHHmm. Do not reinterpret unknown formats.
  if(/^\d{10}$/.test(v)){
   const year=2000+Number(v.slice(0,2)),month=Number(v.slice(2,4)),day=Number(v.slice(4,6)),
    hour=Number(v.slice(6,8)),minute=Number(v.slice(8,10));
   if(month>=1&&month<=12&&day>=1&&day<=31&&hour<=23&&minute<=59)
    return String(day).padStart(2,"0")+"/"+String(month).padStart(2,"0")+"/"+year+
     " à "+String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
  }
  const date=/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+"T12:00:00"):new Date(v);
  return Number.isNaN(date.getTime())?v:date.toLocaleString("fr-FR",{
   day:"2-digit",month:"2-digit",year:"numeric",
   ...(v.includes("T")?{hour:"2-digit",minute:"2-digit"}:{})
  });
 }
 function normalizeLock(value){
  return String(value||"").trim().toUpperCase().replace(/^0+(?=[0-9A-F])/,"");
 }
 function showReadDetails(card,client){
  const panel=get("sevenRfidCardDetails");
  panel.hidden=false;
  const fields=get("sevenRfidReadFields");
  fields.replaceChildren();
  const add=(label,value,important=false)=>{
   const item=document.createElement("div");
   item.className="seven-rfid-read-field"+(important?" seven-rfid-read-important":"");
   const heading=document.createElement("span");
   heading.textContent=label;
   const content=document.createElement("strong");
   content.textContent=String(value??"—")||"—";
   item.append(heading,content);fields.append(item);
  };
  const type=String(card.type||"").toUpperCase();
  const isBlank=type==="F",isGuest=type==="6";
  const found=client?.ok===true&&client?.found===true&&isGuest;
  const room=found?(roomById(client.roomId)||ctx?.rooms?.find(r=>r.number===client.roomNumber)):null;
  const location=room&&entryFor(room.id);
  const lockMismatch=!!(found&&card.lockNo&&location?.lockNo&&
   normalizeLock(card.lockNo)!==normalizeLock(location.lockNo));
  const physicallyDecoded=card.decoded===true&&!!card.lockNo&&!!card.expiry;
  const valid=found&&client.valid===true&&!lockMismatch&&physicallyDecoded;
  const reasons={
   revoked:"Carte désactivée dans Seven",expired:"Carte expirée",stay_not_active:"Séjour terminé",
   unknown_card:"Carte non attribuée",active:"Carte enregistrée",unknown:"Statut à vérifier"
  };
  let title="",status="",notice="";
  if(isBlank){
   title="Carte vierge";status="Aucun client";
   notice="Cette carte ne contient pas de carte de chambre active. Vous pouvez l’attribuer à un client.";
  }else if(!isGuest){
   title="Carte non-client";status="Non attribuée";
   notice="Cette carte n’est pas reconnue comme une carte de chambre client. Aucun client ne lui est associé automatiquement.";
  }else if(found){
   title=client.guestName||"Dossier du séjour";
   status=valid?"Carte active":lockMismatch?"Serrure à vérifier":reasons[client.reason]||"À vérifier";
   notice=client.message||"Informations du client retrouvées dans le registre Seven.";
   if(!physicallyDecoded&&client.valid===true){
    notice+=" Le numéro de serrure ou la date de la carte n’a pas pu être vérifié sur le lecteur.";
   }
   if(lockMismatch)notice+=" Attention : le numéro de serrure inscrit sur la carte ne correspond pas à celui de la chambre dans Seven.";
  }else{
   title="Carte non attribuée";status="Aucun dossier confirmé";
   notice=client?.message||"Le badge est lisible, mais aucun client n’a été retrouvé dans Seven.";
  }
  get("sevenRfidReadTitle").textContent=title;
  const statusEl=get("sevenRfidReadStatus");
  statusEl.textContent=status;
  statusEl.dataset.state=valid?"valid":found?"warning":"unknown";
  get("sevenRfidReadNotice").textContent=notice;
  if(found){
   add("Client",client.guestName||"Non disponible",true);
   add("Hôtel",ctx?.hotelName||"—");
   add("Chambre",client.roomNumber||room?.number||"—",true);
   if(location){
    add("Bâtiment",location.building);
    add("Étage",location.floor);
   }
   add("Réservation",client.reference||"—");
   add("Arrivée",formattedDate(client.checkIn));
   add("Départ",formattedDate(client.checkOut));
   if(client.guestPhone)add("Téléphone du client",client.guestPhone);
   add("Fin d’accès enregistrée",formattedDate(client.expiresAt));
  }
  add("Numéro de la carte",card.sequence||"Non disponible");
  add("Type",isBlank?"Vierge":isGuest?"Carte de chambre":"Autre carte");
  if(card.lockNo)add("Serrure inscrite sur la carte",card.lockNo);
  if(card.expiry)add("Fin d’accès inscrite sur la carte",formattedDate(card.expiry));
 }
 function canWrite(){
  const booking=bookingById(get("sevenRfidBooking").value);
  return (!specialReader()||readerConfigured())&&!busy&&!!booking&&!!entryFor(booking.room_id)&&!!vendorHotelId&&get("sevenRfidConfirmTest").checked;
 }
 function updateButtons(){
  get("sevenRfidRead").disabled=busy||!ctx||(specialReader()&&!readerConfigured());
  get("sevenRfidIssue").disabled=!canWrite();
  get("sevenRfidErase").disabled=busy||!ctx||!vendorHotelId||(specialReader()&&!readerConfigured())||!get("sevenRfidConfirmTest").checked;
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
   ["Configuration du lecteur",specialReader()?(readerConfigured()&&vendorHotelId?"RF57 configuré":"À compléter"):vendorHotelId?"Prête":"À compléter"]
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
  renderReaderProfile();
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
    selectedBookingId="";
    readerWasReady=false;
    [layout,vendorHotelId,readerProfile]=await Promise.all([
     api.getRfidRoomLayout(common),api.getRfidVendorId(common),api.getRfidReaderProfile(common)]);
    loadedKey=key;saveMsg.textContent="";
    }catch(error){layout=[];vendorHotelId=null;readerProfile=null;loadedKey="";saveMsg.textContent="Configuration inaccessible : "+(error.message||"erreur");}
  }
  render();
 }
 async function deviceStatus(){
  if(specialReader()){
   readerWasReady=false;
   try{
    const vendor=await api.getProUsb71Status?.({userId:ctx?.userId,hotelId:ctx?.hotelId});
    get("sevenRfidDeviceStatus").textContent=!readerProfile
     ?"Enregistrez d'abord le profil du lecteur Seven 71."
     :vendor?.running?"proUSB V9.27C du Seven 71 est ouvert. Lecteur prêt pour les opérations dans Seven."
     :vendor?.conflict?"Un autre hôtel utilise actuellement le logiciel de serrures. Fermez-le avant de passer au Seven 71."
     :"Démarrez proUSB V9.27C du Seven 71, connectez-vous dans sa fenêtre, puis utilisez les cartes dans Seven.";
   }catch{get("sevenRfidDeviceStatus").textContent="Impossible de vérifier le logiciel proUSB du Seven 71.";}
   return;
  }
  try{
   const data=await api.getNativeRfidStatus();
   const ready=data.readerReady===undefined?!!data.cardLockReady:!!data.readerReady;
   get("sevenRfidDeviceStatus").textContent=!data.available?"Le lecteur est indisponible. Vérifiez l’installation de Seven sur Windows."
    :ready?"Lecteur connecté et prêt."
    :data.cardLockReady?"Le logiciel du lecteur est ouvert, mais le S18 ne répond pas. Vérifiez le câble USB."
    :"Le lecteur n’est pas encore prêt. Cliquez sur « Démarrer le lecteur ».";
   if(ready&&!readerWasReady)api.playRfidSound?.("connected").catch(()=>{});
   readerWasReady=ready;
  }catch{
   readerWasReady=false;
   get("sevenRfidDeviceStatus").textContent="Le lecteur est momentanément indisponible.";
  }
 }
 get("sevenRfidReaderForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!ctx||!manager())return;
  const driver=isHotel71()?"pro-usb-v9":get("sevenRfidReaderDriver").value;
  const data={
   userId:ctx.userId,hotelId:ctx.hotelId,driver,
   port:get("sevenRfidReaderPort").value,
   encoderNo:get("sevenRfidEncoderNo").value,
   cardType:get("sevenRfidCardType").value,
   dllVersion:get("sevenRfidReaderVersion").value
  };
  try{
   readerProfile=await api.saveRfidReaderProfile(data);
   get("sevenRfidReaderMessage").textContent="Profil du lecteur enregistré uniquement pour "+ctx.hotelName+".";
   render();await deviceStatus();
  }catch(error){get("sevenRfidReaderMessage").textContent=error?.message||"Configuration du lecteur non enregistrée.";}
 });
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
  if(specialReader()&&!readerConfigured())return;
  if(name==="issue"&&!canWrite())return;
  if(name==="erase"&&(busy||!vendorHotelId||!get("sevenRfidConfirmTest").checked))return;
  if(name!=="read"&&!window.confirm(
     name==="issue"?"Créer maintenant une carte pour la chambre du client sélectionné ?":
     "Effacer définitivement les informations de cette carte client ? Vérifiez qu’il ne s’agit pas d’une carte encore utilisée."))return;
  busy=true;updateButtons();message.dataset.result="pending";
  clearRead();
  const scannedHotelId=ctx.hotelId;
  message.textContent=name==="read"?(specialReader()?"Lecture de la carte RF57 du Seven 71…":"Lecture de la carte et recherche du client…"):name==="issue"?"Création et vérification de la carte en cours…":"Effacement et relecture en cours…";
  const payload={operation:name,userId:ctx.userId,hotelId:ctx.hotelId,roomId,
   port:get("sevenRfidPort").value,expiresAt:get("sevenRfidExpiry").value,
   cardNo:Number(get("sevenRfidCardNo").value),dai:Number(get("sevenRfidDai").value),
   confirmAuthorization:name!=="read"&&get("sevenRfidConfirmTest").checked};
  try{
   const result=await api.runNativeRfid(payload);
   message.dataset.result=result.ok?"success":"error";
   message.textContent=result.message||"Le moteur RFID n'a pas répondu.";
   if(name==="read"&&specialReader()&&!result.ok)
    message.textContent+=" Vérifiez que CardLock du Seven 71 est ouvert et que la carte est bien une RF57/T5557. Si le lecteur reste incompatible, il faudra ses DLL d’origine." ;
   if(name==="read"&&result.ok)api.playRfidSound?.("read").catch(()=>{});
   if(name==="issue"&&result.ok&&result.verified===true)api.playRfidSound?.("written").catch(()=>{});
   if(name==="read"&&result.ok){
    const isGuest=result.type==="6";
    let customer=null;
    if(isGuest&&result.sequence&&scannedHotelId===ctx?.hotelId){
     customer=await window.SevenRfidLookupCard?.({sequence:result.sequence})||
      {ok:false,message:"Impossible de rechercher le client pour cette carte."};
    }
    if(scannedHotelId!==ctx?.hotelId){
     message.dataset.result="error";
     message.textContent="L’établissement a changé pendant la lecture. Relisez la carte.";
     return;
    }
    showReadDetails(result,customer);
    message.textContent=isGuest
     ?customer?.found?"Lecture terminée : le dossier du client est affiché ci-dessous."
      :"Lecture terminée : aucun client confirmé pour cette carte."
     :result.type==="F"?"Carte vierge reconnue.":"Carte lue. Consultez les informations ci-dessous.";
    message.dataset.result=customer?.found?"success":isGuest?"warning":"success";
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
  if(specialReader()){
   message.textContent="Ouverture de proUSB V9.27C du Seven 71…";
   try{
    const result=await api.openProUsb71({userId:ctx.userId,hotelId:ctx.hotelId});
    message.textContent=result.message||(result.ok?"proUSB V9.27C ouvert. Connectez-vous, puis revenez dans Seven.":"Impossible de démarrer le lecteur Seven 71.");
   }catch(error){message.textContent=error?.message||"Impossible d’ouvrir proUSB V9.27C de Seven 71.";}
   await deviceStatus();
   return;
  }
  message.textContent="Démarrage du lecteur…";
  try{const r=await api.openRfidCardLock();message.textContent=r.ok?"Lecteur démarré. Vous pouvez créer la carte directement dans Seven.":r.message||"Démarrage annulé.";}
  catch(error){message.textContent=error?.message||"Impossible de démarrer le lecteur.";}
  await deviceStatus();
  // CardLock may take a moment to finish starting before USB is available.
  if(!readerWasReady)setTimeout(()=>{deviceStatus();},1400);
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