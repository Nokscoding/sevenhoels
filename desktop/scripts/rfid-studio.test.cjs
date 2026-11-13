"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {EventEmitter}=require("node:events");
const {createRfidStudioController}=require("../rfid-studio.cjs");
function context({platform="win32",port=10086,config='/vendor/CardLock.exe',selection='/vendor/CardLock.exe',missing=false,readyAfterLaunch=false,spawnError=false}={}){
 const launched=[],writes=[],dialogs=[];
 let service=port;
 const files={
  stat:async p=>({isFile:()=>!missing||!p.endsWith("SevenRFIDStudio.exe")}),
  readFile:async()=>JSON.stringify({cardLockPath:config}),
  mkdir:async()=>{},writeFile:async(...args)=>writes.push(args),rename:async()=>{}
 };
 const controller=createRfidStudioController({
  app:{isPackaged:true,getPath:()=>"/user/seven"},getWindow:()=>({}),platform,files,
  resourcesPath:"/app/resources",pause:async()=>{},probe:async()=>service,
  dialog:{showOpenDialog:async(...args)=>{dialogs.push(args);return selection?{canceled:false,filePaths:[selection]}:{canceled:true,filePaths:[]};}},
  spawnProcess:(file,args,options)=>{
   const child=new EventEmitter();child.exitCode=null;child.unref=()=>{};
   launched.push({file,args,options,child});
   if(readyAfterLaunch&&file.endsWith("CardLock.exe"))service=10086;
   queueMicrotask(()=>child.emit(spawnError?"error":"spawn",...(spawnError?[new Error("launch failed")]:[])));
   return child;
  }
 });
 return {controller,launched,writes,dialogs};
}
test("bundled compatibility source and vendor archive exactly pinned",()=>{
 const root=path.resolve(__dirname,"../rfid-studio");
 const digest=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
 assert.equal(digest(path.join(root,"source/Program.cs")),"96e1d4dae092519c1469499bd15d54175137a8ef6ef622f855e9416ab64a0a17");
 assert.equal(digest(path.join(root,"p50-sdk-v2.2.tar.xz")),"6770cf193c8790e92427eb1e22b7dbe8b58957158f2065275f709b539e62bc47");
});
test("existing CardLock service opens original studio outside asar without shell",async()=>{
 const c=context();const result=await c.controller.openStudio();
 assert.equal(result.ok,true);assert.equal(c.launched.length,1);
 assert.equal(c.launched[0].file,path.join("/app/resources","rfid-studio","SevenRFIDStudio.exe"));
 assert.deepEqual(c.launched[0].args,[]);assert.equal(c.launched[0].options.shell,false);
 assert.equal(c.dialogs.length,0);
 await c.controller.openStudio();assert.equal(c.launched.length,1,"avoid duplicate studio while tracked child runs");
});
test("status identifies the bundled original engine and required manufacturer service",async()=>{
 const c=context();const value=await c.controller.status();assert.equal(value.version,"2.2");assert.equal(value.requiresCardLock,true);assert.equal(value.available,true);assert.equal(value.servicePort,10086);
});
test("first-use CardLock selection persists path locally then starts studio",async()=>{
 const c=context({port:null,config:null,readyAfterLaunch:true});
 assert.equal((await c.controller.openStudio()).ok,true);
 assert.equal(c.dialogs.length,1);assert.equal(c.writes.length,1);
 assert.match(c.writes[0][0],/seven-rfid-studio\.json\.tmp$/);
 assert.deepEqual(c.launched.map(x=>path.basename(x.file)),["CardLock.exe","SevenRFIDStudio.exe"]);
});
test("cancelled manufacturer selection never starts native studio",async()=>{
 const c=context({port:null,config:null,selection:null});assert.equal((await c.controller.openStudio()).cancelled,true);assert.equal(c.launched.length,0);
});
test("unready manufacturer leaves studio closed and explains next action",async()=>{
 const c=context({port:null});const result=await c.controller.openStudio();
 assert.equal(result.ok,false);assert.match(result.message,/terminer son ouverture/);assert.equal(c.launched.length,1);
});
test("missing bundle does not run any external program",async()=>{
 const c=context({missing:true});assert.equal((await c.controller.openStudio()).ok,false);assert.equal(c.launched.length,0);
});
test("wrong selected executable is rejected",async()=>{
 const c=context({port:null,config:null,selection:"/vendor/other.exe"});assert.equal((await c.controller.openStudio()).ok,false);assert.equal(c.launched.length,0);
});
test("non-Windows client exposes no native launcher",async()=>{
 const c=context({platform:"linux"});assert.equal((await c.controller.status()).supported,false);assert.equal((await c.controller.openStudio()).ok,false);assert.equal(c.launched.length,0);
});
test("spawn failure clears busy state so the user can retry",async()=>{
 const c=context({spawnError:true});assert.equal((await c.controller.openStudio()).ok,false);
 assert.equal((await c.controller.openStudio()).ok,false);assert.equal(c.launched.length,2);
});
