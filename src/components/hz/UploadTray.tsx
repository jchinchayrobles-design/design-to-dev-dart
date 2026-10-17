import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, LoaderCircle, Upload, X } from "lucide-react";
import { services } from "@/services";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentAccess } from "./DocumentAccess";

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatMeta(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", kind: "Documento PDF", cls: "bg-danger-soft text-danger" };
  if (ext === "doc" || ext === "docx") return { label: "WORD", kind: "Documento Word", cls: "bg-info-soft text-info" };
  if (ext === "xls" || ext === "xlsx") return { label: "EXCEL", kind: "Hoja de Excel", cls: "bg-success-soft text-success" };
  if (ext === "txt") return { label: "TXT", kind: "Texto", cls: "bg-secondary text-foreground" };
  return { label: ext.toUpperCase().slice(0, 6) || "DOC", kind: "Archivo", cls: "bg-secondary text-foreground" };
}

export function UploadTray({
  open,
  onOpenChange,
  title = "Registrar documentos",
  description = "Selecciona o arrastra tus archivos. Revisa la bandeja antes de cargarlos.",
  confirmLabel = "Cargar",
  readyLabel = "Listo para cargar",
  initialFiles,
  onConfirm,
  persist = false,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  readyLabel?: string;
  initialFiles?: File[];
  onConfirm?: (files: File[]) => void | Promise<void>;
  persist?: boolean;
  onUploaded?: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState<Record<string, { status: "cargando" | "guardado" | "error"; error?: string }>>({});
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"normativa" | "caso">("normativa");
  const key = (f: File) => f.name + f.size;

  useEffect(() => { if (open) { setFiles(initialFiles ?? []); setStates({}); setError(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => {
      const keys = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...Array.from(list).filter((f) => !keys.has(f.name + f.size))];
    });
  };
  const total = files.reduce((s, f) => s + f.size, 0);
  const close = (o: boolean) => { if (busy) return; onOpenChange(o); if (!o) setFiles([]); };
  const pending = files.filter((f) => states[key(f)]?.status !== "guardado");
  const confirm = async () => {
    if (!files.length || busy) return;
    if (!persist) { if (onConfirm) { await onConfirm(files); close(false); } return; }
    setBusy(true); setError("");
    try {
      if (!(await services.isSignedIn())) { setError("Inicia sesión para guardar tus documentos de forma privada."); return; }
      for (const file of pending) {
        setStates((s) => ({ ...s, [key(file)]: { status: "cargando" } }));
        try {
          await services.uploadDocument(file, kind);
          setStates((s) => ({ ...s, [key(file)]: { status: "guardado" } }));
          onUploaded?.();
          await queryClient.invalidateQueries({ queryKey: ["documents"] });
        } catch (e) {
          setStates((s) => ({ ...s, [key(file)]: { status: "error", error: e instanceof Error ? e.message : "No se pudo guardar el archivo." } }));
        }
      }
      if (onConfirm) await onConfirm(files);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la carga."); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-xl" onInteractOutside={(e) => { if (busy) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {persist && <DocumentAccess />}
        {persist && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-muted-foreground">Registrar como:</span>
            {(["normativa", "caso"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} disabled={busy} className={`rounded-full border px-3 py-1 ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                {k === "normativa" ? "Normativa" : "Caso"}
              </button>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={`flex h-auto w-full flex-col items-center gap-1 whitespace-normal rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${drag ? "border-foreground bg-accent" : "border-border bg-secondary hover:bg-accent"}`}
        >
          <Upload className="size-6" />
          <span className="text-[13px] font-semibold">Arrastra aquí o haz clic para seleccionar</span>
          <span className="text-[11px] text-muted-foreground">PDF, Word, Excel y otros formatos · varios archivos a la vez</span>
        </Button>
        <input ref={input} type="file" multiple disabled={busy} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span><strong className="text-foreground">{files.length}</strong> en bandeja{files.length > 0 && ` · ${fmtSize(total)}`}</span>
            {files.length > 0 && <Button type="button" variant="link" disabled={busy} onClick={() => { setFiles([]); setStates({}); }}>Vaciar bandeja</Button>}
          </div>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {files.length === 0 && <li className="rounded-lg border border-border px-3 py-4 text-center text-[12px] text-muted-foreground">La bandeja está vacía.</li>}
            {files.map((f, i) => {
              const m = formatMeta(f.name);
              const state = states[key(f)];
              return (
                <li key={f.name + f.size} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <span className={`w-12 shrink-0 rounded-md py-1 text-center text-[9px] font-bold ${m.cls}`}>{m.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-all text-[12px] font-semibold" title={f.name}>{f.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{m.kind} · {fmtSize(f.size)} · {state?.status === "guardado" ? <><Check className="size-3 text-success" />Guardado</> : state?.status === "cargando" ? <><LoaderCircle className="size-3 animate-spin" />Guardando…</> : state?.status === "error" ? "No guardado" : readyLabel}</div>
                    {state?.error && <p role="alert" className="mt-1 text-[11px] text-danger">{state.error}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={`Quitar ${f.name}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X /></Button>
                </li>
              );
            })}
          </ul>
        </div>

        {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
        <p className="text-[11px] text-muted-foreground">{persist ? "Los documentos se guardan de forma privada. El análisis del contenido y la vigencia aún no están conectados." : "Archivos seleccionados en este navegador; aún no se guardan ni se analizan."}</p>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => close(false)}>{persist && files.length > 0 && pending.length === 0 ? "Cerrar" : "Cancelar"}</Button>
          <Button className="rounded-full" disabled={busy || !files.length || (!onConfirm && !persist) || (persist && !pending.length)} onClick={() => void confirm()}>
            {busy ? <><LoaderCircle className="animate-spin" />Guardando…</> : persist && files.length > 0 && !pending.length ? "Documentos guardados" : <>{confirmLabel} {persist ? pending.length || "" : files.length || ""} documento{(persist ? pending.length : files.length) === 1 ? "" : "s"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
