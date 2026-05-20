export interface Client {
  name: string;
  idNumber: string; // Cedula (10), RUC (13) or 9999...
  idType: "04" | "05" | "06" | "07"; // 04=RUC, 05=Cedula, 06=Pasaporte, 07=Consumidor Final
  email?: string;
  phone?: string;
  address?: string;
}

export interface Emitter {
  ruc: string;
  name: string;
  tradeName?: string;
  address: string;
  obligado: boolean; // Obligado a llevar contabilidad (SI/NO)
  environment: "1" | "2"; // 1 = Pruebas, 2 = Producción
  serial: string; // e.g. "001001"
  typeRimpe: "POPULAR" | "EMPRENDEDOR" | "REGIMEN_GENERAL";
  signatureP12Name?: string;
  saasPlan?: "BASIC" | "PRO" | "ENTERPRISE";
}

export interface Item {
  name: string;
  quantity: number;
  price: number;
  ivaRate: 0 | 12 | 15;
  discount: number;
  total: number;
}

export interface Invoice {
  id: string;
  sequence: string; // e.g. "000000021"
  date: string; // YYYY-MM-DD
  client: Client;
  items: Item[];
  paymentMethod: string; // SRI payment codes ("01" = Efectivo, "20" = Transferencia)
  paymentStatus: "PAGADO" | "PENDIENTE";
  status: "BORRADOR" | "PENDIENTE_ENVIO" | "AUTORIZADO" | "RECHAZADO";
  accessKey?: string;
  signedXml?: string;
  totals: {
    subtotal15: number;
    subtotal12: number;
    subtotal0: number;
    discount: number;
    iva: number;
    total: number;
  };
  sriLogs?: string[];
  sriDiagnostic?: string;
}

export interface TaxDeadlineInfo {
  ninthDigit: number;
  ivaDeadlineDay: number;
  incomeDeadlineMonth: string;
  regimen: string;
}

export interface SriAlert {
  title: string;
  date: string;
  urgency: "ALTA" | "MEDIA" | "BAJA";
  description: string;
}

export interface FlowPrediction {
  healthScore: number;
  prognosis: string;
  sriAlerts: SriAlert[];
  ecuadorianTaxTips: string[];
  graphPoints: Array<{ name: string; Caja: number }>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
