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
    return <div className="rounded-md border border-dashed border-ed-rule-strong p-6 text-sm text-ed-ink-3">No assets yet.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {assets.map((asset) => (
        <div key={asset.id} className="overflow-hidden rounded-md border border-ed-rule-strong bg-ed-panel-2">
          <img src={asset.url} alt={asset.alt_text ?? ''} className="h-28 w-full object-cover" />
          <div className="space-y-2 p-2">
            <div className="space-y-1">
              <div className="truncate text-xs font-medium text-ed-ink">
                {asset.original_filename || asset.prompt || `${asset.source} image`}
              </div>
              <div className="line-clamp-2 text-[11px] text-ed-ink-3">
                {asset.alt_text || asset.prompt || asset.source}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-8 px-2 py-1 text-xs" onClick={() => onUse(asset)}>
                Use
              </Button>
              {canEdit && (
                <>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-xs" onClick={() => onEdit(asset)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-xs" onClick={() => onChatRefine(asset)}>
                    Chat refine
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-xs" onClick={() => onRemoveBg(asset)}>
                    Remove BG
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-8 px-2 py-1 text-xs text-danger hover:text-danger" onClick={() => onArchive(asset)}>
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
