'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { archiveWorkspaceAsset, listWorkspaceAssets, uploadWorkspaceAsset, type WorkspaceAsset, type AssetUsage } from '@/lib/api/assets';
import { editImage } from '@/lib/api/images';
import { createRequestKey } from '@/lib/images/request-key';
import { useRole } from '@/lib/editor/RoleProvider';
import { confirmDialog } from '@/lib/utils/confirm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { AssetLibraryGrid } from './AssetLibraryGrid';
import { GenerateImageForm } from './GenerateImageForm';
import { MaskCanvas, type MaskCanvasHandle } from './MaskCanvas';

type Tab = 'library' | 'upload' | 'generate' | 'edit';

interface Props {
  workspaceSlug: string;
  value: string;
  altText?: string;
  onSelect(url: string): void;
  onClose(): void;
}

export function AssetPicker({ workspaceSlug, value, altText, onSelect, onClose }: Props) {
  const role = useRole();
  const canEdit = role === 'owner' || role === 'editor';
  const [tab, setTab] = useState<Tab>('library');
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [usage, setUsage] = useState<AssetUsage | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [editingAsset, setEditingAsset] = useState<WorkspaceAsset | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const maskRef = useRef<MaskCanvasHandle | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const editRequestKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh();
    }, search ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    void refresh();
  }, []);

  const selectedPreview = useMemo(() => value || editingAsset?.url || '', [value, editingAsset]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkspaceAssets(workspaceSlug, { q: search });
      setAssets(res.assets);
      setUsage(res.usage);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load assets.');
    } finally {
      setLoading(false);
    }
  }

  async function onArchive(asset: WorkspaceAsset) {
    const ok = await confirmDialog({
      title: 'Archive asset?',
      message: 'Archived assets disappear from the library but existing project URLs keep working.',
      confirmLabel: 'Archive',
    });
    if (!ok) return;
    try {
      await archiveWorkspaceAsset(workspaceSlug, asset.id);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to archive asset.');
    }
  }

  async function onUpload(file: File) {
    setUploadBusy(true);
    setError(null);
    try {
      const result = await uploadWorkspaceAsset(workspaceSlug, file, altText);
      onSelect(result.url);
      await refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploadBusy(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }

  async function onRunEdit(mode: 'inpaint' | 'remove_bg', assetOverride?: WorkspaceAsset) {
    const asset = assetOverride ?? editingAsset;
    if (!asset) return;
    const maskBlob = mode === 'remove_bg'
      ? new Blob([], { type: 'image/png' })
      : maskRef.current?.exportMask();
    if (!maskBlob) {
      setError('Add a mask before regenerating.');
      return;
    }

    setEditBusy(true);
    setError(null);
    const requestKey = editRequestKeyRef.current ?? createRequestKey();
    editRequestKeyRef.current = requestKey;
    try {
      const imageBlob = await fetch(asset.url).then((res) => res.blob());
      const imageFile = new File([imageBlob], asset.original_filename ?? 'asset.png', {
        type: asset.mime_type,
      });
      const result = await editImage({
        image: imageFile,
        mask: maskBlob,
        prompt: mode === 'remove_bg' ? 'remove the background, output transparent PNG' : editPrompt.trim(),
        workspaceSlug,
        mode,
        requestKey,
      });
      editRequestKeyRef.current = undefined;
      onSelect(result.asset.url);
      setEditingAsset(null);
      setTab('library');
      await refresh();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Edit failed.');
      }
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border-strong bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-fg">Asset Picker</div>
            <div className="text-xs text-muted">Workspace library, uploads, and AI generation in one place.</div>
          </div>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-border px-4 py-3">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')}>Library</TabButton>
          <TabButton active={tab === 'upload'} disabled={!canEdit} onClick={() => setTab('upload')}>Upload</TabButton>
          <TabButton active={tab === 'generate'} disabled={!canEdit} onClick={() => setTab('generate')}>Generate</TabButton>
          {editingAsset && <TabButton active={tab === 'edit'} disabled={!canEdit} onClick={() => setTab('edit')}>Edit</TabButton>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'library' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by alt text, prompt, or filename"
                  className="flex-1"
                />
                {selectedPreview && <img src={selectedPreview} alt="" className="h-10 w-10 rounded border border-border-strong object-cover" />}
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Loading assets…</div>
              ) : (
                <AssetLibraryGrid
                  assets={assets}
                  canEdit={canEdit}
                  onUse={(asset) => onSelect(asset.url)}
                  onArchive={onArchive}
                  onEdit={(asset) => {
                    setEditingAsset(asset);
                    setEditPrompt(asset.prompt ?? '');
                    setTab('edit');
                  }}
                  onRemoveBg={(asset) => {
                    setEditingAsset(asset);
                    setEditPrompt('remove the background, output transparent PNG');
                    void onRunEdit('remove_bg', asset);
                  }}
                />
              )}
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => uploadRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    uploadRef.current?.click();
                  }
                }}
                className="rounded-lg border border-dashed border-border-strong p-10 text-center text-sm text-muted hover:border-brand hover:text-fg"
              >
                {uploadBusy ? 'Uploading…' : 'Click to choose an image from your computer'}
              </div>
              <input
                ref={uploadRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onUpload(file);
                }}
              />
            </div>
          )}

          {tab === 'generate' && (
            <GenerateImageForm
              workspaceSlug={workspaceSlug}
              canEdit={canEdit}
              onUse={(asset) => onSelect(asset.url)}
              onGenerated={() => {
                void refresh();
              }}
            />
          )}

          {tab === 'edit' && editingAsset && (
            <div className="space-y-3">
              <MaskCanvas ref={maskRef} imageUrl={editingAsset.url} />
              <Textarea
                rows={3}
                value={editPrompt}
                onChange={(event) => setEditPrompt(event.target.value)}
                placeholder="Describe how the masked area should change..."
                disabled={!canEdit || editBusy}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void onRunEdit('inpaint')} disabled={!canEdit || editBusy || !editPrompt.trim()}>
                  {editBusy ? 'Processing…' : 'Regenerate masked area'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => maskRef.current?.clear()} disabled={editBusy}>
                  Clear mask
                </Button>
                <Button type="button" variant="ghost" onClick={() => {
                  setEditingAsset(null);
                  setTab('library');
                }}>
                  Back to library
                </Button>
              </div>
            </div>
          )}

          {error && <div className="mt-4 text-xs text-danger">{error}</div>}
        </div>

        <div className="border-t border-border px-4 py-3 text-xs text-muted">
          {usage ? `Quota: ${usage.count}/${usage.limit} this month` : 'Quota unavailable'}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick(): void;
  children: import('react').ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm ${active ? 'bg-brand text-white' : 'bg-panel-2 text-fg'} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
