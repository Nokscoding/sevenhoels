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
 const manufacturer71={
  ensureRunning:async()=>({ok:true,running:true}),
  state:async()=>({ok:true,running:true,path:"D:\\working-cardlock-71\\CardLock.exe"})
 };
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
  manufacturer71,
  ctrl:createRfidNativeController({app:{isPackaged:true},studio,layout,
   manufacturer71,files,
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
 assert.equal(t.calls[0].payload.vendorDirectory,"D:\\working-cardlock-71");
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


test("Seven 71 rejects RFID writes if its own proUSB V9.27C program is not running",async()=>{
 const t=mock();
 t.layout.getReaderProfile=async()=>({driver:"pro-usb-v9",port:"Port1",
  encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"});
 t.manufacturer71.ensureRunning=async()=>({ok:false,message:"Seven 47 is running"});
 // The native controller receives its own manufacturer71 dependency:
 // use an explicit second mocked controller to exercise the failure branch.
 const {createRfidNativeController}=require("../rfid-native.cjs");
 const control=createRfidNativeController({
  app:{isPackaged:true},studio:t.studio,layout:t.layout,
  files:{stat:async()=>({isFile:()=>true})},platform:"win32",
  resourcesPath:"C:\\Seven\\resources",
  manufacturer71:{ensureRunning:async()=>({ok:false,message:"Le programme du Seven 47 est ouvert."})},
  spawnProcess:()=>{throw Error("must not spawn bridge");}
 });
 const blocked=await control.execute({operation:"issue",userId,hotelId,roomId,
  expiresAt:"2026-11-15T12:00",cardNo:0,dai:1,confirmAuthorization:true});
 assert.equal(blocked.ok,false);
 assert.match(blocked.message,/47/);
});

test("Seven 47 does not issue cards while proUSB V9.27C of Seven 71 is open",async()=>{
 const t=mock();
 const controller=createRfidNativeController({
  app:{isPackaged:true},studio:t.studio,layout:t.layout,
  manufacturer71:{guardLegacy:async()=>({ok:false,message:"ProUSB Seven 71 est ouvert."})},
  files:{stat:async()=>({isFile:()=>true})},
  platform:"win32",resourcesPath:"C:\\Seven\\resources",
  spawnProcess:()=>{throw Error("no SDK call permitted");}
 });
 const response=await controller.execute({operation:"read",userId,hotelId});
 assert.equal(response.ok,false);
 assert.match(response.message,/71/);
});

test("Seven 71 refuses OEM operations when the actual running vendor DLL directory cannot be verified",async()=>{
 const t=mock();
 t.layout.getReaderProfile=async()=>({
  driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"
 });
 t.manufacturer71.state=async()=>({ok:false,running:false,
  message:"Le CardLock ouvert est différent de celui du Seven 71."});
 const denied=await t.ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(denied.ok,false);
 assert.equal(t.calls.length,0,"never invoke a guessed OEM DLL");
});
test("Seven 47 remains on the original P50 SDK path, without a vendor DLL override",async()=>{
 const t=mock();
 const result=await t.ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(result.ok,true);
 assert.equal(t.calls[0].payload.readerFamily,"p50");
 assert.equal(t.calls[0].payload.vendorDirectory,"");
});

test("OEM native process crash reports its last hardware stage instead of unreadable response",async()=>{
 const studio={status:async()=>({servicePort:10086}),openCardLock:async()=>({ok:true})};
 const layout={getVendorId:async()=>48231,get:async()=>[],
  getReaderProfile:async()=>({driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"})};
 const spawnProcess=()=>{
  const child=new EventEmitter();
  child.stdout=new PassThrough();
  child.stderr=new PassThrough();
  child.kill=()=>{};
  child.stdin=new PassThrough();
  child.stdin.on("data",()=>queueMicrotask(()=>{
   child.stderr.emit("data",Buffer.from("SEVEN_STAGE:usb\n"));
   child.emit("close",-1073741819,null); // NTSTATUS 0xC0000005
  }));
  return child;
 };
 const ctrl=createRfidNativeController({app:{isPackaged:true},studio,layout,
  manufacturer71:{ensureRunning:async()=>({ok:true,running:true}),
   state:async()=>({ok:true,running:true,path:"D:\\Seven71\\CardLock.exe"})},
  files:{stat:async()=>({isFile:()=>true})},platform:"win32",
  resourcesPath:"C:\\Seven\\resources",spawnProcess});
 const result=await ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(result.ok,false);
 assert.match(result.message,/Initialisation du lecteur USB/);
 assert.match(result.message,/0xC0000005/);
 assert.doesNotMatch(result.message,/illisible/i);
});
test("interrupted write warns to reread the same card before attempting again",async()=>{
 const studio={status:async()=>({servicePort:10086}),openCardLock:async()=>({ok:true})};
 const layout={getVendorId:async()=>48231,get:async()=>[{roomId,lockNo:"01020A"}],
  getReaderProfile:async()=>({driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"})};
 const spawnProcess=()=>{
  const child=new EventEmitter();
  child.stdout=new PassThrough();
  child.stderr=new PassThrough();
  child.kill=()=>{};
  child.stdin=new PassThrough();
  child.stdin.on("data",()=>queueMicrotask(()=>{
   child.stderr.emit("data",Buffer.from("SEVEN_STAGE:write\n"));
   child.emit("close",-1073741819,null);
  }));
  return child;
 };
 const ctrl=createRfidNativeController({app:{isPackaged:true},studio,layout,
  manufacturer71:{ensureRunning:async()=>({ok:true,running:true}),
   state:async()=>({ok:true,running:true,path:"D:\\Seven71\\CardLock.exe"})},
  files:{stat:async()=>({isFile:()=>true})},platform:"win32",
  resourcesPath:"C:\\Seven\\resources",spawnProcess});
 const result=await ctrl.execute({operation:"issue",userId,hotelId,roomId,
  expiresAt:"2026-11-16T12:00",cardNo:0,dai:2,confirmAuthorization:true});
 assert.equal(result.ok,false);
 assert.match(result.message,/écriture ou d.effacement a été lancée/);
 assert.match(result.message,/relisez-la/);
});

test("read-only OEM close code 0 never reports that a guest card might have been written",async()=>{
 const studio={status:async()=>({servicePort:10086}),openCardLock:async()=>({ok:true})};
 const layout={getVendorId:async()=>48231,get:async()=>[],
  getReaderProfile:async()=>({driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"})};
 const spawnProcess=()=>{
  const child=new EventEmitter();
  child.stdout=new PassThrough();
  child.stderr=new PassThrough();
  child.kill=()=>{};
  child.stdin=new PassThrough();
  child.stdin.on("data",()=>queueMicrotask(()=>{
   child.stderr.emit("data",Buffer.from("SEVEN_STAGE:card\nSEVEN_STAGE:close\n"));
   child.emit("close",0,null);
  }));
  return child;
 };
 const ctrl=createRfidNativeController({app:{isPackaged:true},studio,layout,
  manufacturer71:{ensureRunning:async()=>({ok:true,running:true}),
   state:async()=>({ok:true,running:true,path:"D:\\Seven71\\CardLock.exe"})},
  files:{stat:async()=>({isFile:()=>true})},platform:"win32",
  resourcesPath:"C:\\Seven\\resources",spawnProcess});
 const result=await ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(result.ok,false);
 assert.match(result.message,/fermé normalement sans transmettre le résultat/);
 assert.doesNotMatch(result.message,/carte a peut-être été modifiée|retirez la carte et relisez-la/);
 assert.match(result.message,/Fermeture de la connexion USB/);
});
test("normal card read returns SDK JSON after silent RF57 cleanup",async()=>{
 const studio={status:async()=>({servicePort:10086}),openCardLock:async()=>({ok:true})};
 const layout={getVendorId:async()=>48231,get:async()=>[],
  getReaderProfile:async()=>({driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"})};
 const spawnProcess=()=>{
  const child=new EventEmitter();
  child.stdout=new PassThrough();
  child.stderr=new PassThrough();
  child.kill=()=>{};
  child.stdin=new PassThrough();
  child.stdin.on("data",()=>queueMicrotask(()=>{
   child.stderr.emit("data",Buffer.from("SEVEN_STAGE:card\n"));
   child.stdout.emit("data",Buffer.from('{"ok":true,"code":0,"type":"6","sequence":"0123ABCD","message":"Badge reconnu."}\n'));
   child.emit("close",0,null);
  }));
  return child;
 };
 const ctrl=createRfidNativeController({app:{isPackaged:true},studio,layout,
  manufacturer71:{ensureRunning:async()=>({ok:true,running:true}),
   state:async()=>({ok:true,running:true,path:"D:\\Seven71\\CardLock.exe"})},
  files:{stat:async()=>({isFile:()=>true})},platform:"win32",
  resourcesPath:"C:\\Seven\\resources",spawnProcess});
 const result=await ctrl.execute({operation:"read",userId,hotelId});
 assert.equal(result.ok,true);
 assert.equal(result.type,"6");
 assert.equal(result.sequence,"0123ABCD");
});

test("Seven 71 RF57 card type is derived from the Delphi SDK 25th character, without unsafe OEM type call",()=>{
 const fs=require("node:fs");
 const path=require("node:path");
 const bridge=fs.readFileSync(path.join(__dirname,"..","rfid-studio","source","SevenRfidBridge.cs"),"utf8");
 assert.match(bridge,/else if\(rf57\)[\s\S]*?c\.Data\[24\]/);
 assert.match(bridge,/else\{\s*Mark\("type"\);\s*byte\[\] buf=new byte\[64\];int tr=Vendor\.GetCardType/);
 assert.match(bridge,/ReaderCard before=Read\(rf57:family=="rf57"\)/);
 assert.match(bridge,/ReaderCard check=Read\("repeat",family=="rf57"\)/);
 assert.match(bridge,/ReaderCard verify=Read\("verify",family=="rf57"\)/);
 assert.match(bridge,/if\(family=="rf57"&&operation=="issue"&&before\.Type!="F"\)/);
});
