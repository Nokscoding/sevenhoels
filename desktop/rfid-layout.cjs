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
   if(error?.code==="ENOENT")return {version:1,entries:{},vendorIds:{}};
   throw error;
  }
 }
 // One physical workstation may host different Seven staff accounts.
 // The hardware mapping belongs to the hotel, not to the staff login.
 const key=(userId,hotelId)=>{cleanId(userId);return "hotel:"+cleanId(hotelId);};
 const previous=(data,userId,hotelId)=>{
  const legacy=cleanId(userId)+":"+cleanId(hotelId);
  if(data.entries?.[legacy])return data.entries[legacy];
  const old=Object.entries(data.entries||{}).find(([k])=>k.endsWith(":"+cleanId(hotelId)));
  return old?.[1]||{};
 };
 async function commit(data) {
  const content=JSON.stringify(data);
  if(content.length>220000)throw Error("Configuration RFID trop volumineuse.");
  const encrypted=await safeStorage.encryptStringAsync(content);
  await files.mkdir(path.dirname(location),{recursive:true});
  const temp=location+".tmp";
  await files.writeFile(temp,encrypted,{mode:0o600});
  await files.rename(temp,location);
 }
 async function getVendorId({userId,hotelId}) {
  const data=await readAll();
  const current=data.vendorIds?.[key(userId,hotelId)];
  if(current)return current;
  const legacy=cleanId(userId)+":"+cleanId(hotelId);
  return data.vendorIds?.[legacy]||
    Object.entries(data.vendorIds||{}).find(([k])=>k.endsWith(":"+cleanId(hotelId)))?.[1]||null;
 }
 async function setVendorId({userId,hotelId,vendorHotelId}) {
  const id=Number(vendorHotelId);
  if(!Number.isSafeInteger(id)||id<=0||id>2147483647)throw Error("Identifiant fabricant invalide.");
  const k=key(userId,hotelId);
  const execute=async()=>{
   const data=await readAll();
   if(!data.vendorIds)data.vendorIds={};
   data.vendorIds[k]=id;
   await commit(data);
   return id;
  };
  const op=writes.then(execute,execute);writes=op.catch(()=>{});return op;
 }
 // Different properties may use incompatible card/encoder families.
 // A reader profile NEVER contains the manufacturer hotel authorization number.
 async function getReaderProfile({userId,hotelId}){
  const data=await readAll();
  return data.readerProfiles?.[key(userId,hotelId)]||null;
 }
 async function setReaderProfile({userId,hotelId,driver,port,encoderNo,cardType,dllVersion}){
  const value={
   driver:String(driver||""),
   port:String(port||"Port1"),
   encoderNo:String(encoderNo||"").trim(),
   cardType:String(cardType||"").trim(),
   dllVersion:String(dllVersion||"").trim()
  };
  if(!["p50","pro-usb-v9"].includes(value.driver))
   throw Error("Famille de lecteur non reconnue.");
  if(!["Port1","Port2"].includes(value.port))throw Error("Port du lecteur non reconnu.");
  if(!/^\d{0,8}$/.test(value.encoderNo)||!/^\d{0,4}$/.test(value.cardType)||
      !/^[A-Za-z0-9.\-_]{0,48}$/.test(value.dllVersion))
   throw Error("Paramètres du lecteur invalides.");
  if(value.driver==="pro-usb-v9"&&(!value.encoderNo||!value.cardType||!value.dllVersion))
   throw Error("Renseignez le numéro de l'encodeur, le type de carte et la version du lecteur.");
  const k=key(userId,hotelId);
  const execute=async()=>{
   const data=await readAll();
   if(!data.readerProfiles)data.readerProfiles={};
   data.readerProfiles[k]=value;
   await commit(data);
   return value;
  };
  const operation=writes.then(execute,execute);writes=operation.catch(()=>{});
  return operation;
 }
 // Store only the path of the explicitly selected manufacturer installation,
 // never vendor databases or card content.
 async function getVendorProgram({userId,hotelId}) {
  const data=await readAll();
  return data.vendorPrograms?.[key(userId,hotelId)]||null;
 }
 async function setVendorProgram({userId,hotelId,programPath}) {
  const file=String(programPath||"").trim();
  if(file.length<12||file.length>1024||/[\u0000-\u001f]/.test(file))
   throw Error("Chemin du logiciel fabricant invalide.");
  if(!/^[a-z]:\\\\/i.test(file)||!file.toLowerCase().endsWith("\\\\cardlock.exe"))
   throw Error("Choisissez l'exécutable CardLock.Exe de proUSB V9.27C.");
  const k=key(userId,hotelId);
  const execute=async()=>{
   const data=await readAll();
   if(!data.vendorPrograms)data.vendorPrograms={};
   data.vendorPrograms[k]=file;
   await commit(data);
   return file;
  };
  const op=writes.then(execute,execute);writes=op.catch(()=>{});return op;
 }
 async function get({userId,hotelId}){
  const data=await readAll();
  const rows=data.entries[key(userId,hotelId)]||previous(data,userId,hotelId);
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
   const rows=data.entries[k]||previous(data,userId,hotelId);
   if(Object.entries(rows).some(([id,value])=>id!==record.roomId&&value.lockNo===record.lockNo))
    throw Error("Cette serrure est déjà associée à une autre chambre de l'établissement.");
   if(Object.keys(rows).length>=800&&!rows[record.roomId])throw Error("Limite de 800 chambres RFID par établissement.");
   rows[record.roomId]={building:record.building,floor:record.floor,lockNo:record.lockNo};
   data.entries[k]=rows;
   await commit(data);
   return record;
  };
  const operation=writes.then(execute,execute);
  writes=operation.catch(()=>{});
  return operation;
 }
 return {get,put,getVendorId,setVendorId,getReaderProfile,setReaderProfile,getVendorProgram,setVendorProgram};
}
module.exports={createRfidLayoutStore};