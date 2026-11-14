"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createProUsb71Launcher,verifyProUsb71}=require("../rfid-vendor71.cjs");
const userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hotelId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const correct="D:\\LockV9.27C\\CardLock.Exe";
const wrong="C:\\Hotel47\\CardLock.exe";
function setup({installed=correct,running=[],discover=true,selection=null,platform="win32"}={}){
 const launches=[],saved=[],dialogs=[];
 const layout={
  getVendorProgram:async()=>installed,
  setVendorProgram:async data=>{saved.push(data);return data.programPath;},
  getReaderProfile:async()=>({driver:"pro-usb-v9"})
 };
 const verifyInstallation=async file=>(
  file.toLowerCase()===correct.toLowerCase() && discover?
   {ok:true,path:file}:{ok:false,message:"Logiciel V9.27C non reconnu."});
 const launcher=createProUsb71Launcher({
  app:{getPath:()=>"/mock"},layout,platform,installPaths:discover?[correct]:[],
  files:{},verifyInstallation,runningPaths:async()=>running,
  getWindow:()=>({}),
  dialog:{showOpenDialog:async()=>{dialogs.push(true);return selection?
    {canceled:false,filePaths:[selection]}:{canceled:true,filePaths:[]};}},
  spawnProcess:(file,args,options)=>{
   const proc=new EventEmitter();proc.unref=()=>{};proc.exitCode=null;
   launches.push({file,args,options});
   queueMicrotask(()=>proc.emit("spawn"));
   return proc;
  }
 });
 return {launcher,launches,saved,dialogs};
}
test("same executable name does not confuse proUSB Seven 71 with Seven 47",async()=>{
 const t=setup({running:[wrong]});
 const status=await t.launcher.state({userId,hotelId});
 assert.equal(status.ok,false);
 assert.equal(status.conflict,true);
 const launched=await t.launcher.launch({userId,hotelId});
 assert.equal(launched.ok,false);
 assert.equal(t.launches.length,0);
 assert.match(launched.message,/47/);
});
test("an already-running Seven 71 V9.27C process is accepted without duplicates",async()=>{
 const t=setup({running:["d:\\LOCKv9.27c\\cardlock.exe"]});
 const status=await t.launcher.state({userId,hotelId});
 assert.equal(status.running,true);
 const ready=await t.launcher.ensureRunning({userId,hotelId});
 assert.equal(ready.ok,true);
 assert.equal(t.launches.length,0);
});
test("launches exactly the supplied V9.27C executable with correct working directory",async()=>{
 const t=setup({running:[]});
 const result=await t.launcher.launch({userId,hotelId});
 assert.equal(result.ok,true);
 assert.equal(result.launched,true);
 assert.equal(result.running,false);
 assert.deepEqual(t.launches[0].args,[]);
 assert.equal(t.launches[0].file,correct);
 assert.equal(t.launches[0].options.cwd,"D:\\LockV9.27C");
 assert.equal(t.launches[0].options.shell,false);
 const later=await t.launcher.ensureRunning({userId,hotelId});
 assert.equal(later.ok,false,"opening a GUI does not mean a vendor login has finished");
 assert.match(later.message,/connectez-vous|Ouvrez/);
});
test("discovers and securely remembers D drive installation when needed",async()=>{
 const t=setup({installed:null});
 const status=await t.launcher.state({userId,hotelId});
 assert.equal(status.ok,true);
 assert.equal(status.running,false);
 assert.equal(t.saved.length,1);
 assert.equal(t.saved[0].hotelId,hotelId);
 assert.equal(t.saved[0].programPath,correct);
});
test("invalid or missing manufacturer software does not start any program",async()=>{
 const t=setup({installed:null,discover:false,selection:wrong});
 const res=await t.launcher.launch({userId,hotelId});
 assert.equal(res.ok,false);
 assert.deepEqual(t.launches,[]);
 assert.equal(t.dialogs.length,1);
});
test("rejects old Seven 47 binary even if it is named CardLock.exe",async()=>{
 const result=await verifyProUsb71(wrong,{readFile:async()=>Buffer.from("old binary")});
 assert.equal(result.ok,false);
 assert.match(result.message,/n'est pas le proUSB/);
});
