-- ============================================================
--  블로그 사진 보관함 만들기
--  Supabase > SQL Editor 에 전체를 붙여넣고 Run (한 번만 실행)
-- ============================================================

-- 1) 누구나 사진을 볼 수 있는 보관함 'post-images'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- 2) 사진 올리기·지우기는 관리자만
drop policy if exists "post-images admin upload" on storage.objects;
create policy "post-images admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post-images admin update" on storage.objects;
create policy "post-images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and public.is_admin());

drop policy if exists "post-images admin delete" on storage.objects;
create policy "post-images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and public.is_admin());
