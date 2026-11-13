// Seven RFID native bridge — Windows .NET Framework 4 / x86.
// Calls only the official P50 SDK and does not alter the validated Studio 2.2.
// CardLock must already be running. Guest cards only; never create master cards.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

internal static class Vendor {
 [DllImport("kernel32.dll", EntryPoint="SetDllDirectoryW",CharSet=CharSet.Unicode,SetLastError=true)]
 [return:MarshalAs(UnmanagedType.Bool)] public static extern bool SetDllDirectory(string path);
 [DllImport("kernel32.dll",EntryPoint="LoadLibraryW",CharSet=CharSet.Unicode,SetLastError=true)]
 public static extern IntPtr LoadLibrary(string file);
 [DllImport("proRFL.dll",EntryPoint="initializeUSB",CallingConvention=CallingConvention.StdCall)]
 public static extern int InitializeUSB(byte p);
 [DllImport("proRFL.dll",EntryPoint="CloseUSB",CallingConvention=CallingConvention.StdCall)]
 public static extern void CloseUSB(byte p);
 [DllImport("proRFL.dll",EntryPoint="ReadCard",CallingConvention=CallingConvention.StdCall)]
 public static extern int ReadCard(byte p,[Out]byte[] data);
 [DllImport("proRFL.dll",EntryPoint="GetCardTypeByCardDataStr",CallingConvention=CallingConvention.StdCall)]
 public static extern int GetCardType([MarshalAs(UnmanagedType.LPStr)]string data,[Out]byte[] type);
 [DllImport("proRFL.dll",EntryPoint="GetGuestLockNoByCardDataStr",CallingConvention=CallingConvention.StdCall)]
 public static extern int GetGuestLockNo(int hotel,[MarshalAs(UnmanagedType.LPStr)]string data,[Out]byte[] number);
 [DllImport("proRFL.dll",EntryPoint="GetGuestETimeByCardDataStr",CallingConvention=CallingConvention.StdCall)]
 public static extern int GetGuestExpiry(int hotel,[MarshalAs(UnmanagedType.LPStr)]string data,[Out]byte[] time);
 [DllImport("proRFL.dll",EntryPoint="GuestCard",CallingConvention=CallingConvention.StdCall)]
 public static extern int GuestCard(byte p,int hotel,byte cardNo,byte dai,byte deadbolt,byte publicDoors,
   [MarshalAs(UnmanagedType.LPStr)]string begin,[MarshalAs(UnmanagedType.LPStr)]string end,
   [MarshalAs(UnmanagedType.LPStr)]string lockNo,[Out]byte[] result);
 [DllImport("proRFL.dll",EntryPoint="CardErase",CallingConvention=CallingConvention.StdCall)]
 public static extern int CardErase(byte p,int hotel,[Out]byte[] result);
}
internal sealed class ReaderCard {
 public int Code;
 public bool Valid;
 public string Type="";
 public string Data="";
 public string Sequence="";
 public string Message="";
}
internal static class Bridge {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 static string Str(Dictionary<string,object> o,string k) {
  object value;return o.TryGetValue(k,out value)&&value!=null?Convert.ToString(value,CultureInfo.InvariantCulture):"";
 }
 static int Num(Dictionary<string,object> o,string k,int fallback=-1) {
  int n;return int.TryParse(Str(o,k),NumberStyles.None,CultureInfo.InvariantCulture,out n)?n:fallback;
 }
 static bool Flag(Dictionary<string,object> o,string k){return Str(o,k).Equals("True",StringComparison.OrdinalIgnoreCase);}
 static string Decode(byte[] data){
  int n=Array.IndexOf(data,(byte)0);if(n<0)n=data.Length;
  return Encoding.ASCII.GetString(data,0,n);
 }
 static bool Hex(string s) {
  if(s.Length<32||s.Length%2!=0)return false;
  foreach(char c in s)if(!Uri.IsHexDigit(c))return false;
  return true;
 }
 static ReaderCard Read(){
  byte[] b=new byte[4096];for(int i=0;i<b.Length;i++)b[i]=0xA5;
  int rc=Vendor.ReadCard(1,b);
  ReaderCard c=new ReaderCard();c.Code=rc;c.Data=Decode(b);
  if(rc!=0){c.Message="Erreur de lecture du SDK : "+rc;return c;}
  if(!Hex(c.Data)||!c.Data.StartsWith("551501",StringComparison.OrdinalIgnoreCase)){
   c.Message="Lecture invalide : entête SDK absent ou format incorrect.";return c;
  }
  string first=c.Data.Substring(0,2);bool same=true;
  for(int i=2;i<c.Data.Length;i+=2)if(c.Data.Substring(i,2)!=first){same=false;break;}
  if(same){c.Message="Réponse USB répétitive non valide.";return c;}
  c.Valid=true;c.Sequence=c.Data.Substring(24,8);
  if(c.Sequence.Equals("FFFFFFFF",StringComparison.OrdinalIgnoreCase))c.Type="F";
  else{
   byte[] buf=new byte[64];int tr=Vendor.GetCardType(c.Data,buf);
   if(tr==0){string s=Decode(buf);if(s.Length>0)c.Type=s.Substring(0,1).ToUpperInvariant();}
  }
  c.Message="Badge reconnu.";return c;
 }
 static string Normalize(string s){
  if(s==null)return "";s=s.Trim().ToUpperInvariant();
  int pos=0;while(pos<s.Length-1&&s[pos]=='0')pos++;return s.Substring(pos);
 }
 static Dictionary<string,object> Info(ReaderCard card,int hotel) {
  var result=new Dictionary<string,object>{
   {"ok",card.Valid},{"code",card.Code},{"type",card.Type},{"sequence",card.Sequence},{"message",card.Message}
  };
  if(card.Valid&&card.Type=="6"&&hotel>0){
   byte[] lockNumber=new byte[128],expiry=new byte[128];
   int lr=Vendor.GetGuestLockNo(hotel,card.Data,lockNumber);
   int er=Vendor.GetGuestExpiry(hotel,card.Data,expiry);
   if(lr==0)result["lockNo"]=Decode(lockNumber).Trim();
   if(er==0)result["expiry"]=Decode(expiry).Trim();
   result["decoded"]=lr==0&&er==0;
  }
  return result;
 }
 static Dictionary<string,object> Error(string message,int rc=-1){
  return new Dictionary<string,object>{{"ok",false},{"code",rc},{"message",message}};
 }
 static bool VerifiedGuest(ReaderCard card,int hotel,string lockNo,string expiry) {
  if(!card.Valid||card.Type!="6")return false;
  byte[] lockNumber=new byte[128],expiryOut=new byte[128];
  int lr=Vendor.GetGuestLockNo(hotel,card.Data,lockNumber);
  int er=Vendor.GetGuestExpiry(hotel,card.Data,expiryOut);
  return lr==0&&er==0&&Normalize(Decode(lockNumber))==Normalize(lockNo)
      &&Decode(expiryOut).Trim()==expiry;
 }
 static Dictionary<string,object> Perform(Dictionary<string,object> request) {
  string operation=Str(request,"operation");
  string port=Str(request,"port");
  if(port!="Port1"&&port!="Port2")return Error("Port SDK inconnu.");
  if(operation!="read"&&operation!="issue"&&operation!="erase")return Error("Opération inconnue.");
  int hotel=Num(request,"hotelId");
  if((operation=="issue"||operation=="erase")&&(hotel<=0||!Flag(request,"confirmAuthorization")))
   return Error("Numéro de l’hôtel et confirmation de l’opération requis.");
  string root=AppDomain.CurrentDomain.BaseDirectory;
  string sdk=Path.Combine(Path.Combine(root,"sdk"),port);
  if(!Directory.Exists(sdk))return Error("Dossier SDK absent : "+port);
  Vendor.SetDllDirectory(sdk);
  string[] names={"MSVCRTD.DLL","MFC42D.DLL","d12.dll","d12c.dll","AESDIT.dll","Card.dll","proRFL.dll"};
  foreach(string name in names)if(!File.Exists(Path.Combine(sdk,name))||
      Vendor.LoadLibrary(Path.Combine(sdk,name))==IntPtr.Zero)
    return Error("Bibliothèque fabricant indisponible : "+name);
  int connected=Vendor.InitializeUSB(1);
  if(connected!=0)return Error("Initialisation S18 refusée par SDK : "+connected,connected);
  try {
   ReaderCard before=Read();
   if(operation=="read")return Info(before,hotel);
   if(!before.Valid)return Error("Carte non reconnue : impossible de modifier le badge.");
   if(operation=="erase"&&before.Type!="6")return Error("Seules les cartes de chambre client peuvent être effacées.");
   if(operation=="issue"&&before.Type!="F"&&before.Type!="6")
    return Error("La carte doit être vierge ou être une carte de chambre client.");
   ReaderCard check=Read();
   if(!check.Valid||check.Data!=before.Data)return Error("La carte a été retirée ou remplacée : opération annulée.");
   byte[] output=new byte[4096];
   if(operation=="erase"){
    int erased=Vendor.CardErase(1,hotel,output);
    if(erased!=0)return Error("CardErase a refusé l'effacement, code "+erased,erased);
    Thread.Sleep(300);
    ReaderCard after=Read();
    bool blank=after.Valid&&after.Type=="F";
    return new Dictionary<string,object>{{"ok",blank},{"code",erased},{"verified",blank},
     {"type",after.Type},{"message",blank?"Carte client effacée et vérifiée.":"Effacement SDK accepté, mais relecture non confirmée."}};
   }
   string lockNo=Str(request,"lockNo").Trim().ToUpperInvariant();
   if(lockNo.Length<1||lockNo.Length>8)return Error("Serrure SDK invalide.");
   foreach(char c in lockNo)if(!Uri.IsHexDigit(c))return Error("Serrure SDK non hexadécimale.");
   int number=Num(request,"cardNo",0),dai=Num(request,"dai",1);
   if(number<0||number>15||dai<0||dai>255)return Error("Numéro de carte ou DAI invalide.");
   DateTime expiryDate;
   if(!DateTime.TryParseExact(Str(request,"expiresAt"),"yyyy-MM-ddTHH:mm",
      CultureInfo.InvariantCulture,DateTimeStyles.None,out expiryDate))
    return Error("Format date / heure d'expiration invalide.");
   if(expiryDate<=DateTime.Now||expiryDate>DateTime.Now.AddYears(5))
    return Error("Date de fin de séjour non valide.");
   string begin=DateTime.Now.ToString("yyMMddHHmm",CultureInfo.InvariantCulture);
   string expiry=expiryDate.ToString("yyMMddHHmm",CultureInfo.InvariantCulture);
   int issued=Vendor.GuestCard(1,hotel,(byte)number,(byte)dai,0,0,begin,expiry,lockNo,output);
   if(issued!=0)return Error("GuestCard a refusé l'écriture, code "+issued,issued);
   Thread.Sleep(300);
   ReaderCard verify=Read();
   bool verified=VerifiedGuest(verify,hotel,lockNo,expiry);
   return new Dictionary<string,object>{{"ok",verified},{"code",issued},{"verified",verified},
    {"type",verify.Type},{"sequence",verify.Sequence},{"message",verified
       ?"Carte client créée ; chambre et date de fin vérifiées."
       :"GuestCard retourne 0 mais la relecture ne confirme pas le contenu. Gardez la carte et relisez-la."}};
  }finally{
   try{Vendor.CloseUSB(1);}catch{}
  }
 }
 public static int Main(string[] args) {
  Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);
  try{
   if(IntPtr.Size!=4)throw new InvalidOperationException("Le moteur P50 doit s'exécuter en x86.");
   string input=Console.ReadLine();
   if(input==null||input.Length>4096)throw new InvalidOperationException("Requête absente ou trop longue.");
   var request=Json.Deserialize<Dictionary<string,object>>(input);
   if(request==null)throw new InvalidOperationException("Requête incorrecte.");
   var result=Perform(request);
   Console.WriteLine(Json.Serialize(result));return result.ContainsKey("ok")&&(bool)result["ok"]?0:1;
  }catch(Exception e){
   // Never emit card data, hotel credentials, or filesystem path in error text.
   Console.WriteLine(Json.Serialize(Error("Opération interrompue ("+e.GetType().Name+"). Vérifier CardLock et le lecteur.")));
   return 2;
  }
 }
}
