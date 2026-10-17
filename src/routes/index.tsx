import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowUpRight, Paperclip, X } from "lucide-react";
import { ConsultProgress } from "@/components/hz/ConsultProgress";
import { UploadTray } from "@/components/hz/UploadTray";
import { Button } from "@/components/ui/button";
import { Highlighted, PageHead, Pill } from "@/components/hz/ui";
import { services, NotImplementedError, type ConsultStage } from "@/services";
import type { ConsultAnswer, ContrastStatus, EvidenceLevel, Tone } from "@/lib/domain/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Consultor normativo · Horizonte Intelligence" },
      { name: "description", content: "Pregunta en lenguaje natural y revisa la evidencia documental que sustenta cada respuesta." },
      { property: "og:title", content: "Consultor normativo · Horizonte Intelligence" },
      { property: "og:description", content: "Respuestas normativas trazables, con fuentes, versiones y advertencias." },
    ],
  }),
  component: Consultor,
});

const levelMeta: Record<EvidenceLevel, { label: string; tone: Tone }> = {
  suficiente: { label: "Evidencia suficiente", tone: "green" },
  parcial: { label: "Evidencia parcial", tone: "amber" },
  insuficiente: { label: "Evidencia insuficiente", tone: "red" },
  revision: { label: "Requiere revisión humana", tone: "amber" },
};

function Consultor() {
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState<ConsultStage>("consulta");
  const [caseFiles, setCaseFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setCaseFiles((prev) => [...prev, ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ["documents"], queryFn: services.listDocuments });
  const history = useQuery({ queryKey: ["contrasts"], queryFn: services.listContrasts });
  const [opened, setOpened] = useState<ConsultAnswer | null>(null);
  const norms = (docs.data ?? []).filter((d) => d.kind !== "caso" && d.extractionStatus === "extraido").length;
  const ask = useMutation({
    mutationFn: ({ q, files }: { q: string; files: File[] }) => {
      setStage("consulta");
      setOpened(null);
      return services.askQuestion(q, setStage, files);
    },
    onSuccess: () => {
      setCaseFiles([]);
      void qc.invalidateQueries({ queryKey: ["contrasts"] });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["validations"] });
    },
  });
  const openContrast = async (id: string) => {
    const a = await services.getContrast(id);
    if (a) { ask.reset(); setOpened(a); }
  };

  const submit = (q: string) => {
    let t = q.trim();
    if (!t && caseFiles.length) t = "Contrasta este caso con la normativa vigente.";
    if (!t) return;
    setQuestion(t);
    ask.mutate({ q: t, files: caseFiles });
  };

  return (
    <section className="mx-auto w-full max-w-[1000px]">
      <PageHead
        eyebrow="Horizonte Intelligence / Consulta"
        title="Consultor normativo"
        subtitle="Pregunta en lenguaje natural. Revisa la respuesta y abre la evidencia exacta que la sustenta."
      />

      {ask.isPending ? (
        <ConsultProgress stage={stage} caseMode={(ask.variables?.files.length ?? 0) > 0} />
      ) : ask.isError ? (
        <div className="glass-panel rounded-[22px] p-8 text-center">
          <Pill tone="amber">{ask.error instanceof NotImplementedError ? "Consulta no disponible" : "No se completó el análisis"}</Pill>
          <p className="mt-3 text-[13px] text-muted-foreground">{ask.error instanceof Error && ask.error.message ? ask.error.message : "No se pudo completar la consulta."} No se ha emitido ninguna conclusión.</p>
          <Button className="mt-4 rounded-full" onClick={() => submit(question)}>Reintentar</Button>
        </div>
      ) : ask.data || opened ? (
        <AnswerView answer={(ask.data ?? opened)!} />
      ) : (
        <div className="glass-panel min-h-[330px] rounded-[22px] px-8 py-11 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary text-2xl text-primary-foreground">✳</div>
          <h2 className="text-[27px] font-semibold tracking-[-0.7px]">¿Qué necesitas resolver?</h2>
          <p className="mx-auto mb-6 mt-2 max-w-[600px] text-[14px] leading-relaxed text-muted-foreground">
            {norms ? "Adjunta los documentos de tu caso para contrastarlos con tus normativas, o haz una pregunta directa." : "Sube tus normativas en la Biblioteca documental para poder contrastar casos."}
          </p>
          <Pill tone={norms ? "green" : "gray"}>{norms ? `${norms} normativa(s) legibles` : "Sin normativas legibles registradas"}</Pill>
          {(history.data?.length ?? 0) > 0 && (
            <div className="mx-auto mt-7 max-w-[640px] text-left">
              <div className="eyebrow mb-2">Contrastes anteriores</div>
              <div className="space-y-1.5">
                {history.data!.slice(0, 8).map((h) => (
                  <button key={h.id} type="button" onClick={() => void openContrast(h.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left text-[12px] hover:bg-accent">
                    <span className="min-w-0"><strong className="block truncate">{h.title || h.question}</strong><span className="block truncate text-muted-foreground">{h.question}</span></span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(h.createdAt).toLocaleDateString("es-PE")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        className={`sticky bottom-3 z-[4] mt-3.5 rounded-[19px] border bg-card p-3.5 shadow-float transition-colors ${dragging ? "border-primary bg-accent" : "border-input"}`}
      >
        {caseFiles.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-2 border-b border-border pb-2.5">
            <span className="eyebrow">Caso a contrastar</span>
            {caseFiles.map((f) => (
              <span key={f.name + f.size} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px]">
                <span className="doc-code">{f.name.split(".").pop()?.toUpperCase()}</span>
                <span className="max-w-[200px] truncate">{f.name}</span>
                <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setCaseFiles((p) => p.filter((x) => x !== f))} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input ref={fileInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <UploadTray
          open={trayOpen}
          onOpenChange={setTrayOpen}
          title="Documentos del caso"
          description="Sube los Excel, PDF o Word de tu caso y corrobora los nombres antes de contrastarlos con la normativa."
          confirmLabel="Usar"
          readyLabel="Listo para contraste"
          initialFiles={caseFiles}
          onConfirm={setCaseFiles}
        />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(question);
            }
          }}
          rows={2}
          aria-label="Consulta normativa"
          placeholder={caseFiles.length ? "Opcional: indica qué quieres verificar del caso (ej. límites de aprobación, garantías)…" : "Ej. ¿Qué política regula la evaluación de créditos? También puedes adjuntar tu caso para contrastarlo."}
          className="min-h-[70px] w-full resize-y bg-transparent p-1 text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-warning" />
            {norms ? `Contraste con ${norms} normativa(s)` : "Sin normativas legibles"}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setTrayOpen(true)} disabled={ask.isPending}>
              <Paperclip /> {caseFiles.length ? `Ver bandeja (${caseFiles.length})` : "Adjuntar caso"}
            </Button>
            <Button type="submit" className="rounded-full" disabled={(!question.trim() && !caseFiles.length) || ask.isPending}>
              {caseFiles.length ? "Contrastar" : "Consultar"} <ArrowUpRight />
            </Button>
          </div>
        </div>
      </form>
      <p className="mx-1 mt-3 text-center text-[10px] leading-normal text-muted-foreground">
        Al contrastar, los archivos del caso se guardan de forma privada y se analizan con IA. Cada hallazgo se valida contra el texto literal de la normativa.
      </p>
    </section>
  );
}

function AnswerView({ answer }: { answer: ConsultAnswer }) {
  const lvl = levelMeta[answer.level];
  return (
    <article className="rounded-[22px] border border-glass-border bg-card/80 p-6 shadow-soft [overflow-wrap:anywhere] max-sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Pill tone={lvl.tone}>{lvl.label}</Pill>
        <span className="text-[10px] text-muted-foreground">
          Respuesta con evidencia ·{" "}
          {new Date(answer.answeredAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="mb-1 text-[11px] text-muted-foreground">“{answer.question}”</p>
      <h2 className="mb-3 text-[19px] font-semibold tracking-[-0.4px]">{answer.title}</h2>

      {answer.contrast && <ContrastView contrast={answer.contrast} />}

      {answer.facts.length > 0 && (
        <div className="mb-3">
          <div className="eyebrow mb-1.5">Hechos respaldados por documentos</div>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-secondary-foreground">
            {answer.facts.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}
      {answer.interpretation && (
        <div className="rounded-xl bg-secondary px-4 py-3">
          <div className="eyebrow mb-1">Interpretación · no es una cita</div>
          <p className="text-[13px] leading-relaxed text-secondary-foreground">{answer.interpretation}</p>
        </div>
      )}

      {answer.evidence.length > 0 && (
        <>
          <div className="mb-2.5 mt-6 flex items-center justify-between text-[13px]">
            <strong>Fragmentos que sustentan la respuesta</strong>
            <span className="text-[10px] text-muted-foreground">{answer.evidence.length} fuentes</span>
          </div>
          {answer.evidence.map((e, i) => (
            <div key={i} className="mt-2.5 rounded-[15px] border border-border bg-card p-4">
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className="doc-code">{e.code}</span>
                <strong className="text-[12px]">{e.title}</strong>
                <Pill>{e.version}</Pill>
              </div>
              <blockquote className="rounded-r-[10px] border-l-[3px] border-primary bg-quote px-3.5 py-3 text-[12px] leading-[1.75] text-secondary-foreground">
                <Highlighted text={e.quote} />
              </blockquote>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  Sección: {e.section ?? "no disponible"} · Página: {e.page ?? "no disponible"} — {e.why}
                </span>
                <Link to="/biblioteca/$code" params={{ code: e.code }} className="text-foreground underline">
                  Ver ficha documental
                </Link>
              </div>
            </div>
          ))}
        </>
      )}

      {answer.warnings.map((w) => (
        <div key={w} className="mt-4 rounded-xl bg-warning-soft px-3.5 py-3 text-[12px] leading-relaxed text-warning">⚠ {w}</div>
      ))}
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
        Trazabilidad: consulta → recuperación de fragmentos → evaluación de vigencia → respuesta con evidencia vinculada a la versión documental.
      </div>
    </article>
  );
}

const contrastMeta: Record<ContrastStatus, { label: string; tone: Tone }> = {
  cumple: { label: "Cumple", tone: "green" },
  riesgo: { label: "Riesgo / brecha", tone: "red" },
  excepcion: { label: "Requiere excepción", tone: "amber" },
  sin_evidencia: { label: "Sin evidencia suficiente", tone: "gray" },
};

function ContrastView({ contrast }: { contrast: NonNullable<ConsultAnswer["contrast"]> }) {
  return (
    <div className="mb-5">
      <div className="mb-3 rounded-xl border border-border bg-secondary px-4 py-3">
        <div className="eyebrow mb-1.5">{contrast.fileNames.length ? `Caso analizado · ${contrast.fileNames.join(", ")}` : "Resumen"}</div>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-secondary-foreground">
          {contrast.summary.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>
      <div className="eyebrow mb-1.5">Matriz de contraste normativo</div>
      <div className="space-y-2">
        {contrast.items.length === 0 && <p className="text-[12px] text-muted-foreground">El análisis no produjo hallazgos.</p>}
        {contrast.items.map((it, idx) => {
          const m = contrastMeta[it.status];
          return (
            <div key={idx} className="rounded-[15px] border border-border bg-card p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Pill tone={m.tone}>{m.label}</Pill>
                <strong className="text-[12px]">{it.caseFact}</strong>
              </div>
              <p className="text-[12px] leading-relaxed text-secondary-foreground">{it.rule}</p>
              {it.quote && (
                <blockquote className="mt-2 rounded-r-[10px] border-l-[3px] border-primary bg-quote px-3.5 py-2.5 text-[12px] leading-[1.7] text-secondary-foreground">
                  “{it.quote}”
                  <div className="mt-1 text-[10px] text-muted-foreground">{it.documentName}{it.location ? ` · ${it.location}` : ""} · Cita verificada en el texto</div>
                </blockquote>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{it.note}</span>
                {it.code && <Link to="/biblioteca/$code" params={{ code: it.code }} className="text-foreground underline">Ver normativa</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
