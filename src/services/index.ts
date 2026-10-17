/** UI accesses document and consultation operations only through this contract. */
import type { CaseContrast, ConsultAnswer, ContrastItem, EvidenceLevel, NormativeDocument, ValidationFinding } from "@/lib/domain/types";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { storageFileName, validateUpload } from "@/lib/domain/uploads";
import type { Database } from "@/integrations/supabase/types";
import { runContrast } from "@/lib/contrast.functions";
import { extractText } from "@/lib/extract";

export type DocumentKind = "normativa" | "caso";
export interface ProcessingStatus {
  documentCode: string;
  stage: "no_disponible" | "en_cola" | "procesando" | "indexado" | "error";
  detail: string;
}
export type ConsultStage = "consulta" | "recuperacion" | "vigencia" | "respuesta";
export interface ContrastSummary { id: string; question: string; title: string; level: EvidenceLevel; createdAt: string }
export interface HorizonteServices {
  mode: "unconfigured" | "backend";
  referenceDate: () => string;
  listDocuments: () => Promise<NormativeDocument[]>;
  getDocument: (code: string) => Promise<NormativeDocument | null>;
  askQuestion: (question: string, onStage?: (stage: ConsultStage) => void, caseFiles?: File[]) => Promise<ConsultAnswer>;
  runValidations: () => Promise<ValidationFinding[]>;
  getProcessingStatus: (code: string) => Promise<ProcessingStatus>;
  uploadDocument: (file: File, kind?: DocumentKind) => Promise<NormativeDocument>;
  setDocumentKind: (code: string, kind: DocumentKind) => Promise<void>;
  listContrasts: () => Promise<ContrastSummary[]>;
  getContrast: (id: string) => Promise<ConsultAnswer | null>;
  downloadDocument: (code: string) => Promise<void>;
  isSignedIn: () => Promise<boolean>;
  signIn: (provider: "google" | "lovable") => Promise<void>;
  onIdentityChange: (callback: () => void) => () => void;
}
export class NotImplementedError extends Error {}

const BUCKET = "horizonte-documents";
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
const extractionLabel = { pendiente: "Lectura pendiente", extraido: "Texto legible", no_legible: "Texto no legible" } as const;
function mapDocument(row: DocumentRow): NormativeDocument {
  const status = (row.extraction_status ?? "pendiente") as keyof typeof extractionLabel;
  return {
    id: row.id, code: row.id, title: row.file_name,
    type: row.file_name.split(".").slice(1).pop()?.toUpperCase() || "Archivo",
    area: row.kind === "caso" ? "Caso" : "Normativa", owner: "No registrado",
    description: status === "extraido" ? "Texto disponible para contraste. Vigencia pendiente de revisión." : status === "no_legible" ? "No se pudo leer el texto (puede ser una imagen escaneada o un formato no soportado)." : "Archivo guardado. Lectura del contenido pendiente.",
    versions: [], relations: [], classification: "Privado", uploaded: row.created_at.slice(0, 10),
    review: "Por confirmar", pendingValidation: true,
    kind: (row.kind as DocumentKind) ?? "normativa", extractionStatus: status,
  };
}
async function currentUser() {
  if (typeof window === "undefined") return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

type ContrastRow = Database["public"]["Tables"]["contrasts"]["Row"];
type FindingRow = Database["public"]["Tables"]["contrast_findings"]["Row"];
async function toAnswer(c: ContrastRow, findings: FindingRow[]): Promise<ConsultAnswer> {
  const ids = [...c.case_document_ids, ...(c.norm_document_ids ?? [])];
  const { data: allDocs } = ids.length ? await supabase.from("documents").select("id, file_name").in("id", ids) : { data: [] };
  const caseDocs = (allDocs ?? []).filter((d) => c.case_document_ids.includes(d.id));
  const normNames = (allDocs ?? []).filter((d) => (c.norm_document_ids ?? []).includes(d.id)).map((d) => ({ id: d.id, name: d.file_name }));
  const items: ContrastItem[] = findings.sort((a, b) => a.position - b.position).map((f) => ({
    caseFact: f.case_fact, status: f.status as ContrastItem["status"], rule: f.rule, note: f.note,
    code: f.document_id ?? "", documentName: f.document_name, quote: f.quote, location: f.location, verified: f.verified,
    observed: f.observed, expected: f.expected, gap: f.gap, action: f.action, missing: f.missing,
  }));
  const contrast: CaseContrast = { fileNames: (caseDocs ?? []).map((d) => d.file_name), summary: (c.summary as string[]) ?? [], items,
    conclusion: c.conclusion, missingInfo: (c.missing_info as string[] | null) ?? [], normNames,
    actions: ((c.actions as { text: string; priority: "alta" | "media" | "baja"; finding_index: number | null }[] | null) ?? []).map((a) => ({ text: a.text, priority: a.priority, findingIndex: a.finding_index })),
  };
  return {
    id: c.id, question: c.question, title: c.title, level: c.level as EvidenceLevel,
    facts: [], interpretation: c.interpretation, evidence: [], warnings: (c.warnings as string[]) ?? [],
    answeredAt: c.created_at, contrast, source: "backend",
  };
}

export const services: HorizonteServices = {
  mode: "backend",
  referenceDate: () => new Date().toISOString().slice(0, 10),
  async isSignedIn() { return Boolean(await currentUser()); },
  async signIn(provider) {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) throw new Error("No se pudo iniciar sesión. Inténtalo nuevamente.");
  },
  onIdentityChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) callback();
    });
    return () => data.subscription.unsubscribe();
  },
  async listDocuments() {
    if (!(await currentUser())) return [];
    const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("No se pudo leer la biblioteca. Inténtalo nuevamente.");
    return (data ?? []).map(mapDocument);
  },
  async getDocument(code) {
    if (!(await currentUser())) return null;
    const { data, error } = await supabase.from("documents").select("*").eq("id", code).maybeSingle();
    if (error) throw new Error("No se pudo leer el documento.");
    return data ? mapDocument(data) : null;
  },
  async askQuestion(question, onStage, caseFiles = []) {
    if (!(await currentUser())) throw new Error("Inicia sesión para consultar tus documentos.");
    onStage?.("consulta");
    const caseIds: string[] = [];
    for (const f of caseFiles) {
      const doc = await services.uploadDocument(f, "caso");
      if (doc.extractionStatus !== "extraido") throw new Error(`No se pudo leer el texto de "${f.name}". Verifica que no sea una imagen escaneada o un formato no soportado.`);
      caseIds.push(doc.id);
    }
    onStage?.("recuperacion");
    const t = setTimeout(() => onStage?.("vigencia"), 2500);
    try {
      const { id } = await runContrast({ data: { question, caseIds } });
      onStage?.("respuesta");
      const answer = await services.getContrast(id);
      if (!answer) throw new Error("No se pudo leer el resultado guardado.");
      return answer;
    } finally { clearTimeout(t); }
  },
  async listContrasts() {
    if (!(await currentUser())) return [];
    const { data, error } = await supabase.from("contrasts").select("id, question, title, level, created_at").order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error("No se pudo leer el historial.");
    return (data ?? []).map((c) => ({ id: c.id, question: c.question, title: c.title, level: c.level as EvidenceLevel, createdAt: c.created_at }));
  },
  async getContrast(id) {
    if (!(await currentUser())) return null;
    const { data: c } = await supabase.from("contrasts").select("*").eq("id", id).maybeSingle();
    if (!c) return null;
    const { data: f } = await supabase.from("contrast_findings").select("*").eq("contrast_id", id);
    return toAnswer(c, f ?? []);
  },
  async runValidations() {
    if (!(await currentUser())) return [];
    const { data, error } = await supabase
      .from("contrast_findings").select("id, case_fact, status, rule, note, document_id, contrast_id, contrasts(title)")
      .in("status", ["riesgo", "excepcion", "sin_evidencia"]).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("No se pudieron leer los hallazgos.");
    return (data ?? []).map((f) => ({
      id: f.id,
      kind: f.status === "sin_evidencia" ? "revision" : "contradiccion",
      title: f.case_fact,
      description: f.rule,
      reason: `${f.status === "riesgo" ? "Riesgo / brecha" : f.status === "excepcion" ? "Requiere excepción" : "Sin evidencia suficiente"} · ${f.note}`,
      documents: f.document_id ? [f.document_id] : [],
      severity: f.status === "riesgo" ? "alta" : f.status === "excepcion" ? "media" : "baja",
      reviewStatus: "pendiente",
      origin: "contraste IA",
    }));
  },
  async getProcessingStatus(code) {
    const doc = await services.getDocument(code);
    if (!doc) return { documentCode: code, stage: "no_disponible", detail: "Documento no disponible." };
    if (doc.extractionStatus === "extraido") return { documentCode: code, stage: "indexado", detail: "Texto disponible para contraste." };
    if (doc.extractionStatus === "no_legible") return { documentCode: code, stage: "error", detail: "No se pudo leer el texto del archivo." };
    return { documentCode: code, stage: "en_cola", detail: "Lectura pendiente." };
  },
  async uploadDocument(file, kind = "normativa") {
    validateUpload(file);
    const user = await currentUser();
    if (!user) throw new Error("Inicia sesión para guardar tus documentos de forma privada.");
    const path = `${user.id}/${crypto.randomUUID()}/${storageFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/octet-stream", upsert: false });
    if (uploadError) {
      if (/size|large|exceed|413/i.test(uploadError.message)) throw new Error("El archivo supera el límite de almacenamiento permitido. Prueba con un archivo más pequeño.");
      throw new Error("No se pudo guardar el archivo. Revisa tu conexión y reintenta.");
    }
    const text = await extractText(file).catch(() => null);
    const { data, error } = await supabase.from("documents").insert({
      user_id: user.id, file_name: file.name, storage_path: path, file_size: file.size, mime_type: file.type || "application/octet-stream",
      kind, extracted_text: text, extraction_status: text ? "extraido" : "no_legible",
    }).select("*").single();
    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error("No se pudo registrar el documento en la biblioteca. Vuelve a intentarlo.");
    }
    return mapDocument(data);
  },
  async setDocumentKind(code, kind) {
    const { error } = await supabase.from("documents").update({ kind }).eq("id", code);
    if (error) throw new Error("No se pudo actualizar el tipo de documento.");
  },
  async downloadDocument(code) {
    if (!(await currentUser())) throw new Error("Inicia sesión para descargar el documento.");
    const { data, error } = await supabase.from("documents").select("*").eq("id", code).single();
    if (error || !data) throw new Error("No se encontró el documento.");
    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(data.storage_path);
    if (downloadError || !blob) throw new Error("No se pudo descargar el archivo.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = data.file_name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
