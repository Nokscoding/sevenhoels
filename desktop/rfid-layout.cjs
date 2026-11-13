"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCK=/^[0-9A-F]{6}$/;

function cleanId(id) {
 if(typeof id!=="string"||!UUID.test(id))throw Error("Identifiant hôtel, utilisateur ou chambre invalide.");
 return id.toLowerCase();
}
function cleanLabel(text,max=60){
 const value=String(text||"").trim();
 if(!value||value.length>max||/[\u0000-\u001f]/.test(value))throw Error("Bâtiment ou étage invalide.");
 return value;
}
function createRfidLayoutStore({app,safeStorage,files=fs}){
 const location=path.join(app.getPath("userData"),"seven-rfid-lock-layout.enc");
 let writes=Promise.resolve();
 async function readAll(){
  if(!safeStorage.isAsyncEncryptionAvailable())throw Error("Le stockage chiffré Windows est indisponible.");
  try{
   const encrypted=await files.readFile(location);
   if(encrypted.length>250000)throw Error("Configuration RFID trop volumineuse.");
   const decrypted=await safeStorage.decryptStringAsync(encrypted);
   const data=JSON.parse(decrypted.result);
   if(data?.version!==1||!data.entries||typeof data.entries!=="object"||Array.isArray(data.entries))
     throw Error("Configuration RFID incompatible.");
   return data;
  }catch(error){
   if(error?.code==="ENOENT")return {version:1,entries:{}};
   throw error;
  }
 }
 const key=(userId,hotelId)=>cleanId(userId)+":"+cleanId(hotelId);
 async function get({userId,hotelId}){
  const data=await readAll();
  const rows=data.entries[key(userId,hotelId)]||{};
  return Object.entries(rows).map(([roomId,entry])=>({
   roomId,building:entry.building,floor:entry.floor,lockNo:entry.lockNo
  }));
 }
 async function put({userId,hotelId,roomId,building,floor,lockNo}){
  const record={roomId:cleanId(roomId),building:cleanLabel(building),floor:cleanLabel(floor,30),
    lockNo:String(lockNo||"").trim().toUpperCase()};
  if(!LOCK.test(record.lockNo))throw Error("Le numéro interne de serrure doit contenir six caractères hexadécimaux (ex. 01020A).");
  const k=key(userId,hotelId);
  const execute=async()=>{
   const data=await readAll();
   const rows=data.entries[k]||{};
   if(Object.entries(rows).some(([id,value])=>id!==record.roomId&&value.lockNo===record.lockNo))
    throw Error("Cette serrure est déjà associée à une autre chambre de l'établissement.");
   if(Object.keys(rows).length>=800&&!rows[record.roomId])throw Error("Limite de 800 chambres RFID par établissement.");
   rows[record.roomId]={building:record.building,floor:record.floor,lockNo:record.lockNo};
   data.entries[k]=rows;
   const content=JSON.stringify(data);
   if(content.length>220000)throw Error("Configuration RFID trop volumineuse.");
   const encrypted=await safeStorage.encryptStringAsync(content);
   await files.mkdir(path.dirname(location),{recursive:true});
   const temp=location+".tmp";
   await files.writeFile(temp,encrypted,{mode:0o600});
   await files.rename(temp,location);
   return record;
  };
  const operation=writes.then(execute,execute);
  writes=operation.catch(()=>{});
  return operation;
 }
 return {get,put};
}
module.exports={createRfidLayoutStore};