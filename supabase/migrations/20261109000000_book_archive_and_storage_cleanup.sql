-- Migration: Add is_archived column, grant archive updates, and allow staff deletion of books and storage assets

begin;

-- 1. Add is_archived column to public.books if it does not exist
alter table public.books
add column if not exists is_archived boolean not null default false;

-- 2. Grant update on is_archived to authenticated users
grant update (is_archived) on public.books to authenticated;

-- 3. Update book selection policy for public/anon users so archived books are hidden
drop policy if exists "public read published books" on public.books;
create policy "public read published books"
on public.books for select
to anon
using (
  published = true
  and is_archived = false
);

-- 4. Allow staff/admins to delete books
drop policy if exists "staff can delete books" on public.books;
create policy "staff can delete books"
on public.books for delete
to authenticated
using (
  public.has_library_role((select auth.uid()), 'admin')
  or (
    public.has_library_role((select auth.uid()), 'content_manager')
    and published = false
  )
);

-- 5. Allow staff/admins to delete storage assets from the library bucket
drop policy if exists "staff delete library assets" on storage.objects;
create policy "staff delete library assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'library'
  and (
    public.has_library_role((select auth.uid()), 'admin')
    or public.has_library_role((select auth.uid()), 'content_manager')
  )
);

commit;
