import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Pill } from "@/components/hz/ui";
import { cn } from "@/lib/utils";
import { countByStatus, overallState, sortBySeverity, STATUS_ORDER } from "@/lib/domain/contrast-view";
import type { ConsultAnswer, ContrastItem, ContrastStatus, Tone } from "@/lib/domain/types";

const statusMeta: Record<ContrastStatus, { label: string; tone: Tone }> = {
  riesgo: { label: "Riesgo / brecha", tone: "red" },
  excepcion: { label: "Requiere excepción", tone: "amber" },
  sin_evidencia: { label: "Sin evidencia suficiente", tone: "gray" },
  cumple: { label: "Cumple", tone: "green" },
};
const overallMeta = {
  requiere_atencion: { label: "Requiere atención", tone: "red" as Tone },
  evidencia_insuficiente: { label: "Evidencia insuficiente", tone: "amber" as Tone },
  sin_observaciones: { label: "Sin observaciones", tone: "green" as Tone },
};
const prioTone = { alta: "red", media: "amber", baja: "gray" } as const;

export function CaseResult({ answer }: { answer: ConsultAnswer }) {
  const c = answer.contrast!;
  const isCase = c.fileNames.length > 0;
  const counts = countByStatus(c.items);
  const overall = overallMeta[overallState(c.items)];
  const [filter, setFilter] = useState<ContrastStatus | null>(null);
  const order = sortBySeverity(c.items).filter((i) => !filter || c.items[i]!.status === filter);
  const focus = (i: number) => {
    setFilter(null);
    requestAnimationFrame(() => document.getElementById(`hallazgo-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <article className="space-y-4 [overflow-wrap:anywhere]">
      {/* 1. Encabezado + 2. Conclusión */}
      <section className="rounded-[22px] border border-glass-border bg-card/80 p-6 shadow-soft max-sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="eyebrow">{isCase ? "Resultado de la revisión del caso" : "Respuesta normativa"}</div>
          <div className="flex items-center gap-2">
            <Pill tone={overall.tone}>{overall.label}</Pill>
            <span className="text-[10px] text-muted-foreground">
              {new Date(answer.answeredAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        </div>
        <h2 className="text-[20px] font-semibold tracking-[-0.4px]">{answer.title}</h2>
        {isCase && <p className="mt-1 text-[11px] text-muted-foreground">Caso: {c.fileNames.join(" · ")}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">Consulta: “{answer.question}”</p>

        {(c.conclusion || c.summary.length > 0) && (
          <div className="mt-4 rounded-xl bg-secondary px-4 py-3">
            <div className="eyebrow mb-1">Conclusión</div>
            {c.conclusion && <p className="text-[14px] font-semibold leading-snug">{c.conclusion}</p>}
            {c.summary.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed text-secondary-foreground">
                {c.summary.map((s) => <li key={s}>{s}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(filter === s ? null : s)}
              disabled={!counts[s]}
              aria-pressed={filter === s}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                filter === s ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent",
              )}
            >
              <div className="text-[20px] font-semibold leading-none">{counts[s]}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{statusMeta[s].label}</div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {/* Columna principal: hallazgos */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[14px] font-semibold">Hallazgos {filter && <span className="font-normal text-muted-foreground">· {statusMeta[filter].label}</span>}</h3>
            {filter && <button type="button" onClick={() => setFilter(null)} className="text-[11px] underline">Ver todos</button>}
          </div>
          {c.items.length === 0 && <p className="px-1 text-[12px] text-muted-foreground">El análisis no produjo hallazgos.</p>}
          <div className="space-y-2.5">
            {order.map((i) => <FindingCard key={i} id={`hallazgo-${i}`} item={c.items[i]!} isCase={isCase} />)}
          </div>
        </section>

        {/* Panel lateral de acción */}
        <aside className="space-y-3 lg:sticky lg:top-4">
          {(c.actions?.length ?? 0) > 0 && (
            <section className="rounded-[18px] border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-2.5 text-[13px] font-semibold">Qué hacer ahora</h3>
              <ol className="space-y-2.5">
                {[...c.actions!].sort((a, b) => ["alta", "media", "baja"].indexOf(a.priority) - ["alta", "media", "baja"].indexOf(b.priority)).map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px] leading-relaxed">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p>{a.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Pill tone={prioTone[a.priority]}>Prioridad {a.priority}</Pill>
                        {a.findingIndex !== null && (
                          <button type="button" onClick={() => focus(a.findingIndex!)} className="text-[10px] text-foreground underline">Ver hallazgo</button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(c.missingInfo?.length ?? 0) > 0 && (
            <section className="rounded-[18px] border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-2 text-[13px] font-semibold">Información faltante</h3>
              <ul className="space-y-1.5 text-[12px]">
                {c.missingInfo!.map((m) => (
                  <li key={m}><label className="flex cursor-pointer gap-2"><input type="checkbox" className="mt-0.5 accent-primary" />{m}</label></li>
                ))}
              </ul>
            </section>
          )}

          {(c.normNames?.length ?? 0) > 0 && (
            <section className="rounded-[18px] border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-2 text-[13px] font-semibold">Normativa aplicada</h3>
              <ul className="space-y-2">
                {c.normNames!.map((n) => (
                  <li key={n.id} className="rounded-xl bg-secondary px-3 py-2 text-[12px]">
                    <div className="truncate font-medium">{n.name}</div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <Pill tone="amber">Vigencia pendiente de validación</Pill>
                      <Link to="/biblioteca/$code" params={{ code: n.id }} className="text-[11px] underline">Ver ficha</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {answer.warnings.length > 0 && (
            <section className="rounded-[18px] bg-warning-soft px-4 py-3 text-[12px] leading-relaxed text-warning">
              <strong className="mb-1 block">Advertencias técnicas</strong>
              <ul className="list-disc space-y-0.5 pl-5">{answer.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

function Block({ label, tone, children }: { label: string; tone?: "warn" | "action"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5 text-[12px] leading-relaxed", tone === "warn" ? "bg-warning-soft" : tone === "action" ? "border border-primary/30 bg-accent" : "bg-secondary")}>
      <div className="eyebrow mb-1">{label}</div>
      <div className="text-secondary-foreground">{children}</div>
    </div>
  );
}

function FindingCard({ id, item, isCase }: { id: string; item: ContrastItem; isCase: boolean }) {
  const m = statusMeta[item.status];
  const [open, setOpen] = useState(item.status !== "cumple");
  const legacy = !item.observed && !item.expected && !item.gap && !item.action;
  return (
    <div id={id} className="scroll-mt-4 rounded-[15px] border border-border bg-card shadow-soft">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
        <Pill tone={m.tone}>{m.label}</Pill>
        <strong className="min-w-0 flex-1 text-[13px]">{item.caseFact}</strong>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-border px-4 pb-4 pt-3">
          {(item.observed || item.expected || item.rule) && (
            <div className="grid gap-2.5 md:grid-cols-2">
              {item.observed && (
                <Block label={isCase ? "Lo que dice el caso" : "Punto consultado"}>{item.observed}</Block>
              )}
              {(item.expected || item.rule) && (
                <Block label="Lo que exige la norma">
                  {item.expected ?? item.rule}
                  {item.expected && item.rule && <div className="mt-0.5 text-[11px] text-muted-foreground">{item.rule}</div>}
                </Block>
              )}
            </div>
          )}
          {item.quote && (
            <blockquote className="rounded-r-[10px] border-l-[3px] border-primary bg-quote px-3 py-2 text-[12px] leading-[1.7]">
              “{item.quote}”
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{item.documentName}{item.location ? ` · ${item.location}` : ""} · Cita verificada en el texto</span>
                {item.code && <Link to="/biblioteca/$code" params={{ code: item.code }} className="text-foreground underline">Ver normativa</Link>}
              </div>
            </blockquote>
          )}
          {item.gap && <Block label="Brecha / diferencia" tone="warn">{item.gap}</Block>}
          {item.action && <Block label="Acción requerida" tone="action"><strong className="font-semibold text-foreground">{item.action}</strong></Block>}
          {item.missing && <Block label="Qué falta para concluir">{item.missing}</Block>}
          {(legacy || item.status === "sin_evidencia") && item.note && <Block label="Nota">{item.note}</Block>}
        </div>
      )}
    </div>
  );
}
