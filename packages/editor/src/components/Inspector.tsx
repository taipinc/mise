import { useEditorStore } from "../store";

export function Inspector(): React.JSX.Element {
  const meta = useEditorStore((s) => s.composition.meta);
  const stage = useEditorStore((s) => s.composition.stage);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex h-8 items-center border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Inspector
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-xs">
        <div className="mb-3">
          <div className="mb-1 text-muted-foreground">Title</div>
          <div className="text-surface-foreground">
            {meta.title || "(untitled)"}
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 text-muted-foreground">ViewBox</div>
          <div className="text-surface-foreground">
            {stage.viewBox.width} &times; {stage.viewBox.height}
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 text-muted-foreground">Duration</div>
          <div className="text-surface-foreground">
            {stage.playback.duration !== null
              ? `${stage.playback.duration}s`
              : "open-ended"}
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 text-muted-foreground">Elements</div>
          <div className="text-surface-foreground">
            {useEditorStore.getState().composition.elements.length}
          </div>
        </div>
      </div>
    </div>
  );
}
