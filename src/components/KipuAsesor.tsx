import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, HelpCircle, ArrowRight, BookOpen } from "lucide-react";
import { ChatMessage, Invoice } from "../types";

const QUICK_PROMPTS = [
  "¿Cuáles son los porcentajes de retención de renta vigentes en Ecuador para servicios?",
  "¿Quiénes pertenecen al RIMPE Popular y cómo se factura?",
  "¿Cómo funciona el crédito tributario de IVA en compras?",
  "¿Qué contiene la Clave de Acceso de 49 dígitos del SRI?"
];

interface KipuAsesorProps {
  ruc: string;
  invoices: Invoice[];
}

export default function KipuAsesor({ ruc, invoices }: KipuAsesorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: "msg-1",
        role: "assistant",
        content: "¡Hola! Soy **Kipu Asesor**, tu consultor de inteligencia financiera y tributaria ecuatoriana. Estoy aquí para ayudarte a entender tus obligaciones del SRI, retenciones, IVA, deducibles del RIMPE, o darte consejos para mejorar la liquidez de tu negocio. ¿Qué duda te gustaría resolver hoy?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
    ];
  });
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll inside chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend = inputText) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const historyPayload = [...messages, userMsg].map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      }));

      const resp = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: historyPayload,
          context: {
             ruc,
             invoicesSummary: {
                totalBilled: invoices.reduce((acc, inv) => acc + (inv.totals?.total || 0), 0),
                totalIva: invoices.reduce((acc, inv) => acc + (inv.totals?.iva || 0), 0),
                invoiceCount: invoices.length,
             }
          }
        }),
      });

      if (!resp.ok) {
        throw new Error("El servicio fiscal Kipu no está disponible de momento.");
      }

      const data = await resp.json();

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        // @ts-ignore
        simulated: data.simulated
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Lo siento, ocurrió una interrupción de conexión al consultar con el SRI Fiscal Advisor. Inténtalo de nuevo.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[580px]" id="kipu-asesor">
      {/* Left educational / prompt panel */}
      <div className="lg:col-span-4 bg-paper border border-divider rounded-[10px] p-5  flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div className="p-1.5 bg-divider text-content rounded-[10px]">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-xs text-content uppercase tracking-widest">
                Guía Rápida SRI & Finanzas
              </h2>
              <p className="text-[10px] text-content-secondary mt-0.5">Haz clic para consultar de inmediato:</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="text-left w-full text-xs p-3 rounded-[10px] border border-zinc-150 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-[#0c0c0d]/65 hover:bg-default dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 text-content-secondary transition-all cursor-pointer flex items-center justify-between group"
              >
                <span className="flex-1 pr-2 line-clamp-2 leading-relaxed text-[11px]">{prompt}</span>
                <ArrowRight className="h-3.5 w-3.5 text-content-secondary group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-zinc-50/50 dark:bg-[#0c0c0d]/40 border border-divider rounded-[10px] mt-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-content mb-1 font-mono uppercase tracking-wider">
            Tarifas de Retención Comunes
          </div>
          <p className="text-[10px] text-content-secondary leading-relaxed font-mono">
            - <strong>1.50% - 1.75%:</strong> Bienes corporales.<br />
            - <strong>2.75%:</strong> Prestación de servicios.<br />
            - <strong>10.00%:</strong> Honorarios profesionales.
          </p>
        </div>
      </div>

      {/* Main Chat box */}
      <div className="lg:col-span-8 bg-paper border border-divider rounded-[10px] flex flex-col justify-between  overflow-hidden relative">
        {/* Chat Messages */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[480px]">
          {messages.map((m) => {
            const isAss = m.role === "assistant";
            return (
              <div key={m.id} className={`flex gap-3 ${isAss ? "justify-start" : "justify-end"}`}>
                {isAss && (
                  <div className="h-7 w-7 rounded-full bg-primary text-[var(--bg-default)] font-medium text-[10px] flex items-center justify-center  shrink-0 select-none">
                    KP
                  </div>
                )}
                <div className="max-w-[85%] space-y-1">
                  <div
                    className={`p-3.5 rounded-[10px] text-xs leading-relaxed space-y-2 ${
                      isAss
                        ? "bg-zinc-50/70 dark:bg-[#18181b]/40 text-zinc-800 dark:text-zinc-250 border border-divider"
                        : "bg-primary text-[var(--bg-default)] border border-primary text-[var(--bg-default)] dark:bg-primary text-[var(--bg-default)] dark:border-primary dark:text-[var(--bg-default)] rounded-br-none"
                    }`}
                  >
                    {/* Render basic markdown bold replacements safely */}
                    <p
                      dangerouslySetInnerHTML={{
                        __html: m.content
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\n/g, "<br/>"),
                      }}
                    />
                  </div>
                  <div className={`text-[9px] text-content-secondary dark:text-zinc-550 font-mono flex items-center gap-2 ${!isAss ? "justify-end mr-1" : "ml-1"}`}>
                    <span>{m.timestamp}</span>
                    {/* @ts-ignore */}
                    {m.simulated && (
                      <span className="px-1 bg-default dark:bg-primary text-content-secondary rounded text-[8px] font-sans border border-zinc-200">
                        IA Local
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start gap-3">
              <div className="h-7 w-7 rounded-full bg-primary text-[var(--bg-default)] font-medium text-[10px] flex items-center justify-center shrink-0 animate-pulse">
                KP
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-[#18181b]/30 rounded-[10px] border border-divider/80 flex items-center gap-1.5 text-xs text-content-secondary font-mono">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-450 dark:bg-zinc-550 animate-bounce" />
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-455 dark:bg-zinc-555 animate-bounce delay-75" />
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-460 dark:bg-zinc-560 animate-bounce delay-150" />
                <span>Kipu Asesor analizando regulaciones fiscales...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form footer */}
        <div className="p-4 border-t border-divider bg-zinc-50/50 dark:bg-[#0c0c0e]/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe tu consulta impositiva aquí. Ej: ¿Cómo cambio de régimen?"
              className="flex-1 px-3 py-2 rounded-[10px] text-xs border border-divider bg-paper focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 text-zinc-800 dark:text-zinc-100"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="px-4 bg-primary text-[var(--bg-default)] hover:brightness-110 text-[var(--bg-default)] disabled:bg-default dark:disabled:bg-primary disabled:text-content-secondary dark:disabled:text-zinc-650 rounded-[10px] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
