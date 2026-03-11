import { useEditorStore } from "../store";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Timeline(): React.JSX.Element {
  const currentTime = useEditorStore((s) => s.currentTime);
  const elements = useEditorStore((s) => s.composition.elements);
  const duration = useEditorStore((s) => s.composition.stage.playback.duration);

  const totalDuration = duration ?? 300;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex h-8 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Timeline
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {formatTime(currentTime)}
          {duration !== null && ` / ${formatTime(duration)}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Tracks */}
        <div className="relative min-h-full">
          {elements.map((el) => {
            const openPct = (el.open.at / totalDuration) * 100;
            const closePct =
              el.close.at !== null
                ? (el.close.at / totalDuration) * 100
                : 100;
            const widthPct = closePct - openPct;

            return (
              <div
                key={el.id}
                className="flex h-7 items-center border-b border-border"
              >
                <div className="w-28 shrink-0 truncate border-r border-border px-2 text-[11px] text-muted-foreground">
                  {el.id}
                </div>
                <div className="relative flex-1">
                  <div
                    className="absolute top-1 h-5 rounded-sm bg-primary/30 text-[10px] leading-5 text-primary-foreground px-1 truncate"
                    style={{
                      left: `${openPct}%`,
                      width: `${Math.max(widthPct, 0.5)}%`,
                    }}
                  >
                    {el.type}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Playhead — positioned within the track area (after the 7rem label column) */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-red-500"
            style={{
              left: `calc(7rem + (100% - 7rem) * ${currentTime / totalDuration})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
