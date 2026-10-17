/** UI accesses document and consultation operations only through this contract. */
import type { ConsultAnswer, NormativeDocument, ValidationFinding } from "@/lib/domain/types";

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
  uploadDocument: (file: File) => Promise<never>;
}
export class NotImplementedError extends Error {}

// Cloud is enabled, but document storage and analysis are not wired yet.
// Fail closed: no sample records, invented findings, or fabricated answers.
export const services: HorizonteServices = {
  mode: "unconfigured",
  referenceDate: () => new Date().toISOString().slice(0, 10),
  async listDocuments() { return []; },
  async getDocument() { return null; },
  async askQuestion() {
    throw new NotImplementedError("El análisis de documentos reales aún no está conectado. No se ha generado ninguna respuesta ni contraste.");
  },
  async runValidations() { return []; },
  async getProcessingStatus(code) {
    return { documentCode: code, stage: "no_disponible", detail: "El procesamiento documental aún no está conectado." };
  },
  async uploadDocument() {
    throw new NotImplementedError("El guardado de documentos aún no está conectado. Los archivos no se han cargado.");
  },
};
