'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

export interface MaskCanvasHandle {
  exportMask(): Blob | null;
  clear(): void;
}

interface Props {
  imageUrl: string;
}

export const MaskCanvas = forwardRef<MaskCanvasHandle, Props>(function MaskCanvas(
  { imageUrl },
  ref,
) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    setReady(false);
  }, [imageUrl]);

  useImperativeHandle(ref, () => ({
    exportMask() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const dataUrl = canvas.toDataURL('image/png');
      const [prefix, data] = dataUrl.split(',');
      if (!prefix || !data) return null;
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      return new Blob([bytes], { type: 'image/png' });
    },
    clear() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  }), []);

  useEffect(() => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !ready) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(12, Math.round(canvas.width / 30));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  }, [ready]);

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    );
  };

  const end = () => {
    drawing.current = false;
  };

  return (
    <div className="relative rounded-md overflow-hidden border border-ed-rule-strong bg-black/40">
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        className="block max-h-[340px] w-full object-contain"
        onLoad={() => setReady(true)}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={begin}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerLeave={end}
      />
    </div>
  );
});
