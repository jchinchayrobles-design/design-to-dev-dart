ALTER TABLE public.documents ADD COLUMN kind text NOT NULL DEFAULT 'normativa' CHECK (kind IN ('normativa','caso'));
ALTER TABLE public.documents ADD COLUMN extracted_text text;
ALTER TABLE public.documents ADD COLUMN extraction_status text NOT NULL DEFAULT 'pendiente' CHECK (extraction_status IN ('pendiente','extraido','no_legible'));
GRANT UPDATE (kind, extracted_text, extraction_status) ON public.documents TO authenticated;
CREATE POLICY documents_update_own ON public.documents FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE public.contrasts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 question text NOT NULL,
 case_document_ids uuid[] NOT NULL DEFAULT '{}',
 norm_document_ids uuid[] NOT NULL DEFAULT '{}',
 title text NOT NULL DEFAULT '',
 level text NOT NULL DEFAULT 'insuficiente' CHECK (level IN ('suficiente','parcial','insuficiente','revision')),
 summary jsonb NOT NULL DEFAULT '[]',
 interpretation text,
 warnings jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.contrasts TO authenticated;
GRANT ALL ON public.contrasts TO service_role;
ALTER TABLE public.contrasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrasts_read_own ON public.contrasts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY contrasts_insert_own ON public.contrasts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY contrasts_delete_own ON public.contrasts FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.contrast_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contrast_id uuid NOT NULL REFERENCES public.contrasts(id) ON DELETE CASCADE,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 position int NOT NULL DEFAULT 0,
 case_fact text NOT NULL,
 status text NOT NULL CHECK (status IN ('cumple','riesgo','excepcion','sin_evidencia')),
 rule text NOT NULL DEFAULT '',
 note text NOT NULL DEFAULT '',
 document_id uuid,
 document_name text,
 quote text,
 location text,
 verified boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contrast_findings_contrast_idx ON public.contrast_findings(contrast_id);
GRANT SELECT, INSERT, DELETE ON public.contrast_findings TO authenticated;
GRANT ALL ON public.contrast_findings TO service_role;
ALTER TABLE public.contrast_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_read_own ON public.contrast_findings FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY findings_insert_own ON public.contrast_findings FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.contrasts c WHERE c.id = contrast_id AND c.user_id = (SELECT auth.uid())));
CREATE POLICY findings_delete_own ON public.contrast_findings FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));