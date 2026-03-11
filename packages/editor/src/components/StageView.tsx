import { useEditorStore } from "../store";

export function StageView(): React.JSX.Element {
  const elements = useEditorStore((s) => s.composition.elements);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex h-8 items-center border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Stage View
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {elements.map((el) => (
            <li
              key={el.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs text-surface-foreground hover:bg-accent"
            >
              <span className="w-14 shrink-0 rounded bg-muted px-1 py-0.5 text-center text-[10px] text-muted-foreground">
                {el.type}
              </span>
              <span className="truncate">{el.id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
