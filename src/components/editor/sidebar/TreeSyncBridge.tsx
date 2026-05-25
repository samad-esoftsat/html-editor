// TreeSyncBridge previously pushed the store-mirrored tree back into Craft
// via `actions.deserialize` whenever the store changed. Combined with
// EditorShell's `onNodesChange` (Craft -> store), this created a two-way
// feedback loop: any Craft mutation re-entered Craft as a fresh
// `deserialize`, producing duplicate React keys mid-mutation and crashing
// renders such as Image deletes.
//
// Craft owns the live tree once <Frame> initializes. The store is a
// downstream mirror used for autosave / export / translate, populated via
// `onNodesChange`. The store -> Craft direction is intentionally cut here.
//
// Kept as a no-op component so existing mounts in EditorShell / dev galleries
// continue to type-check without churn. Safe to delete in a follow-up.
export function TreeSyncBridge() {
  return null;
}
