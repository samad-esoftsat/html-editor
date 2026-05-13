import 'dotenv/config';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'project-assets';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const orgs = await loadOrganizations(args);
  if (orgs.length === 0) {
    console.log('No matching workspaces found.');
    return;
  }

  console.log(`Processing ${orgs.length} workspace(s)${args.dryRun ? ' [dry-run]' : ''}...`);

  for (const org of orgs) {
    await backfillWorkspace(org);
  }
}

async function backfillWorkspace(org) {
  console.log(`\nWorkspace: ${org.slug} (${org.id})`);

  const { data: projects, error: projectError } = await sb
    .from('projects')
    .select('id, org_id, user_id, name, data')
    .eq('org_id', org.id);

  if (projectError) {
    console.error(`  Failed to load projects: ${projectError.message}`);
    return;
  }

  const refs = collectProjectImageRefs(projects || []);
  if (refs.length === 0) {
    console.log('  No project images found.');
    return;
  }

  const { data: existingAssets, error: assetError } = await sb
    .from('assets')
    .select('storage_path')
    .eq('org_id', org.id);

  if (assetError) {
    console.error(`  Failed to load existing assets: ${assetError.message}`);
    return;
  }

  const existingPaths = new Set((existingAssets || []).map((asset) => asset.storage_path));
  let inserted = 0;
  let copiedExternal = 0;
  let reusedBucket = 0;
  let skipped = 0;

  for (const ref of refs) {
    const managedPath = storagePathFromPublicUrl(ref.url);
    if (managedPath) {
      if (existingPaths.has(managedPath)) {
        skipped += 1;
        continue;
      }

      const row = buildAssetRow({
        orgId: org.id,
        createdBy: ref.createdBy,
        storagePath: managedPath,
        mimeType: mimeTypeFromUrl(ref.url),
        altText: ref.altText,
        originalFilename: ref.originalFilename,
        width: null,
        height: null,
      });

      if (args.dryRun) {
        console.log(`  [dry] register bucket asset ${managedPath}`);
      } else {
        const { error } = await sb
          .from('assets')
          .upsert(row, { onConflict: 'storage_path', ignoreDuplicates: true });
        if (error) {
          console.error(`  Failed to register ${managedPath}: ${error.message}`);
          continue;
        }
      }

      existingPaths.add(managedPath);
      inserted += 1;
      reusedBucket += 1;
      continue;
    }

    if (!/^https?:\/\//i.test(ref.url)) {
      skipped += 1;
      continue;
    }

    const mimeType = mimeTypeFromUrl(ref.url);
    const storagePath = legacyExternalAssetPath(org.id, ref.url, mimeType);
    if (existingPaths.has(storagePath)) {
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(`  [dry] copy external ${ref.url} -> ${storagePath}`);
      existingPaths.add(storagePath);
      inserted += 1;
      copiedExternal += 1;
      continue;
    }

    try {
      const response = await fetch(ref.url);
      if (!response.ok) {
        console.error(`  Failed to fetch ${ref.url}: HTTP ${response.status}`);
        continue;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      const resolvedMime = headerMime(response.headers.get('content-type')) || sniffMimeType(bytes) || mimeType;
      const dims = getImageDimensions(bytes, resolvedMime);

      const upload = await sb.storage
        .from(BUCKET)
        .upload(storagePath, bytes, {
          contentType: resolvedMime,
          upsert: false,
        });

      if (upload.error && !String(upload.error.message).toLowerCase().includes('exists')) {
        console.error(`  Failed to upload ${ref.url}: ${upload.error.message}`);
        continue;
      }

      const row = buildAssetRow({
        orgId: org.id,
        createdBy: ref.createdBy,
        storagePath,
        mimeType: resolvedMime,
        altText: ref.altText,
        originalFilename: ref.originalFilename,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });

      const { error } = await sb
        .from('assets')
        .upsert(row, { onConflict: 'storage_path', ignoreDuplicates: true });
      if (error) {
        console.error(`  Failed to register copied asset ${storagePath}: ${error.message}`);
        continue;
      }

      existingPaths.add(storagePath);
      inserted += 1;
      copiedExternal += 1;
    } catch (error) {
      console.error(`  Failed to copy ${ref.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`  Done. inserted=${inserted}, copiedExternal=${copiedExternal}, reusedBucket=${reusedBucket}, skipped=${skipped}`);
}

async function loadOrganizations(options) {
  let query = sb
    .from('organizations')
    .select('id, slug, name')
    .order('slug', { ascending: true });

  if (options.orgId) query = query.eq('id', options.orgId);
  if (options.slug) query = query.eq('slug', options.slug);

  const { data, error } = await query;
  if (error) {
    console.error(`Failed to load organizations: ${error.message}`);
    process.exit(1);
  }

  return data || [];
}

function collectProjectImageRefs(projects) {
  const refs = new Map();

  for (const project of projects) {
    pushRef(refs, project, project.data?.header?.logoSrc, project.data?.header?.logoAlt);
    pushRef(refs, project, project.data?.header?.bannerSrc, project.data?.header?.bannerAlt);
    pushRef(refs, project, project.data?.footer?.bannerSrc, project.data?.footer?.bannerAlt);

    for (const section of project.data?.sections || []) {
      pushRef(refs, project, section.imageSrc, section.imageAlt);
    }
  }

  return [...refs.values()];
}

function pushRef(refs, project, url, altText) {
  if (typeof url !== 'string') return;
  const normalized = url.trim();
  if (!normalized || refs.has(normalized)) return;

  refs.set(normalized, {
    url: normalized,
    altText: typeof altText === 'string' && altText.trim() ? altText.trim() : null,
    createdBy: project.user_id,
    originalFilename: filenameFromUrl(normalized),
  });
}

function buildAssetRow({
  orgId,
  createdBy,
  storagePath,
  mimeType,
  altText,
  originalFilename,
  width,
  height,
}) {
  return {
    org_id: orgId,
    created_by: createdBy,
    request_key: null,
    storage_path: storagePath,
    mime_type: mimeType,
    width,
    height,
    source: 'upload',
    prompt: null,
    provider: null,
    alt_text: altText,
    original_filename: originalFilename,
  };
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    orgId: null,
    slug: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--org-id') {
      options.orgId = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--slug') {
      options.slug = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/backfill-workspace-assets.mjs [--dry-run] [--org-id <uuid> | --slug <slug>]

Examples:
  node scripts/backfill-workspace-assets.mjs --dry-run
  node scripts/backfill-workspace-assets.mjs --slug my-workspace
  node scripts/backfill-workspace-assets.mjs --org-id 00000000-0000-0000-0000-000000000000
`);
}

function storagePathFromPublicUrl(url) {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const encoded = parsed.pathname.slice(index + marker.length);
    if (!encoded) return null;
    return encoded
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/');
  } catch {
    return null;
  }
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const last = parts.at(-1);
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

function mimeTypeFromUrl(url) {
  const filename = filenameFromUrl(url);
  const match = filename?.match(/\.([A-Za-z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/png';
  }
}

function legacyExternalAssetPath(orgId, url, mimeType) {
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 24);
  const ext = extensionFromMimeType(mimeType);
  return `${orgId}/assets/legacy-${digest}.${ext}`;
}

function extensionFromMimeType(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function headerMime(value) {
  if (!value) return null;
  return value.split(';', 1)[0]?.trim() || null;
}

function sniffMimeType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) return 'image/png';

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) return 'image/jpeg';

  if (buffer.length >= 6 && buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString('ascii') === 'GIF87a') return 'image/gif';

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';

  return null;
}

function getImageDimensions(buffer, mimeType) {
  try {
    switch (mimeType) {
      case 'image/png':
        if (buffer.length >= 24) {
          return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20),
          };
        }
        return null;
      case 'image/gif':
        if (buffer.length >= 10) {
          return {
            width: buffer.readUInt16LE(6),
            height: buffer.readUInt16LE(8),
          };
        }
        return null;
      case 'image/jpeg':
        return parseJpegDimensions(buffer);
      case 'image/webp':
        return parseWebpDimensions(buffer);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (!marker || marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + size;
  }
  return null;
}

function parseWebpDimensions(buffer) {
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
