// scripts/rekey-storage.ts
//
// Usage:
//   tsx scripts/rekey-storage.ts --dry-run
//   tsx scripts/rekey-storage.ts --apply
//
// Copies each project's legacy `<user_id>/<project_id>/...` storage objects to
// the new workspace-scoped path `<org_id>/<project_id>/...` and rewrites the
// matching public URLs in `projects.data` (header.logoSrc, header.bannerSrc,
// footer.bannerSrc, sections[].imageSrc).
//
// Copy-only: originals are NOT deleted. Delete manually after the Storage RLS
// migration is applied and the editor has been verified end-to-end.

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local' });
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? 'project-assets';
const APPLY = process.argv.includes('--apply');
const DRY = process.argv.includes('--dry-run') || !APPLY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const SIGNED_PREFIX = `/storage/v1/object/sign/${BUCKET}/`;

interface ProjectRow {
  id: string;
  user_id: string;
  org_id: string | null;
  data: unknown;
}

interface RewriteResult {
  changed: boolean;
  manifest: { from: string; to: string }[];
}

function extractStoragePath(value: string): string | null {
  if (typeof value !== 'string' || !value) return null;
  const idx = value.indexOf(PUBLIC_PREFIX);
  if (idx !== -1) return value.slice(idx + PUBLIC_PREFIX.length).split('?')[0];
  const idx2 = value.indexOf(SIGNED_PREFIX);
  if (idx2 !== -1) return value.slice(idx2 + SIGNED_PREFIX.length).split('?')[0];
  return null;
}

function publicUrlFor(path: string): string {
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function rewriteUrlIfLegacy(
  url: string | undefined,
  userId: string,
  orgId: string,
  projectId: string,
  manifest: { from: string; to: string }[],
): string | undefined {
  if (typeof url !== 'string' || !url) return url;
  const objPath = extractStoragePath(url);
  if (!objPath) return url;
  const legacyPrefix = `${userId}/`;
  const newPrefix = `${orgId}/${projectId}/`;
  if (!objPath.startsWith(legacyPrefix)) return url;
  if (objPath.startsWith(newPrefix)) return url;
  const tail = objPath.slice(legacyPrefix.length);
  const newPath = `${orgId}/${projectId}/${tail.includes('/') ? tail.slice(tail.indexOf('/') + 1) : tail}`;
  manifest.push({ from: objPath, to: newPath });
  return publicUrlFor(newPath);
}

function rewriteData(p: ProjectRow): RewriteResult {
  const manifest: { from: string; to: string }[] = [];
  if (!p.org_id) return { changed: false, manifest };
  const data = structuredClone(p.data ?? {}) as {
    header?: { logoSrc?: string; bannerSrc?: string };
    footer?: { bannerSrc?: string };
    sections?: Array<{ imageSrc?: string }>;
  };

  if (data.header) {
    const nl = rewriteUrlIfLegacy(data.header.logoSrc, p.user_id, p.org_id, p.id, manifest);
    if (nl !== data.header.logoSrc) data.header.logoSrc = nl;
    const nb = rewriteUrlIfLegacy(data.header.bannerSrc, p.user_id, p.org_id, p.id, manifest);
    if (nb !== data.header.bannerSrc) data.header.bannerSrc = nb;
  }
  if (data.footer) {
    const nb = rewriteUrlIfLegacy(data.footer.bannerSrc, p.user_id, p.org_id, p.id, manifest);
    if (nb !== data.footer.bannerSrc) data.footer.bannerSrc = nb;
  }
  if (Array.isArray(data.sections)) {
    for (const sec of data.sections) {
      const ni = rewriteUrlIfLegacy(sec.imageSrc, p.user_id, p.org_id, p.id, manifest);
      if (ni !== sec.imageSrc) sec.imageSrc = ni;
    }
  }

  if (manifest.length === 0) return { changed: false, manifest };
  (p as unknown as { _newData: unknown })._newData = data;
  return { changed: true, manifest };
}

async function copyObject(src: string, dst: string) {
  if (DRY) {
    console.log(`[dry] copy ${src} -> ${dst}`);
    return;
  }
  const { error } = await sb.storage.from(BUCKET).copy(src, dst);
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  console.log(`copied ${src} -> ${dst}`);
}

async function main() {
  console.log(`Mode: ${DRY ? 'DRY RUN' : 'APPLY'} | bucket: ${BUCKET}`);
  const { data: projects, error } = await sb
    .from('projects')
    .select('id, user_id, org_id, data')
    .not('org_id', 'is', null);
  if (error) throw error;
  if (!projects || projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  let touched = 0;
  let totalCopies = 0;

  for (const p of projects as ProjectRow[]) {
    const { changed, manifest } = rewriteData(p);
    if (!changed) continue;
    touched += 1;
    totalCopies += manifest.length;
    console.log(`project ${p.id}: ${manifest.length} object(s) to rekey`);
    for (const { from, to } of manifest) await copyObject(from, to);

    const newData = (p as unknown as { _newData: unknown })._newData;
    if (DRY) {
      console.log(`[dry] would update project ${p.id} data with new URLs`);
      continue;
    }
    const { error: uerr } = await sb.from('projects').update({ data: newData }).eq('id', p.id);
    if (uerr) throw uerr;
    console.log(`updated project ${p.id}`);
  }

  console.log(`\nDone. Projects touched: ${touched}. Objects ${DRY ? 'to copy' : 'copied'}: ${totalCopies}.`);
  if (DRY) console.log('Re-run with --apply to perform the copy + DB update.');
  else console.log('Originals were NOT deleted. Verify the editor, then prune manually.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
