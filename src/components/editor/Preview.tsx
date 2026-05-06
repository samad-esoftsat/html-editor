'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PreviewBody } from './PreviewBody';

export function Preview() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const onLoad = () => setBody(iframe.contentDocument?.body ?? null);
    iframe.addEventListener('load', onLoad);
    if (iframe.contentDocument?.readyState === 'complete') onLoad();
    return () => iframe.removeEventListener('load', onLoad);
  }, []);

  return (
    <iframe
      ref={ref}
      title="Live preview"
      srcDoc="<!doctype html><html><head><meta charset='utf-8'><style>body{margin:0;padding:0}</style></head><body></body></html>"
      className="w-full h-full border-0 bg-white"
    >
      {body && createPortal(<PreviewBody />, body)}
    </iframe>
  );
}
