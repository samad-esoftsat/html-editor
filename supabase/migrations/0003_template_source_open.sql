-- Allow arbitrary template ids in projects.template_source.
-- The original check constraint only permitted ('default', 'imported'), but the
-- template registry now ships 'blank' and 'globaltt', and will grow as users
-- save their own templates. The application validates ids via getTemplate(),
-- so a DB-level enum is no longer the right place for this check.

alter table public.projects
  drop constraint if exists projects_template_source_check;
