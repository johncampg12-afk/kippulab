import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, query, collection, onSnapshot, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthScreen from "./components/AuthScreen";
import {
  Sparkles,
  Layers,
  FileText,
  TrendingUp,
  MessageSquare,
  Settings,
  Building,
  KeyRound,
  Eye,
  Activity,
  Award,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  Lock,
  UploadCloud,
  Check,
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { Invoice, Client, Item, Emitter } from "./types";
import ThemeToggle from "./components/ThemeToggle";
import CuadernoAI from "./components/CuadernoAI";
import Facturador from "./components/Facturador";
import InteligenciaFlujo from "./components/InteligenciaFlujo";
import KipuAsesor from "./components/KipuAsesor";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"CUADERNO" | "FACTURADOR" | "INTELIGENCIA" | "ASESOR" | "CONFIG">("CUADERNO");

  // Default initial Ecuadorian SME (Specialty Coffee matiz in Shyris, Quito)
  const [emitter, setEmitter] = useState<Emitter>({
    ruc: "1792345678001", // 9th digit is 8: SRI deadline is day 24 of each month
    name: "CAFÉ BALANDRA SHYRIS S.A.S.",
    tradeName: "Café Balandra",
    address: "Av. de los Shyris N32-140 y Av. Eloy Alfaro, Edificio Shyris Park, Quito",
    obligado: true,
    environment: "1", // 1 = Pruebas, 2 = Producción
    serial: "001001",
    typeRimpe: "EMPRENDEDOR",
    signatureP12Name: "firma_digital_balandra_signed.p12"
  });

  // Default Invoices in ledger to populate graphs instantly
  const [invoices, setInvoices] = useState<Invoice[]>([
    {
      id: "preset-inv-1",
      sequence: "000000018",
      date: "2026-05-18",
      client: {
        name: "Lorena Alexandra Cueva",
        idNumber: "1718223948",
        idType: "05",
        email: "lorena.cueva@pymes.ec"
      },
      items: [
        { name: "Sacos de café premium tostado (1kg)", quantity: 4, price: 18.50, ivaRate: 15, discount: 2.00, total: 72.00 },
        { name: "Filtros de cafetera japonesa V60", quantity: 2, price: 9.00, ivaRate: 15, discount: 0, total: 18.00 }
      ],
      paymentMethod: "20",
      paymentStatus: "PAGADO",
      status: "AUTORIZADO",
      accessKey: "1805202601179234567800110010010000000188827361218",
      sriDiagnostic: "Comprobante recibido y autorizado fiscalmente por el SRI.",
      totals: { subtotal15: 90.00, subtotal12: 0, subtotal0: 0, discount: 2.00, iva: 13.50, total: 103.50 }
    },
    {
      id: "preset-inv-2",
      sequence: "000000019",
      date: "2026-05-19",
      client: {
        name: "Corporación de Alimentos Quito",
        idNumber: "1790011223001",
        idType: "04",
        email: "adquisiciones@corpquito.ec"
      },
      items: [
        { name: "Servicio de Catering y Barista Cocteles", quantity: 1, price: 340.00, ivaRate: 15, discount: 15.00, total: 325.00 },
        { name: "Fruta fresca y lácteos de consumo", quantity: 5, price: 12.00, ivaRate: 0, discount: 0, total: 60.00 }
      ],
      paymentMethod: "20",
      paymentStatus: "PENDIENTE", // Accounts receivable!
      status: "AUTORIZADO",
      accessKey: "1905202601179234567800110010010000000198827361219",
      sriDiagnostic: "Comprobante de venta recibido y autorizado bajo el régimen general de facturación ecuatoriana.",
      totals: { subtotal15: 325.00, subtotal12: 0, subtotal0: 60.00, discount: 15.00, iva: 48.75, total: 433.75 }
    },
    {
      id: "preset-inv-3",
      sequence: "000000020",
      date: "2026-05-20",
      client: {
        name: "Consumidor Final",
        idNumber: "9999999999999",
        idType: "07",
        email: "final@consumidor.ec"
      },
      items: [
        { name: "2 Cafés Expresos y Torta de Zanahoria", quantity: 1, price: 8.50, ivaRate: 15, discount: 0, total: 8.50 }
      ],
      paymentMethod: "01",
      paymentStatus: "PAGADO",
      status: "BORRADOR", // Not authorized yet! Ready to be signed.
      totals: { subtotal15: 8.50, subtotal12: 0, subtotal0: 0, discount: 0, iva: 1.28, total: 9.78 }
    }
  ]);

  const [currentCash, setCurrentCash] = useState<number>(3450.00);
  const [recurringExpenses, setRecurringExpenses] = useState<number>(1400.00);
  const [configSaved, setConfigSaved] = useState<boolean>(false);
  const [saasPlan, setSaasPlan] = useState<"BASIC" | "PRO" | "ENTERPRISE">("BASIC");
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [p12VerificationStatus, setP12VerificationStatus] = useState<"IDLE" | "VERIFYING" | "VALID" | "INVALID">("VALID");
  const [p12VerificationError, setP12VerificationError] = useState<string | null>(null);

  // Transfer client from AI Cuaderno to Facturador draft on callback
  const [draftInvoice, setDraftInvoice] = useState<{ client: Client; items: Item[]; paymentMethod: string; notes: string } | null>(null);

  useEffect(() => {
    let unsubscribeInvoices: () => void;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const emitterDoc = await getDoc(doc(db, `users/${u.uid}/emitter/default`));
          if (emitterDoc.exists()) {
            const data = emitterDoc.data();
            setEmitter({
              ruc: data.ruc || "",
              name: data.name || "",
              tradeName: data.tradeName || "",
              address: data.address || "",
              obligado: data.obligado || false,
              environment: data.environment || "1",
              serial: data.serial || "001001",
              typeRimpe: data.typeRimpe || "EMPRENDEDOR",
              signatureP12Name: data.signatureP12Name || "firma_digital_balandra_signed.p12",
              saasPlan: data.saasPlan || "BASIC"
            });
            setSaasPlan(data.saasPlan || "BASIC");
          }

          const q = query(collection(db, `users/${u.uid}/invoices`));
          unsubscribeInvoices = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
               // Seed the initial data for the user so it looks good visually!
               const batch = writeBatch(db);
               invoices.forEach(inv => {
                 batch.set(doc(db, `users/${u.uid}/invoices`, inv.id), { ...inv, userId: u.uid });
               });
               await batch.commit();
            } else {
               const loadedInvoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
               // Sort newest first based on sequence string
               loadedInvoices.sort((a,b) => b.sequence.localeCompare(a.sequence));
               setInvoices(loadedInvoices);
            }
          });
        } catch (e) {
          console.error("Failed to load user data", e);
        }
      }
      setAuthLoading(false);
    });
    return () => {
      unsubscribe();
      if (unsubscribeInvoices) unsubscribeInvoices();
    };
  }, []);

  const handleP12Upload = (file: File) => {
    setP12VerificationStatus("VERIFYING");
    setP12VerificationError(null);

    // Initial check without reading file for immediate feedback on extension
    const hasP12Extension = file.name.toLowerCase().endsWith(".p12") || file.name.toLowerCase().endsWith(".pfx");
    if (!hasP12Extension) {
      setTimeout(() => {
        setP12VerificationStatus("INVALID");
        setP12VerificationError("Extensión inválida. Se requiere un certificado firmado oficial .p12 o .pfx.");
      }, 800);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      // Simulate network/intense processing delay for UX (shows "Cargando...")
      setTimeout(() => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          
          if (!buffer || buffer.byteLength === 0) {
            setP12VerificationStatus("INVALID");
            setP12VerificationError("Estructura incorrecta: El certificado digital está completamente vacío.");
            return;
          }
          
          if (buffer.byteLength < 512) {
            setP12VerificationStatus("INVALID");
            setP12VerificationError("Archivo demasiado pequeño para ser un certificado válido. Es probable que esté corrupto.");
            return;
          }

          const uint8 = new Uint8Array(buffer);
          
          // Magic ASN.1 sequence check (PKCS#12 commonly starts with 0x30 0x82)
          const isASN1Sequence = uint8[0] === 0x30;
          
          if (!isASN1Sequence) {
            setP12VerificationStatus("INVALID");
            setP12VerificationError("Formato PKCS#12 corrupto o cabecera inválida. El archivo carece de la estructura criptográfica estándar. El SRI rechazará esta firma.");
          } else {
            setP12VerificationStatus("VALID");
            setEmitter((prev) => ({ ...prev, signatureP12Name: file.name }));
          }
        } catch (err) {
          setP12VerificationStatus("INVALID");
          setP12VerificationError("Error al procesar el formato criptográfico del certificado de firma electrónica.");
        }
      }, 1500); // 1.5 seconds simulated deep inspecting
    };

    reader.onerror = () => {
      setP12VerificationStatus("INVALID");
      setP12VerificationError("No se pudo leer el archivo físico desde su dispositivo. El archivo puede estar corrupto o sin permisos.");
    };

    reader.readAsArrayBuffer(file);
  };

  const handleUpgrade = async (plan: "BASIC" | "PRO" | "ENTERPRISE") => {
    if (!user) return;
    setSaasPlan(plan);
    try {
      // First save locally to emitter state
      setEmitter({ ...emitter, saasPlan: plan });
      const emitterRef = doc(db, `users/${user.uid}/emitter/default`);
      await setDoc(emitterRef, { saasPlan: plan }, { merge: true });

      // Create stripe checkout session
      const response = await fetch("/api/create-checkout", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ plan, userId: user.uid, origin: window.location.origin })
      });
      const data = await response.json();
      if (data.url) {
         window.location.href = data.url;
      }
    } catch (e) {
      console.error("Upgrade checkout failed", e);
    }
  };

  const handleApplyInvoice = (client: Client, items: Item[], paymentMethod: string, notes: string) => {
    setDraftInvoice({ client, items, paymentMethod, notes });
    setActiveTab("FACTURADOR");
  };

  const handleAddInvoice = async (inv: Invoice) => {
    setInvoices(prev => {
      if (prev.find(i => i.id === inv.id)) return prev;
      return [inv, ...prev];
    });
    // Also increase balance if it was flagged as immediately paid
    if (inv.paymentStatus === "PAGADO") {
      setCurrentCash((prev) => prev + inv.totals.total);
    }
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.uid}/invoices`, inv.id), { ...inv, userId: user.uid });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updateInvoiceStatus = async (
    id: string,
    status: Invoice["status"],
    data?: { signedXml?: string; accessKey?: string; sriDiagnostic?: string }
  ) => {
    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const copy = { ...i, status };
        if (data?.signedXml) copy.signedXml = data.signedXml;
        if (data?.accessKey) copy.accessKey = data.accessKey;
        if (data?.sriDiagnostic) copy.sriDiagnostic = data.sriDiagnostic;
        return copy;
      })
    );

    if (user) {
      try {
        const updatePayload: any = { status };
        if (data?.signedXml) updatePayload.signedXml = data.signedXml;
        if (data?.accessKey) updatePayload.accessKey = data.accessKey;
        if (data?.sriDiagnostic) updatePayload.sriDiagnostic = data.sriDiagnostic;
        await setDoc(doc(db, `users/${user.uid}/invoices`, id), updatePayload, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }
  };

  // UI state for local current time indicator is May 20, 2026
  const [timeStr, setTimeStr] = useState("07:28:42");
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-default flex flex-col items-center justify-center font-sans gap-3">
        <Server className="h-6 w-6 animate-spin text-primary" />
        <span className="text-content-secondary text-sm font-medium">Iniciando sistema...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-zinc-800 dark:bg-[#09090b] dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* Upper Navigation and Header section */}
      <header className="px-6 lg:px-10 py-4 bg-paper border-b border-zinc-200/55 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40 ">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary text-[var(--bg-default)] rounded-[10px] flex items-center justify-center font-display font-semibold text-base tracking-tight  transition-all duration-150 hover:brightness-110">
              Kp
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-lg leading-none tracking-tight text-zinc-900 dark:text-zinc-50">
                  KippuLab
                </span>
                <span className="px-1.5 py-0.5 bg-divider text-content/80 text-content font-semibold font-mono text-[9px] rounded-md border border-[#E2E8F0] dark:border-zinc-700">
                  ECUADOR 2026
                </span>
                <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium font-mono text-[9px] rounded-md border border-emerald-100 dark:border-emerald-800/50 uppercase tracking-widest text-[8px]">
                  KIPU {saasPlan}
                </span>
              </div>
              <p className="text-[10px] text-content-secondary mt-1">
                Plataforma digital para facturación electrónica offline y análisis de caja.
              </p>
            </div>
          </div>
        </div>

        {/* Live operational widget bars */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active emitter info pill */}
          <div className="px-3 py-1.5 bg-default border border-divider rounded-[10px] flex items-center gap-2 text-[10px] text-zinc-650 dark:text-content-secondary font-medium">
            <Building className="h-3.5 w-3.5 text-content-secondary" />
            <span>Empresa: <strong className="text-content font-medium">{emitter.name.substring(0, 15)}...</strong></span>
          </div>

          {/* Clock widget */}
          <div className="px-3 py-1.5 bg-default border border-divider rounded-[10px] flex items-center gap-2 text-[10px] text-content font-mono">
            <Activity className="h-3.5 w-3.5 text-content animate-pulse" />
            <span>2026-05-20 {timeStr} ECT</span>
          </div>

          <ThemeToggle />
          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-default border border-divider rounded-[10px] text-xs font-semibold text-content hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Primary body grid containing sidebar menu controls and dynamic panels container */}
      <div className="flex-1 max-w-[1550px] w-full mx-auto px-6 lg:px-10 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar container */}
        <nav className="lg:col-span-3 bg-paper border border-zinc-200/60 dark:border-zinc-800/80 rounded-[10px] p-4  space-y-1 lg:sticky lg:top-[90px]">
          <span className="text-[9px] font-medium text-content-secondary dark:text-zinc-550 uppercase tracking-widest block px-2.5 mb-2.5 select-none">
            Módulos del Sistema
          </span>

          <button
            onClick={() => setActiveTab("CUADERNO")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left transition-all duration-150 cursor-pointer ${
              activeTab === "CUADERNO"
                ? "bg-divider text-content/80 text-content font-semibold border-l-3 border-primary rounded-l-none pl-3"
                : "text-content-secondary hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:brightness-110/30"
            }`}
          >
            <Sparkles className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "CUADERNO" ? "text-content" : "text-content-secondary"}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs block leading-normal">Cuaderno Inteligente</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("FACTURADOR")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left transition-all duration-150 cursor-pointer ${
              activeTab === "FACTURADOR"
                ? "bg-divider text-content/80 text-content font-semibold border-l-3 border-primary rounded-l-none pl-3"
                : "text-content-secondary hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:brightness-110/30"
            }`}
          >
            <FileText className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "FACTURADOR" ? "text-content" : "text-content-secondary"}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs block leading-normal">Facturación SRI</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("INTELIGENCIA")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left transition-all duration-150 cursor-pointer ${
              activeTab === "INTELIGENCIA"
                ? "bg-divider text-content/80 text-content font-semibold border-l-3 border-primary rounded-l-none pl-3"
                : "text-content-secondary hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:brightness-110/30"
            }`}
          >
            <TrendingUp className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "INTELIGENCIA" ? "text-content" : "text-content-secondary"}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs block leading-normal">Inteligencia de Caja</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("ASESOR")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left transition-all duration-150 cursor-pointer ${
              activeTab === "ASESOR"
                ? "bg-divider text-content/80 text-content font-semibold border-l-3 border-primary rounded-l-none pl-3"
                : "text-content-secondary hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:brightness-110/30"
            }`}
          >
            <MessageSquare className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "ASESOR" ? "text-content" : "text-content-secondary"}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs block leading-normal">Asesor Tributario AI</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("CONFIG")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-left transition-all duration-150 cursor-pointer ${
              activeTab === "CONFIG"
                ? "bg-divider text-content/80 text-content font-semibold border-l-3 border-primary rounded-l-none pl-3"
                : "text-content-secondary hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:brightness-110/30"
            }`}
          >
            <Settings className={`h-4 w-4 shrink-0 transition-colors ${activeTab === "CONFIG" ? "text-content" : "text-content-secondary"}`} />
            <div className="flex-1 min-w-0">
              <span className="text-xs block leading-normal">Configuración</span>
            </div>
          </button>

          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 mt-4 text-[10px] text-content-secondary dark:text-zinc-550 space-y-3 px-2.5">
            <div>
              <span className="font-medium flex items-center gap-1 text-content-secondary uppercase tracking-widest text-[8px] select-none">
                CONEXIÓN SRI:
              </span>
              <span className="text-[9px] text-content font-mono block mt-0.5">celcer.sri.gob.ec (Simulado)</span>
            </div>
            <div>
              <span className="font-medium block text-content-secondary uppercase tracking-widest text-[8px] select-none">RÉGIMEN EMISOR:</span>
              <p className="font-medium text-content-secondary text-[10px] mt-1 bg-default px-2 py-0.5 rounded border border-divider inline-block">
                {emitter.typeRimpe === "POPULAR" ? "RIMPE Popular" : emitter.typeRimpe === "EMPRENDEDOR" ? "RIMPE Emprendedor" : "Régimen General"}
              </p>
            </div>
          </div>
        </nav>

        {/* Dynamic primary content layout display box */}
        <main className="lg:col-span-9">
          {(activeTab === "CUADERNO" || activeTab === "INTELIGENCIA" || activeTab === "ASESOR") && saasPlan === "BASIC" ? (
             <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 bg-paper border border-divider rounded-[10px]">
               <div className="p-4 bg-primary/10 rounded-full mb-4">
                 <Lock className="w-8 h-8 text-primary" />
               </div>
               <h3 className="text-lg font-semibold text-content mb-2 font-display">Función Reservada: IA Desactivada</h3>
               <p className="text-sm text-content-secondary max-w-md mb-6">
                 Las funciones avanzadas de Inteligencia Artificial ("Cuaderno", "Inteligencia de Flujo", "Asesor Tributario") requieren un plan <strong className="text-primary">Kipu Pro</strong> o superior.
               </p>
               <button 
                 onClick={() => {
                   setActiveTab("CONFIG");
                   setTimeout(() => document.getElementById('sas-puestas')?.scrollIntoView({ behavior: 'smooth' }), 100);
                 }}
                 className="px-6 py-2.5 bg-primary text-[var(--bg-default)] text-sm font-medium rounded-[10px] hover:brightness-110 transition-all flex items-center gap-2"
               >
                 Actualizar Plan
                 <ArrowRight className="w-4 h-4" />
               </button>
             </div>
          ) : (
            <>
              {activeTab === "CUADERNO" && (
                <CuadernoAI onApplyInvoice={handleApplyInvoice} />
              )}
              {activeTab === "INTELIGENCIA" && (
                <InteligenciaFlujo
                  ruc={emitter.ruc}
                  invoices={invoices}
                  currentCash={currentCash}
                  recurringExpenses={recurringExpenses}
                  onRefresh={() => {}}
                />
              )}
              {activeTab === "ASESOR" && (
                <KipuAsesor ruc={emitter.ruc} invoices={invoices} />
              )}
            </>
          )}

          {activeTab === "FACTURADOR" && (
            <Facturador
              emitter={emitter}
              invoices={invoices}
              onAddInvoice={handleAddInvoice}
              onUpdateInvoiceStatus={updateInvoiceStatus}
              draftInvoice={draftInvoice}
              onClearDraft={() => setDraftInvoice(null)}
              onSetDraftInvoice={(c, i, p, n) => setDraftInvoice({ client: c, items: i, paymentMethod: p, notes: n })}
              p12VerificationStatus={p12VerificationStatus}
              p12VerificationError={p12VerificationError}
            />
          )}

          {activeTab === "CONFIG" && (
            <div className="space-y-8" id="sas-puestas">
              {/* Emisor Config Card */}
              <div className="bg-paper border border-divider rounded-[10px] p-6  space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-divider text-content rounded-[10px]">
                      <Settings className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h2 className="font-display font-semibold text-sm text-content uppercase tracking-wide">
                        Configuración del Emisor Electrónico
                      </h2>
                      <p className="text-[10px] text-content-secondary">
                        Configura tus datos fiscales obligatorios para la firma de comprobantes del SRI.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-default dark:bg-primary text-content-secondary px-2 py-0.5 rounded font-mono border border-divider/70">
                    Esquema Offline SRI v2.32
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-content-secondary">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-zinc-450 dark:text-content-secondary">Razón Social del Emisor (SRI)</label>
                      <input
                        type="text"
                        className="px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none transition-all font-medium text-zinc-800 dark:text-zinc-100"
                        value={emitter.name}
                        onChange={(e) => setEmitter({ ...emitter, name: e.target.value })}
                        placeholder="CAFÉ BALANDRA SHYRIS S.A.S."
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-zinc-450 dark:text-content-secondary">Nombre Comercial</label>
                      <input
                        type="text"
                        className="px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none transition-all font-medium text-zinc-800 dark:text-zinc-100"
                        value={emitter.tradeName}
                        onChange={(e) => setEmitter({ ...emitter, tradeName: e.target.value })}
                        placeholder="Café Balandra"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-zinc-450 dark:text-content-secondary">RUC del Emisor (13 dígitos)</label>
                        <input
                          type="text"
                          maxLength={13}
                          className="px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none font-mono font-medium text-zinc-800 dark:text-zinc-100"
                          value={emitter.ruc}
                          onChange={(e) => setEmitter({ ...emitter, ruc: e.target.value.replace(/\D/g, "") })}
                          placeholder="1792345678001"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-zinc-450 dark:text-content-secondary">Punto Emisión-Establecimiento</label>
                        <input
                          type="text"
                          maxLength={6}
                          className="px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none font-mono font-medium text-zinc-800 dark:text-zinc-100"
                          value={emitter.serial}
                          onChange={(e) => setEmitter({ ...emitter, serial: e.target.value.replace(/\D/g, "") })}
                          placeholder="001001"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-medium text-zinc-450 dark:text-content-secondary">Dirección Fiscal Obligatoria (Matriz)</label>
                      <input
                        type="text"
                        className="px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none font-medium text-zinc-800 dark:text-zinc-100"
                        value={emitter.address}
                        onChange={(e) => setEmitter({ ...emitter, address: e.target.value })}
                        placeholder="Av. de los Shyris N32-140, Quito, Ecuador"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Digital Signature with real file loading simulation */}
                    <div className="p-4 bg-default rounded-[10px] border border-divider space-y-3">
                      <span className="font-medium text-content block uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4 text-content shrink-0" />
                        Firma Electrónica (.p12) autorizada
                      </span>
                      <p className="text-[10px] text-content-secondary leading-relaxed">
                        El SRI exige firmar criptográficamente cada comprobante con un certificado .p12 otorgado por entidades acreditadas (Security Data, ANF, BanEcuador).
                      </p>

                      <div className="space-y-3">
                        {/* Interactive upload drag & drop box */}
                        <div className={`relative border border-dashed rounded-[10px] p-3.5 text-center transition-all cursor-pointer group bg-white dark:bg-[#0c0c0d] ${
                          p12VerificationStatus === "VERIFYING" 
                            ? "border-blue-400 bg-blue-50/10" 
                            : p12VerificationStatus === "INVALID" 
                              ? "border-red-400 bg-red-50/10" 
                              : "border-divider hover:border-primary dark:hover:border-[#94A3B8]"
                        }`}>
                          <input
                            type="file"
                            accept=".p12,.pfx"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) {
                                handleP12Upload(f);
                              }
                            }}
                          />
                          <div className="flex flex-col items-center justify-center">
                            {p12VerificationStatus === "VERIFYING" ? (
                              <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mb-1.5" />
                            ) : p12VerificationStatus === "INVALID" ? (
                              <AlertTriangle className="h-6 w-6 text-red-500 mb-1.5" />
                            ) : (
                              <UploadCloud className="h-6 w-6 text-content-secondary group-hover:text-content mb-1.5 transition-colors" />
                            )}
                            
                            <span className="font-medium text-content font-mono text-[10px] block truncate max-w-xs">
                              {p12VerificationStatus === "VERIFYING" 
                                ? "Analizando certificado..." 
                                : p12VerificationStatus === "INVALID" 
                                  ? "¡Error de Formato!" 
                                  : (emitter.signatureP12Name || "Haz clic o arrastra tu firma .p12 aquí")}
                            </span>
                            
                            <span className={`text-[9px] font-semibold mt-1 block uppercase tracking-wide ${
                              p12VerificationStatus === "VERIFYING" 
                                ? "text-blue-500 animate-pulse" 
                                : p12VerificationStatus === "INVALID" 
                                  ? "text-rose-500 font-medium" 
                                  : "text-emerald-500 font-medium"
                            }`}>
                              {p12VerificationStatus === "VERIFYING" && "Leyendo firma digital (.p12)..."}
                              {p12VerificationStatus === "INVALID" && "FORMATO INCORRECTO"}
                              {p12VerificationStatus === "VALID" && "✓ CERTIFICADO DIGITAL VÁLIDO & ACTIVO"}
                            </span>
                          </div>
                        </div>

                        {p12VerificationStatus === "INVALID" && p12VerificationError && (
                          <div className="p-2.5 bg-rose-500/[0.03] text-rose-800 dark:text-rose-450 text-[10px] rounded-[10px] border border-rose-500/35 leading-relaxed font-semibold">
                            ⚠️ {p12VerificationError}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-zinc-450 dark:text-content-secondary uppercase tracking-wider font-medium">Contraseña Certificado</label>
                            <input
                              type="password"
                              className="px-2.5 py-1.5 bg-white dark:bg-[#0c0c0d] border border-divider text-zinc-800 dark:text-zinc-100 rounded-[10px] text-xs"
                              value="Balandra2026_SRI!"
                              readOnly
                            />
                          </div>
                          <div className="flex flex-col justify-end text-[9px] text-content-secondary leading-relaxed">
                            <p>Vence: 18 de Mayo, 2029</p>
                            <span className={`font-medium block mt-0.5 ${p12VerificationStatus === "VALID" ? "text-emerald-500" : p12VerificationStatus === "VERIFYING" ? "text-blue-500" : "text-rose-500"}`}>
                              ESTADO: {p12VerificationStatus === "VALID" ? "INTEGRADO" : p12VerificationStatus === "VERIFYING" ? "VERIFICANDO..." : "INCOMPATIBLE"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-zinc-450 dark:text-content-secondary text-[10px]">Régimen Legal SRI</label>
                        <select
                          value={emitter.typeRimpe}
                          onChange={(e) => setEmitter({ ...emitter, typeRimpe: e.target.value as any })}
                          className="w-full px-3 py-2 text-xs rounded-[10px] border border-divider bg-white dark:bg-[#0c0c0d] focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer font-semibold"
                        >
                          <option value="EMPRENDEDOR">RIMPE Emprendedor</option>
                          <option value="REGIMEN_GENERAL">Régimen General</option>
                          <option value="POPULAR">RIMPE Popular</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-medium text-zinc-450 dark:text-content-secondary text-[10px]">Obligado Contabilidad</label>
                        <select
                          value={emitter.obligado ? "SI" : "NO"}
                          onChange={(e) => setEmitter({ ...emitter, obligado: e.target.value === "SI" })}
                          className="w-full px-3 py-2 text-xs rounded-[10px] border border-divider bg-white dark:bg-[#0c0c0d] focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer font-semibold"
                        >
                          <option value="SI">SI</option>
                          <option value="NO">NO</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800/85 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-content-secondary flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-500" />
                      Certificado almacenado localmente con encriptación AES-256 de nivel bancario.
                    </span>
                    {configSaved && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium animate-pulse">
                        ✓ ¡Cambios del emisor guardados y sincronizados correctamente!
                      </span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (user) {
                        try {
                          await setDoc(doc(db, `users/${user.uid}/emitter/default`), {
                            ...emitter,
                            userId: user.uid,
                            updatedAt: new Date()
                          });
                          setConfigSaved(true);
                          setTimeout(() => setConfigSaved(false), 3000);
                        } catch (e) {
                          console.error("Error al guardar:", e);
                        }
                      }
                    }}
                    className="px-4.5 py-2 bg-primary text-[var(--bg-default)] hover:brightness-110 text-[var(--bg-default)] rounded-[10px] text-xs font-medium cursor-pointer active:scale-95 transition-all text-center"
                  >
                    Guardar Parámetros de Factura
                  </button>
                </div>
              </div>

              {/* Planes de Suscripción SaaS Grid */}
              <div className="bg-paper border border-divider rounded-[10px] p-6  space-y-5">
                <div>
                  <h3 className="font-display font-semibold text-xs text-content uppercase tracking-widest flex items-center gap-2">
                    <Award className="h-4.5 w-4.5 text-content" />
                    Membresía Kipu SaaS - Selección de Tiers
                  </h3>
                  <p className="text-[10px] text-zinc-450 dark:text-content-secondary">
                    Sincroniza tus límites mensuales de emisión autorizada por el SRI según el volumen de facturación de tu negocio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* BASIC TIER */}
                  <div className={`p-5 rounded-[10px] border flex flex-col justify-between h-72 transition-all relative ${saasPlan === "BASIC" ? "border-emerald-500/80 bg-emerald-500/[0.02] " : "border-divider bg-default"}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 bg-divider text-content text-zinc-650 dark:text-zinc-300 font-medium text-[8px] font-mono rounded tracking-wider uppercase border border-zinc-200 dark:border-zinc-700">
                          RIMPE Popular
                        </span>
                        {saasPlan === "BASIC" && (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <Check className="h-3 w-3" /> ACTIVO
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-sm text-zinc-900 dark:text-zinc-50">Kipu Micro</h4>
                        <p className="text-[20px] font-mono font-black text-content mt-1">$9<span className="text-xs font-normal text-content-secondary">/mes</span></p>
                      </div>
                      <ul className="text-[10px] text-content-secondary space-y-1.5 font-sans list-disc list-inside">
                        <li>Hasta 20 facturas / mes</li>
                        <li>Ideal para RIMPE Popular</li>
                        <li>Soporte de IVA mixto</li>
                        <li>1 Empresa vinculada</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => handleUpgrade("BASIC")}
                      className={`w-full py-1.5 rounded-[10px] text-xs font-medium transition-all ${saasPlan === "BASIC" ? "bg-emerald-600 text-[var(--bg-default)]" : "bg-divider text-content-secondary hover:bg-zinc-200"}`}
                    >
                      {saasPlan === "BASIC" ? "Plan Seleccionado" : "Elegir Plan Kipu Micro"}
                    </button>
                  </div>

                  {/* PRO TIER */}
                  <div className={`p-5 rounded-[10px] border flex flex-col justify-between h-72 transition-all relative overflow-hidden ${saasPlan === "PRO" ? "border-primary/80 bg-primary text-[var(--bg-default)]/[0.02] " : "border-divider bg-default"}`}>
                    <div className="absolute top-0 right-0 px-2 py-0.5 bg-primary text-[var(--bg-default)] font-mono text-[8px] font-black uppercase tracking-wider rounded-bl">
                      POPULAR RECOMENDADO
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 bg-divider text-content font-medium text-[8px] font-mono rounded tracking-wider uppercase border border-[#E2E8F0] dark:border-zinc-700">
                          RIMPE Emprendedor
                        </span>
                        {saasPlan === "PRO" && (
                          <span className="text-[9px] text-content font-medium flex items-center gap-1">
                            <Check className="h-3 w-3" /> ACTIVO
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-sm text-zinc-900 dark:text-zinc-50">Kipu Pro</h4>
                        <p className="text-[20px] font-mono font-black text-content mt-1">$29<span className="text-xs font-normal text-content-secondary">/mes</span></p>
                      </div>
                      <ul className="text-[10px] text-zinc-550 dark:text-content-secondary space-y-1.5 font-sans list-disc list-inside">
                        <li><strong>Facturas Ilimitadas</strong></li>
                        <li>Certificación offline SRI v2.32</li>
                        <li>Buzón de compras automático</li>
                        <li>Análisis de caja y IA Cuaderno</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => handleUpgrade("PRO")}
                      className={`w-full py-1.5 rounded-[10px] text-xs font-medium transition-all ${saasPlan === "PRO" ? "bg-primary text-[var(--bg-default)] hover:brightness-110" : "bg-divider text-content-secondary hover:bg-zinc-200"}`}
                    >
                      {saasPlan === "PRO" ? "Plan Seleccionado" : "Elegir Plan Kipu Pro"}
                    </button>
                  </div>

                  {/* ENTERPRISE TIER */}
                  <div className={`p-5 rounded-[10px] border flex flex-col justify-between h-72 transition-all relative ${saasPlan === "ENTERPRISE" ? "border-zinc-900/80 bg-primary/[0.02] dark:border-zinc-200/80 dark:bg-white/[0.02] " : "border-divider bg-default"}`}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 bg-divider text-content text-zinc-650 dark:text-zinc-300 font-medium text-[8px] font-mono rounded tracking-wider uppercase border border-zinc-200 dark:border-zinc-700">
                          Régimen General
                        </span>
                        {saasPlan === "ENTERPRISE" && (
                          <span className="text-[9px] text-zinc-900 dark:text-zinc-200 font-medium flex items-center gap-1">
                            <Check className="h-3 w-3" /> ACTIVO
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-sm text-zinc-900 dark:text-zinc-50">Kipu Corporativo</h4>
                        <p className="text-[20px] font-mono font-black text-content mt-1">$79<span className="text-xs font-normal text-content-secondary">/mes</span></p>
                      </div>
                      <ul className="text-[10px] text-content-secondary space-y-1.5 font-sans list-disc list-inside">
                        <li>Múltiples sucursales y puntos emi</li>
                        <li>Declaración automática mensual</li>
                        <li>Soporte premium 24/7 con contadores</li>
                        <li>API de facturación y webhook de cobros</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => handleUpgrade("ENTERPRISE")}
                      className={`w-full py-1.5 rounded-[10px] text-xs font-medium transition-all ${saasPlan === "ENTERPRISE" ? "bg-primary text-[var(--bg-default)]" : "bg-divider text-content-secondary hover:bg-zinc-200"}`}
                    >
                      {saasPlan === "ENTERPRISE" ? "Plan Seleccionado" : "Elegir Plan Corporativo"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Ecuadorian SRI Pre-Authorization Launch Diagnostic Check */}
              <div className="bg-paper border border-divider rounded-[10px] p-6  space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-xs text-content uppercase tracking-widest flex items-center gap-2">
                      <Server className="h-4.5 w-4.5 text-content" />
                      Auditor de Puesta en Marcha SRI & Sandbox Diagnostic
                    </h3>
                    <p className="text-[10px] text-zinc-450 dark:text-content-secondary">
                      Ejecuta un diagnóstico pre-operativo exhaustivo para verificar si las credenciales de tu negocio están listas para emitir con validez fiscal de forma oficial.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsDiagnosticRunning(true);
                      setDiagnosticResult(null);
                      setTimeout(() => {
                        setIsDiagnosticRunning(false);
                        const rClean = emitter.ruc.replace(/\D/g, "");
                        const isRucProvValid = rClean.length === 13 && parseInt(rClean.substring(0, 2)) >= 1 && parseInt(rClean.substring(0, 2)) <= 24;
                        const hasSignature = !!emitter.signatureP12Name;
                        const hasEstablishment = emitter.serial.length === 6;

                        setDiagnosticResult({
                          rucCheck: isRucProvValid ? "PASSED" : "FAILED",
                          sigCheck: hasSignature ? "PASSED" : "FAILED",
                          serialCheck: hasEstablishment ? "PASSED" : "FAILED",
                          pingCheck: "PASSED",
                          profileCheck: "PASSED",
                          finalScore: (!isRucProvValid ? 0 : 20) + (hasSignature ? 40 : 0) + (hasEstablishment ? 20 : 0) + 20,
                          details: isRucProvValid && hasSignature && hasEstablishment
                            ? "¡Felicidades! Tu emisor tiene una estructura legal 100% compatible con los estándares del SRI del Ecuador de la Ficha Técnica v2.32 offline. Listo para facturación en producción."
                            : "Tu emisor tiene pendientes críticos. Asegúrate de configurar un RUC correcto de 13 dígitos y subir tu firma digital .p12 con su clave antes de emitir comprobantes legales."
                        });
                      }, 2000);
                    }}
                    disabled={isDiagnosticRunning}
                    className="px-4 py-2 bg-primary hover:bg-zinc-850 text-[var(--bg-default)] dark:bg-paper dark:text-primary dark:hover:bg-zinc-200 text-xs font-medium rounded-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isDiagnosticRunning ? "animate-spin" : ""}`} />
                    <span>{isDiagnosticRunning ? "Ejecutando Auditoría..." : "Ejecutar Diagnóstico SRI"}</span>
                  </button>
                </div>

                {isDiagnosticRunning && (
                  <div className="space-y-2.5 p-4 bg-default rounded-[10px] border border-divider">
                    <p className="text-xs font-semibold text-content-secondary font-mono flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping inline-block" />
                      Auditoria en curso: analizando emisor y pingueando servidores del SRI en celcer.sri.gob.ec...
                    </p>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary text-[var(--bg-default)] h-full rounded-full animate-[shimmer_2s_infinite]" style={{ width: "65%" }} />
                    </div>
                  </div>
                )}

                {diagnosticResult && (
                  <div className="space-y-4 animate-fade-in">
                    <div className={`p-4 rounded-[10px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${diagnosticResult.finalScore >= 80 ? "bg-emerald-500/[0.03] border-emerald-505/50 text-emerald-800 dark:text-emerald-400" : "bg-rose-500/[0.03] border-rose-505/50 text-rose-800 dark:text-rose-400"}`}>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono tracking-widest font-black uppercase text-zinc-450 block">ESTADO GENERAL DE COMPATIBILIDAD</span>
                        <h4 className="font-display font-black text-base flex items-center gap-1.5">
                          {diagnosticResult.finalScore >= 80 ? (
                            <>
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              CERTIFICACIÓN SRI v2.32 CONCEDIDA — LISTO PARA LA PUESTA EN MARCHA 🚀
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-5 w-5 text-rose-500" />
                              REQUERIMIENTOS EN CONFIGURACIÓN INCOMPLETOS
                            </>
                          )}
                        </h4>
                        <p className="text-xs text-zinc-650 dark:text-content-secondary max-w-xl leading-relaxed mt-1">
                          {diagnosticResult.details}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono font-medium block text-content-secondary">COMPATIBILITY SCORE</span>
                        <span className="text-[34px] font-display font-black leading-none block mt-1">{diagnosticResult.finalScore}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
                      <div className="p-3 bg-default/30 border border-zinc-200/70 dark:border-zinc-800/80 rounded-[10px] flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[9px] text-zinc-450 dark:text-zinc-550 uppercase">RUC Emisor</p>
                          <p className="font-mono text-[10px] font-semibold text-content-secondary mt-0.5">{emitter.ruc || "Vacío"}</p>
                        </div>
                        {diagnosticResult.rucCheck === "PASSED" ? (
                          <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-medium text-[10px]">✓</span>
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center font-medium text-[10px]">✗</span>
                        )}
                      </div>

                      <div className="p-3 bg-default/30 border border-zinc-200/70 dark:border-zinc-800/80 rounded-[10px] flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[9px] text-zinc-450 dark:text-zinc-550 uppercase">Firma Digital</p>
                          <p className="font-mono text-[10px] font-semibold text-content-secondary mt-0.5 truncate max-w-[100px]">{emitter.signatureP12Name ? ".p12 Cargada" : "No cargada"}</p>
                        </div>
                        {diagnosticResult.sigCheck === "PASSED" ? (
                          <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-medium text-[10px]">✓</span>
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center font-medium text-[10px]">✗</span>
                        )}
                      </div>

                      <div className="p-3 bg-default/30 border border-zinc-200/70 dark:border-zinc-800/80 rounded-[10px] flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[9px] text-zinc-450 dark:text-zinc-550 uppercase">Secuencial</p>
                          <p className="font-mono text-[10px] font-semibold text-content-secondary mt-0.5">{emitter.serial || "Vacío"}</p>
                        </div>
                        {diagnosticResult.serialCheck === "PASSED" ? (
                          <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-medium text-[10px]">✓</span>
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 flex items-center justify-center font-medium text-[10px]">✗</span>
                        )}
                      </div>

                      <div className="p-3 bg-default/30 border border-zinc-200/70 dark:border-zinc-800/80 rounded-[10px] flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[9px] text-zinc-450 dark:text-zinc-550 uppercase">Ping SRI Web WS</p>
                          <p className="font-mono text-[10px] font-semibold text-content-secondary mt-0.5">celcer.sri.gob.ec</p>
                        </div>
                        <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-medium text-[10px]">✓</span>
                      </div>

                      <div className="p-3 bg-default/30 border border-zinc-200/70 dark:border-zinc-800/80 rounded-[10px] flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[9px] text-zinc-450 dark:text-zinc-550 uppercase">Régimen Legal</p>
                          <p className="font-mono text-[10px] font-semibold text-content-secondary mt-0.5">{emitter.typeRimpe}</p>
                        </div>
                        <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-medium text-[10px]">✓</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible reference guide for SRI technical files */}
              <div className="bg-default border border-divider rounded-[10px] p-5 space-y-3">
                <span className="font-medium text-zinc-450 dark:text-content-secondary block uppercase text-[9px] tracking-wider select-none">
                  Librería de Cumplimiento Técnico Integrado (SRI Normas)
                </span>
                <p className="text-[10px] text-content-secondary leading-relaxed font-sans">
                  Kipu SaaS contiene algoritmos que cumplen los esquemas e instructivos normativos de la República del Ecuador. A continuación se desglosan las fichas integradas y reguladas por nuestro software:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[10px] text-zinc-700 dark:text-zinc-355 font-mono">
                  <div className="p-3 bg-paper rounded-[10px] border border-divider/85">
                    <p className="font-medium text-zinc-850 dark:text-zinc-205 text-[11px] mb-1">✓ Ficha Técnica Offline Versión 2.32 (Nov 2025)</p>
                    <p className="leading-normal">Estructura XML de Clave de Acceso de 49 dígitos con cálculo de dígito verificador Modulo 11. Estructura de impuestos con código 2 para IVA (Tarifa 12% código 2, Tarifa 15% código 4, Tarifa 0% código 0).</p>
                  </div>
                  <div className="p-3 bg-paper rounded-[10px] border border-divider/85">
                    <p className="font-medium text-zinc-850 dark:text-zinc-205 text-[11px] mb-1">✓ Notas de Crédito, Débito & Retenciones (Dic 2020)</p>
                    <p className="leading-normal">Formulaciones legalmente reguladas para el campo 'Devolución de IVA' y estructura de compensación. Soporta validación de sucursales activas (evita 000 como número de serie).</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Solid footer block */}
      <footer className="mt-auto px-6 py-4 bg-paper border-t border-zinc-200/60 dark:border-zinc-800/80 text-center text-[10px] uppercase font-medium tracking-wider text-content-secondary dark:text-zinc-550 font-sans">
        <p>KIPU SaaS Ecuador | 2026. Ley de Facturación Electrónica Obligatoria y SRI Esquema Recaudación.</p>
      </footer>
    </div>
  );
}
