export type Tone = "green" | "amber" | "red" | "gray" | "blue";

export type VersionStatus = "approved" | "replaced" | "pending";

export interface DocumentVersion {
  v: string;
  status: VersionStatus;
  from: string | null;
  until: string | null;
  approved: string | null;
  by: string | null;
  note: string;
}

export interface DocumentRelation {
  kind: "replaces" | "potential_conflict" | "related";
  target: string;
  status: "confirmada" | "no resuelta" | "por verificar" | "programada";
  note: string;
}

export interface NormativeDocument {
  id: string;
  code: string;
  title: string;
  type: string;
  area: string;
  owner: string;
  description: string;
  versions: DocumentVersion[];
  relations: DocumentRelation[];
  classification: string;
  uploaded: string | null;
  review: string;
  /** Explicit flag set by a responsible reviewer. */
  pendingValidation?: boolean;
  kind?: "normativa" | "caso";
  extractionStatus?: "pendiente" | "extraido" | "no_legible";
}

export type ValidityState = "Vigente" | "Pendiente" | "Revisión" | "Sin versión";

export interface ValidityAssessment {
  state: ValidityState;
  label: string;
  tone: Tone;
  version: DocumentVersion | null;
  futureVersion: DocumentVersion | null;
  reason: string;
  uncertain: boolean;
}

export type EvidenceLevel = "suficiente" | "parcial" | "insuficiente" | "revision";

export interface EvidenceFragment {
  code: string;
  title: string;
  version: string;
  section: string | null;
  page: string | null;
  /** HTML-free text; segments wrapped in [[ ]] are highlighted. */
  quote: string;
  why: string;
}

export interface ConsultAnswer {
  id: string;
  question: string;
  title: string;
  level: EvidenceLevel;
  facts: string[];
  interpretation: string | null;
  evidence: EvidenceFragment[];
  warnings: string[];
  answeredAt: string;
  /** Present when the user attached a case to contrast against the regulations. */
  contrast?: CaseContrast;
  source: "backend";
}

export type FindingKind =
  | "vencido"
  | "contradiccion"
  | "version"
  | "revision"
  | "metadatos";

export interface ValidationFinding {
  id: string;
  kind: FindingKind;
  title: string;
  description: string;
  reason: string;
  documents: string[];
  severity: "alta" | "media" | "baja";
  reviewStatus: "pendiente" | "en revisión" | "resuelto";
  origin: "regla local" | "contraste IA";
}

export type ContrastStatus = "cumple" | "riesgo" | "excepcion" | "sin_evidencia";

export interface ContrastItem {
  /** Fact extracted from the user's case. */
  caseFact: string;
  status: ContrastStatus;
  /** Normative reference the fact is contrasted against. */
  rule: string;
  code: string;
  note: string;
  documentName?: string | null;
  quote?: string | null;
  location?: string | null;
  verified?: boolean;
  observed?: string | null;
  expected?: string | null;
  gap?: string | null;
  action?: string | null;
  missing?: string | null;
}

export interface ContrastAction { text: string; priority: "alta" | "media" | "baja"; findingIndex: number | null }

export interface CaseContrast {
  fileNames: string[];
  summary: string[];
  items: ContrastItem[];
  conclusion?: string | null;
  actions?: ContrastAction[];
  missingInfo?: string[];
  normNames?: { id: string; name: string }[];
}
