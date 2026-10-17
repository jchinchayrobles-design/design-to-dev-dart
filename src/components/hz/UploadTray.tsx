import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt";

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
  return { label: ext.toUpperCase() || "?", kind: "Formato no admitido", cls: "bg-warning-soft text-warning" };
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  readyLabel?: string;
  initialFiles?: File[];
  onConfirm?: (files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setFiles(initialFiles ?? []); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => {
      const keys = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...Array.from(list).filter((f) => !keys.has(f.name + f.size))];
    });
  };
  const total = files.reduce((s, f) => s + f.size, 0);
  const close = (o: boolean) => { onOpenChange(o); if (!o) setFiles([]); };
  const confirm = () => {
    if (!onConfirm) return;
    onConfirm(files);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${drag ? "border-foreground bg-accent" : "border-border bg-secondary hover:bg-accent"}`}
        >
          <span className="text-2xl">⇪</span>
          <span className="text-[13px] font-semibold">Arrastra aquí o haz clic para seleccionar</span>
          <span className="text-[11px] text-muted-foreground">PDF, Word, Excel o TXT · varios archivos a la vez</span>
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span><strong className="text-foreground">{files.length}</strong> en bandeja{files.length > 0 && ` · ${fmtSize(total)}`}</span>
            {files.length > 0 && <button type="button" className="underline" onClick={() => setFiles([])}>Vaciar bandeja</button>}
          </div>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {files.length === 0 && <li className="rounded-lg border border-border px-3 py-4 text-center text-[12px] text-muted-foreground">La bandeja está vacía.</li>}
            {files.map((f, i) => {
              const m = formatMeta(f.name);
              return (
                <li key={f.name + f.size} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <span className={`w-12 shrink-0 rounded-md py-1 text-center text-[9px] font-bold ${m.cls}`}>{m.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="break-all text-[12px] font-semibold" title={f.name}>{f.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.kind} · {fmtSize(f.size)} · {readyLabel}</div>
                  </div>
                  <button type="button" aria-label={`Quitar ${f.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>✕</button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-[11px] text-muted-foreground">{onConfirm ? "Archivos seleccionados en este navegador; aún no se guardan ni se analizan." : "El guardado de documentos aún no está conectado. Los archivos seleccionados no se han cargado."}</p>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => close(false)}>Cancelar</Button>
          <Button className="rounded-full" disabled={!onConfirm} onClick={confirm}>
            {confirmLabel} {files.length || ""} documento{files.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
