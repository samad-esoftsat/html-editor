import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let user;
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('import_auth_failed', authError);
      return NextResponse.json({ error: 'auth_failed' }, { status: 401 });
    }
    user = data.user;
  } catch (error) {
    console.error('import_auth_setup_failed', error);
    return NextResponse.json({ error: 'auth_setup_failed' }, { status: 500 });
  }
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const form = await req.formData();
    return handleImportForm(form);
  } catch (error) {
    console.error('import_form_read_failed', error);
    return NextResponse.json({ error: 'form_read_failed' }, { status: 400 });
  }
}

async function handleImportForm(form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
    return NextResponse.json({ error: 'bad_type' }, { status: 415 });
  }

  let html: string;
  try {
    html = await file.text();
  } catch (error) {
    console.error('import_file_read_failed', error);
    return NextResponse.json({ error: 'file_read_failed' }, { status: 400 });
  }

  try {
    const { parseHtml } = await import('@/lib/import/parseHtml');
    const result = parseHtml(html);
    return NextResponse.json(result);
  } catch (error) {
    console.error('import_parse_failed', error);
    return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
  }
}
