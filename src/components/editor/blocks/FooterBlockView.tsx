'use client';
import type { FooterBlock, GlobalStyles, SocialPlatform } from '@/lib/editor/types';
import { useEditorStore } from '@/lib/editor/StoreProvider';
import { useEditorMode } from '../EditorModeProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import { EditableText } from '../editable/EditableText';
import { EditableImage } from '../editable/EditableImage';
import { EditableLink } from '../editable/EditableLink';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

interface Props {
  block: FooterBlock;
  global: GlobalStyles;
}

export function FooterBlockView({ block, global: g }: Props) {
  const store = useEditorStore();
  const setFooter = store.getState().setFooter;
  const { mode } = useEditorMode();
  const blockNav = mode === 'edit' ? (e: React.MouseEvent) => e.preventDefault() : undefined;

  return (
    <>
      {/* Footer */}
      <div style={{
        background: block.backgroundColor ?? g.footerBackgroundColor,
        color: block.textColor ?? g.footerTextColor,
        textAlign: 'center', padding: '20px',
      }}>
        <EditableImage
          value={block.bannerSrc}
          onChange={(v) => setFooter({ bannerSrc: v })}
          alt={block.bannerAlt}
          placeholderLabel="Footer banner - click to add"
          placeholderWidth={710}
          width={block.bannerWidth ?? 710}
          onWidthChange={(w) => setFooter({ bannerWidth: w })}
          aspectRatio={710 / 120}
          imgStyle={{ maxWidth: 710, width: '100%' }}
          altLabel="Footer banner alt text"
          onAltChange={(v) => setFooter({ bannerAlt: v })}
        />
        <p style={{ fontWeight: 700, margin: '12px 0 0' }}>
          <EditableText
            value={block.companyName}
            onChange={(v) => setFooter({ companyName: v })}
            singleLine
            placeholder="Click to add company name"
            ariaLabel="Footer company name"
          />
        </p>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>
          <EditableText
            value={block.address}
            onChange={(v) => setFooter({ address: v })}
            placeholder="Click to add address (multiple lines allowed)"
            ariaLabel="Footer address"
          />
        </p>
        <p style={{ marginTop: 12 }}>
          Tel:{' '}
          <a href={`tel:${block.phoneTel}`} onClick={blockNav} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <span className="inline-link-wrap inline-flex items-center gap-1">
              <EditableText
                value={block.phone}
                onChange={(v) => setFooter({ phone: v })}
                singleLine
                placeholder="Click to add phone"
                ariaLabel="Footer phone"
                style={{ color: g.accentColor }}
              />
              <EditableLink
                value={block.phoneTel}
                onChange={(v) => setFooter({ phoneTel: v })}
                ariaLabel="Edit phone dial URL"
              />
            </span>
          </a>
          <br />
          Email:{' '}
          <a href={`mailto:${block.email}`} onClick={blockNav} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <EditableText
              value={block.email}
              onChange={(v) => setFooter({ email: v })}
              singleLine
              placeholder="Click to add email"
              ariaLabel="Footer email"
              style={{ color: g.accentColor }}
            />
          </a>
          <br />
          {block.websites.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={w.url} onClick={blockNav} style={{ color: g.accentColor, textDecoration: 'none' }}>
                <span className="inline-link-wrap inline-flex items-center gap-1">
                  <EditableText
                    value={w.label}
                    onChange={(v) => {
                      const next = block.websites.slice();
                      next[i] = { ...next[i], label: v };
                      setFooter({ websites: next });
                    }}
                    singleLine
                    placeholder="Website label"
                    ariaLabel={`Website ${i + 1} label`}
                    style={{ color: g.accentColor }}
                  />
                  <EditableLink
                    value={w.url}
                    onChange={(v) => {
                      const next = block.websites.slice();
                      next[i] = { ...next[i], url: v };
                      setFooter({ websites: next });
                    }}
                    ariaLabel={`Edit website ${i + 1} URL`}
                  />
                </span>
              </a>
            </span>
          ))}
        </p>
        <div style={{ marginTop: 16 }}>
          {block.socials.map((s, i) => {
            const Icon = ICONS[s.platform];
            return (
              <span key={i} className="relative inline-block" style={{ margin: '0 10px' }}>
                <a href={s.url} onClick={blockNav} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                  <Icon size={32} color={g.footerTextColor} />
                </a>
                <EditableLink
                  value={s.url}
                  onChange={(v) => {
                    const next = block.socials.slice();
                    next[i] = { ...next[i], url: v };
                    setFooter({ socials: next });
                  }}
                  ariaLabel={`Edit ${s.platform} URL`}
                  alwaysVisible
                  className="absolute -top-2 -right-2 bg-ed-panel-2 rounded-full border border-ed-rule-strong"
                />
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}
