(function(){"use strict";
const cfg=window.SEVEN_CONFIG||{},sb=(cfg.url&&cfg.publishableKey&&window.supabase)?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
const state={user:null,roles:[],hotels:[],hotelId:"",view:"dashboard",requests:[],rooms:[],roomTypes:[],stays:[],services:[],attendance:[],rfid:[],allocatingRequestId:null};
const el=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const names={dashboard:["Vue d'ensemble","Toutes les informations essentielles de votre établissement."],requests:["Demandes de réservation","Suivez et traitez les demandes de vos visiteurs."],stays:["Séjours & arrivées","Gérez les confirmations, arrivées et départs des clients."],rooms:["Gestion des chambres","Suivez la disponibilité opérationnelle des chambres."],services:["Espaces et services","Gérez les salles, restaurants et installations."],attendance:["Présences","Enregistrez les entrées et sorties de votre équipe."],access:["Accès et permissions","Contrôlez les autorisations par établissement."],notifications:["Notifications","Suivez les événements importants de vos établissements."],management:["Espace responsables","Pilotage des équipes, de l’hôtel et des opérations."],properties:["Établissements","Gérez les hôtels et appartements de la chaîne Seven."],rfid:["Cartes RFID","Registre et préparation de la gestion des accès."]};
const statusNames={pending:"En attente",confirmed:"Confirmée",checked_in:"Occupée",checked_out:"Terminé",no_show:"Non-présenté",approved:"Approuvée",declined:"Refusée",cancelled:"Annulée",available:"Disponible",occupied:"Occupée",cleaning:"Nettoyage",maintenance:"Maintenance",out_of_service:"Hors service"};
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
function goto(view){if((view==="management"&&!canManage())||(view==="access"&&!canManageAccess())||(view==="properties"&&!leadership()))return;if(view==="requests"&&!canHandle())return;if(view==="stays"&&!(canHandle()||currentRole()==="accountant"))view="rooms";state.view=view;document.querySelectorAll(".page").forEach(n=>n.classList.toggle("active",n.id===view+"Page"));document.querySelectorAll(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));el("pageTitle").textContent=names[view][0];el("pageDescription").textContent=names[view][1];el("breadcrumb").textContent=names[view][0].toUpperCase();el("serviceForm").hidden=!(view==="services"&&canManage());document.querySelector(".sidebar").classList.remove("open");}
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
    action='<div class="inline-actions">'+(r.kind==="stay"?'<button type="button" class="action-button action-primary" data-allocate="'+esc(r.id)+'">Attribuer chambre</button>':'<span class="hint">À organiser</span>')+'<button type="button" class="action-button action-danger" data-decline="'+esc(r.id)+'">Refuser</button></div>';
  } else if(r.reservation_id){
    const stay=state.stays.find(s=>s.id===r.reservation_id);
    action='<span class="reservation-ref">'+esc(stay?.reference||"Séjour lié")+'</span>';
  }
  return '<tr><td>'+esc(r.guest_name)+'</td><td>'+esc(({stay:"Chambre",apartment:"Appartement",restaurant:"Restaurant",event:"Événement",fitness:"Sport & bien-être"})[r.kind]||r.kind)+'</td><td>'+esc(r.guest_phone)+'</td><td>'+esc(r.guests)+'</td><td>'+esc(r.start_date)+(r.end_date?' → '+esc(r.end_date):'')+'</td><td>'+pill(r.status)+'</td><td>'+action+'</td></tr>';
 });
 el("requestsTable").innerHTML=table(["Client","Type","Téléphone","Pers.","Dates","Statut","Décision"],rows);
 el("recentRequests").innerHTML=table(["Client","Type","Date","Statut"],state.requests.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5).map(r=>'<tr><td>'+esc(r.guest_name)+'</td><td>'+esc(r.kind)+'</td><td>'+esc(r.start_date)+'</td><td>'+pill(r.status)+'</td></tr>'));
 el("requestCount").textContent=state.requests.filter(r=>r.status==="pending").length;
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
  return '<tr><td>'+esc(r.number)+'</td><td>'+esc(type?.name||"—")+'</td><td>'+esc(r.floor||"—")+'</td><td>'+pill(r.operational_status)+'</td><td>'+planning+'</td><td>'+action+'</td></tr>';
 });
 el("roomsTable").innerHTML=table(["N°","Catégorie","Étage","État réel","Planning au "+date,"Action"],rows);
}
function datePlusOne(date){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function money(amount,currency){try{return new Intl.NumberFormat("fr-FR",{style:"currency",currency:currency||"USD"}).format(Number(amount));}catch{return String(amount)+" "+(currency||"");}}
function renderRoomTypes(){
 el("roomTypePanel").hidden=!canManage();
 el("roomCreationPanel").hidden=!canManage();
 const options=state.roomTypes.filter(t=>t.active).map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("");
 el("roomCreationType").innerHTML='<option value="">Choisir une catégorie</option>'+options;
 el("roomTypesTable").innerHTML=table(["Catégorie","Capacité","Tarif / nuit","Publication"],state.roomTypes.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.capacity)+'</td><td>'+esc(money(t.base_price,t.currency))+'</td><td>'+(t.website_published?"Publiée":"Privée")+'</td></tr>'));
}

function renderServices(){el("servicesTable").innerHTML=table(["Service","Type","Capacité","Publication"],state.services.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(r.kind)+'</td><td>'+esc(r.capacity)+'</td><td>'+ (r.active?"Visible":"Non publié") +'</td></tr>'));}

function renderAttendance(){
 const rows=state.attendance.slice().sort((a,b)=>new Date(b.clock_in)-new Date(a.clock_in)).map(r=>{
  const employee=(state.allRoles||[]).find(x=>x.user_id===r.user_id&&x.hotel_id===state.hotelId);
  const person=employee?.full_name||(r.user_id===state.user?.id?"Mon pointage":"Employé");
  return '<tr><td>'+esc(person)+'</td><td>'+esc(dateDisplay(r.clock_in))+' '+esc(new Date(r.clock_in).toLocaleTimeString("fr-FR"))+'</td><td>'+(r.clock_out?esc(new Date(r.clock_out).toLocaleTimeString("fr-FR")):"—")+'</td><td>'+(r.clock_out?"Terminé":"Présent")+'</td></tr>';
 });
 el("attendanceTable").innerHTML=table(["Employé","Entrée","Sortie","État"],rows);
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

function renderRFID(){el("rfidTable").innerHTML=table(["Chambre","Carte (empreinte)","Délivrée","Révoquée"],state.rfid.map(r=>'<tr><td>'+esc((state.rooms.find(x=>x.id===r.room_id)||{}).number||"—")+'</td><td>'+esc(r.card_uid_hash.substring(0,10))+'…</td><td>'+dateDisplay(r.issued_at)+'</td><td>'+(r.revoked_at?"Oui":"Non")+'</td></tr>'));}

function renderManagement(){
 const hotel=currentHotel();
 el("managementPropertyTitle").textContent=hotel?.name||"Espace responsables";
 el("managementPropertyName").textContent=hotel?.name||"cet établissement";
 el("managementRole").textContent=roleNames[currentRole()]||"Responsable";
 const date=todayLocal();
 const staff=(state.allRoles||[]).filter(r=>r.active&&(r.hotel_id===state.hotelId));
 const pending=state.requests.filter(r=>r.status==="pending").length;
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

function render(){
 const date=todayLocal(),tomorrow=datePlusOne(date);
 const pending=state.requests.filter(r=>r.status==="pending").length;
 el("metricPending").textContent=pending;
 el("metricRooms").textContent=state.rooms.length;
 el("metricAvailable").textContent=state.rooms.filter(r=>r.active&&r.operational_status==="available"&&!stayBlocksRoom(r.id,date,tomorrow)).length;
 el("metricServices").textContent=state.services.length;
 renderRequests();renderStays();renderRooms();renderRoomTypes();
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
  const [requests,rooms,roomTypes,stays,services,attendance,rfid]=await Promise.all([
    fetchFor("seven_booking_requests"),fetchFor("rooms"),
    fetchFor("room_types"),fetchFor("reservations"),
    fetchFor("seven_service_resources"),fetchFor("seven_attendance"),
    fetchFor("seven_rfid_cards")
  ]);
  if(hotel!==state.hotelId)return;
  Object.assign(state,{requests,rooms,roomTypes,stays,services,attendance,rfid});
  if(canManageAccess()){
   const r=await sb.from("seven_roles").select("id,user_id,hotel_id,role,full_name,active");
   state.allRoles=r.data||[];
  }
  render();
  if(window.sevenDesktop)rememberDesktopRooms();
 }catch(e){
  console.error(e);flash(navigator.onLine?"Certaines données sont indisponibles. Vérifiez vos accès ou réessayez.":"Connexion indisponible : seules les données synchronisées peuvent être consultées.");
 }
}
function readableError(e){
 const names={
  request_not_found:"Demande introuvable.",
  request_not_pending:"Cette demande a déjà été traitée.",
  room_not_found_in_hotel:"Cette chambre ne fait pas partie de l'établissement.",
  room_not_ready_today:"Cette chambre n'est pas prête pour une arrivée aujourd'hui.",
  room_out_of_service:"Cette chambre est indisponible (maintenance ou hors service).",
  room_unavailable:"Cette chambre est déjà réservée sur ces dates.",
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
 if(!req||req.status!=="pending"||req.kind!=="stay")return flash("Cette demande ne peut plus être attribuée.");
 state.allocatingRequestId=id;
 const options=roomOptionsFor(req).sort((a,b)=>String(a.number).localeCompare(String(b.number)));
 const select=el("allocationRoom"),message=el("allocationMessage");
 select.innerHTML='<option value="">Sélectionner une chambre</option>'+options.map(room=>{
  const type=state.roomTypes.find(t=>t.id===room.room_type_id);
  return '<option value="'+esc(room.id)+'">N° '+esc(room.number)+' · '+esc(type?.name||"Chambre")+' · '+esc(money(type?.base_price||0,type?.currency||"USD"))+' / nuit</option>';
 }).join("");
 el("allocationSummary").innerHTML='<strong>'+esc(req.guest_name)+'</strong><div>Du '+esc(req.start_date)+' au '+esc(req.end_date)+' · '+esc(req.guests)+' personne(s)</div><div>'+esc(currentHotel()?.name||"Établissement")+'</div>';
 message.textContent=options.length?"":"Aucune chambre disponible et adaptée à cette demande. Vérifiez les dates ou l'inventaire.";
 el("confirmAllocation").disabled=!options.length;
 el("allocationDialog").showModal();
}
async function confirmAllocation(e){
 e.preventDefault();
 const id=state.allocatingRequestId,roomId=el("allocationRoom").value;
 if(!id||!roomId||!navigator.onLine)return;
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
async function declineRequest(id){
 if(!canHandle()||!navigator.onLine)return flash("Connexion nécessaire.");
 const reason=window.prompt("Motif du refus (facultatif) :", "");
 if(reason===null)return;
 try{
  const r=await sb.rpc("seven_decline_booking_request",{p_request_id:id,p_reason:reason||null});
  if(r.error)throw r.error;
  flash("Demande refusée.");await loadAll();
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
el("signOut").addEventListener("click",async()=>{window.SevenNotifications.stop();if(window.sevenDesktop)await window.sevenDesktop.clearSnapshot().catch(()=>{});await sb.auth.signOut();state.user=null;state.roles=[];showLogin();});
el("hotelSwitcher").addEventListener("change",async e=>{state.hotelId=e.target.value;el("userRole").textContent=roleNames[currentRole()]||"Personnel";el("serviceForm").hidden=!(state.view==="services"&&canManage());el("roleHotel").value=state.hotelId;el("inviteHotel").value=state.hotelId;roleNav();await loadAll();});
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.view)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>goto(b.dataset.goto)));
el("requestsTable").addEventListener("click",e=>{
 const assign=e.target.closest("[data-allocate]"),decline=e.target.closest("[data-decline]");
 if(assign)openAllocation(assign.dataset.allocate);
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
el("roomCreationForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canManage()||!navigator.onLine)return flash("Action réservée à la direction, avec connexion.");
 const d=new FormData(e.target),typeId=String(d.get("room_type_id")),type=state.roomTypes.find(t=>t.id===typeId&&t.active);
 if(!type)return flash("Choisissez une catégorie valide.");
 try{
  const result=await sb.from("rooms").insert({
   hotel_id:state.hotelId,room_type_id:typeId,number:String(d.get("number")).trim(),
   floor:String(d.get("floor")||"").trim()||null,operational_status:"available",active:true
  }).select("id").maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)throw new Error("not_authorized");
  e.target.reset();flash("La chambre a été ajoutée à votre établissement.");
  await loadAll();
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
el("roomsTable").addEventListener("change",e=>{if(e.target.matches("[data-room]"))setRoomStatus(e.target.dataset.room,e.target.value);});
el("serviceForm").addEventListener("submit",async e=>{e.preventDefault();if(!canManage()||!navigator.onLine)return flash("Action impossible hors connexion ou sans autorisation.");const d=new FormData(e.target);const r=await sb.from("seven_service_resources").insert({hotel_id:state.hotelId,name:String(d.get("name")).trim(),kind:String(d.get("kind")),capacity:Number(d.get("capacity")),active:false});if(r.error)return flash(r.error.message);e.target.reset();flash("Espace enregistré, non publié tant que ses informations ne sont pas validées.");await loadAll();});
el("clockIn").addEventListener("click",async()=>{if(!navigator.onLine)return flash("Pointage indisponible hors connexion pour le moment.");if(state.attendance.some(r=>r.user_id===state.user.id&&!r.clock_out))return flash("Vous avez déjà une présence en cours.");const r=await sb.from("seven_attendance").insert({user_id:state.user.id,hotel_id:state.hotelId});if(r.error)flash(r.error.message);else{flash("Entrée enregistrée.");await loadAll();}});
el("clockOut").addEventListener("click",async()=>{if(!navigator.onLine)return flash("Pointage indisponible hors connexion pour le moment.");const shift=state.attendance.find(r=>r.user_id===state.user.id&&!r.clock_out);if(!shift)return flash("Aucune présence en cours.");const r=await sb.from("seven_attendance").update({clock_out:new Date().toISOString()}).eq("id",shift.id).eq("user_id",state.user.id);if(r.error)flash(r.error.message);else{flash("Sortie enregistrée.");await loadAll();}});
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
el("inviteForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!canManageAccess()||!navigator.onLine)return flash("Accès refusé ou connexion indisponible.");
 const data=new FormData(e.target);
 const role=String(data.get("role")||"");
 if(!canAssignRole(role))return flash("Vous n'avez pas le droit d'attribuer ce rôle.");
 const hotel_id=globalRole(role)?null:(leadership()?String(data.get("hotel_id")||""):state.hotelId);
 if(!globalRole(role)&&!state.hotels.some(h=>h.id===hotel_id))return flash("Établissement invalide.");
 const email=String(data.get("email")||"").trim().toLowerCase();
 const full_name=String(data.get("full_name")||"").trim();
 if(!email.includes("@")||full_name.length<2)return flash("Renseignez un nom et une adresse e-mail valides.");
 const button=el("inviteSubmit"),result=el("inviteResult");
 button.disabled=true;result.textContent="Envoi de l'invitation en cours…";
 try{
  const response=await sb.functions.invoke("seven-invite-staff",{
   body:{email,full_name,role,hotel_id}
  });
  if(response.error)throw response.error;
  if(!response.data?.ok)throw Error(response.data?.error||"Invitation non créée");
  result.textContent="Invitation envoyée à "+email+". Le collaborateur devra activer son compte.";
  e.target.reset();
  configureRoleSelect("inviteRole","inviteHotelWrap","inviteHotel");
  await loadAll();
 }catch(error){
  console.error("Seven invitation failed",error);
  result.textContent="Invitation impossible. Vérifiez l'autorisation du compte, le paramétrage des e-mails Supabase et l'adresse fournie.";
 }finally{button.disabled=false;}
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

el("mobileNav").addEventListener("click",()=>document.querySelector(".sidebar").classList.toggle("open"));
window.SevenNotifications.init();
window.addEventListener("online",()=>{if(state.user&&state.hotelId)loadAll();});
bootstrap().catch(e=>{console.error(e);showLogin("Service d'authentification indisponible.");});
})();