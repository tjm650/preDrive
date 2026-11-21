-- preDrive requires pgcrypto for one-way collector handover PIN hashing.
-- Supabase projects commonly install pgcrypto in the extensions schema, but
-- declaring it here makes the dependency explicit and reproducible on replay.
begin;

create extension if not exists pgcrypto with schema extensions;

commit;
