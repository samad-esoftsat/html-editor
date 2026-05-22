'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search, UploadCloud } from 'lucide-react';
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
import { ChatRefinePanel } from './ChatRefinePanel';
import { GenerateImageForm } from './GenerateImageForm';
import { MaskCanvas, type MaskCanvasHandle } from './MaskCanvas';

type Tab = 'library' | 'upload' | 'generate' | 'edit' | 'chat';

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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 p-8 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-[1024px] flex-col overflow-hidden rounded-[12px] border border-ed-rule bg-ed-panel-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-ed-rule px-4 py-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-ed-ink">Asset Picker</div>
            <div className="text-xs text-ed-ink-3">Workspace library, uploads, and AI generation in one place.</div>
          </div>
          <button
            type="button"
            aria-label="Close asset picker"
            className="rounded-md p-1.5 text-ed-ink-3 transition-colors hover:bg-ed-panel-3 hover:text-ed-ink"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-ed-rule px-4 py-3">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')}>Library</TabButton>
          <TabButton active={tab === 'upload'} disabled={!canEdit} onClick={() => setTab('upload')}>Upload</TabButton>
          <TabButton active={tab === 'generate'} disabled={!canEdit} onClick={() => setTab('generate')}>Generate</TabButton>
          {editingAsset && <TabButton active={tab === 'edit'} disabled={!canEdit} onClick={() => setTab('edit')}>Edit</TabButton>}
          {editingAsset && <TabButton active={tab === 'chat'} disabled={!canEdit} onClick={() => setTab('chat')}>Chat refine</TabButton>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ed-ink-3" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by alt text, prompt, or filename"
                    className="pl-9"
                  />
                </div>
                {selectedPreview && (
                  <img
                    src={selectedPreview}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-ed-rule-strong object-cover"
                  />
                )}
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-ed-ink-3">
                  <Spinner size={16} /> Loading assets…
                </div>
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
                  onChatRefine={(asset) => {
                    setEditingAsset(asset);
                    setTab('chat');
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
            <div className="flex h-full items-center justify-center">
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
                className="flex w-full max-w-xl cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-ed-rule-strong bg-ed-panel-2 px-8 py-14 text-center transition-colors hover:border-brand"
              >
                <UploadCloud size={40} className="text-ed-ink-3" strokeWidth={1.5} />
                <div className="space-y-1">
                  <div className="text-base font-medium text-ed-ink">
                    {uploadBusy ? 'Uploading…' : 'Drop an image here, or click to browse'}
                  </div>
                  <div className="text-xs text-ed-ink-3">PNG, JPG, WebP, or GIF. Max 10 MB.</div>
                </div>
                <span className="rounded-md border border-brand bg-brand/15 px-4 py-2 text-[13px] font-medium text-brand">
                  Choose file
                </span>
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

          {tab === 'chat' && editingAsset && (
            <ChatRefinePanel
              workspaceSlug={workspaceSlug}
              canEdit={canEdit}
              seed={editingAsset}
              onUse={(asset) => onSelect(asset.url)}
              onTurnCommitted={() => {
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

          {error && <div className="mt-4 text-xs text-ed-danger">{error}</div>}
        </div>

        <div className="border-t border-ed-rule px-4 py-3 text-xs text-ed-ink-3">
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
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]'
          : 'bg-ed-panel-3 text-ed-ink hover:bg-ed-panel hover:text-ed-ink'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
