/** Pure helpers to verify that AI-proposed citations literally exist in the source text. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”«»"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/[\u00ad]/g, "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A quote is verified only if every segment (split by ellipsis) of at least 12 chars appears in the source. */
export function verifyQuote(quote: string | null | undefined, source: string | null | undefined): boolean {
  if (!quote || !source) return false;
  const hay = normalizeForMatch(source);
  const segments = normalizeForMatch(quote)
    .replace(/^"|"$/g, "")
    .split(/\s*(?:\.\.\.|…|\[\.\.\.\])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return false;
  if (segments.some((s) => s.length < 12)) return false;
  return segments.every((s) => hay.includes(s));
}

export type FindingStatus = "cumple" | "riesgo" | "excepcion" | "sin_evidencia";

/** A finding without a verified citation from an allowed normative document can never keep a conclusive status. */
export function resolveFindingStatus(status: FindingStatus, verified: boolean): FindingStatus {
  return verified ? status : "sin_evidencia";
}
