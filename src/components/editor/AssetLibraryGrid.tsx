'use client';

import type { WorkspaceAsset } from '@/lib/api/assets';
import { Button } from '@/components/ui/Button';

interface Props {
  assets: WorkspaceAsset[];
  canEdit: boolean;
  onUse(asset: WorkspaceAsset): void;
  onArchive(asset: WorkspaceAsset): void;
  onEdit(asset: WorkspaceAsset): void;
  onChatRefine(asset: WorkspaceAsset): void;
  onRemoveBg(asset: WorkspaceAsset): void;
}

export function AssetLibraryGrid({
  assets,
  canEdit,
  onUse,
  onArchive,
  onEdit,
  onChatRefine,
  onRemoveBg,
}: Props) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ed-rule-strong p-12 text-center text-sm text-ed-ink-3">
        No assets yet. Upload or generate one to get started.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="group overflow-hidden rounded-lg border border-ed-rule-strong bg-ed-panel-2 transition-colors hover:border-brand/40"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-ed-panel">
            <img
              src={asset.url}
              alt={asset.alt_text ?? ''}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-2 p-3">
            <div className="space-y-1">
              <div className="truncate text-[12px] font-medium text-ed-ink">
                {asset.original_filename || asset.prompt || `${asset.source} image`}
              </div>
              <div className="line-clamp-2 text-[11px] text-ed-ink-3">
                {asset.alt_text || asset.prompt || asset.source}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 rounded-md bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand hover:bg-brand/25 hover:text-brand"
                onClick={() => onUse(asset)}
              >
                Use
              </Button>
              {canEdit && (
                <>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onEdit(asset)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onChatRefine(asset)}>
                    Chat refine
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-[11px]" onClick={() => onRemoveBg(asset)}>
                    Remove BG
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-8 px-2 py-1 text-[11px] text-danger hover:text-danger"
                    onClick={() => onArchive(asset)}
                  >
                    Archive
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
