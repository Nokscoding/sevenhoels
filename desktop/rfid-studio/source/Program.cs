// Seven RFID Studio SDK v2.1
// Windows Forms / .NET Framework 4.x / x86. Uses only vendor-supplied DLLs.
// Based on the P50 SDK V0925's Delphi 7 Unit1.pas and Explanation.doc.
// Never use against live hotel credentials or occupied-room locks without an approved test plan.
using System;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using System.Diagnostics;

namespace SevenRFIDStudio
{
    internal static class Native
    {
        [DllImport("kernel32.dll", EntryPoint="SetDllDirectoryW", CharSet=CharSet.Unicode, SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetDllDirectory(string path);
        [DllImport("kernel32.dll", EntryPoint="LoadLibraryW", CharSet=CharSet.Unicode, SetLastError=true)]
        public static extern IntPtr LoadLibrary(string file);
        [DllImport("kernel32.dll", EntryPoint="FreeLibrary", SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        public static extern bool FreeLibrary(IntPtr handle);

        [DllImport("proRFL.dll", EntryPoint="initializeUSB", CallingConvention=CallingConvention.StdCall)]
        public static extern int InitializeUSB(byte type);
        [DllImport("proRFL.dll", EntryPoint="CloseUSB", CallingConvention=CallingConvention.StdCall)]
        public static extern void CloseUSB(byte type);
        [DllImport("proRFL.dll", EntryPoint="GetDLLVersion", CallingConvention=CallingConvention.StdCall)]
        public static extern int GetDLLVersion([Out] byte[] version);
        [DllImport("proRFL.dll", EntryPoint="ReadCard", CallingConvention=CallingConvention.StdCall)]
        public static extern int ReadCard(byte type, [Out] byte[] data);
        [DllImport("proRFL.dll", EntryPoint="Buzzer", CallingConvention=CallingConvention.StdCall)]
        public static extern int Buzzer(byte type, byte duration10ms);
        [DllImport("proRFL.dll", EntryPoint="GetCardTypeByCardDataStr", CallingConvention=CallingConvention.StdCall)]
        public static extern int GetCardType([MarshalAs(UnmanagedType.LPStr)] string data, [Out] byte[] type);
        [DllImport("proRFL.dll", EntryPoint="GetGuestLockNoByCardDataStr", CallingConvention=CallingConvention.StdCall)]
        public static extern int GetGuestLockNo(int hotelId, [MarshalAs(UnmanagedType.LPStr)] string data, [Out] byte[] lockNo);
        [DllImport("proRFL.dll", EntryPoint="GetGuestETimeByCardDataStr", CallingConvention=CallingConvention.StdCall)]
        public static extern int GetGuestExpiry(int hotelId, [MarshalAs(UnmanagedType.LPStr)] string data, [Out] byte[] expiry);
        [DllImport("proRFL.dll", EntryPoint="GuestCard", CallingConvention=CallingConvention.StdCall)]
        public static extern int IssueGuest(byte type, int hotelId, byte cardNo, byte dai, byte deadbolt, byte publicDoors,
            [MarshalAs(UnmanagedType.LPStr)] string issued,
            [MarshalAs(UnmanagedType.LPStr)] string expiry,
            [MarshalAs(UnmanagedType.LPStr)] string lockNo,
            [Out] byte[] output);
        [DllImport("proRFL.dll", EntryPoint="CardErase", CallingConvention=CallingConvention.StdCall)]
        public static extern int EraseCard(byte type, int hotelId, [Out] byte[] output);
    }

    internal sealed class CardResult
    {
        public int ReturnCode;
        public string Data;
        public string Message;
        public string TypeCode;
        public bool VerifiedFormat;
        public bool Blank;
        public string Sequence;
    }

    internal sealed class MainForm : Form
    {
        private readonly Color bg = Color.FromArgb(15, 23, 42);
        private readonly Color pane = Color.FromArgb(30, 41, 59);
        private readonly Color surface = Color.FromArgb(51, 65, 85);
        private readonly Color fg = Color.FromArgb(241, 245, 249);
        private readonly Color muted = Color.FromArgb(148, 163, 184);
        private readonly Color teal = Color.FromArgb(45, 212, 191);
        private readonly string root;
        private readonly string variant;
        private readonly string dllFolder;
        private readonly StringBuilder trace = new StringBuilder();
        private bool connected;
        private bool busy;
        private CardResult lastCard;
        private TextBox raw, journal, txtHotelId, txtLock, txtDai, txtCardNo;
        private Label headline, subtitle, status, lblType, lblId, lblExpiry;
        private Button btnConnect, btnRead, btnIssue, btnErase, btnVerify, btnBuzzer, btnSwap;
        private CheckBox cbTest, cbSound;
        private int pendingHotelId;
        private string pendingLockNo, pendingExpiry;
        private DateTimePicker dtExpiry;
        private readonly System.Collections.Generic.List<IntPtr> libraries = new System.Collections.Generic.List<IntPtr>();

        public MainForm(string sdkVariant)
        {
            variant = sdkVariant;
            root = AppDomain.CurrentDomain.BaseDirectory;
            dllFolder = Path.Combine(Path.Combine(root, "sdk"), variant);
            Text = "Seven RFID Studio 2.2 · SDK V0925 · " + variant;
            Width = 1020; Height = 810; MinimumSize = new Size(1020, 810);
            Font = new Font("Segoe UI", 9.5f);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = bg; ForeColor = fg;
            BuildInterface();
            Load += delegate { Boot(); };
            FormClosing += delegate { Disconnect(); };
        }

        private Label AddLabel(string text, int x, int y, int width, int height, float size, bool bold, Color color)
        {
            Label l = new Label(); l.Text=text; l.Location=new Point(x,y); l.Size=new Size(width,height);
            l.Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular);
            l.ForeColor=color; l.BackColor=Color.Transparent; Controls.Add(l); return l;
        }
        private Button AddButton(string text, int x, int y, int width, EventHandler click, bool accent)
        {
            Button b = new Button(); b.Text=text; b.Location=new Point(x,y); b.Size=new Size(width,37);
            b.FlatStyle=FlatStyle.Flat; b.FlatAppearance.BorderSize=1;
            b.BackColor=accent ? Color.FromArgb(20, 110, 104) : pane;
            b.FlatAppearance.BorderColor=accent ? Color.FromArgb(31, 174, 157) : surface;
            b.ForeColor=fg; b.Cursor=Cursors.Hand; b.Click += click; Controls.Add(b); return b;
        }
        private TextBox TextEntry(int x, int y, int width, string initial)
        {
            TextBox t = new TextBox(); t.Location=new Point(x,y);t.Width=width;t.Text=initial;
            t.BackColor=pane;t.ForeColor=fg;t.BorderStyle=BorderStyle.FixedSingle;
            Controls.Add(t);return t;
        }
        private void BuildInterface()
        {
            headline=AddLabel("SEVEN   /   RFID STUDIO", 23, 16, 550, 38, 19, true, fg);
            subtitle=AddLabel("Moteur fabricant · ProUSB · Windows x86 · Application indépendante", 26, 55, 800, 25, 9, false, muted);
            status=AddLabel("Initialisation...",26,93,930,27,11,true,teal);
            btnConnect=AddButton("Connecter le S18",25,136,157,delegate { Connect(); },true);
            btnRead=AddButton("Lire le badge",189,136,149,delegate { ReadBadge(true); },true);
            btnVerify=AddButton("Relire / vérifier",345,136,157,delegate { ReadBadge(true); },false);
            btnBuzzer=AddButton("Tester buzzer",509,136,123,delegate { Beep(); },false);
            btnSwap=AddButton("Changer de port SDK",639,136,186,delegate { Swap(); },false);
            AddButton("Exporter le journal",832,136,156,delegate { SaveReport(); },false);
            btnRead.Enabled=false;btnVerify.Enabled=false;btnBuzzer.Enabled=false;
            AddLabel("CARTE DÉTECTÉE",26,192,210,21,9,true,muted);
            lblType=AddLabel("Type : —",27,221,375,25,11,true,fg);
            lblId=AddLabel("Séquence : —",416,221,560,25,11,false,fg);
            lblExpiry=AddLabel("Date d'expiration : —",27,252,920,23,9,false,muted);
            AddLabel("RÉPONSE COMPLÈTE DE LA DLL  ·  sans masquage",26,292,650,22,9,true,muted);
            raw = new TextBox(); raw.Location=new Point(26,320);raw.Size=new Size(958,137);
            raw.Multiline=true;raw.ReadOnly=true;raw.WordWrap=false;raw.ScrollBars=ScrollBars.Both;
            raw.Font=new Font("Consolas",10);raw.BackColor=pane;raw.ForeColor=fg;
            raw.Text="En attente d’une lecture. Aucun badge n’a encore été validé."; Controls.Add(raw);
            AddLabel("ÉMISSION / EFFACEMENT  ·  BADGES DE TEST UNIQUEMENT",26,468,750,23,9,true,muted);
            AddLabel("ID hôtel autorisé",26,499,155,20,9,false,muted);
            txtHotelId=TextEntry(26,519,180,"");
            AddLabel("Serrure SDK (HEX)",220,499,155,20,9,false,muted);
            txtLock=TextEntry(220,519,145,"");
            AddLabel("Dai",381,499,100,20,9,false,muted);
            txtDai=TextEntry(381,519,102,"1");
            AddLabel("N° carte (0–15)",497,499,135,20,9,false,muted);
            txtCardNo=TextEntry(497,519,117,"0");
            AddLabel("Expiration du badge",633,499,170,20,9,false,muted);
            dtExpiry = new DateTimePicker();dtExpiry.Location=new Point(633,519);dtExpiry.Width=352;
            dtExpiry.Format=DateTimePickerFormat.Custom;dtExpiry.CustomFormat="dd/MM/yyyy HH:mm";
            dtExpiry.Value=DateTime.Now.AddDays(1);Controls.Add(dtExpiry);
            cbTest=new CheckBox();cbTest.Location=new Point(26,565);cbTest.Width=920;cbTest.Height=26;
            cbTest.Text="Je confirme : badge de TEST, serrure isolée, et autorisation d'utiliser cet identifiant d'hôtel.";
            cbTest.ForeColor=fg; cbTest.CheckedChanged+=delegate { UpdateButtons(); }; Controls.Add(cbTest);
            btnIssue=AddButton("ÉCRIRE carte CLIENT test",26,598,252,delegate { Issue(); },true);
            btnErase=AddButton("Effacer le badge TEST",288,598,209,delegate { Erase(); },false);
            btnIssue.Enabled=false;btnErase.Enabled=false;
            cbSound=new CheckBox();cbSound.Location=new Point(520,603);cbSound.Width=465;cbSound.Height=28;
            cbSound.Text="Signal après lecture / écriture vérifiée (500 ms)";cbSound.ForeColor=fg;
            cbSound.Checked=false;Controls.Add(cbSound);
            AddLabel("JOURNAL D'EXÉCUTION",26,651,450,19,9,true,muted);
            journal=new TextBox();journal.Location=new Point(26,674);journal.Size=new Size(958,86);
            journal.Multiline=true;journal.ReadOnly=true;journal.ScrollBars=ScrollBars.Vertical;
            journal.BackColor=pane;journal.ForeColor=fg;journal.Font=new Font("Consolas",9);
            Controls.Add(journal);
        }
        private void Log(string s)
        {
            string line="[" + DateTime.Now.ToString("HH:mm:ss") + "] " + s;
            trace.AppendLine(line);journal.AppendText(line + Environment.NewLine);
        }
        private void SetStatus(string s, bool positive)
        {
            status.Text=s;status.ForeColor=positive ? teal : Color.FromArgb(251, 191, 36);
        }
        private void Boot()
        {
            if (IntPtr.Size != 4) { SetStatus("ERREUR : Seven doit fonctionner en 32 bits.",false);btnConnect.Enabled=false;return; }
            if (!Directory.Exists(dllFolder)) { SetStatus("Dossier SDK introuvable : " + dllFolder,false);btnConnect.Enabled=false;return; }
            Native.SetDllDirectory(dllFolder);
            string[] names = {"MSVCRTD.DLL","MFC42D.DLL","d12.dll","d12c.dll","AESDIT.dll","Card.dll","proRFL.dll"};
            foreach (string name in names)
            {
                string path = Path.Combine(dllFolder,name);
                if (!File.Exists(path)) { Log("DLL ABSENTE : " + path);btnConnect.Enabled=false;continue; }
                IntPtr h = Native.LoadLibrary(path);
                if (h==IntPtr.Zero) { Log("DLL NON CHARGÉE : " + name + " / erreur Win32 " + Marshal.GetLastWin32Error());btnConnect.Enabled=false; }
                else { libraries.Add(h);Log("DLL OK : " + name); }
            }
            if (!btnConnect.Enabled) {SetStatus("Les bibliothèques du SDK ne sont pas prêtes.",false);return;}
            SetStatus("SDK " + variant + " chargé ; S18 non connecté.",true);
            try
            {
                byte[] version=new byte[256];
                int code=Native.GetDLLVersion(version);
                Log("GetDLLVersion : code=" + code + " ; " + DecodeC(version));
            }
            catch(Exception e) {Log("Version SDK indisponible : " + e.Message);}
        }
        private static string DecodeC(byte[] bytes)
        {
            int n=Array.IndexOf(bytes,(byte)0);if(n<0)n=bytes.Length;
            return Encoding.ASCII.GetString(bytes,0,n);
        }
        private static bool OnlyHex(string s)
        {
            if (s.Length==0 || (s.Length%2)!=0)return false;
            for(int i=0;i<s.Length;i++)
            {
                char c=s[i];if(!((c>='0' && c<='9')||(c>='A' && c<='F')||(c>='a' && c<='f')))return false;
            }
            return true;
        }
        private static bool IdenticalBytes(string s)
        {
            if(s.Length<4)return true;
            string first=s.Substring(0,2);
            for(int i=2;i<s.Length;i+=2) if(s.Substring(i,2)!=first)return false;
            return true;
        }
        private void Connect()
        {
            try
            {
                int rc=Native.InitializeUSB(1); Log("initializeUSB(1) : code="+rc);
                connected=(rc==0);btnConnect.Enabled=!connected;
                if(connected){SetStatus("S18 connecté (mode ProUSB=1). Lecture carte non encore vérifiée.",true);}
                else SetStatus("Échec de connexion au S18 (code="+rc+").",false);
                UpdateButtons();
            }
            catch(Exception e) {Log("ERREUR connexion : "+e.Message);SetStatus("Impossible d'ouvrir le lecteur : "+e.Message,false);}
        }
        private static string NameType(string type)
        {
            switch(type)
            {
                case "0":return "Carte système";
                case "1":return "Carte journal";
                case "2":return "Paramètres chambre";
                case "3":return "Mise à l'heure";
                case "4":return "Carte perdue";
                case "5":return "Carte groupe configuration";
                case "6":return "Carte CLIENT";
                case "7":return "Carte de départ";
                case "8":return "Carte groupe";
                case "A":return "Carte d'urgence";
                case "B":return "Carte MAÎTRE";
                case "C":return "Carte bâtiment";
                case "D":return "Carte étage";
                case "F":return "Carte vierge";
                default:return "Type inconnu ("+type+")";
            }
        }
        private CardResult ReadNative()
        {
            byte[] b=new byte[4096];for(int i=0;i<b.Length;i++)b[i]=0xA5;
            int code=Native.ReadCard(1,b);
            CardResult card=new CardResult();card.ReturnCode=code;
            card.Data=DecodeC(b);card.Message="";card.TypeCode="";card.VerifiedFormat=false;
            if(code!=0) {card.Message="Erreur du SDK (code="+code+").";return card;}
            if(card.Data.Length<32) {card.Message="Réponse trop courte ; pas de carte confirmée.";return card;}
            if(!OnlyHex(card.Data)) {card.Message="Réponse non hexadécimale ; lecture non validée.";return card;}
            if(!card.Data.StartsWith("551501",StringComparison.OrdinalIgnoreCase))
            {card.Message="Marqueur SDK 551501 absent ; lecture non validée.";return card;}
            if(IdenticalBytes(card.Data)) {card.Message="Réponse répétitive suspecte ; lecture non validée.";return card;}
            card.VerifiedFormat=true;
            card.Message="Format SDK reconnu ; vérifier la carte et sa réponse.";
            card.Sequence=card.Data.Substring(24,8);
            card.Blank=(card.Sequence.Equals("FFFFFFFF",StringComparison.OrdinalIgnoreCase));
            if(card.Blank)card.TypeCode="F";
            else
            {
                try
                {
                    byte[] typ=new byte[64];int tr=Native.GetCardType(card.Data,typ);
                    Log("GetCardTypeByCardDataStr : retour="+tr+" / "+DecodeC(typ));
                    if(tr==0){string value=DecodeC(typ);if(value.Length>0)card.TypeCode=value.Substring(0,1).ToUpperInvariant();}
                }
                catch(Exception ex){Log("Décodage type indisponible : "+ex.Message);}
            }
            return card;
        }
        private void ReadBadge(bool show)
        {
            if(!connected||busy)return;
            busy=true;UpdateButtons();
            try
            {
                CardResult r=ReadNative();lastCard=r;
                raw.Text="Code retour : "+r.ReturnCode+Environment.NewLine+
                    "Longueur : "+r.Data.Length+" caractères ASCII"+Environment.NewLine+
                    "Données complètes (brutes) :"+Environment.NewLine+r.Data;
                if(r.VerifiedFormat)
                {
                    lblType.Text="Type : "+NameType(r.TypeCode);
                    lblId.Text="Séquence : "+r.Sequence;
                    lblExpiry.Text="Expiration : non déterminée";
                    if(r.TypeCode=="6")
                    {
                        int id;
                        if(int.TryParse(txtHotelId.Text,out id) && id>0)
                        {
                            try
                            {
                                byte[] lockOut=new byte[128];byte[] expiryOut=new byte[128];
                                int lr=Native.GetGuestLockNo(id,r.Data,lockOut);
                                int er=Native.GetGuestExpiry(id,r.Data,expiryOut);
                                Log("Détails client : chambre/serrure rc="+lr+" ; expiration rc="+er);
                                if(lr==0)
                                {
                                    string sdkLock=DecodeC(lockOut).Trim();
                                    lblId.Text="Séquence : "+r.Sequence+"   ·   Serrure SDK : "+sdkLock;
                                    if(sdkLock.Length>0 && sdkLock.Length<=8)
                                    {
                                        txtLock.Text=sdkLock;
                                        Log("Numéro de serrure SDK récupéré depuis la carte CLIENT reconnue ; champ renseigné automatiquement.");
                                    }
                                }
                                if(er==0)lblExpiry.Text="Expiration SDK : "+DecodeC(expiryOut);
                                if(lr==2||er==2)lblExpiry.Text="Identifiant hôtel différent : impossible de décoder.";
                            }
                            catch(Exception e){Log("Décodage détails : "+e.Message);}
                        }
                    }
                    SetStatus("Lecture reconnue : "+NameType(r.TypeCode)+". "+r.Message,true);
                    if(pendingHotelId>0)
                    {
                        // Verifier l'encodage par fonctions SDK, et NON sur le seul code de retour GuestCard.
                        bool verified=VerifyExpectedGuest(r,pendingHotelId,pendingLockNo,pendingExpiry);
                        if(verified)
                        {
                            SetStatus("ECRITURE VERIFIEE : la carte relue contient la serrure et l'expiration attendues.",true);
                            Log("Controle apres ecriture : type=CLIENT, serrure et date conformes.");
                            pendingHotelId=0;pendingLockNo=null;pendingExpiry=null;
                            TryOptionalSound();
                        }
                        else
                        {
                            SetStatus("ECRITURE NON CONFIRMEE : informations relues non conformes ou indisponibles.",false);
                            Log("Controle apres ecriture : non confirme ; verifier les champs et la compatibilite SDK.");
                        }
                    }
                    else TryOptionalSound();
                }
                else
                {
                    lblType.Text="Type : non déterminé";lblId.Text="Séquence : —";
                    lblExpiry.Text="Expiration : —";
                    SetStatus("LECTURE NON VALIDÉE : "+r.Message,false);
                }
                Log("ReadCard : code="+r.ReturnCode+" ; longueur="+r.Data.Length+" ; valide="+r.VerifiedFormat+
                    " ; message="+r.Message);
                // Raw data intentionally NOT added to persistent log unless exported deliberately.
            }
            catch(Exception e){lastCard=null;SetStatus("Lecture impossible : "+e.Message,false);Log("ERREUR lecture : "+e.Message);}
            finally {busy=false;UpdateButtons();}
        }
        private static string NormalizeNumber(string s)
        {
            if(string.IsNullOrEmpty(s))return "";
            s=s.Trim();int pos=0;
            while(pos<s.Length-1 && s[pos]=='0')pos++;
            return s.Substring(pos);
        }
        private bool VerifyExpectedGuest(CardResult r, int hotel, string lockNo, string expiry)
        {
            if(r==null || !r.VerifiedFormat || r.TypeCode!="6")
            {Log("Verification : la carte relue n'est pas une carte client reconnue.");return false;}
            try
            {
                byte[] lockOut=new byte[128]; byte[] expiryOut=new byte[128];
                int lr=Native.GetGuestLockNo(hotel,r.Data,lockOut);
                int er=Native.GetGuestExpiry(hotel,r.Data,expiryOut);
                string actualLock=DecodeC(lockOut).Trim();
                string actualExpiry=DecodeC(expiryOut).Trim();
                bool lockOk=lr==0 && string.Equals(NormalizeNumber(actualLock),NormalizeNumber(lockNo),StringComparison.OrdinalIgnoreCase);
                bool expiryOk=er==0 && actualExpiry==expiry;
                Log("Verification SDK : serrure rc="+lr+", correspondance="+lockOk+
                    "; expiration rc="+er+", correspondance="+expiryOk);
                lblId.Text="Séquence : "+r.Sequence+" · Serrure lue : "+actualLock;
                lblExpiry.Text="Expiration relue : "+actualExpiry;
                return lockOk && expiryOk;
            }
            catch(Exception ex){Log("Verification SDK impossible : "+ex.Message);return false;}
        }
        private void TryOptionalSound()
        {
            if(cbSound==null || !cbSound.Checked || !connected)return;
            try
            {
                int rc=Native.Buzzer(1,50);
                Log("Signal facultatif Buzzer(1,50) apres operation : retour="+rc+
                    " (500 ms demandes ; le nombre de bips n'est pas garanti).");
            }
            catch(Exception e){Log("Signal facultatif indisponible : "+e.Message);}
        }

        private bool Parameters(out int id, out byte no, out byte dai, out string lockNo, out string issued, out string expiry)
        {
            id=0;no=0;dai=0;lockNo="";issued="";expiry="";
            int n, d;
            if(!int.TryParse(txtHotelId.Text,out id)||id<=0){MessageBox.Show("Indique un ID hôtel valide obtenu de ton système autorisé.");return false;}
            if(!int.TryParse(txtCardNo.Text,out n)||n<0||n>15){MessageBox.Show("N° de carte entre 0 et 15.");return false;}
            if(!int.TryParse(txtDai.Text,out d)||d<0||d>255){MessageBox.Show("Dai entre 0 et 255.");return false;}
            lockNo=txtLock.Text.Trim();
            if(lockNo.Length<1||lockNo.Length>8){MessageBox.Show("Le numéro de serrure doit contenir 1 à 8 caractères.");return false;}
            // L'exemple officiel Port1 fournit 01020A : le numéro interne de serrure peut contenir A-F.
            lockNo=lockNo.ToUpperInvariant();
            for(int i=0;i<lockNo.Length;i++)
            {
                char ch=lockNo[i];
                if(!((ch>='0' && ch<='9') || (ch>='A' && ch<='F')))
                {
                    MessageBox.Show("Numéro de serrure SDK attendu (1 à 8 caractères hexadécimaux, ex. 01020A). Ne pas substituer automatiquement le numéro affiché sur la porte.");
                    return false;
                }
            }
            if(dtExpiry.Value <= DateTime.Now){MessageBox.Show("Expiration doit être dans le futur.");return false;}
            if(dtExpiry.Value > DateTime.Now.AddDays(30)){MessageBox.Show("Pour ce prototype, durée de test maximale : 30 jours.");return false;}
            no=(byte)n;dai=(byte)d;issued=DateTime.Now.ToString("yyMMddHHmm",CultureInfo.InvariantCulture);
            expiry=dtExpiry.Value.ToString("yyMMddHHmm",CultureInfo.InvariantCulture);
            return true;
        }
        private bool VerifyCardBeforeMutation()
        {
            // Ensure the test card has not been removed or swapped since the last reading.
            // This does not authenticate the hotel system or prove a physical lock is isolated.
            CardResult check = ReadNative();
            if (lastCard == null || !check.VerifiedFormat ||
                !string.Equals(lastCard.Data, check.Data, StringComparison.Ordinal))
            {
                lastCard = null;
                SetStatus("Badge absent ou donnees modifiees : operation annulee.", false);
                Log("SECURITE : relecture prealable incompatible ; aucune operation d'ecriture effectuee.");
                MessageBox.Show("Le badge ne correspond plus a la derniere lecture. Relis ton badge de test avant de continuer.",
                    "Operation interrompue", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return false;
            }
            Log("Relecture prealable : meme carte de test toujours presente (format reconnu).");
            return true;
        }

        private void Issue()
        {
            if(!connected||busy||!cbTest.Checked||lastCard==null||!lastCard.VerifiedFormat)return;
            if(lastCard.TypeCode!="F" && lastCard.TypeCode!="6") {MessageBox.Show("Seules les cartes vierges ou CLIENT de test sont autorisées.");return;}
            int hotel;byte no,dai;string lockNo,issued,expiry;
            if(!Parameters(out hotel,out no,out dai,out lockNo,out issued,out expiry))return;
            if(MessageBox.Show("Émettre une carte CLIENT sur le badge actuellement posé ?\n\n"+
                "Hôtel : "+hotel+"\nSerrure : "+lockNo+"\nExpiration : "+dtExpiry.Value.ToString("g")+
                "\n\nUniquement badge ET serrure de test isolés.",
                "Confirmer l'encodage physique",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;
            busy=true;UpdateButtons();
            try
            {
                if (!VerifyCardBeforeMutation()) return;
                byte[] output=new byte[4096];
                int rc=Native.IssueGuest(1,hotel,no,dai,0,0,issued,expiry,lockNo,output);
                Log("GuestCard : code="+rc+" / fenêtre de validité "+issued+" -> "+expiry+" / serrure "+lockNo);
                string s=DecodeC(output);
                raw.Text="Résultat brut de GuestCard :"+Environment.NewLine+s;
                lastCard=null;
                if(rc==0)
                {
                    pendingHotelId=hotel;pendingLockNo=lockNo;pendingExpiry=expiry;
                    // Le SDK demande une relecture. L'utilisateur doit garder la carte en place.
                    SetStatus("GuestCard = 0. Clique sur « Relire / vérifier » sans retirer le badge.",false);
                    MessageBox.Show("La DLL a accepté l'écriture, mais le badge n'est PAS encore vérifié.\n"+
                        "Garde le badge sur le S18 et clique sur « Relire / vérifier ».\n"+
                        "Seven contrôlera le type CLIENT, la serrure et l'expiration.\n"+
                        "Test final : serrure isolée uniquement.",
                        "Écriture : vérification obligatoire",MessageBoxButtons.OK,MessageBoxIcon.Information);
                }
                else
                {
                    pendingHotelId=0;pendingLockNo=null;pendingExpiry=null;
                    if(rc==10)
                    {
                        Log("DIAGNOSTIC GuestCard=10 : erreur interne de la DLL ou échec de sous-opération ; la documentation SDK ne fournit pas de traduction officielle du code 10.");
                        Log("Vérifier le numéro interne de serrure (hexadécimal, pas nécessairement le numéro de chambre), l'ID hôtel depuis une carte autorisée, et la dépendance à CardLock.");
                        SetStatus("Écriture non réalisée (GuestCard=10). Vérifier serrure SDK et initialisation.",false);
                    }
                    else SetStatus("Écriture refusée par le SDK : code="+rc,false);
                }
            }
            catch(Exception e){Log("ERREUR GuestCard : "+e.Message);SetStatus("Écriture échouée.",false);}
            finally{busy=false;UpdateButtons();}
        }
        private void Erase()
        {
            if(!connected||busy||!cbTest.Checked||lastCard==null||!lastCard.VerifiedFormat)return;
            if(lastCard.TypeCode!="6") {MessageBox.Show("Effacement autorisé uniquement après lecture d'une carte CLIENT de test.");return;}
            int id;
            if(!int.TryParse(txtHotelId.Text,out id)||id<=0){MessageBox.Show("L'ID hôtel valide est requis.");return;}
            if(MessageBox.Show("Cette opération modifie physiquement le badge CLIENT actuellement posé.\nConfirmer qu'il s'agit d'une carte TEST hors service ?",
                "Effacement irréversible du badge test",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;
            busy=true;UpdateButtons();
            try
            {
                if (!VerifyCardBeforeMutation()) return;
                byte[] output=new byte[4096];int rc=Native.EraseCard(1,id,output);
                Log("CardErase : code="+rc);
                raw.Text="Résultat brut CardErase :"+Environment.NewLine+DecodeC(output);
                lastCard=null;
                pendingHotelId=0;pendingLockNo=null;pendingExpiry=null;
                if(rc==0)
                {
                    SetStatus("Effacement signalé par SDK. Relis le badge pour vérifier son nouvel état.",false);
                }
                else SetStatus("Effacement non confirmé, code SDK="+rc,false);
            }
            catch(Exception e){Log("ERREUR CardErase : "+e.Message);SetStatus("Effacement échoué.",false);}
            finally{busy=false;UpdateButtons();}
        }
        private void Beep()
        {
            if(!connected||busy)return;
            try {int rc=Native.Buzzer(1,50);Log("Buzzer(1,50) : code="+rc+". 500 ms demandes, nombre de bips determine par le lecteur.");}
            catch(Exception e){Log("ERREUR Buzzer : "+e.Message);}
        }
        private void UpdateButtons()
        {
            btnRead.Enabled=connected&&!busy;
            btnVerify.Enabled=connected&&!busy;
            btnBuzzer.Enabled=connected&&!busy;
            bool allowed=connected&&!busy&&cbTest.Checked&&lastCard!=null&&lastCard.VerifiedFormat;
            btnIssue.Enabled=allowed&&(lastCard.TypeCode=="F"||lastCard.TypeCode=="6");
            btnErase.Enabled=allowed&&lastCard.TypeCode=="6";
        }
        private void Disconnect()
        {
            if(connected){try{Native.CloseUSB(1);Log("CloseUSB(1)");}catch(Exception e){Log("CloseUSB : "+e.Message);}connected=false;}
            // Deliberately do not FreeLibrary during FormClosing: runtime may retain bound P/Invoke thunks.
        }
        private void Swap()
        {
            if(busy)return;
            string target=variant=="Port1"?"Port2":"Port1";
            Disconnect();
            try {Process.Start(Application.ExecutablePath,"--"+target.ToLowerInvariant());Close();}
            catch(Exception e){MessageBox.Show("Impossible de démarrer "+target+" : "+e.Message);}
        }
        private void SaveReport()
        {
            using(SaveFileDialog dialog=new SaveFileDialog())
            {
                dialog.Title="Exporter le diagnostic Seven RFID";dialog.Filter="Texte UTF-8 (*.txt)|*.txt";
                dialog.FileName="Seven-RFID-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+".txt";
                if(dialog.ShowDialog()!=DialogResult.OK)return;
                string body="Seven RFID Studio SDK v2.1\r\nVariante : "+variant+"\r\nDate : "+DateTime.Now+"\r\n\r\n"+
                    "ATTENTION : ce rapport contient toutes les données du badge en clair.\r\n\r\n"+
                    "--- DONNEES BRUTES ---\r\n"+raw.Text+"\r\n\r\n--- JOURNAL ---\r\n"+trace.ToString();
                File.WriteAllText(dialog.FileName,body,new UTF8Encoding(true));
                Log("Rapport enregistré : "+dialog.FileName);
            }
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
            string port=(args.Length>0&&args[0].Equals("--port2",StringComparison.OrdinalIgnoreCase))?"Port2":"Port1";
            Application.Run(new MainForm(port));
        }
    }
}
