import { useRef, useState, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { MiseElement, ElementType } from "@mise/core";
import { useEditorStore } from "../store";
import { usePlayerRef } from "./StagePreview";
import { sendCommand } from "../lib/player-bridge";
import { cn } from "../lib/cn";

const TRACK_HEIGHT = 26;
const LABEL_WIDTH = 112; // px
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;

const TYPE_BG: Record<ElementType, string> = {
  video: "bg-blue-500/40 hover:bg-blue-500/55",
  audio: "bg-green-500/40 hover:bg-green-500/55",
  image: "bg-amber-500/40 hover:bg-amber-500/55",
  text: "bg-purple-500/40 hover:bg-purple-500/55",
  component: "bg-cyan-500/40 hover:bg-cyan-500/55",
  graphic: "bg-pink-500/40 hover:bg-pink-500/55",
};

const TYPE_SELECTED: Record<ElementType, string> = {
  video: "ring-blue-400",
  audio: "ring-green-400",
  image: "ring-amber-400",
  text: "ring-purple-400",
  component: "ring-cyan-400",
  graphic: "ring-pink-400",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function visualEnd(el: MiseElement, totalDuration: number): number {
  if (el.close.at !== null) return el.close.at;
  // For none/userClose, render to composition end or 30s past open, whichever is smaller
  return Math.min(totalDuration, el.open.at + 30);
}

function Ruler({
  totalDuration,
  zoom,
}: {
  totalDuration: number;
  zoom: number;
}): React.JSX.Element {
  const pxPerSecond = zoom;
  // Pick nice tick intervals
  let tickInterval = 1;
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const c of candidates) {
    if (c * pxPerSecond >= 40) {
      tickInterval = c;
      break;
    }
  }

  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration; t += tickInterval) {
    ticks.push(t);
  }

  return (
    <div className="relative h-5 border-b border-border" style={{ width: totalDuration * zoom }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 flex h-full flex-col items-start"
          style={{ left: t * zoom }}
        >
          <div className="h-2 w-px bg-muted-foreground/30" />
          <span className="pl-0.5 text-[9px] text-muted-foreground/60 select-none">
            {formatTime(t)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Timeline(): React.JSX.Element {
  const currentTime = useEditorStore((s) => s.currentTime);
  const elements = useEditorStore((s) => s.composition.elements);
  const duration = useEditorStore((s) => s.composition.stage.playback.duration);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

  const totalDuration = duration ?? 300;

  // Zoom: px per second
  const [zoom, setZoom] = useState(4);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const seekToX = useCallback(
    (clientX: number) => {
      const area = trackAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const x = clientX - rect.left;
      const seconds = Math.max(0, Math.min(x / zoom, totalDuration));
      // Update local time immediately for responsive feel
      useEditorStore.getState().setCurrentTime(seconds);
      // Send seek to player
      const iframe = usePlayerRef.getState().iframe;
      if (iframe) sendCommand(iframe, "seek", seconds);
    },
    [zoom, totalDuration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only seek if clicking in the track area (not on an element block)
      if ((e.target as HTMLElement).dataset.block) return;
      scrubbing.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seekToX(e.clientX);
    },
    [seekToX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbing.current) return;
      seekToX(e.clientX);
    },
    [seekToX]
  );

  const handlePointerUp = useCallback(() => {
    scrubbing.current = false;
  }, []);

  // Zoom via scroll wheel (with shift or ctrl)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => {
          const factor = e.deltaY > 0 ? 0.85 : 1.18;
          return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
        });
      }
    },
    []
  );

  // Keep playhead in view while playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrubbing.current) return;
    const playheadX = currentTime * zoom;
    const scrollLeft = el.scrollLeft;
    const viewWidth = el.clientWidth - LABEL_WIDTH;
    if (playheadX < scrollLeft || playheadX > scrollLeft + viewWidth - 20) {
      el.scrollLeft = Math.max(0, playheadX - viewWidth * 0.3);
    }
  }, [currentTime, zoom]);

  const zoomIn = (): void => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5));
  const zoomOut = (): void => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5));

  const trackWidth = totalDuration * zoom;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">Timeline</span>
        <div className="flex items-center gap-2">
          <button onClick={zoomOut} className="rounded p-0.5 text-muted-foreground hover:bg-accent" title="Zoom out">
            <ZoomOut size={13} />
          </button>
          <span className="w-10 text-center font-mono text-[10px] text-muted-foreground">
            {zoom.toFixed(1)}x
          </span>
          <button onClick={zoomIn} className="rounded p-0.5 text-muted-foreground hover:bg-accent" title="Zoom in">
            <ZoomIn size={13} />
          </button>
          <div className="mx-1 h-3 w-px bg-border" />
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(currentTime)}
            {duration !== null && <span className="text-muted-foreground/50"> / {formatTime(duration)}</span>}
          </span>
        </div>
      </div>

      {/* Scrollable track area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        onWheel={handleWheel}
      >
        <div className="flex" style={{ minWidth: LABEL_WIDTH + trackWidth }}>
          {/* Label column */}
          <div className="sticky left-0 z-10 shrink-0 bg-surface" style={{ width: LABEL_WIDTH }}>
            {/* Ruler spacer */}
            <div className="h-5 border-b border-r border-border" />
            {elements.map((el) => (
              <div
                key={el.id}
                className={cn(
                  "flex items-center border-b border-r border-border px-2 text-[11px] text-muted-foreground truncate cursor-pointer hover:bg-accent/50",
                  selectedElementId === el.id && "bg-accent text-surface-foreground"
                )}
                style={{ height: TRACK_HEIGHT }}
                onClick={() => setSelectedElementId(el.id)}
              >
                {el.id}
              </div>
            ))}
          </div>

          {/* Track area */}
          <div
            ref={trackAreaRef}
            className="relative cursor-crosshair select-none"
            style={{ width: trackWidth }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Ruler */}
            <Ruler totalDuration={totalDuration} zoom={zoom} />

            {/* Element blocks */}
            {elements.map((el, i) => {
              const left = el.open.at * zoom;
              const end = visualEnd(el, totalDuration);
              const width = Math.max((end - el.open.at) * zoom, 4);
              const isOpenEnded = el.close.at === null;
              const isSelected = selectedElementId === el.id;

              return (
                <div
                  key={el.id}
                  data-block="1"
                  className={cn(
                    "absolute flex items-center rounded-sm px-1 text-[10px] text-white/80 truncate cursor-pointer transition-shadow",
                    TYPE_BG[el.type],
                    isSelected && `ring-1 ${TYPE_SELECTED[el.type]}`,
                    isOpenEnded && "border-r border-dashed border-white/20"
                  )}
                  style={{
                    left,
                    width,
                    top: 20 + i * TRACK_HEIGHT + 3, // ruler height + track offset + padding
                    height: TRACK_HEIGHT - 6,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementId(el.id);
                  }}
                  title={`${el.id} (${el.type}) ${formatTime(el.open.at)}–${isOpenEnded ? "..." : formatTime(end)}`}
                >
                  {width > 30 && el.id}
                </div>
              );
            })}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 w-px bg-red-500"
              style={{
                left: currentTime * zoom,
                height: 20 + elements.length * TRACK_HEIGHT,
              }}
            />
            {/* Playhead handle */}
            <div
              className="pointer-events-none absolute -translate-x-1/2"
              style={{ left: currentTime * zoom, top: 0 }}
            >
              <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
