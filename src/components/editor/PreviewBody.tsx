'use client';
import { useEditor } from '@/lib/editor/StoreProvider';
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react';
import type { SocialPlatform } from '@/lib/editor/types';

const ICONS: Record<SocialPlatform, React.ComponentType<{ size?: number; color?: string }>> = {
  facebook: Facebook, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, instagram: Instagram,
};

export function PreviewBody() {
  const data = useEditor((s) => s.data);
  const g = data.global;

  return (
    <div style={{ background: g.backgroundColor, padding: 0, minHeight: '100%', fontFamily: g.fontFamily }}>
      {/* Header */}
      <div style={{ maxWidth: 710, margin: '0 auto', padding: '20px' }}>
        {data.header.logoSrc && (
          <div style={{ textAlign: 'center' }}>
            <img src={data.header.logoSrc} alt={data.header.logoAlt} style={{ maxWidth: data.header.logoWidth, width: '100%' }} />
          </div>
        )}
        {data.header.title && (
          <h1 style={{ textAlign: 'center', fontSize: data.header.titleFontSize, color: g.textColor, fontWeight: 400, margin: '20px 0' }}>
            {data.header.title}
          </h1>
        )}
        {data.header.bannerSrc && (
          <div style={{ textAlign: 'center' }}>
            <img src={data.header.bannerSrc} alt={data.header.bannerAlt} style={{ width: '100%' }} />
          </div>
        )}
        {data.header.sectionHeading && (
          <h3 style={{ textAlign: 'center', fontSize: data.header.sectionHeadingFontSize, color: g.textColor, fontWeight: 400, margin: '12px 0' }}>
            {data.header.sectionHeading}
          </h3>
        )}
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
            {s.imageSrc && <img src={s.imageSrc} alt={s.imageAlt} style={{ maxWidth: 355, width: '100%' }} />}
          </div>
        );
        const TextCol = (
          <div style={{ width: '50%', padding: 20, verticalAlign: 'middle', display: 'inline-block' }}>
            <h1 style={{ fontSize: titleSize, color: textColor, fontWeight: 700, margin: 0 }}>{s.title}</h1>
            <ul style={{ fontSize: bulletSize, color: textColor, lineHeight: '150%' }}>
              {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <a
              href={s.ctaUrl ?? g.contactUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-block', background: buttonColor, color: g.buttonTextColor,
                padding: '10px 30px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              }}
            >
              {s.ctaText}
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
        {data.footer.bannerSrc && (
          <img src={data.footer.bannerSrc} alt={data.footer.bannerAlt} style={{ maxWidth: 710, width: '100%' }} />
        )}
        <p style={{ fontWeight: 700, margin: '12px 0 0' }}>{data.footer.companyName}</p>
        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{data.footer.address}</p>
        <p style={{ marginTop: 12 }}>
          Tel: <a href={`tel:${data.footer.phoneTel}`} style={{ color: g.accentColor, textDecoration: 'none' }}>{data.footer.phone}</a><br />
          Email: <a href={`mailto:${data.footer.email}`} style={{ color: g.accentColor, textDecoration: 'none' }}>{data.footer.email}</a><br />
          {data.footer.websites.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <a href={w.url} style={{ color: g.accentColor, textDecoration: 'none' }}>{w.label}</a>
            </span>
          ))}
        </p>
        <div style={{ marginTop: 16 }}>
          {data.footer.socials.map((s, i) => {
            const Icon = ICONS[s.platform];
            return (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{ margin: '0 10px', display: 'inline-block' }}>
                <Icon size={32} color={g.footerTextColor} />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
