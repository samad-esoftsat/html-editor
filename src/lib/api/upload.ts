const MAX_DIM = 1400;

async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  if (ratio === 1 && file.size < 1.5 * 1024 * 1024) return file;

  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.convertToBlob({ type: mime, quality: 0.85 });
}

export async function uploadImage(file: File, projectId: string): Promise<string> {
  const blob = await resize(file);
  const fd = new FormData();
  fd.append('file', new File([blob], file.name, { type: blob.type }));
  fd.append('projectId', projectId);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'upload_failed');
  }
  const { publicUrl } = await res.json();
  return publicUrl as string;
}
