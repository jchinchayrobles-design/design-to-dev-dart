CREATE TABLE public.documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 1024),
 storage_path text NOT NULL UNIQUE,
 file_size bigint NOT NULL CHECK (file_size >= 0),
 mime_type text NOT NULL DEFAULT 'application/octet-stream',
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (storage_path LIKE user_id::text || '/%')
);
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_read_own ON public.documents FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY documents_insert_own ON public.documents FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY documents_delete_own ON public.documents FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY horizonte_files_read_own ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'horizonte-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY horizonte_files_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'horizonte-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY horizonte_files_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'horizonte-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);