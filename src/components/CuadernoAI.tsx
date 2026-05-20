import { useState } from "react";
import { Sparkles, ArrowRight, CornerDownRight, Check, HelpCircle, AlertCircle, FileText } from "lucide-react";
import { Client, Item } from "../types";

interface CuadernoAIProps {
  onApplyInvoice: (client: Client, items: Item[], paymentMethod: string, notes: string) => void;
}

const PRESET_NOTEBOOKS = [
  {
    title: "☕ Cafetería (Varios ítems & IVA mixto)",
    text: "Venta a Carlos Ruiz Pérez, cédula 1723456789. Consumió 2 tazas de café americano a $2.50 cada una (grava IVA 15%) y compró 3 fundas de pan de masa madre sin procesar a $3.00 cada una (grava IVA 0%). Pagó todo con transferencia bancaria directa."
  },
  {
    title: "🚜 Ferretería e Informalidad",
    text: "Facturar a Constructora del Norte S.A. con RUC 0992341234001. Compraron 10 sacos de cemento Holcim a $8.20 cada uno y 5 palas metálicas de flete a $12.50. Hicieron un descuento de 5 dólares en total. El pago se hizo en efectivo."
  },
  {
    title: "🥬 Venta de Legumbres Básicas (Tasa 0%)",
    text: "Entregar a María Elena López con pasaporte 88273612. Compró 15 libras de papa chola a $0.40 la libra, 5 litros de leche pasteurizada a $0.90 cada uno y 2 bandejas de frutillas a $2.00 cada una. Todo con IVA 0% por ser alimentos naturales. Comprobante en efectivo."
  }
];

export default function CuadernoAI({ onApplyInvoice }: CuadernoAIProps) {
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleProcessAI = async (textToProcess = inputText) => {
    if (!textToProcess.trim()) return;
    setLoading(true);
    setApiError(null);
    setParsedResult(null);

    try {
      const resp = await fetch("/api/nlp-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: textToProcess }),
      });
      if (!resp.ok) {
        throw new Error("El servicio de Kipu Inteligente está procesando muchas solicitudes. Intenta de nuevo.");
      }
      const data = await resp.json();
      setParsedResult(data);
    } catch (err: any) {
      setApiError(err.message || "Fallo al conectar con el motor inteligente Kipu.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    onApplyInvoice(
      parsedResult.client,
      parsedResult.items,
      parsedResult.paymentMethod || "01",
      `Generado con IA Kipu desde nota manuscrita: "${inputText.substring(0, 60)}..."`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="cuaderno-ai">
      {/* Left Input Column */}
      <div className="lg:col-span-6 bg-paper border border-divider rounded-[10px] p-6 ">
        <div className="flex items-center gap-2 mb-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="p-2 bg-divider text-content text-zinc-800 dark:text-zinc-200 rounded-[10px]">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm text-content">
              El Cuaderno Inteligente
            </h2>
            <p className="text-[11px] text-zinc-450 dark:text-content-secondary">
              Escribe o pega una nota informal. Te la convertimos en factura SRI al instante.
            </p>
          </div>
        </div>

        {/* Preset selections */}
        <div className="my-4">
          <span className="text-[10px] font-medium text-content-secondary uppercase tracking-wider block mb-2.5">
            Selecciona un ejemplo rápido para probar:
          </span>
          <div className="flex flex-col gap-1.5">
            {PRESET_NOTEBOOKS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(preset.text);
                  handleProcessAI(preset.text);
                }}
                className="text-left w-full text-xs p-2.5 rounded-[10px] border border-zinc-150 dark:border-zinc-800 bg-default/50 hover:bg-default dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-750 text-content-secondary transition-all cursor-pointer truncate"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input area */}
        <div className="mt-4">
          <label className="text-[10px] uppercase font-medium text-zinc-450 dark:text-content-secondary block mb-1.5 select-none">
            Tu nota de venta o detalle manual
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ej: Vendido a Sr. Manuel Salazar Cédula 1709923812 una ensalada mixta de $5.50 y un jugo de coco de $2.00. Pagó con transferencia..."
            className="w-full h-36 px-3 py-2.5 text-xs rounded-[10px] border border-divider bg-paper focus:outline-none focus:border-zinc-500 dark:focus:focus:border-zinc-400 text-zinc-800 dark:text-zinc-100 resize-none transition-all placeholder:text-content-secondary dark:placeholder:text-zinc-650 font-mono"
          />
        </div>

        {/* Submit */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-content-secondary flex items-center gap-1">
            Soporta IVA 15%, 0% y datos tributarios.
          </span>
          <button
            onClick={() => handleProcessAI()}
            disabled={loading || !inputText.trim()}
            className="px-4 py-2 bg-primary text-[var(--bg-default)] hover:brightness-110 dark:bg-primary text-[var(--bg-default)] dark:hover:brightness-110 disabled:bg-default dark:disabled:bg-primary disabled:text-content-secondary dark:disabled:text-zinc-650 text-[var(--bg-default)] font-semibold rounded-[10px] text-xs flex items-center gap-2 transition-all cursor-pointer  active:scale-95"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Estructurando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generar Factura SRI</span>
              </>
            )}
          </button>
        </div>

        {apiError && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-[10px] text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}
      </div>

      {/* Right Result Column */}
      <div className="lg:col-span-6 flex flex-col justify-between bg-zinc-50 dark:bg-[#0c0c0e] border border-zinc-200/95 dark:border-zinc-800 rounded-[10px] p-6 relative overflow-hidden">
        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-divider/60 pb-3">
              <span className="text-[10px] font-medium text-content-secondary dark:text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-zinc-450" />
                Resultado de la Interpretación IA
              </span>
              {parsedResult && parsedResult.simulated && (
                <span className="px-1.5 py-0.5 text-[8px] bg-default dark:bg-primary text-content-secondary border border-divider rounded font-mono">
                  SIMULADO
                </span>
              )}
            </div>

            {!parsedResult && !loading && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-paper/40 border border-zinc-150 dark:border-zinc-850 rounded-[10px]">
                <div className="w-10 h-10 rounded-[10px] bg-default dark:bg-primary flex items-center justify-center text-content-secondary dark:text-zinc-600 mb-2.5">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-content-secondary">
                  Esperando nota de venta
                </p>
                <p className="text-[10px] text-content-secondary dark:text-zinc-550 mt-1 max-w-xs">
                  Selecciona uno de los ejemplos o redacta tu propio texto a la izquierda para ver la interpretación analítica de KIPU.
                </p>
              </div>
            )}

            {loading && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-[#121114] border border-zinc-150 dark:border-zinc-850 rounded-[10px]">
                <div className="relative w-10 h-10 flex items-center justify-center mb-3.5">
                  <Sparkles className="h-5 w-5 text-content-secondary animate-pulse" />
                </div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-205">
                  Kipu analizando regulaciones del SRI...
                </p>
                <p className="text-[10px] text-content-secondary mt-1 max-w-md px-4">
                  Clasificando tarifas de IVA de Ecuador (0% para canasta básica vs 15% general), RUCs, cédulas de identidad, y calculando subtotales limpios...
                </p>
              </div>
            )}

            {parsedResult && (
              <div className="space-y-4 animate-fade-in text-xs text-content-secondary">
                {/* Intelligent Summary Banner */}
                <div className="p-3 bg-default dark:bg-zinc-850 border border-divider/40 rounded-[10px] text-xs leading-relaxed text-content-secondary font-medium font-mono">
                  {parsedResult.summary}
                </div>

                {/* Client Structured Data */}
                <div className="bg-paper rounded-[10px] p-3.5 border border-divider ">
                  <h4 className="text-[9px] font-medium text-content-secondary dark:text-zinc-550 uppercase tracking-wider mb-2 select-none">
                    CLIENTE IDENTIFICADO
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-xs">
                    <div>
                      <span className="text-[10px] text-content-secondary block">Nombre / Razón Social:</span>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">{parsedResult.client.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-content-secondary block">Identificación:</span>
                      <p className="font-mono font-semibold text-zinc-800 dark:text-zinc-105">
                        {parsedResult.client.idNumber} 
                        <span className="ml-1.5 px-1 py-0.5 bg-divider text-content text-[8px] text-content-secondary rounded">
                          {parsedResult.client.idType === "04" ? "RUC" : parsedResult.client.idType === "05" ? "Cédula" : parsedResult.client.idType === "06" ? "Pasaporte" : "C. Final"}
                        </span>
                      </p>
                    </div>
                    {parsedResult.client.email && (
                      <div className="col-span-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-2 mt-1">
                        <span className="text-[10px] text-content-secondary dark:text-zinc-550 block">Correo Electrónico:</span>
                        <p className="text-content-secondary">{parsedResult.client.email}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Extracted structured */}
                <div className="bg-paper rounded-[10px] p-3.5 border border-divider ">
                  <h4 className="text-[9px] font-medium text-content-secondary dark:text-zinc-550 uppercase tracking-wider mb-2 flex items-center justify-between select-none">
                    <span>CONCEPTOS DETECTADOS</span>
                    <span className="text-[10px] font-mono text-content-secondary font-normal">Total: {parsedResult.items?.length || 0}</span>
                  </h4>
                  <div className="space-y-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {parsedResult.items?.map((item: any, idx: number) => (
                      <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-content-secondary font-mono mt-0.5">
                            Cant: {item.quantity} × ${item.price?.toFixed(2)} USD
                            {item.discount > 0 && <span className="ml-2 text-rose-500">Desc: -${item.discount?.toFixed(2)}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
                            ${((item.quantity * item.price) - (item.discount || 0)).toFixed(2)}
                          </span>
                          <div className="text-[9px] font-mono text-zinc-450 dark:text-zinc-550">
                            IVA {item.ivaRate}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment details */}
                <div className="flex items-center gap-3 text-xs bg-paper p-3.5 rounded-[10px] border border-divider ">
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-450 dark:text-content-secondary block">Forma de Pago del SRI:</span>
                    <p className="font-semibold text-content-secondary font-mono mt-0.5">
                      {parsedResult.paymentMethod === "20" ? "20 - Transferencia Bancaria (Sistema Financiero)" : "01 - Efectivo / Nota Informal"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {parsedResult && (
            <div className="mt-6 pt-4 border-t border-divider relative z-10">
              <button
                onClick={handleApply}
                className="w-full py-2.5 bg-primary text-[var(--bg-default)] hover:brightness-110 border border-transparent text-[var(--bg-default)] rounded-[10px] font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 "
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>¡Traspasado con Éxito al Facturador!</span>
                  </>
                ) : (
                  <>
                    <span>Exportar Datos al Generador SRI</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
