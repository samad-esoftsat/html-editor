'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, X, Plus } from 'lucide-react';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { useCanEdit } from '@/lib/editor/RoleProvider';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Field } from '@/components/ui/Field';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { ImageInput } from '../ImageInput';
import { Button } from '@/components/ui/Button';
import type { SocialPlatform } from '@/lib/editor/types';

const PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin', 'twitter', 'youtube', 'instagram'];

export function FooterPanel() {
  const [open, setOpen] = useState(false);
  const f = useEditor((s) => s.data.footer);
  const setFooter = useEditorStore().getState().setFooter;
  const canEdit = useCanEdit();

  return (
    <div className="rounded-md bg-panel-2 border border-border overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-fg">
        <span>Footer</span>
        {open ? <ChevronDown size={14} className="text-muted-2" /> : <ChevronRight size={14} className="text-muted-2" />}
      </button>
      {open && (
        <fieldset disabled={!canEdit} className="space-y-3 p-3 border-t border-border min-w-0 disabled:opacity-70">
          <Field label="Footer banner"><ImageInput value={f.bannerSrc} onChange={(v) => setFooter({ bannerSrc: v })} /></Field>
          <Field label="Banner alt"><Input value={f.bannerAlt} onChange={(e) => setFooter({ bannerAlt: e.target.value })} /></Field>
          <Field label="Company name"><Input value={f.companyName} onChange={(e) => setFooter({ companyName: e.target.value })} /></Field>
          <Field label="Address (multi-line)"><Textarea rows={3} value={f.address} onChange={(e) => setFooter({ address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone (display)"><Input value={f.phone} onChange={(e) => setFooter({ phone: e.target.value })} /></Field>
            <Field label="Phone (tel link)"><Input value={f.phoneTel} onChange={(e) => setFooter({ phoneTel: e.target.value })} /></Field>
          </div>
          <Field label="Email"><Input value={f.email} onChange={(e) => setFooter({ email: e.target.value })} /></Field>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-2 mb-1">Websites</div>
            <div className="space-y-2">
              {f.websites.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Label" value={w.label}
                    onChange={(e) => setFooter({ websites: f.websites.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                  <Input className="flex-1" placeholder="https://..." value={w.url}
                    onChange={(e) => setFooter({ websites: f.websites.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
                  <button onClick={() => setFooter({ websites: f.websites.filter((_, j) => j !== i) })} className="text-muted-2 hover:text-danger px-1"><X size={14} /></button>
                </div>
              ))}
              {canEdit && (
                <Button variant="secondary" className="w-full" onClick={() => setFooter({ websites: [...f.websites, { label: '', url: '' }] })}><Plus size={14} /> Website</Button>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-2 mb-1">Socials</div>
            <div className="space-y-2">
              {f.socials.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Select className="w-32" value={s.platform}
                    onChange={(e) => setFooter({ socials: f.socials.map((x, j) => j === i ? { ...x, platform: e.target.value as SocialPlatform } : x) })}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                  <Input className="flex-1" placeholder="https://..." value={s.url}
                    onChange={(e) => setFooter({ socials: f.socials.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
                  <button onClick={() => setFooter({ socials: f.socials.filter((_, j) => j !== i) })} className="text-muted-2 hover:text-danger px-1"><X size={14} /></button>
                </div>
              ))}
              {canEdit && (
                <Button variant="secondary" className="w-full" onClick={() => setFooter({ socials: [...f.socials, { platform: 'facebook', url: '' }] })}><Plus size={14} /> Social</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Background override"><ColorPicker value={f.backgroundColor ?? ''} onChange={(v) => setFooter({ backgroundColor: v || undefined })} /></Field>
            <Field label="Text override"><ColorPicker value={f.textColor ?? ''} onChange={(v) => setFooter({ textColor: v || undefined })} /></Field>
          </div>
        </fieldset>
      )}
    </div>
  );
}
