"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createRfidLayoutStore}=require("../rfid-layout.cjs");
const u1="a1111111-1111-4111-8111-111111111111";
const hotel="b2222222-2222-4222-8222-222222222222";
const room1="c3333333-3333-4333-8333-333333333333";
const room2="d4444444-4444-4444-8444-444444444444";
function fixture(){
 let blob=null;
 const storage={isAsyncEncryptionAvailable:()=>true,
  encryptStringAsync:async data=>Buffer.from(data,"utf8").map(value=>value^0x5a),
  decryptStringAsync:async data=>({result:Buffer.from(data).map(value=>value^0x5a).toString("utf8")})};
 const files={
  readFile:async()=>{if(!blob){const e=new Error("missing");e.code="ENOENT";throw e;}return blob;},
  writeFile:async(_p,data)=>{blob=data;},mkdir:async()=>{},rename:async()=>{}
 };
 return {store:createRfidLayoutStore({app:{getPath:()=>"/safe"},safeStorage:storage,files}),getBlob:()=>blob};
}
test("configurations shared between Seven staff logins on same Windows profile",async()=>{
 const {store}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven 71",floor:"1",lockNo:"01020a"});
 assert.deepEqual(await store.get({userId:u1,hotelId:hotel}),[{roomId:room1,building:"Seven 71",floor:"1",lockNo:"01020A"}]);
 assert.deepEqual(await store.get({userId:room2,hotelId:hotel}),[{roomId:room1,building:"Seven 71",floor:"1",lockNo:"01020A"}]);
});
test("rejects incorrect or duplicate lock identifiers",async()=>{
 const {store}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven",floor:"RDC",lockNo:"01020A"});
 await assert.rejects(store.put({userId:u1,hotelId:hotel,roomId:room2,building:"Seven",floor:"RDC",lockNo:"01020A"}),/déjà associée/);
 await assert.rejects(store.put({userId:u1,hotelId:hotel,roomId:room2,building:"Seven",floor:"RDC",lockNo:"131"}),/six caractères/);
});
test("never saves plaintext in normal Windows safeStorage operation",async()=>{
 const {store,getBlob}=fixture();
 await store.put({userId:u1,hotelId:hotel,roomId:room1,building:"Seven",floor:"RDC",lockNo:"01020A"});
 assert.ok(Buffer.isBuffer(getBlob()));
 assert.equal(getBlob().includes(Buffer.from("01020A")),false);
});

test("manufacturer hotel number shared locally and encrypted",async()=>{
 const {store,getBlob}=fixture();
 assert.equal(await store.getVendorId({userId:u1,hotelId:hotel}),null);
 await store.setVendorId({userId:u1,hotelId:hotel,vendorHotelId:654321});
 assert.equal(await store.getVendorId({userId:room2,hotelId:hotel}),654321);
 assert.equal(getBlob().includes(Buffer.from("654321")),false);
 await assert.rejects(store.setVendorId({userId:u1,hotelId:hotel,vendorHotelId:-2}),/invalide/);
});

test("Seven 71 stores different encoder and card type without overwriting Seven 47",async()=>{
 const {store,getBlob}=fixture();
 const hotel71="e5555555-5555-4555-8555-555555555555";
 await store.setVendorId({userId:u1,hotelId:hotel,vendorHotelId:48231});
 assert.equal(await store.getReaderProfile({userId:u1,hotelId:hotel}),null);
 const saved=await store.setReaderProfile({userId:u1,hotelId:hotel71,
  driver:"pro-usb-v9",port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"});
 assert.equal(saved.encoderNo,"2922");
 assert.equal(saved.cardType,"57");
 assert.deepEqual(await store.getReaderProfile({userId:room2,hotelId:hotel71}),saved);
 assert.equal(await store.getReaderProfile({userId:u1,hotelId:hotel}),null);
 assert.equal(await store.getVendorId({userId:u1,hotelId:hotel}),48231);
 assert.equal(await store.getVendorId({userId:u1,hotelId:hotel71}),null);
 assert.equal(getBlob().includes(Buffer.from("proUSB-V9-20171130")),false);
});
test("rejects unrecognized reader families and malformed encoders",async()=>{
 const {store}=fixture();
 const body={userId:u1,hotelId:hotel,port:"Port1",encoderNo:"2922",cardType:"57",dllVersion:"proUSB-V9-20171130"};
 await assert.rejects(store.setReaderProfile({...body,driver:"arbitrary-dll"}),/non reconnue/);
 await assert.rejects(store.setReaderProfile({...body,driver:"pro-usb-v9",encoderNo:"../../"}),/invalides/);
});

test("vendor executable path is isolated by hotel and encrypted locally",async()=>{
 const {store,getBlob}=fixture();
 const hotel71="e5555555-5555-4555-8555-555555555555";
 const vendor="D:\\LockV9.27C\\CardLock.Exe";
 assert.equal(await store.getVendorProgram({userId:u1,hotelId:hotel71}),null);
 await store.setVendorProgram({userId:u1,hotelId:hotel71,programPath:vendor});
 assert.equal(await store.getVendorProgram({userId:room2,hotelId:hotel71}),vendor);
 assert.equal(await store.getVendorProgram({userId:u1,hotelId:hotel}),null);
 assert.equal(getBlob().includes(Buffer.from("LockV9.27C")),false);
 await assert.rejects(store.setVendorProgram({userId:u1,hotelId:hotel,programPath:"C:\\Hotel47\\other.exe"}),/CardLock/);
});
