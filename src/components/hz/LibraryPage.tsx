import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadTray } from "./UploadTray";
import { Empty, PageHead, Panel, Pill } from "./ui";
import { services } from "@/services";
import { assessValidity, fmtDate } from "@/lib/domain/validity";
import { DocumentAccess } from "./DocumentAccess";

const field = "rounded-[9px] border border-input bg-card px-3 py-2.5 text-[12px] outline-none focus:border-ring";

export function LibraryPage() {
  const search = useSearch({ from: "/biblioteca/" });
  const navigate = useNavigate();
  const date = services.referenceDate();
  const { data: docs, isLoading, isError, refetch } = useQuery({ queryKey: ["documents"], queryFn: services.listDocuments });
  const [q, setQ] = useState(search.q ?? "");
  const [type, setType] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const qc = useQueryClient();
  const toggleKind = async (code: string, kind: "normativa" | "caso") => { await services.setDocumentKind(code, kind); await qc.invalidateQueries({ queryKey: ["documents"] }); };
  useEffect(() => setQ(search.q ?? ""), [search.q]);

  const types = useMemo(() => [...new Set(docs?.map((d) => d.type))], [docs]);
  const areas = useMemo(() => [...new Set(docs?.map((d) => d.area))], [docs]);

  const rows = (docs ?? [])
    .map((d) => ({ d, a: assessValidity(d, date) }))
    .filter(({ d, a }) => {
      const hay = [d.code, d.title, d.owner, d.area, d.type, ...d.versions.map((v) => "v" + v.v)].join(" ").toLowerCase();
      const st = status === "Futura" ? (a.futureVersion ? "Futura" : "") : status === "Reemplazado" ? (d.versions.some((v) => v.status === "replaced") ? "Reemplazado" : "") : a.state;
      return (!q || hay.includes(q.toLowerCase().trim())) && (!type || d.type === type) && (!area || d.area === area) && (!status || st === status);
    });

  const reset = () => {
    setQ(""); setType(""); setArea(""); setStatus("");
    navigate({ to: "/biblioteca", search: {} });
  };

  return (
    <section>
      <PageHead
        eyebrow="Repositorio central"
        title="Biblioteca documental"
        subtitle="Encuentra documentos, revisa sus versiones y verifica su aplicabilidad temporal."
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={reset}>↺ Limpiar filtros</Button>
            <Button className="rounded-full" onClick={() => setUploadOpen(true)}>＋ Registrar documento</Button>
          </>
        }
      />
      <DocumentAccess />
      <div className="mb-4 flex flex-wrap gap-2.5 text-[11px] text-muted-foreground">
        <span>{docs?.length ?? "—"} documentos registrados</span>
        <span>Fecha de referencia: {fmtDate(date)}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input className={`${field} min-w-[260px] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, título, versión o responsable..." aria-label="Buscar documentos" />
        <select className={field} value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>{types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={field} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Categoría / área">
          <option value="">Todas las áreas</option>{areas.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="Vigente">Vigente</option>
          <option value="Pendiente">Pendiente de validación</option>
          <option value="Revisión">Vigencia por confirmar</option>
          <option value="Sin versión">Vencido / sin versión</option>
          <option value="Reemplazado">Con versiones reemplazadas</option>
          <option value="Futura">Con versión futura</option>
        </select>
      </div>
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[12px]">
            <thead className="bg-secondary text-left text-[10px] font-bold uppercase tracking-[0.4px] text-muted-foreground">
              <tr>{["Documento", "Tipo / área", "Versión aplicable", "Vigente desde", "Estado documental", "Responsable"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6}><Empty>Cargando documentos…</Empty></td></tr>}
              {isError && <tr><td colSpan={6}><Empty>No se pudo cargar la biblioteca. <button className="underline" onClick={() => refetch()}>Reintentar</button></Empty></td></tr>}
              {docs && rows.length === 0 && <tr><td colSpan={6}><Empty>{docs.length === 0 ? "No hay documentos registrados en tu biblioteca." : "No hay documentos que coincidan con los filtros."}</Empty></td></tr>}
              {rows.map(({ d, a }) => (
                <tr key={d.code} onClick={() => navigate({ to: "/biblioteca/$code", params: { code: d.code } })} className="cursor-pointer border-t border-border transition-colors hover:bg-accent">
                  <td className="px-4 py-3"><div className="doc-code">{d.code}</div><div className="font-semibold">{d.title}</div><div className="text-[11px] text-muted-foreground">{d.classification}</div></td>
                  <td className="px-4 py-3">{d.type}
                    <div className="mt-1 flex items-center gap-1.5">
                      <button type="button" title="Cambiar entre normativa y caso" onClick={(e) => { e.stopPropagation(); void toggleKind(d.code, d.kind === "caso" ? "normativa" : "caso"); }} className="rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-secondary">{d.kind === "caso" ? "Caso" : "Normativa"} ⇄</button>
                      <span className="text-[10px] text-muted-foreground">{d.extractionStatus === "extraido" ? "Texto legible" : d.extractionStatus === "no_legible" ? "No legible" : "Pendiente"}</span>
                    </div></td>
                  <td className="px-4 py-3">
                    {a.version && !a.uncertain ? <strong>v{a.version.v}</strong> : <span className="text-muted-foreground">{a.version ? `v${a.version.v} · no confirmada` : "No determinada"}</span>}
                    {a.futureVersion && <div className="text-[11px] text-muted-foreground">v{a.futureVersion.v} aprobada · futura</div>}
                  </td>
                  <td className="px-4 py-3">{a.version?.from ? fmtDate(a.version.from) : "Por confirmar"}</td>
                  <td className="px-4 py-3"><Pill tone={a.tone}>{a.label}</Pill></td>
                  <td className="px-4 py-3">{d.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {docs && <div className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">Mostrando {rows.length} de {docs.length} documentos</div>}
      </Panel>

      <UploadTray open={uploadOpen} onOpenChange={setUploadOpen} persist />
    </section>
  );
}
