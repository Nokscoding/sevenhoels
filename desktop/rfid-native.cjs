"use strict";
/* One-shot, headless P50 SDK process. Does not use the UI of Seven RFID Studio.
 * CardLock remains a prerequisite; all card mutations are confirmed test operations.
 * Never pass raw SDK data, manufacturer secrets or arbitrary executable paths.
 */
const path=require("node:path");
const fs=require("node:fs/promises");
const {spawn}=require("node:child_process");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
function createRfidNativeController({app,studio,layout,files=fs,spawnProcess=spawn,
 platform=process.platform,resourcesPath=process.resourcesPath,
 pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const root=app.isPackaged?path.join(resourcesPath,"rfid-studio"):path.join(__dirname,"rfid-studio","runtime");
 const executable=path.join(root,"SevenRfidBridge.exe");
 let busy=false;
 async function exists(){try{return (await files.stat(executable)).isFile();}catch{return false;}}
 async function status(){
  const s=await studio.status();
  return {supported:platform==="win32",available:platform==="win32"&&await exists(),
   cardLockReady:!!s.servicePort,busy};
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
   let settled=false,out="";
   const done=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
   let child;
   try{child=spawnProcess(executable,[],{cwd:root,windowsHide:true,shell:false,stdio:["pipe","pipe","ignore"]});}
   catch{return resolve({ok:false,message:"Démarrage du moteur natif impossible."});}
   const timer=setTimeout(()=>{try{child.kill();}catch{}done({ok:false,message:"Le lecteur ne répond plus ; opération interrompue."});},30000);
   child.once("error",()=>done({ok:false,message:"Le moteur natif ne démarre pas."}));
   child.stdout.on("data",data=>{
    out+=data.toString("utf8");
    if(out.length>15000){try{child.kill();}catch{}done({ok:false,message:"Réponse RFID trop volumineuse."});}
   });
   child.once("close",()=>{
    if(settled)return;
    try{
     const parsed=JSON.parse(out.trim());
     if(!parsed||typeof parsed!=="object"||typeof parsed.ok!=="boolean")
      throw Error("Invalid bridge response");
     done({
      ok:parsed.ok,code:Number.isInteger(parsed.code)?parsed.code:-1,
      type:String(parsed.type||"").slice(0,2),sequence:String(parsed.sequence||"").slice(0,16),
      lockNo:String(parsed.lockNo||"").slice(0,12),expiry:String(parsed.expiry||"").slice(0,20),
      verified:parsed.verified===true,decoded:parsed.decoded===true,
      message:String(parsed.message||"Réponse du SDK reçue.").slice(0,240)
     });
    }catch{done({ok:false,message:"Réponse native illisible. Vérifier les DLL du fabricant."});}
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
  if(input.operation!=="read"&&(!UUID.test(String(input.roomId||""))||input.confirmTest!==true))
   return {ok:false,message:"Chambre et confirmation de badge de test obligatoires."};
  if(input.operation==="issue"){
   if(!DATE.test(input.expiresAt)||!Number.isInteger(input.cardNo)||input.cardNo<0||input.cardNo>15||
    !Number.isInteger(input.dai)||input.dai<0||input.dai>255)
    return {ok:false,message:"Date, numéro de badge ou paramètres du fabricant invalides."};
  }
  busy=true;
  try{
   if(!await exists())return {ok:false,message:"Moteur RFID intégré absent. Installer la version Windows à jour."};
   if(!await waitCardLock())return {ok:false,message:"CardLock doit rester ouvert avant de lire ou encoder."};
   const vendorHotelId=await layout.getVendorId({userId:input.userId,hotelId:input.hotelId});
   if(input.operation!=="read"&&!vendorHotelId)
    return {ok:false,message:"Configurer d'abord l'identifiant fabricant de cet hôtel."};
   let lockNo="";
   if(input.operation!=="read"){
    const entries=await layout.get({userId:input.userId,hotelId:input.hotelId});
    const found=entries.find(row=>row.roomId===input.roomId);
    if(!found)return {ok:false,message:"Associez d'abord la chambre à sa serrure."};
    lockNo=found.lockNo;
   }
   return await invoke({operation:input.operation,port:input.port==="Port2"?"Port2":"Port1",
    hotelId:vendorHotelId||0,lockNo,
    cardNo:input.operation==="issue"?input.cardNo:0,
    dai:input.operation==="issue"?input.dai:1,
    expiresAt:input.operation==="issue"?input.expiresAt:"",
    confirmTest:input.confirmTest===true});
  }catch(error){
   return {ok:false,message:"Lecteur indisponible : "+String(error?.message||"erreur locale").slice(0,150)};
  }finally{busy=false;}
 }
 return {status,execute};
}
module.exports={createRfidNativeController};