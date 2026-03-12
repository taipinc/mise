import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { MiseElement, MiseStage, MiseMeta } from "@mise/core";
import { useEditorStore } from "../store";
import type { DeepPartial } from "../store";
import { cn } from "../lib/cn";
import { CssEditor } from "./CssEditor";

// ============================================================
// Primitives
// ============================================================

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-surface-foreground">{children}</span>
    </div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return <Row label={label}>{value}</Row>;
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

function Mono({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="font-mono text-[11px]">{children}</span>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

// ============================================================
// Editable input primitives (commit-on-blur / Enter)
// ============================================================

const INPUT_CLASS =
  "w-full rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-surface-foreground outline-none focus:ring-1 focus:ring-primary/50";

function NumberInput({
  value,
  onChange,
  nullable = false,
  min,
  step,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  nullable?: boolean;
  min?: number;
  step?: number;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const ref = useRef<HTMLInputElement>(null);

  // Sync when external value changes (e.g. different element selected)
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const commit = (): void => {
    if (nullable && draft.trim() === "") {
      onChange(null);
      return;
    }
    const n = Number(draft);
    if (Number.isFinite(n) && (min === undefined || n >= min)) {
      onChange(n);
    } else {
      setDraft(value === null ? "" : String(value));
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      className={INPUT_CLASS}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          ref.current?.blur();
        }
      }}
      step={step}
    />
  );
}

function ToggleInput({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-mono transition-colors",
        value
          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {value ? "yes" : "no"}
    </button>
  );
}

function SelectInput<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}): React.JSX.Element {
  return (
    <select
      className={cn(INPUT_CLASS, "cursor-pointer")}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (draft !== value) onChange(draft);
  };

  return (
    <input
      ref={ref}
      type="text"
      className={INPUT_CLASS}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          ref.current?.blur();
        }
      }}
    />
  );
}

function TextAreaInput({
  value,
  onChange,
  rows = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (): void => {
    if (draft !== value) onChange(draft);
  };

  return (
    <textarea
      ref={ref}
      className={cn(INPUT_CLASS, "resize-y")}
      rows={rows}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

// ============================================================
// Stage Inspector (no selection) — with editable playback fields
// ============================================================

function StageInspector({
  meta,
  stage,
  elementCount,
}: {
  meta: MiseMeta;
  stage: MiseStage;
  elementCount: number;
}): React.JSX.Element {
  const updateStage = useEditorStore((s) => s.updateStage);

  return (
    <>
      <Section title="Meta">
        <ReadonlyRow label="Title" value={meta.title || "(untitled)"} />
        <ReadonlyRow label="Author" value={meta.author || "—"} />
        <ReadonlyRow label="Created" value={meta.created} />
        <ReadonlyRow label="Modified" value={meta.modified} />
      </Section>

      <Section title="ViewBox">
        <Row label="Width">
          <NumberInput
            value={stage.viewBox.width}
            onChange={(v) => v !== null && updateStage({ viewBox: { width: v } })}
            min={1}
          />
        </Row>
        <Row label="Height">
          <NumberInput
            value={stage.viewBox.height}
            onChange={(v) => v !== null && updateStage({ viewBox: { height: v } })}
            min={1}
          />
        </Row>
        <ReadonlyRow label="Scaling" value={<Bool value={stage.scaling} />} />
        <ReadonlyRow
          label="Background"
          value={stage.background ? <Mono>{truncate(stage.background, 40)}</Mono> : "—"}
        />
      </Section>

      <Section title="Playback">
        <Row label="Duration">
          <NumberInput
            value={stage.playback.duration}
            onChange={(v) => updateStage({ playback: { duration: v } })}
            nullable
            min={0}
          />
        </Row>
        <Row label="Loop">
          <ToggleInput
            value={stage.playback.loop}
            onChange={(v) => updateStage({ playback: { loop: v } })}
          />
        </Row>
        <Row label="Sync w/ Clock">
          <ToggleInput
            value={stage.playback.sync.withClock}
            onChange={(v) => updateStage({ playback: { sync: { withClock: v } } })}
          />
        </Row>
      </Section>

      <Section title="Playback Bar">
        <Row label="Visible">
          <ToggleInput
            value={stage.playbackBar.visible}
            onChange={(v) => updateStage({ playbackBar: { visible: v } })}
          />
        </Row>
        <Row label="Interactive">
          <ToggleInput
            value={stage.playbackBar.interactive}
            onChange={(v) => updateStage({ playbackBar: { interactive: v } })}
          />
        </Row>
        <Row label="Show Time">
          <ToggleInput
            value={stage.playbackBar.showCurrentTime}
            onChange={(v) => updateStage({ playbackBar: { showCurrentTime: v } })}
          />
        </Row>
        <Row label="Global Mute">
          <ToggleInput
            value={stage.playbackBar.globalMute}
            onChange={(v) => updateStage({ playbackBar: { globalMute: v } })}
          />
        </Row>
      </Section>

      <Section title="Stage Styles">
        <CssEditor
          value={stage.styles}
          onChange={(v) => updateStage({ styles: v })}
        />
      </Section>

      <Section title="Summary" defaultOpen={false}>
        <ReadonlyRow label="Elements" value={elementCount} />
      </Section>
    </>
  );
}

// ============================================================
// Element Inspector (with selection) — editable
// ============================================================

function ElementInspector({ el }: { el: MiseElement }): React.JSX.Element {
  const updateElement = useEditorStore((s) => s.updateElement);
  const patch = (p: DeepPartial<MiseElement>): void => updateElement(el.id, p);

  return (
    <>
      <Section title="Identity">
        <ReadonlyRow label="ID" value={<Mono>{el.id}</Mono>} />
        <ReadonlyRow label="Type" value={el.type} />
        <Row label="Visible">
          <ToggleInput value={el.visible} onChange={(v) => patch({ visible: v })} />
        </Row>
        <Row label="Background">
          <ToggleInput value={el.background} onChange={(v) => patch({ background: v })} />
        </Row>
      </Section>

      {el.src !== null && (
        <Section title="Source">
          <Row label="src">
            <TextInput value={el.src} onChange={(v) => patch({ src: v })} />
          </Row>
        </Section>
      )}

      {el.content !== null && (
        <Section title="Content">
          <TextAreaInput value={el.content} onChange={(v) => patch({ content: v })} rows={6} />
        </Section>
      )}

      <Section title="Cues">
        <Row label="Open mode">
          <SelectInput
            value={el.open.mode}
            options={["cue", "link", "both"] as const}
            onChange={(v) => patch({ open: { mode: v } })}
          />
        </Row>
        <Row label="Open at">
          <NumberInput value={el.open.at} onChange={(v) => v !== null && patch({ open: { at: v } })} min={0} />
        </Row>
        <Row label="Close mode">
          <SelectInput
            value={el.close.mode}
            options={["cue", "userClose", "none"] as const}
            onChange={(v) => patch({ close: { mode: v } })}
          />
        </Row>
        <Row label="Close at">
          <NumberInput
            value={el.close.at}
            onChange={(v) => patch({ close: { at: v } })}
            nullable
            min={0}
          />
        </Row>
      </Section>

      <Section title="Position & Size">
        <Row label="X">
          <NumberInput value={el.position.x} onChange={(v) => v !== null && patch({ position: { x: v } })} />
        </Row>
        <Row label="Y">
          <NumberInput value={el.position.y} onChange={(v) => v !== null && patch({ position: { y: v } })} />
        </Row>
        <Row label="Width">
          <NumberInput value={el.size.width} onChange={(v) => v !== null && patch({ size: { width: v } })} min={1} />
        </Row>
        <Row label="Height">
          <NumberInput value={el.size.height} onChange={(v) => v !== null && patch({ size: { height: v } })} min={1} />
        </Row>
        <Row label="zIndex">
          <NumberInput value={el.zIndex} onChange={(v) => patch({ zIndex: v })} nullable />
        </Row>
        <Row label="mediaFit">
          <SelectInput
            value={el.mediaFit}
            options={["fit", "fill"] as const}
            onChange={(v) => patch({ mediaFit: v })}
          />
        </Row>
      </Section>

      <Section title="Flags">
        <Row label="Movable">
          <ToggleInput value={el.flags.movable} onChange={(v) => patch({ flags: { movable: v } })} />
        </Row>
        <Row label="Resizable">
          <ToggleInput value={el.flags.resizable} onChange={(v) => patch({ flags: { resizable: v } })} />
        </Row>
        <Row label="Closable">
          <ToggleInput value={el.flags.closable} onChange={(v) => patch({ flags: { closable: v } })} />
        </Row>
        <Row label="zIndexable">
          <ToggleInput value={el.flags.zIndexable} onChange={(v) => patch({ flags: { zIndexable: v } })} />
        </Row>
      </Section>

      <Section title="Animation">
        <ReadonlyRow label="Enter" value={el.animation.enter || "—"} />
        <ReadonlyRow label="Exit" value={el.animation.exit || "—"} />
      </Section>

      {el.playback && (
        <Section title="Playback">
          <Row label="Initial">
            <SelectInput
              value={el.playback.initial}
              options={["playing", "paused"] as const}
              onChange={(v) => patch({ playback: { initial: v } })}
            />
          </Row>
          <Row label="Loop">
            <ToggleInput value={el.playback.loop} onChange={(v) => patch({ playback: { loop: v } })} />
          </Row>
          <Row label="Sync w/ Clock">
            <ToggleInput
              value={el.playback.syncWithClock}
              onChange={(v) => patch({ playback: { syncWithClock: v } })}
            />
          </Row>
          <Row label="Audience Ctrl">
            <ToggleInput
              value={el.playback.audienceControl}
              onChange={(v) => patch({ playback: { audienceControl: v } })}
            />
          </Row>
          <Row label="Bar visible">
            <ToggleInput
              value={el.playback.bar.visible}
              onChange={(v) => patch({ playback: { bar: { visible: v } } })}
            />
          </Row>
        </Section>
      )}

      {el.audio && (
        <Section title="Audio">
          <Row label="Initial">
            <SelectInput
              value={el.audio.initial}
              options={["on", "off"] as const}
              onChange={(v) => patch({ audio: { initial: v } })}
            />
          </Row>
          <Row label="Audience Ctrl">
            <ToggleInput
              value={el.audio.audienceControl}
              onChange={(v) => patch({ audio: { audienceControl: v } })}
            />
          </Row>
          <Row label="Fade in (ms)">
            <NumberInput
              value={el.audio.fadeIn}
              onChange={(v) => v !== null && patch({ audio: { fadeIn: v } })}
              min={0}
            />
          </Row>
          <Row label="Fade out (ms)">
            <NumberInput
              value={el.audio.fadeOut}
              onChange={(v) => v !== null && patch({ audio: { fadeOut: v } })}
              min={0}
            />
          </Row>
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

// ============================================================
// Main Inspector
// ============================================================

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
