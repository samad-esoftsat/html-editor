import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseHtml } from '@/lib/import/parseHtml';

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') {
      return NextResponse.json({ error: 'bad_type' }, { status: 415 });
    }

    const html = await file.text();
    const result = parseHtml(html);
    return NextResponse.json(result);
  } catch (error) {
    console.error('import_failed', error);
    return NextResponse.json({ error: 'import_failed' }, { status: 500 });
  }
}
