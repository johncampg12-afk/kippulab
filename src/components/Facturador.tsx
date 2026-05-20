import { useState, FormEvent, useEffect } from "react";
import {
  FileText,
  User,
  Plus,
  Trash,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  Settings,
  X,
  CreditCard,
  Building,
  ShieldAlert,
  FileCode,
  Sparkles,
  ClipboardList
} from "lucide-react";
import { Invoice, Client, Item, Emitter } from "../types";

interface FacturadorProps {
  emitter: Emitter;
  invoices: Invoice[];
  onAddInvoice: (inv: Invoice) => void;
  onUpdateInvoiceStatus: (id: string, status: Invoice["status"], data?: { signedXml?: string; accessKey?: string; sriDiagnostic?: string }) => void;
  onSetDraftInvoice: (client: Client, items: Item[], paymentMethod: string, notes: string) => void;
  draftInvoice: { client: Client | null; items: Item[]; paymentMethod: string; notes: string } | null;
  onClearDraft: () => void;
  p12VerificationStatus?: "IDLE" | "VERIFYING" | "VALID" | "INVALID";
  p12VerificationError?: string | null;
}

const ECUADOR_PAYMENT_METHODS = [
  { code: "01", name: "01 - Sin utilización del sistema financiero (Efectivo)" },
  { code: "16", name: "16 - Tarjeta de Débito" },
  { code: "19", name: "19 - Tarjeta de Crédito" },
  { code: "20", name: "20 - Transferencia Bancaria / Cuenta de Ahorro" }
];

export function validateEcuadorianId(id: string, type: "04" | "05" | "06" | "07"): { isValid: boolean; message?: string } {
  if (type === "07") return { isValid: true };
  if (!id) return { isValid: true };

  // Passport has variable alphanumeric formats, but typically 3-20 digits
  if (type === "06") {
    if (id.length < 3) return { isValid: false, message: "El pasaporte debe tener al menos 3 caracteres." };
    if (id.length > 20) return { isValid: false, message: "El pasaporte no puede exceder los 20 caracteres." };
    return { isValid: true };
  }

  // Cédula and RUC require digits only
  const digits = id.replace(/\D/g, "");
  if (digits !== id) {
    return { isValid: false, message: "La identificación debe contener solo números." };
  }

  // 1. Cédula Validation
  if (type === "05") {
    if (id.length !== 10) {
      return { isValid: false, message: `Debe tener exactamente 10 dígitos (actual: ${id.length}).` };
    }
    const prov = parseInt(id.substring(0, 2), 10);
    if ((prov < 1 || prov > 24) && prov !== 30) {
      return { isValid: false, message: "Dos primeros dígitos deben ser un código de provincia válido (01 a 24, o 30)." };
    }
    const third = parseInt(id.charAt(2), 10);
    if (third > 5) {
      return { isValid: false, message: "El tercer dígito de la cédula debe ser menor a 6 de persona natural de Ecuador." };
    }

    // Luhn/Mod modulus 10 matching
    const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(id.charAt(i), 10) * coefs[i];
      if (val >= 9) val -= 9;
      sum += val;
    }
    const checkDigit = parseInt(id.charAt(9), 10);
    const mod = sum % 10;
    const calcDigit = mod === 0 ? 0 : 10 - mod;

    if (calcDigit !== checkDigit) {
      return { isValid: false, message: `Dígito verificador incorrecto. Esperado: ${calcDigit}, Ingresado: ${checkDigit}` };
    }
    return { isValid: true };
  }

  // 2. RUC Validation
  if (type === "04") {
    if (id.length !== 13) {
      return { isValid: false, message: `El RUC debe tener exactamente 13 dígitos (actual: ${id.length}).` };
    }
    const prov = parseInt(id.substring(0, 2), 10);
    if ((prov < 1 || prov > 24) && prov !== 30) {
      return { isValid: false, message: "Los primeros dos dígitos no representan una provincia ecuatoriana válida." };
    }
    const lastThree = id.substring(10, 13);
    if (lastThree === "000") {
      return { isValid: false, message: "Las últimas 3 cifras deben representar números de sucursal activos (ej. 001)." };
    }

    const third = parseInt(id.charAt(2), 10);
    if (third < 6) {
      // Natural Person: contains a valid Cédula in first 10 digits
      const subCedula = id.substring(0, 10);
      const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        let val = parseInt(subCedula.charAt(i), 10) * coefs[i];
        if (val >= 9) val -= 9;
        sum += val;
      }
      const checkDigit = parseInt(subCedula.charAt(9), 10);
      const mod = sum % 10;
      const calcDigit = mod === 0 ? 0 : 10 - mod;
      if (calcDigit !== checkDigit) {
        return { isValid: false, message: "RUC Persona Natural inválido (verificador de los 10 dígitos base incorrecto)." };
      }
      return { isValid: true };
    } else if (third === 9) {
      // Sociedad Privada / Persona Jurídica
      const coefs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(id.charAt(i), 10) * coefs[i];
      }
      const checkDigit = parseInt(id.charAt(9), 10);
      const mod = sum % 11;
      const calcDigit = mod === 0 ? 0 : 11 - mod;
      if (calcDigit !== checkDigit) {
        return { isValid: false, message: "RUC de Sociedad Privada inválido (verificación de sociedad jurídicos incorrecta)." };
      }
      return { isValid: true };
    } else if (third === 6) {
      // Público/Estatal
      const coefs = [3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += parseInt(id.charAt(i), 10) * coefs[i];
      }
      const checkDigit = parseInt(id.charAt(8), 10);
      const tenthDigit = parseInt(id.charAt(9), 10);
      if (tenthDigit !== 0) {
        return { isValid: false, message: "RUC del Sector Público inválido: el décimo dígito debe ser obligatoriamente '0' según el patrón del SRI." };
      }
      const mod = sum % 11;
      const calcDigit = mod === 0 ? 0 : 11 - mod;
      if (calcDigit !== checkDigit) {
        return { isValid: false, message: "RUC del Sector Público inválido: el dígito verificador (novena posición) no coincide." };
      }
      return { isValid: true };
    } else {
      return { isValid: false, message: "El tercer dígito del RUC no es legal para ningún esquema de validez del SRI." };
    }
  }

  return { isValid: true };
}

const PRESETS_PRODUCTS = [
  { name: "Almuerzo Ejecutivo de Lomo", price: 6.50, ivaRate: 15 },
  { name: "Saco de Papas de consumo", price: 14.00, ivaRate: 0 },
  { name: "Aceite de cocina familiar", price: 4.80, ivaRate: 15 },
  { name: "Maíz de siembra certificado", price: 20.00, ivaRate: 0 },
  { name: "Servicio de flete y transporte", price: 45.00, ivaRate: 15 },
  { name: "Consultoría de negocios pymes", price: 150.00, ivaRate: 15 }
];

export default function Facturador({
  emitter,
  invoices,
  onAddInvoice,
  onUpdateInvoiceStatus,
  draftInvoice,
  onClearDraft,
  p12VerificationStatus = "VALID",
  p12VerificationError = null
}: FacturadorProps) {
  // New invoice form states
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState("");
  const [idType, setIdType] = useState<"04" | "05" | "06" | "07">("05"); // Default: Cedula
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Real-time live Ecuadorian ID format check
  const validation = validateEcuadorianId(idType === "07" ? "9999999999999" : clientId, idType);
  const showValidationWarning = clientId.trim().length > 0 && !validation.isValid && idType !== "07";
  const showValidationSuccess = clientId.trim().length > 0 && validation.isValid && idType !== "07";

  const [items, setItems] = useState<Item[]>([
    { name: "Almuerzo Ejecutivo de Lomo", quantity: 2, price: 6.50, ivaRate: 15, discount: 0, total: 13.00 }
  ]);

  const [paymentMethod, setPaymentMethod] = useState("01");

  // SRI Signing/Sending workflow states
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [signing, setSigning] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [openRideModal, setOpenRideModal] = useState<boolean>(false);
  const [openXmlModal, setOpenXmlModal] = useState<boolean>(false);

  const handleExportCSV = () => {
    if (invoices.length === 0) return;
    
    const headers = [
      "Secuencial", "Fecha", "Cliente", "Identificacion_Cliente", 
      "Tipo_Identificacion", "Metodo_Pago", "Subtotal_15", "Subtotal_0", 
      "Descuento", "IVA_15", "Total_USD", "Estado_SRI", "Clave_Acceso"
    ];
    
    const rows = invoices.map(inv => {
      const idTypeLabel = inv.client.idType === "04" ? "RUC" : inv.client.idType === "05" ? "Cedula" : inv.client.idType === "06" ? "Pasaporte" : "Consumidor Final";
      const paymentMethodLabel = inv.paymentMethod === "01" ? "Efectivo" : inv.paymentMethod === "20" ? "Transferencia" : "Otros";
      return [
        `"${emitter.serial}-${inv.sequence}"`,
        `"${inv.date}"`,
        `"${inv.client.name.replace(/"/g, '""')}"`,
        `"${inv.client.idNumber}"`,
        `"${idTypeLabel}"`,
        `"${paymentMethodLabel}"`,
        (inv.totals.subtotal15 || 0).toFixed(2),
        (inv.totals.subtotal0 || 0).toFixed(2),
        (inv.totals.discount || 0).toFixed(2),
        (inv.totals.iva || 0).toFixed(2),
        inv.totals.total.toFixed(2),
        `"${inv.status}"`,
        `"${inv.accessKey || ''}"`
      ];
    });
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Kipu_SaaS_Libro_Ventas_${emitter.ruc}_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick select product helper
  const handleAddProductPreset = (prod: typeof PRESETS_PRODUCTS[number]) => {
    const existing = items.find((i) => i.name === prod.name && i.ivaRate === prod.ivaRate);
    if (existing) {
      setItems(items.map((i) =>
        i.name === prod.name && i.ivaRate === prod.ivaRate
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price - i.discount }
          : i
      ));
    } else {
      setItems([...items, {
        name: prod.name,
        quantity: 1,
        price: prod.price,
        // @ts-ignore
        ivaRate: prod.ivaRate,
        discount: 0,
        total: prod.price
      }]);
    }
  };

  // Adjust row metrics on the fly
  const handleItemChange = (index: number, field: keyof Item, value: any) => {
    const updated = items.map((i, idx) => {
      if (idx !== index) return i;
      const copy = { ...i, [field]: value };
      copy.total = (copy.price * copy.quantity) - copy.discount;
      return copy;
    });
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleAddNewRow = () => {
    setItems([...items, { name: "Nuevo producto o servicio", quantity: 1, price: 5.00, ivaRate: 15, discount: 0, total: 5.00 }]);
  };

  // Check if draft arrived from Cuaderno Inteligente AI
  useEffect(() => {
    if (draftInvoice && draftInvoice.client) {
      const dClient = draftInvoice.client;
      setClientId(dClient.idNumber);
      setClientName(dClient.name);
      // @ts-ignore
      setIdType(dClient.idType || "05");
      setClientEmail(dClient.email || "");
      setClientAddress(dClient.address || "");
      setItems(draftInvoice.items);
      setPaymentMethod(draftInvoice.paymentMethod || "01");
      onClearDraft();
    }
  }, [draftInvoice, onClearDraft]);

  // Live Math calculations for totals
  let subtotal15 = 0;
  let subtotal12 = 0;
  let subtotal0 = 0;
  let totalDiscount = 0;

  items.forEach((i) => {
    const totItem = i.price * i.quantity - i.discount;
    if (i.ivaRate === 15) {
      subtotal15 += totItem;
    } else if (i.ivaRate === 12) {
      subtotal12 += totItem;
    } else {
      subtotal0 += totItem;
    }
    totalDiscount += i.discount;
  });

  const ivaAmount = subtotal15 * 0.15 + subtotal12 * 0.12;
  const bottomLineTotal = subtotal15 + subtotal12 + subtotal0 + ivaAmount;

  // Submit and Save Invoice locally as Draft
  const handleCreateInvoice = (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientId.trim()) return;

    if (idType !== "07") {
      const checkVal = validateEcuadorianId(clientId, idType);
      if (!checkVal.isValid) {
        return;
      }
    }

    // Sequence calculation
    const currentNumber = invoices.length + 1;
    const seqStr = String(currentNumber).padStart(9, "0");

    const newInv: Invoice = {
      id: `kipu-inv-${Date.now()}`,
      sequence: seqStr,
      date: new Date().toISOString().split("T")[0],
      client: {
        name: clientName,
        idNumber: clientId,
        idType,
        email: clientEmail || undefined,
        address: clientAddress || undefined
      },
      items,
      paymentMethod,
      paymentStatus: "PENDIENTE",
      status: "BORRADOR",
      totals: {
        subtotal15,
        subtotal12,
        subtotal0,
        discount: totalDiscount,
        iva: ivaAmount,
        total: bottomLineTotal
      }
    };

    onAddInvoice(newInv);

    // Reset fields
    setClientName("");
    setClientId("");
    setClientEmail("");
    setClientAddress("");
    setItems([{ name: "Almuerzo Ejecutivo de Lomo", quantity: 2, price: 6.50, ivaRate: 15, discount: 0, total: 13.00 }]);
  };

  // Perform Simulated Sign & Transmission to SRI (Ecuador Celcer Testbed)
  const handleTransmitSri = async (inv: Invoice) => {
    if (!window.confirm("¿Estás seguro de que deseas enviar esta factura al SRI?")) {
      return;
    }

    const plan = emitter.saasPlan || "BASIC";
    if (plan === "BASIC") {
       const currentMonth = new Date().getMonth();
       const currentYear = new Date().getFullYear();
       const thisMonthInvoices = invoices.filter(i => {
          if (!i.date) return false;
          const d = new Date(i.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear && i.status !== "RECHAZADO";
       });
       if (thisMonthInvoices.length >= 20) {
          onUpdateInvoiceStatus(inv.id, "RECHAZADO", { sriDiagnostic: "Límite del Plan Micro (20 facturas/mes) alcanzado. Por favor, actualiza al plan Kipu Pro en Configuración." });
          return;
       }
    }

    setSelectedInvoice(inv);
    setSigning(true);

    try {
      // 1. Submit to Sign simulator (returns 49-digit XML and crypt signature block)
      const signResp = await fetch("/api/sri-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: {
            date: inv.date,
            docType: "01",
            serial: emitter.serial,
            sequence: inv.sequence,
            environment: emitter.environment,
            paymentMethod: inv.paymentMethod
          },
          emitter,
          client: inv.client,
          items: inv.items
        })
      });

      const signData = await signResp.json();
      if (!signData.success) throw new Error(signData.error);

      // Transition locally to SIGNED
      onUpdateInvoiceStatus(inv.id, "BORRADOR", {
        signedXml: signData.signedXml,
        accessKey: signData.accessKey
      });

      setSigning(false);
      setSending(true);

      // 2. Submit signed XML to simulated SRI receiver
      const sResp = await fetch("/api/sri-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: signData.accessKey,
          signedXml: signData.signedXml
        })
      });

      const sendData = await sResp.json();
      const nextStatus = sendData.status === "AUTORIZADO" ? "AUTORIZADO" : "RECHAZADO";

      onUpdateInvoiceStatus(inv.id, nextStatus as any, {
        signedXml: signData.signedXml,
        accessKey: signData.accessKey,
        sriDiagnostic: sendData.errors ? sendData.errors.join("; ") : sendData.diagnostic
      });

      // Update local viewer instance
      setSelectedInvoice((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: nextStatus as any,
          accessKey: signData.accessKey,
          signedXml: signData.signedXml,
          sriDiagnostic: sendData.errors ? sendData.errors.join("; ") : sendData.diagnostic
        };
      });

      // 3. Send Email with RIDE PDF & XML if AUTHORIZED
      if (nextStatus === "AUTORIZADO" && inv.client.email) {
        try {
          await fetch("/api/invoice/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoice: {
                 sequence: inv.sequence,
                 date: inv.date,
                 totals: inv.totals,
                 total: inv.totals.total
              },
              emitter,
              client: inv.client,
              items: inv.items,
              accessKey: signData.accessKey,
              signedXml: signData.signedXml
            })
          });
        } catch (emailErr) {
          console.error("Failed to send RIDE email:", emailErr);
        }
      }

    } catch (err: any) {
      console.error(err);
      onUpdateInvoiceStatus(inv.id, "RECHAZADO", { sriDiagnostic: "Fallo de conexión SRI: " + err.message });
    } finally {
      setSigning(false);
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8" id="facturador">
      {/* Left Input form Column (Create invoice) */}
      <div className="xl:col-span-7 bg-paper border border-divider rounded-[10px] p-6 ">
        <h2 className="font-display font-semibold text-xs text-content uppercase tracking-widest mb-4 flex items-center gap-1.5 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <FileText className="h-4.5 w-4.5 text-content" />
          Nuevo Comprobante Electrónico (Factura)
        </h2>

        {/* Quick presets for testing */}
        <div className="mb-5 bg-default/60 rounded-[10px] p-3.5 border border-divider">
          <span className="text-[10px] font-medium text-content-secondary uppercase tracking-wider block mb-2 flex items-center gap-1.5 select-none">
            <Sparkles className="h-3.5 w-3.5 text-content" />
            Añadir Productos Rápidamente:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS_PRODUCTS.map((prod, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddProductPreset(prod)}
                className="px-2.5 py-1 text-xs font-semibold rounded-[10px] border border-divider bg-paper text-content-secondary hover:bg-default hover:text-content hover:border-[#E2E8F0]  dark:text-zinc-300 transition-all cursor-pointer "
              >
                {prod.name} (+${prod.price.toFixed(2)})
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {/* Client Identification Segment */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-zinc-50 dark:bg-[#0c0c0e] p-4 rounded-[10px] border border-divider">
            <div className="md:col-span-4">
              <label className="text-[10px] font-medium text-zinc-450 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                TIPO DOCUMENTO
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-[10px] border border-zinc-200 dark:border-zinc-805 bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <option value="05">05 - Cédula (10 dgt)</option>
                <option value="04">04 - RUC (13 dgt)</option>
                <option value="06">06 - Pasaporte</option>
                <option value="07">07 - Consumidor Final</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="text-[10px] font-medium text-zinc-455 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                IDENTIFICACIÓN
              </label>
              <input
                type="text"
                value={idType === "07" ? "9999999999999" : clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={idType === "04" ? "1792345678001" : "1723456789"}
                className={`w-full px-3 py-2 text-xs rounded-[10px] bg-paper focus:outline-none font-mono transition-all ${
                  showValidationWarning
                    ? "border-2 border-red-500/80 focus:border-red-600 dark:border-red-605 text-red-600 dark:text-red-400"
                    : showValidationSuccess
                    ? "border-2 border-emerald-500/80 focus:border-emerald-600 dark:border-emerald-605"
                    : "border border-zinc-200 dark:border-zinc-805 focus:border-zinc-500 dark:focus:border-zinc-400 text-zinc-800 dark:text-zinc-200"
                }`}
                disabled={idType === "07"}
                required
              />
              {showValidationWarning && (
                <span className="text-[10px] text-red-600 dark:text-red-400 mt-1 block font-semibold flex items-start gap-1 leading-snug">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                  <span>{validation.message}</span>
                </span>
              )}
              {showValidationSuccess && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-semibold flex items-center gap-1 leading-snug">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>Estructura SRI correcta</span>
                </span>
              )}
            </div>

            <div className="md:col-span-4">
              <label className="text-[10px] font-medium text-zinc-455 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                FORMA DE PAGO SRI
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                {ECUADOR_PAYMENT_METHODS.map((method) => (
                  <option key={method.code} value={method.code}>{method.code} - {method.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-1 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80">
              <div className="md:col-span-1">
                <label className="text-[10px] font-medium text-zinc-455 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                  NOMBRE COMPRADOR
                </label>
                <input
                  type="text"
                  value={idType === "07" ? "Consumidor Final" : clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Carlos Pérez Ortiz"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-zinc-200 dark:border-zinc-805 bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-zinc-455 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                  EMAIL NOTIFICACIÓN
                </label>
                <input
                  type="email"
                  value={idType === "07" ? "final@consumidor.ec" : clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="perez@gmail.ec"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-zinc-455 dark:text-content-secondary block mb-1.5 uppercase tracking-wider">
                  DIRECCIÓN (FISCAL)
                </label>
                <input
                  type="text"
                  value={idType === "07" ? "Ecuador" : clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Av. Amazonas y Colón, Quito"
                  className="w-full px-3 py-2 text-xs rounded-[10px] border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Invoice Lines / Table Segment */}
          <div className="space-y-2">
            <h3 className="text-[9px] font-medium text-zinc-450 dark:text-zinc-550 uppercase tracking-widest block flex justify-between items-center select-none">
              <span>LÍNEAS DE FACTURACIÓN</span>
              <button
                type="button"
                onClick={handleAddNewRow}
                className="text-[10px] font-medium text-content hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva Fila
              </button>
            </h3>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 bg-zinc-50 dark:bg-[#0c0c0e] border border-divider rounded-[10px] items-center"
                >
                  <div className="md:col-span-5">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                      placeholder="Nombre del Item"
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                      placeholder="Cant"
                      className="w-full px-2 py-1.5 text-xs rounded border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 font-mono"
                      min="0.01"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      step="any"
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                      placeholder="Precio"
                      className="w-full px-2 py-1.5 text-xs rounded border border-divider bg-paper focus:border-zinc-500 dark:focus:border-zinc-400 focus:outline-none text-zinc-800 dark:text-zinc-200 font-mono"
                      min="0"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={item.ivaRate}
                      onChange={(e) => handleItemChange(idx, "ivaRate", parseInt(e.target.value) as any)}
                      className="w-full px-1.5 py-1.5 text-xs rounded border border-divider bg-paper focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer"
                    >
                      <option value="15">IVA 15%</option>
                      <option value="0">IVA 0%</option>
                    </select>
                  </div>

                  <div className="md:col-span-1 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 px-1.5 bg-default hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-30 text-zinc-650 dark:text-zinc-300 rounded cursor-pointer transition-colors"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Submit */}
          <div className="pt-4 border-t border-divider flex flex-col md:flex-row md:items-start justify-between gap-4">
            <button
              type="submit"
              disabled={items.length === 0 || showValidationWarning}
              className={`px-5 py-2.5 text-[var(--bg-default)] font-medium rounded-[10px] text-xs tracking-wide flex items-center gap-2 cursor-pointer transition-all active:scale-95  shrink-0 font-sans ${
                (items.length === 0 || showValidationWarning)
                  ? "bg-zinc-200 dark:bg-zinc-800 text-content-secondary dark:text-zinc-650 cursor-not-allowed opacity-60 active:scale-100"
                  : "bg-primary text-[var(--bg-default)] hover:brightness-110"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>Guardar Factura como Borrador</span>
            </button>

            {/* Structured receipt columns */}
            <div className="w-full md:w-72 bg-zinc-50 dark:bg-[#0c0c0e]/80 p-4 rounded-[10px] border border-divider space-y-2 text-xs">
              <div className="flex justify-between text-content-secondary">
                <span>Subtotal IVA 15%:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-secondary">
                <span>Subtotal IVA 0%:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">${subtotal0.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-secondary">
                <span>Descuento total:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">-${totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content-secondary border-t border-divider pt-1.5">
                <span>Valor IVA 15%:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">${ivaAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-content font-medium text-xs border-t border-divider pt-2 bg-default/30 dark:bg-primary/10 -mx-4 px-4 pb-1">
                <span>Importe Total:</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-50 text-sm font-medium">${bottomLineTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Right List Column (Existing bills ledger with SRI flow validation buttons) */}
      <div className="xl:col-span-5 bg-paper border border-divider rounded-[10px] p-6  flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <h2 className="font-display font-semibold text-xs text-content uppercase tracking-widest flex items-center gap-1.5">
              <ClipboardList className="h-4.5 w-4.5 text-content" />
              Libro de Ventas y Estado SRI
            </h2>
            {invoices.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1 bg-default hover:bg-[#E2E8F0] text-content dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-300 text-[10px] font-medium rounded-md flex items-center gap-1 cursor-pointer transition-all active:scale-95 border border-[#E2E8F0]/50 dark:border-zinc-700"
                title="Desborda los datos a una planilla de Excel (formato estándar CSV)"
              >
                <Download className="h-3 w-3" />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>

          {invoices.length === 0 ? (
            <div className="h-72 bg-default border border-divider text-content-secondary rounded-[10px] flex flex-col items-center justify-center text-center p-6 text-content-secondary">
              <FileCode className="h-8 w-8 text-zinc-350 dark:text-zinc-700 mb-2" />
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-650">No hay comprobantes guardados</p>
              <p className="text-[10px] text-zinc-450 dark:text-content-secondary mt-1 max-w-sm leading-relaxed">
                Utiliza el "Cuaderno Inteligente" para crearlo con IA o llena el formulario de la izquierda.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {invoices.map((inv) => {
                const isAuth = inv.status === "AUTORIZADO";
                const isRej = inv.status === "RECHAZADO";
                return (
                  <div
                    key={inv.id}
                    className="p-4 border border-divider rounded-[10px] bg-zinc-50/50 dark:bg-[#0c0c0e]/40 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono font-medium text-[9px] text-content-secondary">
                          SECUENCIAL: {emitter.serial}-{inv.sequence}
                        </div>
                        <div className="font-medium text-zinc-850 dark:text-zinc-100 text-[13px] mt-0.5">
                          {inv.client.name}
                        </div>
                        <div className="font-mono text-[9px] text-content-secondary mt-0.5">
                          ID: {inv.client.idNumber} | {inv.date}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-display font-semibold text-xs text-content block">
                          ${inv.totals.total.toFixed(2)}
                        </span>
                        {/* Interactive pills of authorization status */}
                        <span className={`inline-block px-1.5 py-0.5 text-[8px] font-medium rounded uppercase mt-1 ${isAuth ? "bg-default text-zinc-800 dark:bg-zinc-805 dark:text-zinc-200 border border-zinc-200/50" : isRej ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-150/50" : "bg-zinc-50 text-zinc-650 dark:bg-primary dark:text-content-secondary border border-zinc-150"}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>

                    {/* SRI Diagnostic summary info */}
                    {inv.sriDiagnostic && (
                      <div className={`p-2.5 rounded-[10px] border text-[10px] leading-relaxed flex items-start gap-2 ${isAuth ? "bg-default border-divider/85 text-content-secondary" : "bg-red-50/20 dark:bg-red-950/10 border-red-200/30 text-red-800 dark:text-red-400"}`}>
                        {isAuth ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-content-secondary shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <span className="font-mono">{inv.sriDiagnostic}</span>
                      </div>
                    )}

                    {/* Operational options */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-divider mt-1">
                      {inv.status === "BORRADOR" ? (
                        <div className="w-full space-y-2">
                          {p12VerificationStatus === "VERIFYING" && (
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/25 text-blue-700 dark:text-blue-400 text-[10px] rounded-[10px] border border-blue-200/40 flex items-center gap-1.5 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                              <span>Verificando firma electrónica .p12...</span>
                            </div>
                          )}
                          {p12VerificationStatus === "INVALID" && (
                            <div className="p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-[10px] rounded-[10px] border border-rose-200/35 flex flex-col gap-0.5">
                              <span className="font-medium flex items-center gap-1 text-[10.5px]">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                Firma Digital Inválida
                              </span>
                              <p className="text-[9px] text-rose-600 dark:text-rose-400 leading-normal">
                                {p12VerificationError || "Verifica el formato del certificado .p12 en Configuración."}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => handleTransmitSri(inv)}
                            disabled={signing || sending || p12VerificationStatus !== "VALID"}
                            className={`px-3 py-2 rounded-[10px] w-full font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95  ${
                              p12VerificationStatus !== "VALID"
                                ? "bg-default dark:bg-zinc-850 text-content-secondary dark:text-zinc-650 cursor-not-allowed opacity-60 active:scale-100"
                                : "bg-primary text-[var(--bg-default)] hover:brightness-110 text-[var(--bg-default)]"
                            }`}
                          >
                            {signing ? (
                              <>
                                <div className="h-3.5 w-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                                <span>Firmando P12...</span>
                              </>
                            ) : sending ? (
                              <>
                                <div className="h-3.5 w-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                                <span>Enviando SRI...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Simular Emisión SRI</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch("/api/invoice/download-pdf", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    invoice: inv,
                                    emitter,
                                    client: inv.client,
                                    items: inv.items,
                                    accessKey: inv.accessKey
                                  })
                                });
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `Factura_${inv.accessKey}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  window.URL.revokeObjectURL(url);
                                } else {
                                  console.error("Failed to download PDF");
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="px-2.5 py-1.5 border border-divider hover:bg-default dark:hover:bg-primary rounded-[10px] font-semibold text-[10px] text-emerald-650 dark:text-emerald-400 hover:text-content dark:hover:text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Descargar PDF</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setOpenRideModal(true);
                            }}
                            className="px-2.5 py-1.5 border border-divider hover:bg-default dark:hover:bg-primary rounded-[10px] font-semibold text-[10px] text-content-secondary hover:text-content dark:hover:text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Ver Recibo</span>
                          </button>

                          {inv.signedXml && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setOpenXmlModal(true);
                              }}
                              className="px-2.5 py-1.5 border border-divider hover:bg-default dark:hover:bg-primary rounded-[10px] font-semibold text-[10px] text-indigo-650 dark:text-indigo-400 hover:text-content dark:hover:text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <FileCode className="h-3.5 w-3.5" />
                              <span>XML Autorizado</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIDE (Ecuadorized Receipt PDF Mockup) Modal */}
      {openRideModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-paper w-full max-w-2xl rounded-[10px] shadow-xl p-6 border border-divider flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-gray-150 dark:border-slate-800 pb-3 mb-4">
              <span className="font-display font-semibold text-sm text-gray-900 dark:text-[var(--bg-default)] flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-emerald-500" />
                RIDE (Representación Impresa del Comprobante) - Factura Autorizada SRI
              </span>
              <button
                onClick={() => setOpenRideModal(false)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* RIDE printable sheet inside scrolled frame */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-850 rounded-[10px] text-gray-800 dark:text-slate-350 font-sans text-xs space-y-4">
              {/* Header Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual business info */}
                <div className="space-y-1 bg-paper p-4 rounded-[10px] border border-gray-150 dark:border-slate-850">
                  <span className="font-display font-extrabold text-base tracking-tight text-gray-900 dark:text-[var(--bg-default)] uppercase block">
                    {emitter.name}
                  </span>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">{emitter.tradeName || "Kipu Negocios"}</p>
                  <div className="text-[10px] text-slate-400 pt-2 space-y-0.5 leading-relaxed">
                    <p>Matriz: {emitter.address}</p>
                    <p>Obligado a llevar contabilidad: {emitter.obligado ? "SI" : "NO"}</p>
                    <p className="text-emerald-500 font-medium">Régimen: RIMPE {emitter.typeRimpe}</p>
                  </div>
                </div>

                {/* Fiscal info */}
                <div className="space-y-1 bg-paper p-4 border border-gray-150 dark:border-slate-850 rounded-[10px] font-mono text-[10px] leading-relaxed relative">
                  <p className="font-medium text-xs">RUC: {emitter.ruc}</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                    FACTURA Nro.
                  </p>
                  <p className="font-medium text-xs">{emitter.serial}-{selectedInvoice.sequence}</p>
                  <div className="pt-2">
                    <p><span className="text-slate-400">Ambiente:</span> {emitter.environment === "1" ? "PRUEBAS" : "PRODUCCIÓN"}</p>
                    <p><span className="text-slate-400">Emisión:</span> NORMAL</p>
                    {selectedInvoice.accessKey && (
                      <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-800">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[8px]">
                          Clave de Acceso y Nro de Autorización SRI
                        </span>
                        <p className="text-[9px] font-medium text-gray-900 dark:text-slate-200 select-all leading-tight">
                          {selectedInvoice.accessKey}
                        </p>
                        {/* Simulated visual barcode stripes */}
                        <div className="w-full h-8 bg-slate-900 dark:bg-slate-800 rounded mt-1.5 flex items-center justify-around overflow-hidden px-1">
                          {Array.from({ length: 30 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-full bg-paper shrink-0"
                              style={{ width: `${Math.random() * 3 + 1}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Client and dates segment */}
              <div className="p-4 bg-paper border border-gray-150 dark:border-slate-850 rounded-[10px] leading-relaxed">
                <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[8px]">Razón Social / Nombres:</span>
                    <strong className="text-gray-900 dark:text-[var(--bg-default)] text-[11px]">{selectedInvoice.client.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase text-[8px]">Identificación Comprador:</span>
                    <strong className="font-mono text-gray-800 dark:text-slate-200 text-[11px]">{selectedInvoice.client.idNumber}</strong>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[8px]">Fecha Emisión:</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{selectedInvoice.date}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400 block font-semibold uppercase text-[8px]">Forma de Pago:</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">
                      {ECUADOR_PAYMENT_METHODS.find((pm) => pm.code === selectedInvoice.paymentMethod)?.name || "Efectivo"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Table of items */}
              <div className="bg-paper border border-gray-150 dark:border-slate-850 rounded-[10px] overflow-hidden">
                <table className="w-full text-left text-[10px] leading-snug">
                  <thead className="bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-400 font-medium uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Deta</th>
                      <th className="px-3 py-2 text-right">Cant</th>
                      <th className="px-3 py-2 text-right">Precio</th>
                      <th className="px-3 py-2 text-right">Desc</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {selectedInvoice.items.map((i, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-950/20">
                        <td className="px-3 py-2.5 font-semibold text-gray-850 dark:text-slate-200">{i.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{i.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-mono">${i.price.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-rose-500 font-mono">-${i.discount.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-850 dark:text-slate-100 font-mono">
                          ${((i.price * i.quantity) - i.discount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total calculations block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-paper border border-gray-150 dark:border-slate-850 rounded-[10px] space-y-1 text-[10px] text-gray-400">
                  <span className="font-medium text-gray-500 block uppercase text-[8px] tracking-wider mb-1">Información Adicional</span>
                  <p>KipuSaaS: Producido por Kipu, el cuaderno del agro y negocios de Ecuador.</p>
                  <p>Ambiente: {emitter.environment === "1" ? "Pruebas celcer.sri" : "Producción cel.sri"}</p>
                  <p>Email: {selectedInvoice.client.email || "N/A"}</p>
                </div>

                <div className="p-4 bg-paper border border-gray-150 dark:border-slate-850 rounded-[10px] space-y-2 text-xs">
                  <div className="flex justify-between text-gray-400 leading-none">
                    <span>Subtotal IVA 15%:</span>
                    <span className="font-mono text-gray-900 dark:text-[var(--bg-default)] font-medium">
                      ${selectedInvoice.totals.subtotal15.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 leading-none">
                    <span>Subtotal IVA 0%:</span>
                    <span className="font-mono text-gray-900 dark:text-[var(--bg-default)] font-medium">
                      ${selectedInvoice.totals.subtotal0.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 leading-none">
                    <span>Descuento:</span>
                    <span className="font-mono text-gray-900 dark:text-[var(--bg-default)] font-medium">
                      -${selectedInvoice.totals.discount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 leading-none border-t border-gray-150/50 dark:border-slate-830 pt-1.5">
                    <span>Valor IVA 15%:</span>
                    <span className="font-mono text-gray-900 dark:text-[var(--bg-default)] font-medium">
                      ${selectedInvoice.totals.iva.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-900 dark:text-[var(--bg-default)] font-medium leading-none border-t border-gray-200 dark:border-slate-700 pt-2.5">
                    <span>VALOR TOTAL USD:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      ${selectedInvoice.totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-[10px] text-xs flex items-center gap-1.5 cursor-pointer"
              >
                Imprimir Documento
              </button>
              <button
                onClick={() => setOpenRideModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-[var(--bg-default)] font-medium rounded-[10px] text-xs cursor-pointer"
              >
                Cerrar RIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* XML Code Modal */}
      {openXmlModal && selectedInvoice && selectedInvoice.signedXml && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-paper w-full max-w-2xl rounded-[10px] shadow-xl p-6 border border-divider flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-gray-150 dark:border-slate-800 pb-3 mb-4">
              <span className="font-display font-semibold text-sm text-gray-900 dark:text-[var(--bg-default)] flex items-center gap-2">
                <FileCode className="h-4.5 w-4.5 text-indigo-500" />
                XML Autorizado Firmado Electrónicamente (XAdES-BES)
              </span>
              <button
                onClick={() => setOpenXmlModal(false)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <pre className="flex-1 overflow-auto p-4 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-[10px] border border-slate-900 select-all leading-relaxed">
              {selectedInvoice.signedXml}
            </pre>

            <div className="mt-4 flex items-center justify-end gap-2 shrink-0">
              <a
                href={`/api/sri-download-xml/${selectedInvoice.accessKey}`}
                download={`Factura_Autorizada_${selectedInvoice.accessKey}.xml`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[var(--bg-default)] font-medium rounded-[10px] text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar Archivo (.xml)
              </a>
              <button
                onClick={() => setOpenXmlModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-750 dark:text-slate-300 font-medium rounded-[10px] text-xs cursor-pointer"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
