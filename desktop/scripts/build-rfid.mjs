import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const root=path.join(desktop,"rfid-studio");
const runtime=path.join(root,"runtime");
const bundle=path.join(root,"p50-sdk-v2.2.tar.xz");
const source=path.join(root,"source","Program.cs");
const bundleHash="6770cf193c8790e92427eb1e22b7dbe8b58957158f2065275f709b539e62bc47";
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
if(hash(await fs.readFile(bundle))!==bundleHash)throw Error("RFID vendor bundle checksum mismatch");
if(hash(await fs.readFile(source))!=="96e1d4dae092519c1469499bd15d54175137a8ef6ef622f855e9416ab64a0a17")throw Error("Stable RFID 2.2 source checksum mismatch");
await fs.mkdir(runtime,{recursive:true});
const extract=spawnSync(process.platform==="win32"?"python":"python3",["-c",`
import pathlib,sys,tarfile
with tarfile.open(sys.argv[1],"r:xz") as archive:
 for member in archive.getmembers():
  parts=pathlib.PurePosixPath(member.name).parts
  if not member.isfile() or len(parts)!=3 or parts[0]!="sdk" or parts[1] not in ["Port1","Port2"] or ".." in parts:
   raise ValueError("Unexpected vendor bundle member")
 archive.extractall(sys.argv[2],filter="data")
`,bundle,runtime],{encoding:"utf8"});
if(extract.status!==0)throw Error("Cannot extract RFID bundle: "+extract.stderr);
const executable=path.join(runtime,"SevenRFIDStudio.exe");
if(process.platform==="win32"){
 const csc=path.join(process.env.WINDIR||"C:\\Windows","Microsoft.NET","Framework","v4.0.30319","csc.exe");
 const result=spawnSync(csc,["/nologo","/target:winexe","/platform:x86","/optimize+","/r:System.Windows.Forms.dll","/r:System.Drawing.dll","/r:System.Core.dll","/out:"+executable,source],{stdio:"inherit"});
 if(result.status!==0)throw Error("Seven RFID Studio 2.2 compilation failed");
}else{
 // Local checks can reuse a cross-compiled .NET x86 binary. Releases compile on Windows.
 await fs.access(executable);
}
const bytes=await fs.readFile(executable);
const pe=bytes.readUInt32LE(0x3c);
if(bytes.toString("ascii",pe,pe+2)!=="PE" || bytes.readUInt16LE(pe+4)!==0x14c)throw Error("RFID helper must be PE32 x86");
await fs.writeFile(path.join(runtime,"version.json"),JSON.stringify({version:"2.2",engine:"P50-proRFL",requiresCardLock:true,bundleSha256:bundleHash,sourceSha256:hash(await fs.readFile(source)),executableSha256:hash(bytes)},null,2)+"\n");
console.log("Seven RFID Studio 2.2 compatibility engine prepared (CardLock required).");
