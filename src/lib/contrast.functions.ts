import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveFindingStatus, verifyQuote, type FindingStatus } from "@/lib/domain/evidence";

const MODEL = "openai/gpt-6-astra";
const PER_DOC = 60_000;
const TOTAL = 360_000;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "level", "summary", "interpretation", "warnings", "findings"],
  properties: {
    title: { type: "string" },
    level: { type: "string", enum: ["suficiente", "parcial", "insuficiente", "revision"] },
    summary: { type: "array", items: { type: "string" } },
    interpretation: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["case_fact", "status", "rule", "note", "document_id", "quote", "location"],
        properties: {
          case_fact: { type: "string" },
          status: { type: "string", enum: ["cumple", "riesgo", "excepcion", "sin_evidencia"] },
          rule: { type: "string" },
          note: { type: "string" },
          document_id: { type: ["string", "null"] },
          quote: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `Eres un analista de cumplimiento normativo. Trabajas SOLO con los documentos proporcionados.
- Si hay documentos de CASO: extrae los hechos relevantes del caso y contrasta cada uno con las NORMATIVAS.
- Si no hay caso: responde la pregunta con hallazgos sustentados en las NORMATIVAS (case_fact = punto consultado).
- Cada hallazgo con estado cumple/riesgo/excepcion DEBE incluir document_id de una NORMATIVA y una cita textual literal copiada exactamente del texto (sin parafrasear, 1-3 oraciones). location = página/sección/artículo si aparece en el texto, si no null.
- Si no hay sustento normativo, usa estado sin_evidencia, document_id y quote null.
- No infieras vigencia de documentos ni inventes datos. Advierte en warnings sobre vacíos, contradicciones o textos truncados.
- level: suficiente sólo si todos los puntos están sustentados; revision si hay riesgos o excepciones que requieren criterio humano.
- Escribe en español.`;

type Input = { question: string; caseIds: string[]; normIds?: string[] };

export const runContrast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (typeof d?.question !== "string" || !d.question.trim() || d.question.length > 4000) throw new Error("Consulta inválida.");
    if (!Array.isArray(d.caseIds) || d.caseIds.length > 20) throw new Error("Casos inválidos.");
    return { question: d.question.trim(), caseIds: d.caseIds.map(String), normIds: d.normIds?.map(String) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: docs, error } = await supabase
      .from("documents")
      .select("id, file_name, kind, extracted_text, extraction_status")
      .eq("extraction_status", "extraido");
    if (error) throw new Error("No se pudieron leer tus documentos.");
    const cases = (docs ?? []).filter((d) => data.caseIds.includes(d.id));
    const norms = (docs ?? []).filter((d) => d.kind === "normativa" && (!data.normIds?.length || data.normIds.includes(d.id)));
    if (!norms.length) throw new Error("No hay normativas legibles en tu biblioteca. Sube al menos una normativa (PDF, Word, Excel o texto) antes de contrastar.");
    if (data.caseIds.length && !cases.length) throw new Error("No se pudo leer el texto de los documentos del caso. Verifica que no sean imágenes escaneadas.");

    const warnings: string[] = [];
    let budget = TOTAL;
    const block = (d: { id: string; file_name: string; extracted_text: string | null }, label: string) => {
      const full = d.extracted_text ?? "";
      const take = Math.max(0, Math.min(PER_DOC, budget, full.length));
      budget -= take;
      if (take < full.length) warnings.push(`El documento "${d.file_name}" es extenso; solo se analizó parcialmente.`);
      return `<${label} document_id="${d.id}" nombre="${d.file_name}">\n${full.slice(0, take)}\n</${label}>`;
    };
    const input = [
      ...cases.map((c) => block(c, "CASO")),
      ...norms.map((n) => block(n, "NORMATIVA")),
      `PREGUNTA DEL CONSULTOR: ${data.question}`,
    ].join("\n\n");

    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("El servicio de análisis no está configurado.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: input }] }],
        stream: true,
        store: false,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "contraste", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error("gateway", res.status, body.slice(0, 500));
      if (res.status === 402) throw new Error("No hay créditos de IA suficientes. Agrega créditos en Settings → Plans & credits.");
      if (res.status === 429) throw new Error("El servicio de análisis está ocupado. Espera un momento y vuelve a intentarlo.");
      if (res.status === 403) throw new Error("El acceso al modelo de análisis fue denegado para este espacio de trabajo.");
      throw new Error("El servicio de análisis no respondió correctamente. Inténtalo nuevamente más tarde.");
    }

    let text = "";
    let refusal = "";
    let failed = false;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta;
          else if (ev.type === "response.refusal.delta") refusal += ev.delta;
          else if (ev.type === "response.failed" || ev.type === "error") failed = true;
        } catch { /* partial */ }
      }
    }
    if (refusal) throw new Error("El modelo se negó a analizar estos documentos.");
    if (failed || !text) throw new Error("El análisis no se completó. Inténtalo nuevamente.");

    let out: {
      title: string; level: "suficiente" | "parcial" | "insuficiente" | "revision"; summary: string[]; interpretation: string | null; warnings: string[];
      findings: { case_fact: string; status: FindingStatus; rule: string; note: string; document_id: string | null; quote: string | null; location: string | null }[];
    };
    try { out = JSON.parse(text); } catch { throw new Error("La respuesta del análisis no tuvo un formato válido."); }

    const normById = new Map(norms.map((n) => [n.id, n]));
    let unverified = 0;
    const findings = out.findings.map((f, position) => {
      const doc = f.document_id ? normById.get(f.document_id) : undefined;
      const verified = Boolean(doc && verifyQuote(f.quote, doc.extracted_text));
      if (!verified && f.status !== "sin_evidencia") unverified++;
      return {
        position,
        case_fact: f.case_fact,
        status: resolveFindingStatus(f.status, verified),
        rule: f.rule,
        note: verified ? f.note : f.status !== "sin_evidencia" ? `Cita no verificada: la cita propuesta no se encontró literalmente en la normativa. ${f.note}` : f.note,
        document_id: doc?.id ?? null,
        document_name: doc?.file_name ?? null,
        quote: verified ? f.quote : null,
        location: verified ? f.location : null,
        verified,
      };
    });
    if (unverified) warnings.push(`${unverified} hallazgo(s) se marcaron "sin evidencia" porque su cita no se encontró en el texto de la normativa.`);
    const level = unverified && out.level === "suficiente" ? "parcial" : out.level;

    const { data: saved, error: insErr } = await supabase
      .from("contrasts")
      .insert({
        user_id: userId, question: data.question, case_document_ids: cases.map((c) => c.id), norm_document_ids: norms.map((n) => n.id),
        title: out.title, level, summary: out.summary, interpretation: out.interpretation, warnings: [...warnings, ...out.warnings],
      })
      .select("id")
      .single();
    if (insErr || !saved) throw new Error("No se pudo guardar el contraste.");
    if (findings.length) {
      const { error: fErr } = await supabase.from("contrast_findings").insert(findings.map((f) => ({ ...f, contrast_id: saved.id, user_id: userId })));
      if (fErr) {
        await supabase.from("contrasts").delete().eq("id", saved.id);
        throw new Error("No se pudieron guardar los hallazgos.");
      }
    }
    return { id: saved.id };
  });
