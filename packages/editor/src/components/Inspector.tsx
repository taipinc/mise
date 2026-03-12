import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { MiseElement, MiseStage, MiseMeta } from "@mise/core";
import { useEditorStore } from "../store";
import { cn } from "../lib/cn";

// --- Primitives ---

function Row({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-surface-foreground">{value}</span>
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3 pb-2 text-xs">{children}</div>}
    </div>
  );
}

function Bool({ value }: { value: boolean }): React.JSX.Element {
  return (
    <span className={cn(value ? "text-green-400" : "text-muted-foreground/60")}>
      {value ? "yes" : "no"}
    </span>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Mono({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="font-mono text-[11px]">{children}</span>;
}

// --- Stage Inspector (no selection) ---

function StageInspector({
  meta,
  stage,
  elementCount,
}: {
  meta: MiseMeta;
  stage: MiseStage;
  elementCount: number;
}): React.JSX.Element {
  return (
    <>
      <Section title="Meta">
        <Row label="Title" value={meta.title || "(untitled)"} />
        <Row label="Author" value={meta.author || "—"} />
        <Row label="Created" value={meta.created} />
        <Row label="Modified" value={meta.modified} />
      </Section>

      <Section title="ViewBox">
        <Row
          label="Size"
          value={<Mono>{stage.viewBox.width} &times; {stage.viewBox.height}</Mono>}
        />
        <Row label="Scaling" value={<Bool value={stage.scaling} />} />
        <Row
          label="Background"
          value={stage.background ? <Mono>{truncate(stage.background, 40)}</Mono> : "—"}
        />
      </Section>

      <Section title="Playback">
        <Row
          label="Duration"
          value={
            stage.playback.duration !== null
              ? <Mono>{formatTime(stage.playback.duration)} ({stage.playback.duration}s)</Mono>
              : "open-ended"
          }
        />
        <Row label="Loop" value={<Bool value={stage.playback.loop} />} />
        <Row label="Sync w/ Clock" value={<Bool value={stage.playback.sync.withClock} />} />
      </Section>

      <Section title="Playback Bar">
        <Row label="Visible" value={<Bool value={stage.playbackBar.visible} />} />
        <Row label="Interactive" value={<Bool value={stage.playbackBar.interactive} />} />
        <Row label="Show Time" value={<Bool value={stage.playbackBar.showCurrentTime} />} />
        <Row label="Global Mute" value={<Bool value={stage.playbackBar.globalMute} />} />
      </Section>

      <Section title="Summary" defaultOpen={false}>
        <Row label="Elements" value={elementCount} />
        <Row
          label="Styles"
          value={stage.styles ? `${stage.styles.length} chars` : "—"}
        />
      </Section>
    </>
  );
}

// --- Element Inspector (with selection) ---

function ElementInspector({ el }: { el: MiseElement }): React.JSX.Element {
  return (
    <>
      <Section title="Identity">
        <Row label="ID" value={<Mono>{el.id}</Mono>} />
        <Row label="Type" value={el.type} />
        <Row label="Visible" value={<Bool value={el.visible} />} />
        <Row label="Background" value={<Bool value={el.background} />} />
      </Section>

      {el.src !== null && (
        <Section title="Source">
          <Row label="src" value={<Mono>{truncate(el.src, 60)}</Mono>} />
        </Section>
      )}

      {el.content !== null && (
        <Section title="Content" defaultOpen={false}>
          <div className="max-h-24 overflow-y-auto rounded bg-muted p-1.5 font-mono text-[10px] text-muted-foreground">
            {truncate(el.content, 300)}
          </div>
        </Section>
      )}

      <Section title="Cues">
        <Row label="Open mode" value={el.open.mode} />
        <Row label="Open at" value={<Mono>{formatTime(el.open.at)} ({el.open.at}s)</Mono>} />
        <Row label="Close mode" value={el.close.mode} />
        <Row
          label="Close at"
          value={
            el.close.at !== null
              ? <Mono>{formatTime(el.close.at)} ({el.close.at}s)</Mono>
              : "—"
          }
        />
      </Section>

      <Section title="Position & Size">
        <Row label="Position" value={<Mono>{el.position.x}, {el.position.y}</Mono>} />
        <Row label="Size" value={<Mono>{el.size.width} &times; {el.size.height}</Mono>} />
        <Row
          label="zIndex"
          value={el.zIndex !== null ? <Mono>{el.zIndex}</Mono> : "auto"}
        />
        <Row label="mediaFit" value={el.mediaFit} />
      </Section>

      <Section title="Flags">
        <Row label="Movable" value={<Bool value={el.flags.movable} />} />
        <Row label="Resizable" value={<Bool value={el.flags.resizable} />} />
        <Row label="Closable" value={<Bool value={el.flags.closable} />} />
        <Row label="zIndexable" value={<Bool value={el.flags.zIndexable} />} />
      </Section>

      <Section title="Animation">
        <Row label="Enter" value={el.animation.enter || "—"} />
        <Row label="Exit" value={el.animation.exit || "—"} />
      </Section>

      {el.playback && (
        <Section title="Playback">
          <Row label="Initial" value={el.playback.initial} />
          <Row label="Loop" value={<Bool value={el.playback.loop} />} />
          <Row label="Sync w/ Clock" value={<Bool value={el.playback.syncWithClock} />} />
          <Row label="Audience Ctrl" value={<Bool value={el.playback.audienceControl} />} />
          <Row label="Bar visible" value={<Bool value={el.playback.bar.visible} />} />
        </Section>
      )}

      {el.audio && (
        <Section title="Audio">
          <Row label="Initial" value={el.audio.initial} />
          <Row label="Audience Ctrl" value={<Bool value={el.audio.audienceControl} />} />
          <Row label="Fade in" value={el.audio.fadeIn ? `${el.audio.fadeIn}ms` : "—"} />
          <Row label="Fade out" value={el.audio.fadeOut ? `${el.audio.fadeOut}ms` : "—"} />
        </Section>
      )}

      {el.classNames.length > 0 && (
        <Section title="CSS Classes" defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {el.classNames.map((cls) => (
              <span
                key={cls}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {cls}
              </span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// --- Main Inspector ---

export function Inspector(): React.JSX.Element {
  const meta = useEditorStore((s) => s.composition.meta);
  const stage = useEditorStore((s) => s.composition.stage);
  const elements = useEditorStore((s) => s.composition.elements);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

  const selectedElement = selectedElementId
    ? elements.find((el) => el.id === selectedElementId) ?? null
    : null;

  const handleDeselect = useCallback(() => {
    setSelectedElementId(null);
  }, [setSelectedElementId]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex h-8 items-center border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          {selectedElement ? "Element" : "Inspector"}
        </span>
        {selectedElement && (
          <>
            <span className="ml-1.5 truncate text-xs text-surface-foreground">
              {selectedElement.id}
            </span>
            <button
              onClick={handleDeselect}
              className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-surface-foreground"
              title="Deselect"
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedElement ? (
          <ElementInspector el={selectedElement} />
        ) : (
          <StageInspector
            meta={meta}
            stage={stage}
            elementCount={elements.length}
          />
        )}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
