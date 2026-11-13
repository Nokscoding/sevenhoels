(function(){"use strict";
const cfg=window.SEVEN_CONFIG||{},sb=(cfg.url&&cfg.publishableKey&&window.supabase)?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const state={user:null,roles:[],hotels:[],hotelId:"",view:"dashboard",requests:[],rooms:[],roomTypes:[],stays:[],services:[],attendance:[],employees:[],rfid:[],media:[],allocatingRequestId:null};
const el=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const names={dashboard:["Vue d'ensemble","Toutes les informations essentielles de votre établissement."],requests:["Réservations à confirmer","Contactez les clients, vérifiez les disponibilités et confirmez les réservations."],stays:["Séjours & arrivées","Gérez les confirmations, arrivées et départs des clients."],rooms:["Gestion des chambres","Suivez la disponibilité opérationnelle des chambres."],services:["Espaces et services","Gérez les salles, restaurants et installations."],attendance:["Présences","Enregistrez les entrées et sorties de votre équipe."],access:["Accès et permissions","Contrôlez les autorisations par établissement."],notifications:["Notifications","Suivez les événements importants de vos établissements."],management:["Espace responsables","Pilotage des équipes, de l’hôtel et des opérations."],properties:["Établissements","Gérez les hôtels et appartements de la chaîne Seven."],rfid:["Cartes RFID","Registre et préparation de la gestion des accès."]};
const statusNames={pending:"À contacter",confirmed:"Confirmée",checked_in:"Occupée",checked_out:"Terminé",no_show:"Non-présenté",approved:"Approuvée",declined:"Refusée",cancelled:"Annulée",available:"Disponible",occupied:"Occupée",cleaning:"Nettoyage",maintenance:"Maintenance",out_of_service:"Hors service"};
const roleNames={supervisor:"Modérateur général",director:"Directeur général",manager:"Gérant",reception:"Réceptionniste",housekeeping:"Entretien",accountant:"Comptabilité"};
function flash(message){el("flash").textContent=message;el("flash").scrollIntoView({block:"nearest",behavior:"smooth"});}
function offline(){el("connectionState").textContent=navigator.onLine?"● En ligne":"● Hors connexion";el("connectionState").classList.toggle("offline",!navigator.onLine);}
window.addEventListener("online",offline);window.addEventListener("offline",offline);offline();
function supervisor(){return state.roles.some(r=>r.role==="supervisor"&&r.active);}
function director(){return state.roles.some(r=>r.role==="director"&&r.active);}
function leadership(){return supervisor()||director();}
function currentRole(){return supervisor()?"supervisor":director()?"director":(state.roles.find(r=>r.hotel_id===state.hotelId&&r.active)||{}).role||"reception";}
function canManageAccess(){return supervisor()||['director','manager'].includes(currentRole());}
function canManage(){return ["supervisor","director","manager"].includes(currentRole());}
function canHandle(){return ["supervisor","director","manager","reception"].includes(currentRole());}
function currentHotel(){return state.hotels.find(h=>h.id===state.hotelId);}
function isValidUUID(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
function showLogin(msg){window.SevenNotifications?.stop();el("appShell").hidden=true;el("loginScreen").hidden=false;el("loginMessage").textContent=msg||"";}
function canAssignRole(role){
 if(supervisor())return ["supervisor","director","manager","reception","housekeeping","accountant"].includes(role);
 if(director())return ["director","manager","reception","housekeeping","accountant"].includes(role);
 return currentRole()==="manager"&&["reception","housekeeping","accountant"].includes(role);
}
function globalRole(role){return role==="director"||role==="supervisor";}
function roleNav(){
 document.querySelector('[data-view="requests"]').hidden=!canHandle();
 document.querySelector('[data-view="stays"]').hidden=!(canHandle()||currentRole()==="accountant");
 document.querySelector(".supervisor-link").hidden=!canManageAccess();
 document.querySelector(".manager-link").hidden=!canManage();
 document.querySelector(".leadership-link").hidden=!leadership();
 document.querySelector('[data-view="rfid"]').hidden=!["supervisor","director","manager","reception"].includes(currentRole());
 document.querySelector('[data-view="services"]').hidden=!["supervisor","director","manager","reception"].includes(currentRole());
 document.querySelector('[data-view="attendance"]').hidden=!(canManage()||currentRole()==="accountant");
}
function configureRoleSelect(selectId,hotelWrapId,hotelSelectId){
 const select=el(selectId);
 select.querySelectorAll("option").forEach(opt=>{
  opt.disabled=!canAssignRole(opt.value);
  opt.hidden=!canAssignRole(opt.value);
 });
 if(!canAssignRole(select.value)){
  const allowed=[...select.options].find(opt=>!opt.disabled);
  select.value=allowed?.value||"";
 }
 const global=globalRole(select.value);
 el(hotelWrapId).hidden=global;
 el(hotelSelectId).disabled=global||!leadership();
 if(!global)el(hotelSelectId).value=state.hotelId;
 if(selectId==="inviteRole"){
  document.querySelectorAll(".staff-employee-field").forEach(wrapper=>{
   wrapper.hidden=global;
   wrapper.querySelectorAll("input,select").forEach(field=>{
    field.disabled=global;
    if(field.id==="staffMonthlySalary")field.required=!global;
   });
  });
 }
}
function populateHotelSelectors(){
 const entries=state.hotels.map(h=>'<option value="'+esc(h.id)+'">'+esc(h.name)+(h.active?"":" · Non publié")+'</option>').join("");
 el("hotelSwitcher").innerHTML=entries;
 el("hotelSwitcher").value=state.hotelId;
 for(const id of ["roleHotel","inviteHotel","propertyEditId"]){
  el(id).innerHTML=entries;
  el(id).value=state.hotelId;
 }
 configureRoleSelect("roleSelect","roleHotelWrap","roleHotel");
 configureRoleSelect("inviteRole","inviteHotelWrap","inviteHotel");
 updatePropertyEditForm();
}
function showApp(){
 el("loginScreen").hidden=true;el("appShell").hidden=false;
 el("userAvatar").textContent=(state.user.email||"S")[0].toUpperCase();
 el("userRole").textContent=roleNames[currentRole()]||"Personnel";
 populateHotelSelectors();
 roleNav();
 el("serviceForm").hidden=!canManage();
 const landing=leadership()?"properties":currentRole()==="manager"?"management":currentRole()==="reception"?"requests":currentRole()==="housekeeping"?"rooms":"dashboard";
 goto(landing);
}
async function bootstrap(){if(!sb){showLogin("La configuration d'accès au serveur est manquante.");return;}const auth=await sb.auth.getUser();if(auth.error||!auth.data.user){showLogin();return;}state.user=auth.data.user;const roles=await sb.from("seven_roles").select("id,user_id,hotel_id,role,full_name,active").eq("user_id",state.user.id).eq("active",true);if(roles.error||!roles.data?.length){await sb.auth.signOut();state.user=null;showLogin("Ce compte n'a pas encore reçu d'autorisation. Contactez la supervision.");return;}state.roles=roles.data;
const hotels=await sb.from("hotels").select("id,name,slug,city,address,phone,email,description,active").order("name");if(hotels.error){showLogin("Impossible de charger les établissements.");return;}state.hotels=leadership()?hotels.data:hotels.data.filter(h=>h.active&&state.roles.some(r=>r.hotel_id===h.id));if(!state.hotels.length){showLogin("Aucun établissement attribué.");return;}state.hotelId=state.hotels[0].id;showApp();await Promise.all([loadAll(),window.SevenNotifications.start({supabase:sb,user:state.user.id,properties:state.hotels,navigate:goto,flash})]);}
function goto(view){if((view==="management"&&!canManage())||(view==="access"&&!canManageAccess())||(view==="properties"&&!leadership()))return;if(view==="requests"&&!canHandle())return;if(view==="stays"&&!(canHandle()||currentRole()==="accountant"))view="rooms";state.view=view;document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id===view+"Page"));document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));el("pageTitle").textContent=names[view][0];el("pageDescription").textContent=names[view][1];el("breadcrumb").textContent=names[view][0].toUpperCase();el("serviceForm").hidden=!(view==="services"&&canManage());setSidebarOpen(false);}
async function fetchFor(table,cols="*"){const q=sb.from(table).select(cols).eq("hotel_id",state.hotelId);const r=await q;if(r.error)throw r.error;return r.data||[];}
function dateDisplay(v){return v?new Date(v).toLocaleDateString("fr-FR"):"—";}
function table(headers,rows){if(!rows.length)return '<div class="empty">Aucune donnée à afficher pour cet établissement.</div>';return '<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+rows.join("")+'</tbody></table>';}
function pill(status){return '<span class="status '+esc(status)+'">'+esc(statusNames[status]||status)+'</span>';}
function stayBlocksRoom(roomId,start,end){return state.stays.find(s=>s.room_id===roomId&&["pending","confirmed","checked_in"].includes(s.status)&&s.check_in<end&&start<s.check_out);}
function todayLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function roomOptionsFor(req){return state.rooms.filter(r=>{
 const rt=state.roomTypes.find(t=>t.id===r.room_type_id);
 return r.active&&rt?.active&&rt.capacity>=req.guests
   &&!["maintenance","out_of_service"].includes(r.operational_status)
   &&!(req.start_date===todayLocal()&&["occupied","cleaning"].includes(r.operational_status))
   &&!stayBlocksRoom(r.id,req.start_date,req.end_date);
});}
function renderRequests(){
 const rows=state.requests.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(r=>{
  let action="—";
  if(canHandle()&&r.status==="pending"){
    action='<div class="inline-actions">'+(r.kind==="stay"?'<button type="button" class="action-button action-primary" data-allocate="'+esc(r.id)+'">Contacter & confirmer</button>':'<button type="button" class="action-button action-primary" data-service-approve="'+esc(r.id)+'">Confirmer le service</button>')+'<button type="button" class="action-button action-danger" data-decline="'+esc(r.id)+'">Refuser</button></div>';
  } else if(r.reservation_id){
    const stay=state.stays.find(s=>s.id===r.reservation_id);
    action='<span class="reservation-ref">'+esc(stay?.reference||"Séjour lié")+'</span>';
  }
  const phone=String(r.guest_phone||"").replace(/[^+0-9]/g,"");
  const whatsapp=String(r.guest_phone||"").replace(/\D/g,"");
  const contact='<div class="contact-actions"><a href="tel:'+esc(phone)+'">Appeler ↗</a>'+(whatsapp.startsWith("243")?'<a href="https://wa.me/'+esc(whatsapp)+'" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>':"")+(r.guest_email?'<a href="mailto:'+esc(r.guest_email)+'">E-mail ↗</a>':"")+'</div>';
  return '<tr><td>'+esc(r.guest_name)+'</td><td>'+esc(({stay:"Chambre",apartment:"Appartement",restaurant:"Restaurant",event:"Événement",fitness:"Sport & bien-être"})[r.kind]||r.kind)+'</td><td>'+esc(r.guest_phone)+'</td><td>'+esc(r.guests)+'</td><td>'+esc(r.start_date)+(r.end_date?' → '+esc(r.end_date):'')+'</td><td>'+pill(r.status)+'</td><td>'+contact+'</td><td>'+action+'</td></tr>';
 });
 el("requestsTable").innerHTML=table(["Client","Type","Téléphone","Pers.","Dates","Statut","Contact","Décision"],rows);
 el("recentRequests").innerHTML=table(["Client","Type","Date","Statut"],state.requests.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5).map(r=>'<tr><td>'+esc(r.guest_name)+'</td><td>'+esc(r.kind)+'</td><td>'+esc(r.start_date)+'</td><td>'+pill(r.status)+'</td></tr>'));
 el("requestCount").textContent=state.requests.filter(r=>r.status==="pending").length+state.stays.filter(r=>r.status==="pending"&&r.source==="public").length;
}

function renderDirectBookings(){
 const incoming=state.stays.filter(s=>s.source==="public"&&s.status==="pending").sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const rows=incoming.map(s=>{
  const room=state.rooms.find(r=>r.id===s.room_id),contact=String(s.guest_phone||"").replace(/[^+0-9]/g,""),wa=String(s.guest_phone||"").replace(/\D/g,"");
  return '<tr><td>'+esc(s.reference||"—")+'</td><td>'+esc(s.guest_name)+'</td><td>'+esc(room?.number||"—")+'</td><td>'+esc(s.check_in)+' → '+esc(s.check_out)+'</td><td>'+esc(money(s.total_amount,s.currency))+'</td><td><div class="contact-actions"><a href="tel:'+esc(contact)+'">Appeler</a>'+(wa?'<a href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener noreferrer">WhatsApp</a>':"")+(s.guest_email?'<a href="mailto:'+esc(s.guest_email)+'">E-mail</a>':"")+'</div></td><td><div class="inline-actions"><button type="button" class="action-button action-primary" data-direct-confirm="'+esc(s.id)+'">Confirmer après contact</button><button type="button" class="action-button action-danger" data-direct-cancel="'+esc(s.id)+'">Annuler</button></div></td></tr>';
 });
 el("selectedBookingsTable").innerHTML=table(["Référence","Client","Chambre choisie","Dates","Total","Contact","Décision"],rows);
 el("selectedBookingsPanel").hidden=!canHandle();
}
async function decideDirectBooking(id,action){
 if(!canHandle()||!navigator.onLine)return flash("Cette action nécessite la connexion et les droits réception.");
 const stay=state.stays.find(s=>s.id===id&&s.hotel_id===state.hotelId&&s.source==="public"&&s.status==="pending");
 if(!stay)return flash("Réservation déjà traitée. Actualisez la liste.");
 if(!window.confirm(action==="confirm"?"Avez-vous contacté le client et validé la réservation "+(stay.reference||"")+" ?":"Annuler cette réservation et libérer la chambre ?"))return;
 try{
  if(action==="cancel"){
   const r=await sb.rpc("seven_transition_stay",{p_reservation_id:stay.id,p_action:"cancel"});
   if(r.error)throw r.error;
   flash("Réservation annulée, chambre libérée pour les dates concernées.");
  }else{
   const r=await sb.from("reservations").update({status:"confirmed"}).eq("id",stay.id).eq("hotel_id",state.hotelId).eq("source","public").eq("status","pending").select("id").single();
   if(r.error)throw r.error;
   flash("Réservation confirmée après contact. Elle apparaît dans Séjours & arrivées.");
  }
  await loadAll();
 }catch(error){console.error("Direct booking decision failed",error);flash(readableError(error));}
}
const ROOM_BUCKET="seven-property-media";
function roomMedia(roomId){return state.media.filter(m=>m.room_id===roomId&&m.kind==="room").sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||(a.sort_order||0)-(b.sort_order||0));}
function mediaURL(path){return sb.storage.from(ROOM_BUCKET).getPublicUrl(path).data.publicUrl;}
async function uploadRoomPhotos(roomId,files){
 const allowed={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
 const photos=[...files].filter(f=>f?.size>0);
 if(!photos.length)return 0;
 if(photos.length>6)throw Error("Sélectionnez six photos maximum à la fois.");
 for(const file of photos)if(!allowed[file.type]||file.size>7*1024*1024)throw Error("Photos JPG, PNG ou WebP uniquement, 7 Mo maximum par photo.");
 if(!state.rooms.some(r=>r.id===roomId&&r.hotel_id===state.hotelId))throw Error("Cette chambre n'appartient pas à cet établissement.");
 let count=0;
 for(const file of photos){
  const filename=crypto.randomUUID()+"."+allowed[file.type];
  const storage_path=state.hotelId+"/"+roomId+"/"+filename;
  const uploaded=await sb.storage.from(ROOM_BUCKET).upload(storage_path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  if(uploaded.error)throw uploaded.error;
  const saved=await sb.from("seven_media").insert({
   hotel_id:state.hotelId,room_id:roomId,kind:"room",storage_path,
   caption:"Chambre "+(state.rooms.find(r=>r.id===roomId)?.number||""),
   is_cover:roomMedia(roomId).length===0&&count===0,sort_order:roomMedia(roomId).length+count
  }).select("id").single();
  if(saved.error){await sb.storage.from(ROOM_BUCKET).remove([storage_path]).catch(()=>{});throw saved.error;}
  count++;
 }
 return count;
}
function renderRoomMedia(){
 const panel=el("roomPresentationPanel");panel.hidden=!canManage();
 if(!canManage())return;
 const previous=el("roomPresentationId").value;
 el("roomPresentationId").innerHTML='<option value="">Choisir une chambre</option>'+state.rooms.filter(r=>r.active).map(r=>'<option value="'+esc(r.id)+'">Chambre '+esc(r.number)+' · '+esc(state.roomTypes.find(t=>t.id===r.room_type_id)?.name||"")+'</option>').join("");
 if(state.rooms.some(r=>r.id===previous))el("roomPresentationId").value=previous;
 const room=state.rooms.find(r=>r.id===el("roomPresentationId").value);
 el("roomPresentationDescription").value=room?.description||"";
 const images=room?roomMedia(room.id):[];
 el("roomPhotoGallery").innerHTML=images.length?images.map(m=>
  '<div class="seven-room-photo"><img loading="lazy" src="'+esc(mediaURL(m.storage_path))+'" alt="'+esc(m.caption||"Photo de la chambre")+'"><button class="action-button action-danger" type="button" data-photo-delete="'+esc(m.id)+'">Retirer</button></div>'
 ).join(""):'<p class="hint">Aucune photo. Une chambre sans photo ne sera pas proposée aux clients en ligne.</p>';
}

function renderStays(){
 const rows=state.stays.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(s=>{
  const room=state.rooms.find(r=>r.id===s.room_id),date=todayLocal();
  let actions="—";
  if(canHandle()){
   const buttons=[];
   if(s.status==="confirmed"&&s.check_in<=date&&s.check_out>date){
    buttons.push('<button type="button" class="action-button action-primary" data-stay="'+esc(s.id)+'" data-action="check_in">Check-in</button>');
   }
   if(s.status==="checked_in"){
    buttons.push('<button type="button" class="action-button action-primary" data-stay="'+esc(s.id)+'" data-action="check_out">Check-out</button>');
     if(window.sevenDesktop?.openRfidStudio){
      buttons.push('<button type="button" class="action-button" data-rfid-prepare="'+esc(s.id)+'">Préparer la carte</button>');
     }
   }
   if(["confirmed","pending"].includes(s.status)){
    buttons.push('<button type="button" class="action-button action-danger" data-stay="'+esc(s.id)+'" data-action="cancel">Annuler</button>');
   }
   if(buttons.length)actions='<div class="inline-actions">'+buttons.join("")+'</div>';
  }
  return '<tr><td><span class="reservation-ref">'+esc(s.reference)+'</span></td><td>'+esc(s.guest_name)+'</td><td>'+esc(room?.number||"—")+'</td><td>'+esc(s.check_in)+' → '+esc(s.check_out)+'</td><td>'+pill(s.status)+'</td><td>'+actions+'</td></tr>';
 });
 el("staysTable").innerHTML=table(["Référence","Client","Chambre","Dates","Statut","Actions"],rows);
}
function renderRooms(){
 const date=el("availabilityDate").value||todayLocal();
 if(!el("availabilityDate").value)el("availabilityDate").value=date;
 const rows=state.rooms.map(r=>{
  const type=state.roomTypes.find(t=>t.id===r.room_type_id),book=stayBlocksRoom(r.id,date,datePlusOne(date));
  const planning=book?'<span class="status booked">Réservée · '+esc(book.reference||"séjour")+'</span>':'<span class="status free">Libre sur ce jour</span>';
  let action="—";
  if(["supervisor","director","manager","reception","housekeeping"].includes(currentRole())){
   if(r.operational_status==="occupied")action='<span class="hint">Via check-out</span>';
   else action='<select data-room="'+esc(r.id)+'">'+["available","cleaning","maintenance","out_of_service"].map(s=>'<option value="'+s+'" '+(r.operational_status===s?"selected":"")+'>'+esc(statusNames[s])+'</option>').join("")+'</select>';
  }
  return '<tr><td>'+esc(r.number)+'</td><td>'+esc(type?.name||"—")+'</td><td>'+esc(r.floor||"—")+'</td><td>'+pill(r.operational_status)+'</td><td>'+planning+'</td><td>'+esc(roomMedia(r.id).length)+" photo(s)</td><td>"+(canManage()?'<button type="button" class="action-button" data-room-edit="'+esc(r.id)+'">Photos & description</button>':"—")+"</td><td>"+action+"</td></tr>";
 });
 el("roomsTable").innerHTML=table(["N°","Catégorie","Étage","État réel","Planning au "+date,"Photos","Présentation","État"],rows);
}
function datePlusOne(date){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function money(amount,currency){try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:currency||"USD"}).format(Number(amount));}catch{return String(amount)+" "+(currency||"");}}
function renderRoomTypes(){
 el("roomTypePanel").hidden=!canManage();
 el("roomCreationPanel").hidden=!canManage();
 const options=state.roomTypes.filter(t=>t.active).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("");
 el("roomCreationType").innerHTML='<option value="">Choisir une catégorie</option>'+options;
 el("roomTypesTable").innerHTML=table(["Catégorie","Capacité","Tarif / nuit","Publication"],state.roomTypes.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.capacity)+'</td><td>'+esc(money(t.base_price,t.currency))+'</td><td><label class="seven-publish-toggle"><input type="checkbox" data-type-publish="'+esc(t.id)+'" '+(t.website_published?"checked":"")+'> Publier sur le site</label></td></tr>'));
}

function renderServices(){el("servicesTable").innerHTML=table(["Service","Type","Capacité","Publication"],state.services.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.kind)+'</td><td>'+esc(r.capacity)+'</td><td>'+ (r.active?"Visible":"Non publié") +'</td></tr>'));}

function renderAttendance(){
 const canWrite=canManage();
 el("attendanceEntryPanel").hidden=!canWrite;
 if(!el("attendanceDate").value)el("attendanceDate").value=todayLocal();
 const employees=state.employees||[];
 el("attendanceEmployee").innerHTML='<option value="">Choisir un salarié</option>'+employees.filter(x=>x.active).map(x=>
  '<option value="'+esc(x.id)+'">'+esc(x.full_name)+' · '+esc(x.job_title)+'</option>'
 ).join("");
 const status={present:"Présent",late:"En retard",absent:"Absent",leave:"Congé",off:"Repos"};
 const rows=state.attendance.slice().sort((a,b)=>String(b.work_date).localeCompare(String(a.work_date))).map(x=>{
  const employee=employees.find(e=>e.id===x.employee_id);
  return '<tr><td>'+esc(x.work_date)+'</td><td>'+esc(employee?.full_name||"Employé")+'</td><td>'+esc(status[x.status]||x.status)+'</td><td>'+esc(x.clock_in||"—")+'</td><td>'+esc(x.clock_out||"—")+'</td><td>'+esc(x.notes||"—")+'</td></tr>';
 });
 el("attendanceTable").innerHTML=table(["Date","Employé","Statut","Arrivée","Départ","Observation"],rows);
}
function canRevokeRole(role){
 if(role.user_id===state.user?.id)return false;
 if(supervisor())return true;
 if(director())return role.role!=="supervisor";
 if(role.hotel_id!==state.hotelId)return false;
 return currentRole()==="manager"&&["reception","housekeeping","accountant"].includes(role.role);
}
function renderRoles(){
 if(!canManageAccess())return;
 const visible=leadership()?
  (state.allRoles||[]).filter(r=>supervisor()||r.role!=="supervisor"):
  (state.allRoles||[]).filter(r=>r.hotel_id===state.hotelId);
 el("accessTable").innerHTML=table(["Collaborateur","Compte","Rôle","Établissement","Statut","Action"],visible.map(r=>{
  const hotel=(state.hotels.find(h=>h.id===r.hotel_id)||{}).name||"Toute la chaîne";
  const action=canRevokeRole(r)?'<button class="action-button action-danger" type="button" data-revoke="'+esc(r.id)+'">'+(r.active?"Désactiver":"Réactiver")+'</button>':"—";
  return '<tr><td>'+esc(r.full_name)+'</td><td>'+esc(r.user_id)+'</td><td><span class="role-pill">'+esc(roleNames[r.role])+'</span></td><td>'+esc(hotel)+'</td><td>'+(r.active?"Actif":"Inactif")+'</td><td>'+action+'</td></tr>';
 }));
}
function updatePropertyEditForm(){
 const h=state.hotels.find(x=>x.id===el("propertyEditId").value);
 if(!h)return;
 el("propertyEditName").value=h.name||"";
 el("propertyEditCity").value=h.city||"";
 el("propertyEditAddress").value=h.address||"";
 el("propertyEditDescription").value=h.description||"";
 el("propertyEditActive").checked=!!h.active;
}
function renderProperties(){
 if(!leadership())return;
 el("propertiesGrid").innerHTML=state.hotels.map(h=>{
  const selected=h.id===state.hotelId,active=!!h.active;
  return '<article class="property-summary-card'+(selected?' selected':'')+'">'
    +'<span class="property-summary-icon">7</span><div class="property-summary-content">'
    +'<strong>'+esc(h.name)+'</strong><small>'+esc(h.city||"Ville à compléter")
    +'</small><span class="property-summary-badge '+(active?'live':'inactive')+'">'+(active?'Actif':'Inactif')+'</span></div>'
    +'<button type="button" class="action-button" data-select-property="'+esc(h.id)+'">'+(selected?"Établissement sélectionné":"Gérer cet établissement ↗")+'</button></article>';
 }).join("");
}
async function refreshHotelRoster(selectId){
 const response=await sb.from("hotels")
   .select("id,name,slug,city,address,phone,email,description,active")
   .order("name");
 if(response.error)throw response.error;
 state.hotels=leadership()?response.data:response.data.filter(h=>h.active&&state.roles.some(r=>r.hotel_id===h.id));
 if(!state.hotels.some(h=>h.id===selectId))
   selectId=state.hotels.find(h=>h.active)?.id||state.hotels[0]?.id||"";
 state.hotelId=selectId;
 populateHotelSelectors();
 renderProperties();
}

// Read-only, non-secret reservation context for the Windows RFID handoff.
// Actual card programming remains inside the proven Studio 2.2.
window.SevenRfidContext=()=>{
 if(!state.user||!state.hotelId||!canHandle())return null;
 return {
  userId:state.user.id,hotelId:state.hotelId,hotelName:currentHotel()?.name||"",
  role:currentRole(),
  rooms:state.rooms.filter(r=>r.hotel_id===state.hotelId).map(r=>({id:r.id,number:r.number,floor:r.floor||""})),
  stays:state.stays.filter(s=>s.hotel_id===state.hotelId&&s.status==="checked_in")
   .map(s=>({id:s.id,hotel_id:s.hotel_id,room_id:s.room_id,reference:s.reference,check_in:s.check_in,check_out:s.check_out,status:s.status}))
 };
};
function renderRFID(){
 const select=el("rfidStaySelect"),previous=select.value;
 const checked=state.stays.filter(s=>s.status==="checked_in"&&s.hotel_id===state.hotelId);
 select.innerHTML='<option value="">Choisir un séjour en cours</option>'+checked.map(s=>{
  const room=state.rooms.find(r=>r.id===s.room_id);
  return '<option value="'+esc(s.id)+'">'+esc(s.reference)+' · '+esc(room?.number||"chambre")+' · '+esc(s.guest_name)+'</option>';
 }).join("");
 if(checked.some(s=>s.id===previous))select.value=previous;
 const now=Date.now();
 const rows=state.rfid.slice().sort((a,b)=>String(b.issued_at).localeCompare(String(a.issued_at))).map(c=>{
  const room=state.rooms.find(r=>r.id===c.room_id),
        stay=state.stays.find(s=>s.id===c.reservation_id);
  const expired=c.expires_at&&new Date(c.expires_at).getTime()<=now;
  const inactive=stay?.status!=="checked_in";
  const current=!c.revoked_at&&!expired&&!inactive;
  const stateName=c.revoked_at?"Révoquée":expired?"Expirée":inactive?"Séjour inactif":"Active";
  return '<tr><td>'+esc(room?.number||"—")+'</td><td>'+esc(stay?.reference||"—")+'</td><td>'+esc(String(c.id||"").slice(0,8).toUpperCase())+'</td><td>'+esc(dateDisplay(c.issued_at))+'</td><td>'+esc(c.expires_at?new Date(c.expires_at).toLocaleString("fr-FR"):"—")+'</td><td>'+pill(current?"available":"cancelled").replace(current?"Disponible":"Annulée",stateName)+'</td><td>'+(c.revoked_at?"—":'<button type="button" class="action-button action-danger" data-rfid-revoke="'+esc(c.id)+'">Révoquer</button>')+'</td></tr>';
 });
 el("rfidTable").innerHTML=table(["Chambre","Séjour","Carte","Création","Expiration","État","Action"],rows);
 el("rfidCardCount").textContent=state.rfid.filter(c=>!c.revoked_at&&(!c.expires_at||new Date(c.expires_at)>new Date())&&state.stays.some(s=>s.id===c.reservation_id&&s.status==="checked_in")).length;
 el("rfidEnrollFields").hidden=el("rfidScanMode").value!=="issue";
 el("rfidScanSubmit").textContent=el("rfidScanMode").value==="issue"?"Enregistrer la carte":"Vérifier la carte";
}

function renderManagement(){
 const hotel=currentHotel();
 el("managementPropertyTitle").textContent=hotel?.name||"Espace responsables";
 el("managementPropertyName").textContent=hotel?.name||"cet établissement";
 el("managementRole").textContent=roleNames[currentRole()]||"Responsable";
 const date=todayLocal();
 const staff=(state.allRoles||[]).filter(r=>r.active&&(r.hotel_id===state.hotelId));
 const pending=state.requests.filter(r=>r.status==="pending").length+state.stays.filter(r=>r.status==="pending"&&r.source==="public").length;
 const arrivals=state.stays.filter(s=>s.status==="confirmed"&&s.check_in===date).length;
 const cleaning=state.rooms.filter(r=>["cleaning","maintenance","out_of_service"].includes(r.operational_status)).length;
 el("managementPending").textContent=pending;
 el("managementArrivals").textContent=arrivals;
 el("managementCleaning").textContent=cleaning;
 el("managementStaffCount").textContent=staff.length;
 const team=staff.slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name),"fr")).slice(0,12);
 el("managementTeam").innerHTML=team.length?team.map(r=>{
  const name=esc(r.full_name||"Collaborateur");
  const initials=esc(String(r.full_name||"?").split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase());
  return '<div class="management-person"><span class="management-person-avatar">'+initials
    +'</span><span class="management-person-main"><strong>'+name+'</strong><small>'+esc(roleNames[r.role]||r.role)
    +'</small></span><span class="management-person-status">Actif</span></div>';
 }).join(""):'<div class="management-empty">Aucun membre du personnel n’est encore affecté à cet établissement. La direction peut attribuer des accès à des comptes existants.</div>';
 const total=state.rooms.length;
 const measures=[
  ["Disponibles",state.rooms.filter(r=>r.operational_status==="available").length,""],
  ["Occupées",state.rooms.filter(r=>r.operational_status==="occupied").length,"busy"],
  ["À préparer / indisponibles",cleaning,"attention"]
 ];
 el("managementRoomHealth").innerHTML=measures.map(([label,count,cls])=>{
  const pc=total?Math.round(count*100/total):0;
  return '<div class="management-health-item"><div class="management-health-label"><span>'+esc(label)
    +'</span><small>'+count+' / '+total+'</small></div><div class="management-progress '+cls
    +'"><span style="width:'+pc+'%"></span></div></div>';
 }).join("");
}

function renderReceptionOptions(){
 const box=el("receptionCreationPanel");
 if(!box)return;
 box.hidden=!canHandle();
 if(!canHandle())return;
 const startInput=el("receptionCheckIn"),endInput=el("receptionCheckOut"),roomInput=el("receptionRoom");
 const today=todayLocal();
 if(!startInput.value)startInput.value=today;
 startInput.min=today;
 endInput.min=datePlusOne(startInput.value);
 if(!endInput.value||endInput.value<=startInput.value)endInput.value=datePlusOne(startInput.value);
 const previous=roomInput.value;
 const options=state.rooms.filter(r=>{
  const type=state.roomTypes.find(t=>t.id===r.room_type_id);
  return r.active&&type?.active&&
    !["maintenance","out_of_service"].includes(r.operational_status)&&
    !(startInput.value===today&&["occupied","cleaning"].includes(r.operational_status))&&
    !stayBlocksRoom(r.id,startInput.value,endInput.value);
 }).sort((a,b)=>String(a.number).localeCompare(String(b.number),"fr"));
 roomInput.innerHTML='<option value="">Sélectionner une chambre</option>'+options.map(r=>{
  const type=state.roomTypes.find(t=>t.id===r.room_type_id);
  return '<option value="'+esc(r.id)+'">'+esc(r.number)+' · '+esc(type?.name||"Chambre")+'</option>';
 }).join("");
 if(options.some(r=>r.id===previous))roomInput.value=previous;
}
function render(){
 const date=todayLocal(),tomorrow=datePlusOne(date);
 const pending=state.requests.filter(r=>r.status==="pending").length;
 el("metricPending").textContent=pending;
 el("metricRooms").textContent=state.rooms.length;
 el("metricAvailable").textContent=state.rooms.filter(r=>r.active&&r.operational_status==="available"&&!stayBlocksRoom(r.id,date,tomorrow)).length;
 el("metricServices").textContent=state.services.length;
 renderRequests();renderDirectBookings();renderStays();renderReceptionOptions();renderRooms();renderRoomTypes();renderRoomMedia();
 renderServices();renderAttendance();renderRFID();if(canManageAccess())renderRoles();if(canManage())renderManagement();if(leadership())renderProperties();
}
async function rememberDesktopRooms(){
 const desktop=window.sevenDesktop;
 if(!desktop||!state.user||!state.hotelId)return;
 // Capture a stable snapshot before any asynchronous storage operations.
 const userId=state.user.id,hotelId=state.hotelId,hotelName=currentHotel()?.name||"Établissement";
 const rooms=state.rooms.map(room=>({
  number:String(room.number||"").slice(0,25),
  floor:String(room.floor||"").slice(0,30),
  status:room.operational_status
 }));
 try{
  const previous=await desktop.readSnapshot();
  const sameAccount=previous?.userId===userId;
  const prior=sameAccount&&Array.isArray(previous.properties)?previous.properties:[];
  const fresh={id:hotelId,name:hotelName,rooms};
  const properties=prior.filter(p=>p.id!==hotelId).concat([fresh]);
  await desktop.saveSnapshot({userId,properties});
 }catch(error){
  // Fail closed: never write plaintext if OS-level encryption is unavailable.
  console.info("Consultation hors ligne non mise à jour :",error?.message);
 }
}
async function loadAll(){
 const hotel=state.hotelId;
 try{
  const [requests,rooms,roomTypes,stays,services,attendance,employees,rfid,media]=await Promise.all([
    fetchFor("seven_booking_requests"),fetchFor("rooms"),
    fetchFor("room_types"),fetchFor("reservations"),
    fetchFor("seven_service_resources"),fetchFor("seven_attendance_register"),
    fetchFor("seven_employees"),fetchFor("seven_rfid_cards"),fetchFor("seven_media")
  ]);
  if(hotel!==state.hotelId)return;
  Object.assign(state,{requests,rooms,roomTypes,stays,services,attendance,employees,rfid,media});
  if(canManageAccess()){
   const r=await sb.from("seven_roles").select("id,user_id,hotel_id,role,full_name,active");
   state.allRoles=r.data||[];
  }
  render();
  if(window.sevenDesktop)window.dispatchEvent(new Event("seven:rfid-context"));
  if(window.sevenDesktop)rememberDesktopRooms();
 }catch(e){
  console.error(e);flash(navigator.onLine?"Certaines données sont indisponibles. Vérifiez vos accès ou réessayez.":"Connexion indisponible : seules les données synchronisées peuvent être consultées.");
 }
}
function readableError(e){
 const names={
  request_not_found:"Réservation introuvable.",
  request_not_pending:"Cette réservation a déjà été traitée.",
  room_not_found_in_hotel:"Cette chambre ne fait pas partie de l'établissement.",
  room_not_ready_today:"Cette chambre n'est pas prête pour une arrivée aujourd'hui.",
  room_out_of_service:"Cette chambre est indisponible (maintenance ou hors service).",
  room_unavailable:"Cette chambre est déjà réservée sur ces dates.",
  invalid_search:"Vérifiez les dates et le nombre de voyageurs.",
  capacity_exceeded:"La capacité de cette chambre est insuffisante.",
  invalid_stay_dates:"Dates de séjour invalides.",
  reservation_not_found:"Séjour introuvable.",
  not_confirmed:"Seule une réservation confirmée peut être enregistrée à l'arrivée.",
  not_checked_in:"Le client n'est pas enregistré comme présent.",
  outside_stay_dates:"L'arrivée doit correspondre aux dates du séjour.",
  room_not_ready:"La chambre doit être prête avant le check-in.",
  cannot_cancel_active_stay:"Un séjour déjà commencé doit être clôturé via check-out.",
  not_authorized:"Vous n'avez pas les autorisations nécessaires.",
  guest_still_checked_in:"La chambre est encore occupée par un client."
 };
 if(e?.code==="23P01")return "Cette chambre a été réservée par quelqu'un d'autre. Actualisez les disponibilités.";
 return names[e?.message]||"Opération impossible. Vérifiez les informations et réessayez.";
}
function openAllocation(id){
 if(!canHandle()||!navigator.onLine){flash("Une connexion est nécessaire pour confirmer les réservations.");return;}
 const req=state.requests.find(r=>r.id===id);
 if(!req||req.status!=="pending"||req.kind!=="stay")return flash("Cette réservation ne peut plus être attribuée.");
 state.allocatingRequestId=id;
 const options=roomOptionsFor(req).sort((a,b)=>String(a.number).localeCompare(String(b.number)));
 const select=el("allocationRoom"),message=el("allocationMessage");
 select.innerHTML='<option value="">Sélectionner une chambre</option>'+options.map(room=>{
  const type=state.roomTypes.find(t=>t.id===room.room_type_id);
  return '<option value="'+esc(room.id)+'">N° '+esc(room.number)+' · '+esc(type?.name||"Chambre")+' · '+esc(money(type?.base_price||0,type?.currency||"USD"))+' / nuit</option>';
 }).join("");
 el("allocationSummary").innerHTML='<strong>'+esc(req.guest_name)+'</strong><div>Du '+esc(req.start_date)+' au '+esc(req.end_date)+' · '+esc(req.guests)+' personne(s)</div><div>'+esc(currentHotel()?.name||"Établissement")+'</div><div>Contact : '+esc(req.guest_phone)+(req.guest_email?' · '+esc(req.guest_email):'')+'</div>';
  el("contactVerified").checked=false;
 message.textContent=options.length?"":"Aucune chambre disponible et adaptée à cette demande. Vérifiez les dates ou l'inventaire.";
 el("confirmAllocation").disabled=!options.length;
 el("allocationDialog").showModal();
}
async function confirmAllocation(e){
 e.preventDefault();
 const id=state.allocatingRequestId,roomId=el("allocationRoom").value;
 if(!id||!roomId||!navigator.onLine)return;
  if(!el("contactVerified").checked){el("allocationMessage").textContent="Veuillez d’abord contacter le client et vérifier les disponibilités.";return;}
 const button=el("confirmAllocation");button.disabled=true;button.textContent="Confirmation…";
 try{
  const res=await sb.rpc("seven_accept_booking_request",{p_request_id:id,p_room_id:roomId});
  if(res.error)throw res.error;
  el("allocationDialog").close();
  flash("Réservation "+(res.data?.reference||"")+" confirmée. La chambre est bloquée sur ces dates.");
  await loadAll();
 }catch(e){
  console.error("Allocation failed",e);
  el("allocationMessage").textContent=readableError(e);
  await loadAll();
 }finally{button.disabled=false;button.textContent="Confirmer la réservation";}
}
async function confirmServiceRequest(id){
 const req=state.requests.find(r=>r.id===id);
 if(!req||req.status!=="pending"||!canHandle())return;
 if(!window.confirm("Avez-vous contacté "+req.guest_name+" et vérifié les détails avant de confirmer ?"))return;
 try{
  const r=await sb.rpc("seven_resolve_service_request",{p_request_id:id,p_approved:true,p_note:null});
  if(r.error)throw r.error;
  flash("Réservation de service confirmée. Prévenez le client des détails.");
  await loadAll();
 }catch(err){console.error("Service confirmation failed",err);flash(readableError(err));}
}
async function declineRequest(id){
 if(!canHandle()||!navigator.onLine)return flash("Connexion nécessaire.");
 const reason=window.prompt("Motif du refus (facultatif) :", "");
 if(reason===null)return;
 try{
  const request=state.requests.find(item=>item.id===id);
   const r=request&&request.kind!=="stay"&&request.kind!=="apartment"
    ?await sb.rpc("seven_resolve_service_request",{p_request_id:id,p_approved:false,p_note:reason||null})
    :await sb.rpc("seven_decline_booking_request",{p_request_id:id,p_reason:reason||null});
  if(r.error)throw r.error;
  flash("Réservation refusée.");await loadAll();
 }catch(e){console.error(e);flash(readableError(e));}
}
async function transitionStay(id,action){
 if(!canHandle()||!navigator.onLine)return flash("Connexion nécessaire.");
 const verbs={check_in:"enregistrer l'arrivée de ce client",check_out:"enregistrer le départ et placer la chambre en nettoyage",cancel:"annuler cette réservation"};
 if(!verbs[action]||!window.confirm("Confirmer : "+verbs[action]+" ?"))return;
 try{
  const r=await sb.rpc("seven_transition_stay",{p_reservation_id:id,p_action:action});
  if(r.error)throw r.error;
  const note={check_in:"Check-in effectué : chambre occupée.",check_out:"Check-out effectué : chambre à nettoyer.",cancel:"Séjour annulé : dates libérées."};
  flash(note[action]||"Séjour mis à jour.");
  await loadAll();
 }catch(e){console.error(e);flash(readableError(e));}
}
async function setRoomStatus(id,status){
 if(!navigator.onLine)return flash("Connexion nécessaire pour changer l'état d'une chambre.");
 if(status==="occupied")return flash("L'occupation est gérée par le check-in.");
 try{
  const r=await sb.from("rooms").update({operational_status:status}).eq("id",id).eq("hotel_id",state.hotelId).select("id").maybeSingle();
  if(r.error)throw r.error;
  if(!r.data)throw new Error("not_authorized");
  flash(status==="available"?"Chambre déclarée prête.":"État de la chambre enregistré.");
  await loadAll();
 }catch(e){console.error(e);flash(readableError(e));await loadAll();}
}

el("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb)return;el("signIn").disabled=true;el("loginMessage").textContent="";try{const r=await sb.auth.signInWithPassword({email:el("email").value.trim(),password:el("password").value});if(r.error)throw r.error;await bootstrap();}catch(err){el("loginMessage").textContent="Connexion impossible : vérifiez vos identifiants."; }finally{el("signIn").disabled=false;}});
el("signOut").addEventListener("click",async()=>{setSidebarOpen(false);window.SevenNotifications.stop();if(window.sevenDesktop)await window.sevenDesktop.clearSnapshot().catch(()=>{});await sb.auth.signOut();state.user=null;state.roles=[];showLogin();});
el("hotelSwitcher").addEventListener("change",async e=>{state.hotelId=e.target.value;el("userRole").textContent=roleNames[currentRole()]||"Personnel";el("serviceForm").hidden=!(state.view==="services"&&canManage());el("roleHotel").value=state.hotelId;el("inviteHotel").value=state.hotelId;roleNav();await loadAll();});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.goto)));
el("selectedBookingsTable").addEventListener("click",e=>{
 const confirmed=e.target.closest("[data-direct-confirm]"),cancelled=e.target.closest("[data-direct-cancel]");
 if(confirmed)decideDirectBooking(confirmed.dataset.directConfirm,"confirm");
 else if(cancelled)decideDirectBooking(cancelled.dataset.directCancel,"cancel");
});
el("requestsTable").addEventListener("click",e=>{
 const assign=e.target.closest("[data-allocate]"),approve=e.target.closest("[data-service-approve]"),decline=e.target.closest("[data-decline]");
 if(assign)openAllocation(assign.dataset.allocate);
 else if(approve)confirmServiceRequest(approve.dataset.serviceApprove);
 else if(decline)declineRequest(decline.dataset.decline);
});
el("staysTable").addEventListener("click",e=>{
 const action=e.target.closest("[data-stay][data-action]");
 if(action)transitionStay(action.dataset.stay,action.dataset.action);
});
el("allocationForm").addEventListener("submit",confirmAllocation);
el("closeAllocation").addEventListener("click",()=>el("allocationDialog").close());
el("allocationDialog").addEventListener("click",e=>{
 if(e.target===el("allocationDialog"))el("allocationDialog").close();
});
el("availabilityDate").addEventListener("change",renderRooms);
el("receptionCheckIn").addEventListener("change",renderReceptionOptions);
el("receptionCheckOut").addEventListener("change",renderReceptionOptions);
el("receptionBookingForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const result=el("receptionBookingResult"),button=el("receptionBookingSubmit");
 if(!canHandle()||!navigator.onLine){result.textContent="Accès refusé ou connexion indisponible.";return;}
 const data=new FormData(e.target);
 const check_in=String(data.get("check_in")||""),check_out=String(data.get("check_out")||"");
 const room_id=String(data.get("room_id")||"");
 const immediate=el("receptionDirectCheckIn").checked;
 if(!state.rooms.some(r=>r.id===room_id)){result.textContent="Sélectionnez une chambre disponible.";return;}
 if(!check_in||!check_out||check_out<=check_in){result.textContent="Les dates sont invalides.";return;}
 if(immediate&&check_in!==todayLocal()){result.textContent="Le check-in immédiat est possible uniquement aujourd’hui.";return;}
 button.disabled=true;result.textContent="Enregistrement de la réservation…";
 try{
  const response=await sb.rpc("create_staff_reservation",{
   p_room_id:room_id,p_check_in:check_in,p_check_out:check_out,
   p_guest_name:String(data.get("guest_name")||"").trim(),
   p_guest_phone:String(data.get("guest_phone")||"").trim(),
   p_guest_email:String(data.get("guest_email")||"").trim()||null,
   p_guests:Number(data.get("guests")||1),p_status:"confirmed",
   p_notes:String(data.get("notes")||"").trim()||null
  });
  if(response.error)throw response.error;
  const booking=Array.isArray(response.data)?response.data[0]:response.data;
  if(!booking?.reservation_id)throw Error("reservation_without_id");
  let message="Réservation "+(booking.reference||"")+" créée et confirmée.";
  if(immediate){
   const transition=await sb.rpc("seven_transition_stay",{p_reservation_id:booking.reservation_id,p_action:"check_in"});
   if(transition.error){
    message+=" Le check-in n’a pas été validé : "+readableError(transition.error)+" Réessayez depuis les séjours.";
   }else message+=" Arrivée du client enregistrée à la réception.";
  }
  e.target.reset();
  await loadAll();
  result.textContent=message;
  flash(message);
 }catch(error){
  console.error("Reception booking failed",error);
  result.textContent=readableError(error);
 }finally{button.disabled=false;}
});

el("roomCreationForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canManage()||!navigator.onLine)return flash("Action réservée à la direction, avec connexion.");
 const d=new FormData(e.target),typeId=String(d.get("room_type_id")),type=state.roomTypes.find(t=>t.id===typeId&&t.active);
 if(!type)return flash("Choisissez une catégorie valide.");
 try{
  const result=await sb.from("rooms").insert({
   hotel_id:state.hotelId,room_type_id:typeId,number:String(d.get("number")).trim(),
   floor:String(d.get("floor")||"").trim()||null,description:String(d.get("description")||"").trim().slice(0,1000)||null,operational_status:"available",active:true
  }).select("id").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new Error("not_authorized");
  const newId=result.data.id;
  e.target.reset();
  await loadAll();
  try{
   const uploaded=await uploadRoomPhotos(newId,d.getAll("photos"));
   if(uploaded)await loadAll();
   flash("Chambre enregistrée"+(uploaded?" avec "+uploaded+" photo(s).":". Ajoutez des photos avant sa publication sur le site."));
  }catch(uploadError){console.error(uploadError);flash("Chambre enregistrée, mais photos non ajoutées : "+readableError(uploadError)+" Ajoutez-les depuis Photos & description.");}
 }catch(err){
  console.error(err);
  flash(err.code==="23505"?"Ce numéro de chambre existe déjà dans cet établissement.":readableError(err));
 }
});
el("roomTypeForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canManage()||!navigator.onLine)return flash("Action réservée à la direction, avec connexion.");
 const d=new FormData(e.target);
 try{
  const result=await sb.from("room_types").insert({
   hotel_id:state.hotelId,name:String(d.get("name")).trim(),
   description:String(d.get("description")||"").trim()||null,
   capacity:Number(d.get("capacity")),base_price:Number(d.get("base_price")),
   currency:String(d.get("currency")),active:true,website_published:false
  }).select("id").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new Error("not_authorized");
  e.target.reset();flash("Catégorie créée : elle restera privée jusqu'à publication.");
  await loadAll();
 }catch(err){console.error(err);flash(readableError(err));}
});

/* Lecteur USB type clavier HID : le numéro est saisi uniquement dans ce champ.
   Le serveur conserve un HMAC, jamais le numéro RFID brut. */
const rfidInput=el("rfidScanInput"),rfidResult=el("rfidScanResult");
el("rfidReaderFocus").addEventListener("click",()=>{
 rfidInput.value="";rfidInput.focus();
 el("rfidReaderHint").textContent="Lecteur actif : présentez la carte sur le S18. Si rien ne s'écrit, testez-le dans le Bloc-notes Windows.";
});
el("rfidScanMode").addEventListener("change",renderRFID);
el("rfidScanForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canHandle()||!navigator.onLine||!state.hotelId){
  rfidResult.textContent="Connexion et autorisation de réception nécessaires.";rfidResult.dataset.result="error";return;
 }
 const uid=rfidInput.value.trim().toUpperCase(),mode=el("rfidScanMode").value;
 if(!/^[A-Z0-9]{6,32}$/.test(uid)){
  rfidResult.textContent="Lecture invalide. Vérifiez le mode clavier USB et le numéro transmis (6 à 32 lettres ou chiffres).";
  rfidResult.dataset.result="error";rfidInput.focus();return;
 }
 const stay=mode==="issue"?state.stays.find(s=>s.id===el("rfidStaySelect").value&&s.hotel_id===state.hotelId&&s.status==="checked_in"):null;
 if(mode==="issue"&&!stay){
  rfidResult.textContent="Sélectionnez un séjour avec check-in effectué.";rfidResult.dataset.result="error";rfidInput.focus();return;
 }
 const btn=el("rfidScanSubmit");btn.disabled=true;
 rfidResult.textContent="Lecture en cours…";rfidResult.dataset.result="pending";
 try{
  const result=mode==="issue"?
   await sb.rpc("seven_rfid_issue",{p_hotel_id:state.hotelId,p_reservation_id:stay.id,p_uid:uid}):
   await sb.rpc("seven_rfid_verify",{p_hotel_id:state.hotelId,p_uid:uid});
  if(result.error)throw result.error;
  const data=result.data||{};
  if(mode==="issue"){
   rfidResult.dataset.result="success";
   rfidResult.textContent="Carte enregistrée pour la chambre "+(state.rooms.find(r=>r.id===stay.room_id)?.number||"")+". Elle sera refusée dès la fin du séjour ou après révocation.";
   await loadAll();
  }else if(data.valid){
   rfidResult.dataset.result="success";
   rfidResult.textContent="Carte reconnue · Chambre "+(data.room_number||"")+" · Séjour "+(data.reference||"")+" · Expire le "+new Date(data.expires_at).toLocaleString("fr-FR")+".";
  }else{
   const reasons={unknown_card:"Carte inconnue",revoked:"Carte révoquée",expired:"Carte expirée",stay_not_active:"Séjour non actif"};
   rfidResult.dataset.result="error";rfidResult.textContent=(reasons[data.reason]||"Carte non autorisée")+" — aucun accès validé.";
  }
 }catch(error){
  const reasons={invalid_card_uid:"Numéro de carte invalide.",not_authorized:"Vous n'avez pas les droits pour gérer les cartes.",reservation_not_found:"Séjour introuvable.",rfid_checkin_required:"Effectuez d'abord le check-in du client.",rfid_stay_ended:"Le séjour est terminé.",rfid_card_already_assigned:"Cette carte est déjà attribuée. Révoquez-la avant de la réutiliser."};
  rfidResult.dataset.result="error";rfidResult.textContent=reasons[error?.message]||"Opération RFID impossible. Vérifiez la connexion et réessayez.";
 }finally{
  rfidInput.value="";btn.disabled=false;
  if(!el("rfidPage").hidden&&state.view==="rfid")rfidInput.focus();
 }
});
el("rfidTable").addEventListener("click",async e=>{
 const btn=e.target.closest("[data-rfid-revoke]");
 if(!btn||!canHandle()||!navigator.onLine)return;
 const card=state.rfid.find(c=>c.id===btn.dataset.rfidRevoke&&c.hotel_id===state.hotelId);
 if(!card||card.revoked_at)return;
 if(!window.confirm("Révoquer cette carte ? Elle ne sera plus reconnue par Seven Gestion."))return;
 btn.disabled=true;
 try{
  const response=await sb.rpc("seven_rfid_revoke",{p_hotel_id:state.hotelId,p_card_id:card.id});
  if(response.error)throw response.error;
  rfidResult.textContent="Carte révoquée dans Seven Gestion.";rfidResult.dataset.result="success";
  await loadAll();
 }catch(error){
  rfidResult.dataset.result="error";rfidResult.textContent="Révocation impossible. Réessayez.";
 }finally{btn.disabled=false;}
});

el("roomsTable").addEventListener("change",e=>{if(e.target.matches("[data-room]"))setRoomStatus(e.target.dataset.room,e.target.value);});
el("roomsTable").addEventListener("click",e=>{
 const b=e.target.closest("[data-room-edit]");if(!b||!canManage())return;
 el("roomPresentationId").value=b.dataset.roomEdit;renderRoomMedia();
 el("roomPresentationPanel").scrollIntoView({behavior:"smooth",block:"start"});
});
el("roomPresentationId").addEventListener("change",renderRoomMedia);
el("roomPresentationForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!canManage()||!navigator.onLine)return flash("Connexion et droits de gérant nécessaires.");
 const id=el("roomPresentationId").value,room=state.rooms.find(r=>r.id===id&&r.hotel_id===state.hotelId);
 if(!room)return flash("Choisissez une chambre.");
 const btn=el("roomPresentationSave");btn.disabled=true;
 try{
  const description=el("roomPresentationDescription").value.trim();
  const update=await sb.from("rooms").update({description:description||null}).eq("id",id).eq("hotel_id",state.hotelId).select("id").single();
  if(update.error)throw update.error;
  const photos=el("roomPresentationPhotos").files;const uploaded=await uploadRoomPhotos(id,photos);
  el("roomPresentationPhotos").value="";
  flash("Présentation enregistrée"+(uploaded?" — "+uploaded+" photo(s) ajoutée(s).":"."));
  await loadAll();
 }catch(error){console.error("Room presentation failed",error);flash(readableError(error)+" Si des photos étaient déjà enregistrées, vérifiez la galerie.");await loadAll();}
 finally{btn.disabled=false;}
});
el("roomPhotoGallery").addEventListener("click",async e=>{
 const b=e.target.closest("[data-photo-delete]");if(!b||!canManage())return;
 const media=state.media.find(m=>m.id===b.dataset.photoDelete&&m.hotel_id===state.hotelId&&m.room_id===el("roomPresentationId").value);
 if(!media||!window.confirm("Supprimer cette photo de la chambre ?"))return;
 try{
  const del=await sb.from("seven_media").delete().eq("id",media.id).eq("hotel_id",state.hotelId);
  if(del.error)throw del.error;
  const storage=await sb.storage.from(ROOM_BUCKET).remove([media.storage_path]);
  if(storage.error)console.warn("Storage cleanup failed",storage.error.message);
  await loadAll();flash("Photo retirée.");
 }catch(error){console.error(error);flash(readableError(error));}
});
el("roomTypesTable").addEventListener("change",async e=>{
 const field=e.target.closest("[data-type-publish]");if(!field||!canManage())return;
 const t=state.roomTypes.find(t=>t.id===field.dataset.typePublish&&t.hotel_id===state.hotelId);
 if(!t)return;
 if(field.checked&&!state.rooms.some(r=>r.active&&r.room_type_id===t.id&&roomMedia(r.id).length>0)){
  field.checked=false;flash("Ajoutez au moins une photo à une chambre de cette catégorie avant de publier.");return;
 }
 field.disabled=true;
 try{
  const res=await sb.from("room_types").update({website_published:field.checked}).eq("id",t.id).eq("hotel_id",state.hotelId).select("id").single();
  if(res.error)throw res.error;
  await loadAll();flash(field.checked?"Catégorie publiée : les chambres photographiées sont visibles aux dates disponibles.":"Catégorie retirée du site.");
 }catch(error){console.error(error);field.checked=!field.checked;flash(readableError(error));}finally{field.disabled=false;}
});
el("serviceForm").addEventListener("submit",async e=>{e.preventDefault();if(!canManage()||!navigator.onLine)return flash("Action impossible hors connexion ou sans autorisation.");const d=new FormData(e.target);const r=await sb.from("seven_service_resources").insert({hotel_id:state.hotelId,name:String(d.get("name")).trim(),kind:String(d.get("kind")),capacity:Number(d.get("capacity")),active:false});if(r.error)return flash(r.error.message);e.target.reset();flash("Espace enregistré, non publié tant que ses informations ne sont pas validées.");await loadAll();});
el("attendanceStatus").addEventListener("change",e=>{
 const work=e.target.value==="present"||e.target.value==="late";
 for(const id of ["attendanceIn","attendanceOut"]){
  const node=el(id);node.disabled=!work;if(!work)node.value="";
 }
});
el("attendanceRegisterForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const result=el("attendanceResult"),button=el("attendanceSubmit");
 if(!canManage()||!navigator.onLine){result.textContent="Seul le gérant ou la direction peut enregistrer la présence.";return;}
 const d=new FormData(e.target),employee_id=String(d.get("employee_id")||"");
 const employee=state.employees.find(x=>x.id===employee_id&&x.hotel_id===state.hotelId);
 if(!employee){result.textContent="Sélectionnez un salarié de cet établissement.";return;}
 const work_date=String(d.get("work_date")||""),status=String(d.get("status")||"");
 const isPresent=status==="present"||status==="late";
 const clock_in=isPresent?String(d.get("clock_in")||"")||null:null;
 const clock_out=isPresent?String(d.get("clock_out")||"")||null:null;
 if(clock_out&&(!clock_in||clock_out<=clock_in)){result.textContent="Heures de présence invalides.";return;}
 button.disabled=true;result.textContent="Enregistrement…";
 try{
  const response=await sb.from("seven_attendance_register").upsert({
   hotel_id:state.hotelId,employee_id,work_date,status,clock_in,clock_out,
   notes:String(d.get("notes")||"").trim()||null,recorded_by:state.user.id
  },{onConflict:"employee_id,work_date"}).select("id").single();
  if(response.error)throw response.error;
  e.target.reset();
  await loadAll();
  result.textContent="Présence enregistrée par le gérant.";
  flash(result.textContent);
 }catch(error){console.error("Attendance error",error);result.textContent=readableError(error);}
 finally{button.disabled=false;}
});
el("accessTable").addEventListener("click",async e=>{
 const btn=e.target.closest("[data-revoke]");
 if(!btn||!canManageAccess()||!navigator.onLine)return;
 const role=(state.allRoles||[]).find(r=>r.id===btn.dataset.revoke);
 if(!role||!canRevokeRole(role))return flash("Vous ne pouvez pas modifier cet accès.");
 const verb=role.active?"désactiver":"réactiver";
 if(!window.confirm("Confirmer : "+verb+" l'accès de "+role.full_name+" ?"))return;
 try{
  const result=await sb.from("seven_roles").update({active:!role.active}).eq("id",role.id).select("id").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new Error("not_authorized");
  flash(role.active?"Accès désactivé.":"Accès réactivé.");
  await loadAll();
 }catch(err){console.error(err);flash(readableError(err));}
});
function bindRoleForm(selectId,hotelWrap,hotel){
 el(selectId).addEventListener("change",()=>configureRoleSelect(selectId,hotelWrap,hotel));
}
bindRoleForm("roleSelect","roleHotelWrap","roleHotel");
bindRoleForm("inviteRole","inviteHotelWrap","inviteHotel");
el("roleForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canManageAccess()||!navigator.onLine)return flash("Accès refusé ou connexion indisponible.");
 const d=new FormData(e.target),user_id=String(d.get("user_id")||"").trim();
 const role=String(d.get("role")||"");
 if(!isValidUUID(user_id))return flash("Identifiant de compte invalide.");
 if(!canAssignRole(role))return flash("Vous ne pouvez pas attribuer ce rôle.");
 const hotel_id=globalRole(role)?null:(leadership()?String(d.get("hotel_id")||state.hotelId):state.hotelId);
 if(!globalRole(role)&&!state.hotels.some(h=>h.id===hotel_id))return flash("Établissement invalide.");
 try{
  const result=await sb.from("seven_roles").insert({
   user_id,role,hotel_id,full_name:String(d.get("full_name")||"").trim()
  }).select("id").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw Error("not_authorized");
  e.target.reset();
  flash("Compte existant rattaché au rôle "+(roleNames[role]||role)+".");
  await loadAll();
  configureRoleSelect("roleSelect","roleHotelWrap","roleHotel");
 }catch(error){console.error(error);flash(error.code==="23505"?"Cet accès existe déjà.":"Attribution impossible : "+readableError(error));}
});
el("staffPasswordVisible").addEventListener("change",e=>{
 el("staffPassword").type=e.target.checked?"text":"password";
});
el("inviteForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const result=el("inviteResult"),button=el("inviteSubmit");
 if(!canManageAccess()||!navigator.onLine){result.textContent="Accès refusé ou connexion indisponible.";return;}
 const data=new FormData(e.target),role=String(data.get("role")||"");
 if(!canAssignRole(role)){result.textContent="Vous ne pouvez pas attribuer ce rôle.";return;}
 const hotel_id=globalRole(role)?null:(leadership()?String(data.get("hotel_id")||""):state.hotelId);
 if(!globalRole(role)&&!state.hotels.some(h=>h.id===hotel_id)){result.textContent="Sélectionnez un établissement valide.";return;}
 const email=String(data.get("email")||"").trim().toLowerCase();
 const full_name=String(data.get("full_name")||"").trim();
 const password=String(data.get("password")||"");
 const job_title=String(data.get("job_title")||"").trim();
 const monthly_salary=Number(data.get("monthly_salary"));
 const salary_currency=String(data.get("salary_currency")||"USD");
 if(!globalRole(role)&&(!job_title||!Number.isFinite(monthly_salary)||monthly_salary<0||!["USD","CDF"].includes(salary_currency))){
  result.textContent="Indiquez le poste, le salaire mensuel et la devise.";return;
 }
 if(!email.includes("@")||full_name.length<2){result.textContent="Nom et adresse e-mail invalides.";return;}
 if(password.length<12||password.length>128||!/[^A-Za-z0-9]/.test(password)||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)||/^\s|\s$/.test(password)){
  result.textContent="Mot de passe : 12 caractères minimum, avec des lettres, des chiffres et un symbole.";return;
 }
 button.disabled=true;result.textContent="Création sécurisée du compte en cours…";
 try{
  const response=await sb.functions.invoke("seven-create-staff",{body:{email,full_name,role,hotel_id,password,job_title,monthly_salary,salary_currency}});
  if(response.error)throw response.error;
  if(!response.data?.ok)throw Error(response.data?.error||"Création impossible");
  result.textContent="Compte "+email+" créé et accès activé. Communiquez les identifiants par un canal privé.";
  e.target.reset();
  el("staffPassword").type="password";
  configureRoleSelect("inviteRole","inviteHotelWrap","inviteHotel");
  await loadAll();
 }catch(error){
  console.error("Seven staff provision failed",error?.message||"unknown");
  result.textContent="Échec de création : ce compte existe peut-être déjà, le mot de passe est invalide ou l'accès est refusé. Aucun e-mail d'invitation n'a été envoyé.";
 }finally{el("staffPassword").value="";button.disabled=false;}
});
el("propertiesGrid").addEventListener("click",async e=>{
 const b=e.target.closest("[data-select-property]");
 if(!b||!leadership())return;
 const hotel=state.hotels.find(x=>x.id===b.dataset.selectProperty);
 if(!hotel)return;
 state.hotelId=hotel.id;populateHotelSelectors();
 el("userRole").textContent=roleNames[currentRole()];
 await loadAll();goto("management");
});
el("propertyEditId").addEventListener("change",updatePropertyEditForm);
el("propertyCreateForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!leadership()||!navigator.onLine)return flash("Cette action est réservée à la direction.");
 const d=new FormData(e.target);
 const slug=String(d.get("slug")||"").trim().toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return flash("Identifiant URL invalide.");
 try{
  const response=await sb.from("hotels").insert({
   slug,name:String(d.get("name")||"").trim(),city:String(d.get("city")||"").trim(),
   address:String(d.get("address")||"").trim()||null,
   phone:String(d.get("phone")||"").trim()||null,
   email:String(d.get("email")||"").trim()||null,
   description:String(d.get("description")||"").trim()||null,active:false
  }).select("id").single();
  if(response.error)throw response.error;
  e.target.reset();
  await refreshHotelRoster(response.data.id);
  await loadAll();
  flash("Nouvel établissement créé. Il reste privé jusqu'à sa publication.");
 }catch(error){
  console.error(error);
  flash(error.code==="23505"?"Cet identifiant d'établissement existe déjà.":"Création refusée : "+readableError(error));
 }
});
el("propertyUpdateForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!leadership()||!navigator.onLine)return flash("Cette action est réservée à la direction.");
 const d=new FormData(e.target);
 const id=String(d.get("id")||"");
 if(!state.hotels.some(h=>h.id===id))return flash("Établissement introuvable.");
 
 try{
  const response=await sb.from("hotels").update({
   name:String(d.get("name")||"").trim(),city:String(d.get("city")||"").trim(),
   address:String(d.get("address")||"").trim()||null,
   description:String(d.get("description")||"").trim()||null,
   active:!!d.get("active")
  }).eq("id",id).select("id").single();
  if(response.error)throw response.error;
  await refreshHotelRoster(id);
  await loadAll();
  flash("Établissement mis à jour.");
 }catch(error){console.error(error);flash("Modification impossible : "+readableError(error));}
});

/* Touch-friendly module drawer; scroll inside menu remains native vertical scrolling. */
const sevenSidebar=el("sevenSidebar"),sevenBackdrop=el("sidebarBackdrop"),sevenMenuButton=el("mobileNav");
const sevenMobile=()=>window.matchMedia("(max-width:750px)").matches;
function setSidebarOpen(open){
 const active=!!open&&sevenMobile()&&!el("appShell").hidden;
 sevenSidebar.classList.toggle("open",active);
 sevenBackdrop.classList.toggle("is-visible",active);
 sevenBackdrop.setAttribute("aria-hidden",String(!active));
 sevenMenuButton.setAttribute("aria-expanded",String(active));
 sevenMenuButton.setAttribute("aria-label",active?"Fermer le menu des modules":"Ouvrir le menu des modules");
 document.body.classList.toggle("seven-drawer-open",active);
}
sevenMenuButton.addEventListener("click",()=>setSidebarOpen(!sevenSidebar.classList.contains("open")));
sevenBackdrop.addEventListener("click",()=>setSidebarOpen(false));
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&sevenSidebar.classList.contains("open")){setSidebarOpen(false);sevenMenuButton.focus();}});
window.addEventListener("resize",()=>{if(!sevenMobile())setSidebarOpen(false);});
let sevenSwipe=null;
document.addEventListener("touchstart",e=>{
 if(!sevenMobile()||!e.touches||e.touches.length!==1||el("appShell").hidden){sevenSwipe=null;return;}
 const p=e.touches[0],open=sevenSidebar.classList.contains("open");
 const insideMenu=sevenSidebar.contains(e.target);
 // From the left edge to open; from inside the menu toward the left to close.
 if((!open&&p.clientX<=32)||(open&&insideMenu)){
   sevenSwipe={x:p.clientX,y:p.clientY,open};
 }else sevenSwipe=null;
},{passive:true});
document.addEventListener("touchend",e=>{
 if(!sevenSwipe||!e.changedTouches||e.changedTouches.length!==1)return;
 const p=e.changedTouches[0],dx=p.clientX-sevenSwipe.x,dy=p.clientY-sevenSwipe.y,wasOpen=sevenSwipe.open;
 sevenSwipe=null;
 if(Math.abs(dy)>Math.abs(dx)*0.75||Math.abs(dx)<65)return; // preserve vertical menu scrolling
 if(!wasOpen&&dx>65)setSidebarOpen(true);
 else if(wasOpen&&dx< -65)setSidebarOpen(false);
},{passive:true});
document.addEventListener("touchcancel",()=>{sevenSwipe=null;},{passive:true});
window.SevenNotifications.init();
window.addEventListener("online",()=>{if(state.user&&state.hotelId)loadAll();});
bootstrap().catch(e=>{console.error(e);showLogin("Service d'authentification indisponible.");});
})();