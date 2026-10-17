/** UI accesses document and consultation operations only through this contract. */
import type { ConsultAnswer, NormativeDocument, ValidationFinding } from "@/lib/domain/types";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { storageFileName, validateUpload } from "@/lib/domain/uploads";
import type { Database } from "@/integrations/supabase/types";

export interface ProcessingStatus {
  documentCode: string;
  stage: "no_disponible" | "en_cola" | "procesando" | "indexado" | "error";
  detail: string;
}
export type ConsultStage = "consulta" | "recuperacion" | "vigencia" | "respuesta";
export interface HorizonteServices {
  mode: "unconfigured" | "backend";
  referenceDate: () => string;
  listDocuments: () => Promise<NormativeDocument[]>;
  getDocument: (code: string) => Promise<NormativeDocument | null>;
  askQuestion: (question: string, onStage?: (stage: ConsultStage) => void, caseFiles?: File[]) => Promise<ConsultAnswer>;
  runValidations: () => Promise<ValidationFinding[]>;
  getProcessingStatus: (code: string) => Promise<ProcessingStatus>;
  uploadDocument: (file: File) => Promise<NormativeDocument>;
  downloadDocument: (code: string) => Promise<void>;
  isSignedIn: () => Promise<boolean>;
  signIn: (provider: "google" | "lovable") => Promise<void>;
  onIdentityChange: (callback: () => void) => () => void;
}
export class NotImplementedError extends Error {}

const BUCKET = "horizonte-documents";
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
function mapDocument(row: DocumentRow): NormativeDocument {
  return {
    id: row.id, code: row.id, title: row.file_name,
    type: row.file_name.split(".").slice(1).pop()?.toUpperCase() || "Archivo",
    area: "No registrada", owner: "No registrado", description: "Archivo guardado. Contenido y vigencia pendientes de revisión.",
    versions: [], relations: [], classification: "Privado", uploaded: row.created_at.slice(0, 10),
    review: "Por confirmar", pendingValidation: true,
  };
}
async function currentUser() {
  if (typeof window === "undefined") return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

// Only stored metadata is returned. Uploading does not imply analysis or validity.
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
  async askQuestion() {
    throw new NotImplementedError("El análisis de documentos reales aún no está conectado. No se ha generado ninguna respuesta ni contraste.");
  },
  async runValidations() { return []; },
  async getProcessingStatus(code) {
    return { documentCode: code, stage: "no_disponible", detail: "El procesamiento documental aún no está conectado." };
  },
  async uploadDocument(file) {
    validateUpload(file);
    const user = await currentUser();
    if (!user) throw new Error("Inicia sesión para guardar tus documentos de forma privada.");
    const path = `${user.id}/${crypto.randomUUID()}/${storageFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/octet-stream", upsert: false });
    if (uploadError) {
      if (/size|large|exceed|413/i.test(uploadError.message)) throw new Error("El archivo supera el límite de almacenamiento permitido. Prueba con un archivo más pequeño.");
      throw new Error("No se pudo guardar el archivo. Revisa tu conexión y reintenta.");
    }
    const { data, error } = await supabase.from("documents").insert({ user_id: user.id, file_name: file.name, storage_path: path, file_size: file.size, mime_type: file.type || "application/octet-stream" }).select("*").single();
    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error("No se pudo registrar el documento en la biblioteca. Vuelve a intentarlo.");
    }
    return mapDocument(data);
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
