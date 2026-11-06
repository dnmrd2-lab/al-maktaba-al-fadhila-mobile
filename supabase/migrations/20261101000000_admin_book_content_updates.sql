-- Allow authorized content staff to edit book metadata without granting them
-- permission to publish or unpublish books. RLS remains the enforcement layer.
begin;

grant update (
  folder_id,
  title,
  author,
  description,
  category,
  cover_key,
  cover_url,
  pdf_url,
  pages,
  sort,
  download_policy,
  updated_at
) on public.books to authenticated;

drop policy if exists "content staff can edit library book content" on public.books;
create policy "content staff can edit library book content"
on public.books for update
to authenticated
using (
  public.has_library_role((select auth.uid()), 'admin')
  or (
    public.has_library_role((select auth.uid()), 'content_manager')
    and published = false
  )
)
with check (
  public.has_library_role((select auth.uid()), 'admin')
  or (
    public.has_library_role((select auth.uid()), 'content_manager')
    and published = false
  )
);

commit;
