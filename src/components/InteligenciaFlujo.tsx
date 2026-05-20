import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DollarSign, Calendar, TrendingUp, Sparkles, Scale, AlertCircle, RefreshCw, BookmarkCheck } from "lucide-react";
import { Invoice, FlowPrediction, TaxDeadlineInfo } from "../types";

interface InteligenciaFlujoProps {
  ruc: string;
  invoices: Invoice[];
  currentCash: number;
  recurringExpenses: number;
  onRefresh: () => void;
}

export default function InteligenciaFlujo({
  ruc,
  invoices,
  currentCash,
  recurringExpenses,
  onRefresh
}: InteligenciaFlujoProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<FlowPrediction | null>(null);
  const [deadlineData, setDeadlineData] = useState<TaxDeadlineInfo | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  // Compute stats on the fly
  const totalBilled = invoices.reduce((sum, inv) => sum + (inv.totals?.total || 0), 0);
  const accountsReceivable = invoices
    .filter((inv) => inv.paymentStatus === "PENDIENTE" && inv.status === "AUTORIZADO")
    .reduce((sum, inv) => sum + (inv.totals?.total || 0), 0);
  const accumulatedIva = invoices
    .filter((inv) => inv.status === "AUTORIZADO")
    .reduce((sum, inv) => sum + (inv.totals?.iva || 0), 0);

  // Get RUC deadlines and compute remaining days relative to current time (May 20, 2026)
  useEffect(() => {
    const rucClean = ruc.replace(/[^0-9]/g, "");
    let ninthDigit = 0;
    if (rucClean.length >= 9) {
      ninthDigit = parseInt(rucClean[8]);
    }

    const deadlinesMap: Record<number, number> = {
      1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28
    };

    const day = deadlinesMap[ninthDigit] || 24;

    setDeadlineData({
      ninthDigit,
      ivaDeadlineDay: day,
      incomeDeadlineMonth: "Marzo/Abril",
      regimen: rucClean.endsWith("001") ? "RIMPE Emprendedor / General" : "Régimen General"
    });

    // Assume current time is May 20, 2026. SRI deadlines for May activity happen in June.
    // If we are on May 20, the deadline for previous month (April) has passed on some, or we are looking at May obligations due in June.
    // Let's compute days until June {day}, 2026 relative to current mock Date: May 20, 2026 (6 days left to end of May + {day} days in June!)
    const currentMockDate = new Date("2026-05-20");
    const deadlineDate = new Date(`2026-06-${day}`);
    const msDiff = deadlineDate.getTime() - currentMockDate.getTime();
    const days = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
    setDaysRemaining(days > 0 ? days : 30 + days);
  }, [ruc]);

  // Handle predicting api
  const fetchPrediction = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/predict-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruc,
          invoices,
          recurringExpenses,
          currentCash
        }),
      });
      const data = await resp.json();
      setPrediction(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
  }, [ruc, invoices, currentCash, recurringExpenses]);

  return (
    <div className="space-y-6" id="inteligencia-flujo">
      {/* Top summary row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Cash balance box */}
        <div className="bg-paper border border-divider rounded-[10px] p-5 ">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-medium text-content-secondary tracking-wider block">
                Caja en Cuenta Kipu
              </span>
              <p className="font-display font-semibold text-xl text-content mt-1">
                ${currentCash.toFixed(2)}
              </p>
            </div>
            <div className="p-1.5 bg-divider text-content rounded-[10px]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-content-secondary flex items-center gap-1 font-mono">
            <span>Disponible inmediato para egresos</span>
          </div>
        </div>

        {/* Facturacion total */}
        <div className="bg-paper border border-divider rounded-[10px] p-5 ">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-medium text-content-secondary tracking-wider block">
                Facturado Total (Ventas)
              </span>
              <p className="font-display font-semibold text-xl text-content mt-1">
                ${totalBilled.toFixed(2)}
              </p>
            </div>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-[10px]">
              <BookmarkCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-content-secondary font-mono">
            {invoices.length} comprobantes emitidos
          </div>
        </div>

        {/* Cuentas por Cobrar */}
        <div className="bg-paper border border-divider rounded-[10px] p-5 ">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-medium text-content-secondary tracking-wider block">
                Cuentas por Cobrar
              </span>
              <p className="font-display font-semibold text-xl text-content mt-1">
                ${accountsReceivable.toFixed(2)}
              </p>
            </div>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-[10px]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-content-secondary font-mono">
            Facturas por cobrar
          </div>
        </div>

        {/* IVA acumulado SRI */}
        <div className="bg-paper border border-divider rounded-[10px] p-5 ">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-medium text-content-secondary dark:text-zinc-550 block">
                IVA Acumulado por Declarar
              </span>
              <p className="font-display font-semibold text-xl text-content mt-1">
                ${accumulatedIva.toFixed(2)}
              </p>
            </div>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 rounded-[10px]">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-content-secondary font-mono">
            Tasa actual general: 15% IVA
          </div>
        </div>
      </div>

      {/* RUC Alerts and Timeframe Banner */}
      {deadlineData && (
        <div className="bg-paper border border-divider rounded-[10px] p-6  flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-divider text-content border border-[#E2E8F0] dark:border-zinc-700/60 rounded text-[9px] font-mono tracking-wide font-medium">
                CÉDULA / RUC ECUADOR
              </span>
              <span className="text-[10px] text-content-secondary dark:text-zinc-550 font-mono">RUC: {ruc}</span>
            </div>
            <h3 className="font-display font-semibold text-sm text-zinc-900 dark:text-zinc-105">
              Alerta de Calendario Tributario SRI
            </h3>
            <p className="text-xs text-zinc-650 dark:text-zinc-450 max-w-xl leading-relaxed">
              El noveno dígito de tu RUC es <strong className="text-content font-mono text-sm">{deadlineData.ninthDigit}</strong>. Según la Ley de Régimen Tributario Interno, tu límite de declaración de IVA y Retenciones vence el <strong className="text-content">día {deadlineData.ivaDeadlineDay} de cada mes</strong>.
            </p>
          </div>

          <div className="relative z-10 shrink-0 bg-default dark:bg-primary/40 border border-[#E2E8F0] dark:border-zinc-800 rounded-[10px] p-4 flex items-center gap-4">
            <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-[10px] text-content ">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] text-zinc-450 dark:text-content-secondary uppercase tracking-widest block font-medium">
                Plazo de Impuestos
              </span>
              <p className="font-display font-black text-2xl text-content mt-0.5">
                {daysRemaining} Días
              </p>
              <p className="text-[9px] text-zinc-450 dark:text-content-secondary mt-0.5 font-mono">Vence: Junio {deadlineData.ivaDeadlineDay}, 2026</p>
            </div>
          </div>
        </div>
      )}

      {/* Prediction engine visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Prediction Chart Column */}
        <div className="lg:col-span-8 bg-paper border border-divider rounded-[10px] p-6  flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/85 pb-4 mb-4">
            <div>
              <h3 className="font-display font-semibold text-xs text-content uppercase tracking-wider">
                Proyección Flujo de Caja (Próximas 4 Semanas)
              </h3>
              <p className="text-[11px] text-zinc-450 dark:text-content-secondary mt-1 leading-relaxed">
                Simulación predictiva cruzando cobros pendientes de clientes, egresos fijos (${recurringExpenses}/mes) y obligaciones del SRI.
              </p>
            </div>
            <button
              onClick={fetchPrediction}
              className="p-1.5 rounded-[10px] border border-divider hover:bg-zinc-50 dark:hover:bg-primary text-zinc-650 dark:text-content-secondary cursor-pointer active:scale-95 transition-all text-xs"
              title="Recalcular Predicción"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading && !prediction && (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <div className="h-6 w-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs text-zinc-550">KIPU está graficando de forma predictiva tus tendencias de flujo...</p>
            </div>
          )}

          {prediction && (
            <div className="space-y-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={prediction.graphPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCaja" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorRenta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorIVA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" className="dark:hidden" />
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" className="hidden dark:block" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181b",
                        color: "#fff",
                        borderRadius: "6px",
                        border: "1px solid #27272a",
                        fontSize: "11px",
                        fontFamily: "monospace"
                      }}
                      formatter={(val: number, name: string) => {
                        let label = "Saldo Caja";
                        if (name === "Renta") label = "Reserva Renta";
                        if (name === "IVA") label = "IVA por Pagar";
                        return [`$${val.toFixed(2)} USD`, label];
                      }}
                    />
                    <Area type="monotone" name="Caja" dataKey="Caja" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCaja)" />
                    <Area type="monotone" name="Renta" dataKey="Renta" stroke="#8b5cf6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRenta)" />
                    <Area type="monotone" name="IVA" dataKey="IVA" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#colorIVA)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Prognosis narrative */}
              <div className="bg-zinc-50/70 dark:bg-[#18181b]/35 p-4 border border-divider rounded-[10px] space-y-1">
                <span className="text-[10px] uppercase font-medium text-zinc-450 dark:text-zinc-505 tracking-wider flex items-center gap-1 font-mono">
                  Diagnóstico Inteligente de Liquidez
                </span>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {prediction.prognosis}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cash Health Score Pillar & Ecuadorian Tax Deducibles column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Circular progress of Cash health score */}
          <div className="bg-paper border border-divider rounded-[10px] p-6  text-center flex flex-col items-center justify-between">
            <h3 className="font-display font-semibold text-xs text-content uppercase tracking-wider mb-4">
              Score de Salud de Liquidez
            </h3>

            {loading ? (
              <div className="h-28 w-28 flex items-center justify-center">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              prediction && (
                <div className="relative flex items-center justify-center my-3">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="54" strokeWidth="6" stroke="#f4f4f5" className="dark:stroke-zinc-800/80" fill="transparent" />
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      strokeWidth="6"
                      stroke="currentColor"
                      className="dark:stroke-[#94A3B8] transition-all duration-1000"
                      fill="transparent"
                      strokeDasharray={339}
                      strokeDashoffset={339 - (339 * prediction.healthScore) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="font-display font-black text-3xl text-zinc-900 dark:text-zinc-50">
                      {prediction.healthScore}
                    </span>
                    <span className="text-[8px] uppercase font-medium tracking-widest text-content-secondary mt-1">
                      {prediction.healthScore >= 80 ? "EXCELENTE" : prediction.healthScore >= 60 ? "SALUDABLE" : "PRECAUCIÓN"}
                    </span>
                  </div>
                </div>
              )
            )}

            <p className="text-[10px] text-content-secondary max-w-[200px] mt-2 leading-relaxed">
              Calculado en base a cobros promedio de facturas y pasivos impositivos estimados.
            </p>
          </div>

          {/* SRI Fiscal Alerts List */}
          <div className="bg-paper border border-divider rounded-[10px] p-5 ">
            <h3 className="font-display font-semibold text-xs text-content uppercase tracking-wider mb-3.5 flex items-center gap-1.5 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
              <AlertCircle className="h-4 w-4 text-content-secondary" />
              Próximos Vencimientos SRI
            </h3>
            <div className="space-y-3">
              {prediction?.sriAlerts.map((alert, idx) => (
                <div key={idx} className="p-3 bg-zinc-50/50 dark:bg-[#18181b]/35 border border-zinc-200/80 dark:border-zinc-800 rounded-[10px] space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 leading-tight">
                      {alert.title}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[8px] rounded font-medium uppercase ${alert.urgency === "ALTA" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-450 border border-red-100" : "bg-default text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/60"}`}>
                      {alert.urgency}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-450 dark:text-content-secondary font-medium font-mono">
                    Límite: {alert.date}
                  </p>
                  <p className="text-[10px] leading-relaxed text-content-secondary">
                    {alert.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tax saving deep tip boxes */}
      {prediction && prediction.ecuadorianTaxTips && (
        <div className="bg-paper border border-divider rounded-[10px] p-6 ">
          <h3 className="font-display font-semibold text-xs text-zinc-900 dark:text-zinc-105 uppercase tracking-wider mb-4 flex items-center gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
            <Scale className="h-4 w-4 text-content-secondary" />
            Estrategias Tributarias Inteligentes (SRI Ecuador 2026)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prediction.ecuadorianTaxTips.map((tip, idx) => (
              <div
                key={idx}
                className="p-4 border border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-[#0c0c0e]/30 rounded-[10px] flex gap-3 text-xs leading-relaxed text-zinc-650 dark:text-zinc-300"
              >
                <div className="p-2 h-7 w-7 rounded-[10px] bg-divider text-content-secondary flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="font-medium text-zinc-800 dark:text-zinc-100 mb-1">
                    {idx === 0 ? "Crédito Tributario de IVA" : idx === 1 ? "Optimización Régimen RIMPE" : "Flujo & Retenciones"}
                  </div>
                  <span className="font-mono text-[11px]" dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*/g, "") }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
