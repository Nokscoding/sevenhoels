/* Seven Gestion — notifications d'établissement.
 * Uniquement les notifications du compte connecté, avec RLS Supabase.
 * Les alertes système fonctionnent tant que l'application est ouverte ;
 * l'envoi Web Push en arrière-plan n'est pas encore configuré.
 */
(function(){
"use strict";

let client=null,userId=null,hotels=[],onNavigate=()=>{},onFlash=()=>{};
let items=[],unreadTotal=0,channel=null,pollTimer=null,loadInProgress=false,initialized=false;
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);
const supportedViews=new Set(["dashboard","requests","stays","rooms","access","attendance","notifications"]);
const kindIcon={booking_request:"✉",reservation:"✓",room:"▦",access:"♙"};
function relativeTime(date){
  if(!date)return "";
  const d=new Date(date);
  if(!Number.isFinite(d.getTime()))return "";
  return new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(d);
}
function hotelName(id){
  if(!id)return "Seven Hotels";
  return hotels.find(x=>x.id===id)?.name||"Établissement Seven";
}
function oneRow(item){
  const unread=!item.read_at;
  return '<button type="button" role="listitem" class="notification-item'+(unread?' is-unread':'')
    +'" data-notification-id="'+escapeHtml(item.id)+'">'
    +'<span class="notification-icon" aria-hidden="true">'+(kindIcon[item.type]||"•")+'</span>'
    +'<span class="notification-copy"><span class="notification-title">'+escapeHtml(item.title)
    +(unread?'<span class="notification-dot" aria-label="Non lue"></span>':'')+'</span>'
    +'<span class="notification-desc">'+escapeHtml(item.body)+'</span>'
    +'<span class="notification-meta">'+escapeHtml(hotelName(item.hotel_id))
    +' · '+escapeHtml(relativeTime(item.created_at))+'</span></span></button>';
}
function render(){
  const pending=unreadTotal>99?"99+":String(unreadTotal);
  for(const id of ["notificationBellCount","notificationsSideCount"]){
    const badge=$(id);if(!badge)continue;
    badge.hidden=unreadTotal===0;
    badge.textContent=pending;
  }
  const preview=$("notificationPreview"),full=$("notificationFullList");
  if(preview)preview.innerHTML=items.length?items.slice(0,8).map(oneRow).join("")
    :'<div class="notification-empty">Aucune notification pour le moment.</div>';
  if(full)full.innerHTML=items.length?items.map(oneRow).join("")
    :'<div class="notification-empty">Aucune notification pour le moment.</div>';
  const disabled=unreadTotal===0;
  $("markAllPanel").disabled=disabled;
  $("markAllPage").disabled=disabled;
}
function closePanel(){
  $("notificationPanel").hidden=true;
  $("notificationBell").setAttribute("aria-expanded","false");
}
function openPanel(){
  $("notificationPanel").hidden=false;
  $("notificationBell").setAttribute("aria-expanded","true");
  load();
}
function report(message){if(onFlash)onFlash(message);}
async function load(){
  if(!client||!userId||loadInProgress)return;
  loadInProgress=true;
  const expectedUser=userId;
  try{
    const [recent,count]=await Promise.all([
      client.from("notifications")
        .select("id,user_id,hotel_id,title,body,type,link,read_at,created_at")
        .eq("user_id",expectedUser).order("created_at",{ascending:false}).limit(100),
      client.from("notifications")
        .select("id",{head:true,count:"exact"}).eq("user_id",expectedUser).is("read_at",null)
    ]);
    if(recent.error)throw recent.error;
    if(count.error)throw count.error;
    if(userId!==expectedUser)return;
    items=recent.data||[];
    unreadTotal=count.count||0;
    render();
  }catch(e){console.error("Seven notifications fetch failed",e);}
  finally{loadInProgress=false;}
}
async function markRead(id){
  if(!client||!userId)return;
  const entry=items.find(n=>String(n.id)===String(id));
  if(!entry||entry.read_at)return;
  try{
    const response=await client.from("notifications")
      .update({read_at:new Date().toISOString()})
      .eq("id",id).eq("user_id",userId).is("read_at",null)
      .select("id").maybeSingle();
    if(response.error)throw response.error;
    await load();
  }catch(e){console.error(e);report("Impossible de marquer cette notification comme lue.");}
}
async function markAllRead(){
  if(!client||!userId||!unreadTotal)return;
  try{
    const response=await client.from("notifications")
      .update({read_at:new Date().toISOString()})
      .eq("user_id",userId).is("read_at",null);
    if(response.error)throw response.error;
    await load();
  }catch(e){console.error(e);report("Impossible de marquer toutes les notifications comme lues.");}
}
function navigateFrom(item){
  const raw=String(item.link||"");
  const view=raw.startsWith("#")?raw.slice(1):"notifications";
  closePanel();
  onNavigate(supportedViews.has(view)?view:"notifications");
}
async function clickNotification(e){
  const element=e.target.closest("[data-notification-id]");
  if(!element)return;
  const item=items.find(n=>String(n.id)===element.dataset.notificationId);
  if(!item)return;
  await markRead(item.id);
  navigateFrom(item);
}
function systemAlert(row){
  // Pas de faux "push" : l'API Notification nécessite une permission explicite
  // et un navigateur encore ouvert. Aucun service worker n'est utilisé ici.
  if(typeof window.Notification==="undefined"||
     window.Notification.permission!=="granted"||!document.hidden)return;
  try{
    const notification=new window.Notification("Seven · "+String(row.title||"Nouvelle alerte"),{
      body:String(row.body||""),
      tag:"seven-"+String(row.id)
    });
    notification.onclick=()=>{window.focus();navigateFrom(row);notification.close();};
  }catch(error){console.info("Notifications système non disponibles",error);}
}
function stop(){
  if(pollTimer){window.clearInterval(pollTimer);pollTimer=null;}
  if(client&&channel){client.removeChannel(channel).catch(()=>{});channel=null;}
  client=null;userId=null;items=[];unreadTotal=0;
  closePanel();render();
}
async function start({supabase,user,properties,navigate,flash}){
  if(!supabase||!user)return;
  if(userId===user&&client===supabase){
    hotels=properties||[];onNavigate=navigate||(()=>{});onFlash=flash||(()=>{});
    return load();
  }
  stop();
  client=supabase;userId=user;hotels=properties||[];
  onNavigate=navigate||(()=>{});onFlash=flash||(()=>{});
  await load();
  // Le flux Realtime utilise la publication existante supabase_realtime
  // et les politiques RLS qui autorisent uniquement user_id=auth.uid().
  channel=client.channel("seven-notifications-"+userId)
    .on("postgres_changes",{
      event:"INSERT",schema:"public",table:"notifications",
      filter:"user_id=eq."+userId
    },payload=>{
      if(payload.new?.user_id!==userId)return;
      systemAlert(payload.new);
      load();
    })
    .on("postgres_changes",{
      event:"UPDATE",schema:"public",table:"notifications",
      filter:"user_id=eq."+userId
    },()=>load())
    .subscribe();
  // Reprise après coupure ou évènement non livré par le WebSocket.
  pollTimer=window.setInterval(()=>{
    if(document.visibilityState==="visible"&&navigator.onLine)load();
  },60000);
}
async function enableSystemAlerts(){
  if(typeof window.Notification==="undefined"||!window.isSecureContext){
    report("Les alertes système ne sont pas disponibles dans ce navigateur.");
    return;
  }
  try{
    const permission=await window.Notification.requestPermission();
    const button=$("enableBrowserAlerts");
    if(permission==="granted"){
      button.textContent="Alertes navigateur activées";
      report("Les alertes seront affichées si l'ERP reste ouvert dans un autre onglet.");
    }else{
      report("L'autorisation des alertes navigateur n'a pas été accordée.");
    }
  }catch(error){
    console.error(error);
    report("Impossible d'activer les alertes de cet appareil.");
  }
}
function init(){
  if(initialized)return;
  initialized=true;
  $("notificationBell").addEventListener("click",()=>{
    if($("notificationPanel").hidden)openPanel();else closePanel();
  });
  $("closeNotificationPanel").addEventListener("click",closePanel);
  $("openNotificationPage").addEventListener("click",()=>{
    closePanel();onNavigate("notifications");load();
  });
  $("markAllPanel").addEventListener("click",markAllRead);
  $("markAllPage").addEventListener("click",markAllRead);
  $("enableBrowserAlerts").addEventListener("click",enableSystemAlerts);
  $("notificationPreview").addEventListener("click",clickNotification);
  $("notificationFullList").addEventListener("click",clickNotification);
  document.addEventListener("click",e=>{
    if(!$("notificationWidget").contains(e.target))closePanel();
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();});
  window.addEventListener("focus",()=>{if(client&&navigator.onLine)load();});
  window.addEventListener("online",()=>{if(client)load();});
  render();
}
window.SevenNotifications={init,start,stop,load};
})();