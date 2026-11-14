"use strict";
/* One-shot, headless P50 SDK process. Does not use the UI of Seven RFID Studio.
 * CardLock remains a prerequisite; every card mutation needs explicit authorization.
 * Never pass raw SDK data, manufacturer secrets or arbitrary executable paths.
 */
const path=require("node:path");
const fs=require("node:fs/promises");
const {spawn}=require("node:child_process");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
function createRfidNativeController({app,studio,layout,manufacturer71=null,files=fs,spawnProcess=spawn,
 platform=process.platform,resourcesPath=process.resourcesPath,
 pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const root=app.isPackaged?path.join(resourcesPath,"rfid-studio"):path.join(__dirname,"rfid-studio","runtime");
 const executable=path.join(root,"SevenRfidBridge.exe");
 let busy=false,readerReady=false,probing=null;
 async function exists(){try{return (await files.stat(executable)).isFile();}catch{return false;}}
 async function status(){
  const available=platform==="win32"&&await exists();
  const guard=available?await manufacturer71?.guardLegacy?.():null;
  if(guard&&!guard.ok){
   readerReady=false;
   return {supported:true,available,cardLockReady:false,readerReady:false,busy,message:guard.message};
  }
  const service=available?await studio.status():null;
  const cardLockReady=!!service?.servicePort;
  if(!cardLockReady){
   readerReady=false;
   return {supported:platform==="win32",available,cardLockReady:false,readerReady:false,busy};
  }
  // A listening CardLock port alone does not prove that the USB reader is connected.
  // Probe the actual vendor USB initialization without reading or writing a card.
  if(!busy){
   if(!probing){
    const beepOnConnection=!readerReady;
    probing=invoke({operation:"connect",port:"Port1",signal:beepOnConnection})
     .then(result=>{readerReady=result.ok===true;return readerReady;})
     .catch(()=>{readerReady=false;return false;})
     .finally(()=>{probing=null;});
   }
   await probing;
  }
  return {supported:true,available,cardLockReady:true,readerReady,busy};
 }
 async function waitCardLock(){
  const state=await studio.status();
  if(state.servicePort)return true;
  const opened=await studio.openCardLock();
  if(!opened.ok)return false;
  for(let n=0;n<40;n++){
   await pause(250);
   if((await studio.status()).servicePort)return true;
  }
  return false;
 }
 function invoke(data){
  return new Promise((resolve)=>{
   let settled=false,out="",lastStage="",attemptedMutation=false,stderrPartial="";
   const stages={
    "dll":"Chargement des bibliothèques du fabricant",
    "usb":"Initialisation du lecteur USB",
    "id":"Lecture de l'identifiant matériel de la carte",
    "card":"Lecture des données de la carte",
    "readreturned":"Retour de la fonction constructeur ReadCard",
    "readparsed":"Validation des données brutes de la carte",
    "type":"Identification du type de carte (étape générale)",
    "type71":"Identification du type RF57 dans le moteur Seven 71",
    "type50":"Appel GetCardType du SDK P50",
    "typeok":"Type de carte extrait",
    "readok":"Lecture de carte terminée",
    "info":"Préparation des informations de la carte",
    "infook":"Informations de la carte préparées",
    "perform":"Exécution de la requête RFID",
    "emit":"Émission du résultat RFID vers Seven Gestion",
    "emitted":"Résultat RFID envoyé",
    "guestlock":"Décodage de la serrure du badge CLIENT",
    "guestexpiry":"Décodage de la date d'expiration du badge CLIENT",
    "repeat":"Vérification de la même carte",
    "write":"Écriture de la carte CLIENT",
    "erase":"Effacement de la carte CLIENT",
    "verify":"Relecture après programmation",
    "close":"Fermeture de la connexion USB"
   };
   const done=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
   let child;
   try{child=spawnProcess(executable,[],{cwd:root,windowsHide:true,shell:false,stdio:["pipe","pipe","pipe"]});}
   catch{return resolve({ok:false,message:"Démarrage du moteur natif impossible."});}
   const timer=setTimeout(()=>{try{child.kill();}catch{}done({ok:false,message:"Le lecteur ne répond plus ; opération interrompue."});},30000);
   child.once("error",()=>done({ok:false,message:"Le moteur natif ne démarre pas."}));
   child.stderr?.on("data",chunk=>{
    // stderr chunks may split one marker in two; never lose a diagnostic
    // milestone because of transport chunk boundaries.
    stderrPartial+=chunk.toString("utf8");
    if(stderrPartial.length>2500)stderrPartial=stderrPartial.slice(-1200);
    const lines=stderrPartial.split(/\r?\n/);
    stderrPartial=lines.pop()||"";
    for(const line of lines){
     const found=/^SEVEN_STAGE:([a-z0-9]+)$/.exec(line.trim());
     if(found && Object.hasOwn(stages,found[1])){
      lastStage=found[1];
      if(found[1]==="write"||found[1]==="erase")attemptedMutation=true;
     }
    }
   });
   child.stdout.on("data",data=>{
    out+=data.toString("utf8");
    if(out.length>15000){try{child.kill();}catch{}done({ok:false,message:"Réponse RFID trop volumineuse."});}
   });
   child.once("close",(exitCode,signal)=>{
    if(settled)return;
    try{
     // The OEM DLL can write its own diagnostic text to stdout. Only
     // accept a complete JSON object emitted by the native bridge.
     const lines=out.trim().split(/\r?\n/);
     let parsed=null;
     for(let i=lines.length-1;i>=0;i--){
      const candidate=lines[i].trim();
      if(!candidate.startsWith("{")||!candidate.endsWith("}"))continue;
      try{
       const value=JSON.parse(candidate);
       if(value&&typeof value==="object"&&typeof value.ok==="boolean"){
        parsed=value;break;
       }
      }catch{}
     }
     if(!parsed)throw Error("Bridge response missing");
     done({
      ok:parsed.ok,code:Number.isInteger(parsed.code)?parsed.code:-1,
      type:String(parsed.type||"").slice(0,2),sequence:String(parsed.sequence||"").slice(0,16),
      lockNo:String(parsed.lockNo||"").slice(0,12),expiry:String(parsed.expiry||"").slice(0,20),
      verified:parsed.verified===true,decoded:parsed.decoded===true,
      bridgeBuild:String(parsed.bridgeBuild||"").slice(0,32),
      message:String(parsed.message||"Réponse du SDK reçue.").slice(0,240)
     });
    }catch{
     const stage=stages[lastStage]||"Démarrage du moteur RFID";
     const code=Number.isInteger(exitCode)?" (Windows 0x"+(exitCode>>>0).toString(16).toUpperCase()+")":signal?" (processus interrompu)":"";
     const followup=attemptedMutation
      ?" Une opération d'écriture ou d'effacement a été lancée : retirez la carte et relisez-la avant toute nouvelle tentative."
      :" Aucune écriture signalée pendant cette lecture. La réponse des données n'a pas été reçue.";
     const reason=exitCode===0&&out.trim()===""
      ?"Le moteur s'est fermé sans transmettre le résultat après : "
      :out.trim()!==""?"La réponse native n'est pas au format attendu après : "
      :"Moteur RFID interrompu pendant : ";
     const seen=out.trim()!==""?" (sortie reçue mais non décodable)":" (aucune sortie de résultat)";
     done({ok:false,stage:lastStage||"unknown",
      message:reason+stage+code+seen+". Moteur Seven 1.0.12."+followup});
    }
   });
   const json=JSON.stringify(data);
   child.stdin.on("error",()=>{});
   child.stdin.end(json+"\n","utf8");
  });
 }
 async function execute(input){
  if(platform!=="win32")return {ok:false,message:"Fonction RFID disponible uniquement sur Seven Gestion Windows."};
  if(busy)return {ok:false,message:"Une opération RFID est déjà en cours."};
  if(!input||typeof input!=="object"||!["read","issue","erase"].includes(input.operation))
   return {ok:false,message:"Opération RFID inconnue."};
  if(!UUID.test(String(input.hotelId||""))||!UUID.test(String(input.userId||"")))
   return {ok:false,message:"Hôtel ou utilisateur invalide."};
  if(input.operation!=="read"&&(input.operation==="issue"&&!UUID.test(String(input.roomId||""))||input.confirmAuthorization!==true))
   return {ok:false,message:"Sélectionnez une chambre et confirmez l’opération avant de continuer."};
  if(input.operation==="issue"){
   if(!DATE.test(input.expiresAt)||!Number.isInteger(input.cardNo)||input.cardNo<0||input.cardNo>15||
    !Number.isInteger(input.dai)||input.dai<0||input.dai>255)
    return {ok:false,message:"Date, numéro de badge ou paramètres du fabricant invalides."};
  }
  busy=true;
  try{
   // Never let a USB connection check overlap with a physical card operation.
   if(probing)await probing;
   if(!await exists())return {ok:false,message:"Moteur RFID intégré absent. Installer la version Windows à jour."};
   const profile=await layout.getReaderProfile?.({userId:input.userId,hotelId:input.hotelId})||null;
   // RF57 (T5557) uses the proUSB V9 SDK family. The bridge performs
   // its own physical RF57 card check before *any* mutation.
   const legacy=profile?.driver==="pro-usb-v9";
   let verifiedVendorDirectory="";

   if(legacy&&(
       profile.cardType!=="57"||!/^[0-9]{1,8}$/.test(profile.encoderNo||"")||
       !/^proUSB-V9-[0-9]{8}$/i.test(profile.dllVersion||"")))
    return {ok:false,message:"Le profil du lecteur Seven 71 est incomplet ou ne correspond pas aux cartes RF57."};
   if(legacy){
    // The 71 has a distinct proUSB V9.27C executable even though both
    // manufacturer programs are named CardLock.Exe. Never accept the
    // Seven 47 process as initialization for this encoder.
    if(!manufacturer71)return {ok:false,message:"Module de lancement proUSB V9.27C de Seven 71 absent."};
    const vendor=await manufacturer71.ensureRunning({userId:input.userId,hotelId:input.hotelId});
    if(!vendor.ok)return {ok:false,message:vendor.message||"Ouvrez le logiciel proUSB V9.27C du Seven 71."};
    const active=await manufacturer71.state({userId:input.userId,hotelId:input.hotelId});
    if(!active.ok||!active.running||!active.path||!path.win32.isAbsolute(active.path))
     return {ok:false,message:active.message||"L'installation CardLock Seven 71 n'est pas vérifiée sur ce poste."};
    // This path comes only from the hash-verified, running manufacturer launcher,
    // never directly from the HTML renderer.
    verifiedVendorDirectory=path.win32.dirname(active.path);
   }else {
    const exclusive=await manufacturer71?.guardLegacy?.();
    if(exclusive&&!exclusive.ok)return {ok:false,message:exclusive.message};
    if(!await waitCardLock())return {ok:false,message:"CardLock doit rester ouvert avant de lire ou encoder."};
   }
   const vendorHotelId=await layout.getVendorId({userId:input.userId,hotelId:input.hotelId});
   if(input.operation!=="read"&&!vendorHotelId)
    return {ok:false,message:"Configurer d'abord l'identifiant fabricant de cet hôtel."};
   let lockNo="";
   if(input.operation==="issue"){
    const entries=await layout.get({userId:input.userId,hotelId:input.hotelId});
    const found=entries.find(row=>row.roomId===input.roomId);
    if(!found)return {ok:false,message:"Associez d'abord la chambre à sa serrure."};
    lockNo=found.lockNo;
   }
   return await invoke({operation:input.operation,port:profile?.port|| (input.port==="Port2"?"Port2":"Port1"),
    readerFamily:legacy?"rf57":"p50",cardType:legacy?"57":"",
    vendorDirectory:legacy?verifiedVendorDirectory:"",
    hotelId:vendorHotelId||0,lockNo,
    cardNo:input.operation==="issue"?input.cardNo:0,
    dai:input.operation==="issue"?input.dai:1,
    expiresAt:input.operation==="issue"?input.expiresAt:"",
    confirmAuthorization:input.confirmAuthorization===true});
  }catch(error){
   return {ok:false,message:"Lecteur indisponible : "+String(error?.message||"erreur locale").slice(0,150)};
  }finally{busy=false;}
 }
 return {status,execute};
}
module.exports={createRfidNativeController};