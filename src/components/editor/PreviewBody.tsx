'use client';
import { useEditor, useEditorStore } from '@/lib/editor/StoreProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import type { SocialPlatform } from '@/lib/editor/types';
import { EditableText } from './editable/EditableText';
import { EditableBulletList } from './editable/EditableBulletList';
import { EditableImage } from './editable/EditableImage';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const store = useEditorStore();
  const g = data.global;
  const setHeader = store.getState().setHeader;
  const setFooter = store.getState().setFooter;
  const setSection = store.getState().setSection;

  return (
    <div className="preview-canvas" style={{ background: g.backgroundColor, padding: 0, minHeight: '100%', fontFamily: g.fontFamily }}>
      {/* Header */}
      <div style={{ maxWidth: 710, margin: '0 auto', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={data.header.logoSrc}
            onChange={(v) => setHeader({ logoSrc: v })}
            alt={data.header.logoAlt}
            placeholderLabel="Logo image - click to add"
            placeholderWidth={data.header.logoWidth}
            imgStyle={{ maxWidth: data.header.logoWidth, width: '100%' }}
          />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: data.header.titleFontSize, color: g.textColor, fontWeight: 400, margin: '20px 0' }}>
          <EditableText
            value={data.header.title}
            onChange={(v) => setHeader({ title: v })}
            singleLine
            placeholder="Click to add a title"
            ariaLabel="Header title"
          />
        </h1>
        <div style={{ textAlign: 'center' }}>
          <EditableImage
            value={data.header.bannerSrc}
            onChange={(v) => setHeader({ bannerSrc: v })}
            alt={data.header.bannerAlt}
            placeholderLabel="Header banner - click to add"
            imgStyle={{ width: '100%' }}
          />
        </div>
        <h3 style={{ textAlign: 'center', fontSize: data.header.sectionHeadingFontSize, color: g.textColor, fontWeight: 400, margin: '12px 0' }}>
          <EditableText
            value={data.header.sectionHeading}
            onChange={(v) => setHeader({ sectionHeading: v })}
            singleLine
            placeholder="Click to add a section heading"
            ariaLabel="Section heading"
          />
        </h3>
      </div>

      {/* Sections */}
      {data.sections.map((s, idx) => {
        const reverse = idx % 2 === 1;
        const titleSize = s.titleFontSize ?? g.headingFontSize;
        const bulletSize = s.bulletFontSize ?? g.baseFontSize;
        const textColor = s.textColor ?? g.textColor;
        const buttonColor = s.buttonColor ?? g.buttonColor;
        const bg = s.backgroundColor;

        const ImageCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <EditableImage
              value={s.imageSrc}
              onChange={(v) => setSection(s.id, { imageSrc: v })}
              alt={s.imageAlt}
              placeholderLabel="Section image - click to add"
              imgStyle={{ maxWidth: 355, width: '100%' }}
            />
          </div>
        );
        const TextCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <h1 style={{ fontSize: titleSize, color: textColor, fontWeight: 700, margin: 0 }}>
              <EditableText
                value={s.title}
                onChange={(v) => setSection(s.id, { title: v })}
                singleLine
                placeholder="Click to add a section title"
                ariaLabel={`Section ${idx + 1} title`}
              />
            </h1>
            <EditableBulletList
              bullets={s.bullets}
              onChange={(next) => setSection(s.id, { bullets: next })}
              ariaLabel={`Section ${idx + 1} bullets`}
              itemStyle={{ fontSize: bulletSize, color: textColor, lineHeight: '150%' }}
            />
            <a
              href={s.ctaUrl ?? g.contactUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
                padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              }}
            >
              <EditableText
                value={s.ctaText}
                onChange={(v) => setSection(s.id, { ctaText: v })}
                singleLine
                placeholder="Click to add CTA text"
                ariaLabel={`Section ${idx + 1} CTA text`}
                style={{ color: g.buttonTextColor }}
              />
            </a>
          </div>
        );

        return (
          <div key={s.id} style={{ background: bg, maxWidth: 710, margin: '0 auto', whiteSpace: 'nowrap' }}>
            {reverse ? <>{TextCol}{ImageCol}</> : <>{ImageCol}{TextCol}</>}
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        background: data.footer.backgroundColor ?? g.footerBackgroundColor,
        color: data.footer.textColor ?? g.footerTextColor,
        textAlign: 'center', padding: '20px',
      }}>
        <EditableImage
          value={data.footer.bannerSrc}
          onChange={(v) => setFooter({ bannerSrc: v })}
          alt={data.footer.bannerAlt}
          placeholderLabel="Footer banner - click to add"
          placeholderWidth={710}
          imgStyle={{ maxWidth: 710, width: '100%' }}
        />
        <p style={{ fontWeight: 700, margin: '12px 0 0' }}>
          <EditableText
            value={data.footer.companyName}
            onChange={(v) => setFooter({ companyName: v })}
            singleLine
            placeholder="Click to add company name"
            ariaLabel="Footer company name"
          />
        </p>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>
          <EditableText
            value={data.footer.address}
            onChange={(v) => setFooter({ address: v })}
            placeholder="Click to add address (multiple lines allowed)"
            ariaLabel="Footer address"
          />
        </p>
        <p style={{ marginTop: 12 }}>
          Tel:{' '}
          <a href={`tel:${data.footer.phoneTel}`} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <EditableText
              value={data.footer.phone}
              onChange={(v) => setFooter({ phone: v })}
              singleLine
              placeholder="Click to add phone"
              ariaLabel="Footer phone"
              style={{ color: g.accentColor }}
            />
          </a>
          <br />
          Email:{' '}
          <a href={`mailto:${data.footer.email}`} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
            <EditableText
              value={data.footer.email}
              onChange={(v) => setFooter({ email: v })}
              singleLine
              placeholder="Click to add email"
              ariaLabel="Footer email"
              style={{ color: g.accentColor }}
            />
          </a>
          <br />
          {data.footer.websites.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={w.url} onClick={(e) => e.preventDefault()} style={{ color: g.accentColor, textDecoration: 'none' }}>
                <EditableText
                  value={w.label}
                  onChange={(v) => {
                    const next = data.footer.websites.slice();
                    next[i] = { ...next[i], label: v };
                    setFooter({ websites: next });
                  }}
                  singleLine
                  placeholder="Website label"
                  ariaLabel={`Website ${i + 1} label`}
                  style={{ color: g.accentColor }}
                />
              </a>
            </span>
          ))}
        </p>
        <div style={{ marginTop: 16 }}>
          {data.footer.socials.map((s, i) => {
            const Icon = ICONS[s.platform];
            return (
              <a key={i} href={s.url} onClick={(e) => e.preventDefault()} target="_blank" rel="noreferrer" style={{ margin: '0 10px', display: 'inline-block' }}>
                <Icon size={32} color={g.footerTextColor} />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
