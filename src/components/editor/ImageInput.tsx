'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useEditor } from '@/lib/editor/StoreProvider';
import { uploadImage } from '@/lib/api/upload';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function ImageInput({ value, onChange, placeholder = 'Image URL' }: Props) {
  const projectId = useEditor((s) => s.projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const url = await uploadImage(file, projectId);
      onChange(url);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        {value && <img src={value} alt="" className="w-10 h-10 object-cover rounded border border-border-strong" />}
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1" />
        <Button variant="secondary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? '…' : <><Upload size={14} /> Upload</>}
        </Button>
        <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={onPick} />
      </div>
      {err && <div className="text-xs text-danger">{err}</div>}
    </div>
  );
}
