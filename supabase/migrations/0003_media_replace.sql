-- ════════════════════════════════════════════════════════════════════
-- 0003 · let accounts overwrite / delete files in their own media folder
-- ════════════════════════════════════════════════════════════════════
-- 0001 only allowed INSERT, so re-uploading a file with the same path failed.
-- Needed by `node scripts/upload-seed-photos.mjs --replace` (swapping the seed photos for your own).

drop policy if exists "media update own folder" on storage.objects;
create policy "media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'issue-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'issue-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media delete own folder" on storage.objects;
create policy "media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'issue-media' and (storage.foldername(name))[1] = auth.uid()::text);
