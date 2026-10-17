/** Browser-side text extraction. Returns null when the format cannot be read as text. */
export async function extractText(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (ext === "pdf") {
      const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await pdfText(pdf, { mergePages: false });
      const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `--- Página ${i + 1} ---\n${t}`);
      return clean(pages.join("\n\n"));
    }
    if (ext === "docx") {
      const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
      const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return clean(res.value);
    }
    if (["xlsx", "xls", "ods"].includes(ext)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      return clean(wb.SheetNames.map((n) => `--- Hoja ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!)}`).join("\n\n"));
    }
    if (["txt", "csv", "md", "json", "xml", "html", "htm", "rtf"].includes(ext) || file.type.startsWith("text/")) {
      return clean(await file.text());
    }
  } catch (e) {
    console.error("extract", e);
  }
  return null;
}

function clean(t: string): string | null {
  const v = t.replace(/\u0000/g, "").trim();
  return v.length >= 20 ? v : null;
}
