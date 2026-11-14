"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {PassThrough}=require("node:stream");
const {createRfidNativeController}=require("../rfid-native.cjs");
const userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hotelId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const roomId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function mock(){
 const calls=[];let writes=0;
 const studio={status:async()=>({servicePort:10086}),openCardLock:async()=>({ok:true})};
 const layout={getVendorId:async()=>48231,get:async()=>[{roomId,lockNo:"01020A"}]};
 const files={stat:async()=>({isFile:()=>true})};
 const spawnProcess=(file,args,opts)=>{
  const child=new EventEmitter();child.stdout=new PassThrough();child.kill=()=>{};
  child.stdin=new PassThrough();child.stdin.on("data",data=>{
   writes++;const payload=JSON.parse(data.toString("utf8").trim());
   calls.push({payload,file,args,opts});
   queueMicrotask(()=>{
    child.stdout.emit("data",Buffer.from(JSON.stringify({
     ok:true,code:0,verified:true,type:"6",sequence:"0123ABCD",
     message:"Carte test écrite et relue."})+"\n"));
    child.emit("close",0);
   });
  });
  return child;
 };
 return {
  calls,studio,layout,
  ctrl:createRfidNativeController({app:{isPackaged:true},studio,layout,files,
   platform:"win32",resourcesPath:"C:\\Seven\\resources",spawnProcess})
 };
}
test("physical issue uses configured hotel + lock, never an untrusted lock from renderer",async()=>{
 const t=mock();
 const r=await t.ctrl.execute({operation:"issue",userId,hotelId,roomId,
  lockNo:"BADBAD",port:"Port1",expiresAt:"2026-11-14T12:00",cardNo:1,dai:1,confirmAuthorization:true});
 assert.equal(r.ok,true,JSON.stringify({result:r,calls:t.calls}));
 assert.equal(r.verified,true);
 assert.equal(t.calls.length,1);
 assert.equal(t.calls[0].payload.hotelId,48231);
 assert.equal(t.calls[0].payload.lockNo,"01020A");
 assert.equal(t.calls[0].payload.operation,"issue");
 assert.equal(t.calls[0].opts.shell,false);
});
test("mutations require test consent and configured valid dates",async()=>{
 const t=mock();
 const noConsent=await t.ctrl.execute({operation:"erase",userId,hotelId,roomId,confirmAuthorization:false});
 assert.equal(noConsent.ok,false);
 const invalid=await t.ctrl.execute({operation:"issue",userId,hotelId,roomId,
  confirmAuthorization:true,expiresAt:"tomorrow",cardNo:0,dai:1});
 assert.equal(invalid.ok,false);
 assert.equal(t.calls.length,0);
});
test("read works using the same bridge without a stay/room",async()=>{
 const t=mock();
 const response=await t.ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(response.ok,true,JSON.stringify({result:response,calls:t.calls}));
 assert.equal(t.calls[0].payload.operation,"read");
 assert.equal(t.calls[0].payload.hotelId,48231);
});
test("unconfigured CardLock service blocks writing without invoking the SDK",async()=>{
 const t=mock();
 t.studio.status=async()=>({servicePort:null});
 t.studio.openCardLock=async()=>({ok:false,cancelled:true});
 const response=await t.ctrl.execute({operation:"erase",userId,hotelId,roomId,confirmAuthorization:true});
 assert.equal(response.ok,false);
 assert.equal(t.calls.length,0);
});

test("connection sound is requested only on first USB connection and after reconnect",async()=>{
 const t=mock();
 const first=await t.ctrl.status();
 assert.equal(first.readerReady,true);
 assert.equal(t.calls[0].payload.operation,"connect");
 assert.equal(t.calls[0].payload.signal,true);
 const second=await t.ctrl.status();
 assert.equal(second.readerReady,true);
 assert.equal(t.calls[1].payload.signal,false);
 t.studio.status=async()=>({servicePort:null});
 const disconnected=await t.ctrl.status();
 assert.equal(disconnected.readerReady,false);
 t.studio.status=async()=>({servicePort:10086});
 const third=await t.ctrl.status();
 assert.equal(third.readerReady,true);
 assert.equal(t.calls[2].payload.signal,true);
});

test("Seven 71 RF57 can issue, erase and read through the manufacturer API after profile validation",async()=>{
 const t=mock();
 t.layout.getReaderProfile=async()=>({
  driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"});
 // The native Windows bridge will additionally reject a card that is not
 // physically recognized as RF57/T5557; mocked successful SDK results do not prove hardware.
 const issue=await t.ctrl.execute({operation:"issue",userId,hotelId,roomId,
  expiresAt:"2026-11-15T12:00",cardNo:0,dai:1,confirmAuthorization:true});
 const erase=await t.ctrl.execute({operation:"erase",userId,hotelId,roomId,confirmAuthorization:true});
 assert.equal(issue.ok,true);
 assert.equal(erase.ok,true);
 assert.equal(t.calls.length,2);
 assert.equal(t.calls[0].payload.operation,"issue");
 assert.equal(t.calls[0].payload.readerFamily,"rf57");
 assert.equal(t.calls[0].payload.cardType,"57");
 assert.equal(t.calls[0].payload.hotelId,48231);
 assert.equal(t.calls[0].payload.lockNo,"01020A");
 assert.equal(t.calls[1].payload.operation,"erase");
 assert.equal(t.calls[1].payload.readerFamily,"rf57");
 assert.equal(t.calls[1].payload.hotelId,48231);
 const read=await t.ctrl.execute({operation:"read",userId,hotelId,port:"Port2"});
 assert.equal(read.ok,true);
 assert.equal(t.calls.length,3);
 assert.equal(t.calls[2].payload.readerFamily,"rf57");
 assert.equal(t.calls[2].payload.port,"Port1");
});
test("Seven 71 refuses unsupported RF cards, wrong hotel identification and missing consent",async()=>{
 const t=mock();
 t.layout.getReaderProfile=async()=>({
  driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"50",dllVersion:"proUSB-V9-20171130"});
 const blocked=await t.ctrl.execute({operation:"erase",userId,hotelId,roomId,confirmAuthorization:true});
 assert.equal(blocked.ok,false);
 assert.equal(t.calls.length,0);
 t.layout.getReaderProfile=async()=>({
  driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"});
 t.layout.getVendorId=async()=>null;
 const missingHotel=await t.ctrl.execute({operation:"issue",userId,hotelId,roomId,
  expiresAt:"2026-11-15T12:00",cardNo:0,dai:1,confirmAuthorization:true});
 assert.equal(missingHotel.ok,false);
 assert.equal(t.calls.length,0);
 const noConsent=await t.ctrl.execute({operation:"erase",userId,hotelId,roomId,confirmAuthorization:false});
 assert.equal(noConsent.ok,false);
});

