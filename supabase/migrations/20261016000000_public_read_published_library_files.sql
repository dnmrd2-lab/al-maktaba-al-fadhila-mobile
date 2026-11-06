-- Public readers may open PDFs only when the matching book is published.
-- Draft files remain readable only to staff through the authenticated policy.
CREATE POLICY "public read published library PDFs"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'library'
  AND EXISTS (
    SELECT 1
    FROM public.books AS book
    WHERE book.pdf_url = storage.objects.name
      AND book.published = true
  )
);

CREATE POLICY "staff read library PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'library'
  AND (
    EXISTS (
      SELECT 1
      FROM public.books AS book
      WHERE book.pdf_url = storage.objects.name
        AND book.published = true
    )
    OR public.is_staff(auth.uid())
  )
);
