import { useMemo, useState, useRef, useEffect } from "react";
import {
  Video,
  Volume2,
  Image,
  Type,
  Puzzle,
  PenTool,
  Plus,
  Trash2,
} from "lucide-react";
import type { MiseElement, ElementType } from "@mise/core";
import { useEditorStore } from "../store";
import { cn } from "../lib/cn";

const TYPE_COLORS: Record<ElementType, string> = {
  video: "border-blue-500",
  audio: "border-green-500",
  image: "border-amber-500",
  text: "border-purple-500",
  component: "border-cyan-500",
  graphic: "border-pink-500",
};

const TYPE_BADGE_COLORS: Record<ElementType, string> = {
  video: "text-blue-400",
  audio: "text-green-400",
  image: "text-amber-400",
  text: "text-purple-400",
  component: "text-cyan-400",
  graphic: "text-pink-400",
};

function TypeIcon({ type }: { type: ElementType }): React.JSX.Element {
  const size = 12;
  switch (type) {
    case "video":
      return <Video size={size} />;
    case "audio":
      return <Volume2 size={size} />;
    case "image":
      return <Image size={size} />;
    case "text":
      return <Type size={size} />;
    case "component":
      return <Puzzle size={size} />;
    case "graphic":
      return <PenTool size={size} />;
  }
}

function isPresent(el: MiseElement, time: number): boolean {
  if (el.open.mode === "link") return false;
  const opened = el.open.at <= time;
  const closed =
    el.close.mode === "cue" && el.close.at !== null && el.close.at <= time;
  return opened && !closed;
}

function isPast(el: MiseElement, time: number): boolean {
  if (el.open.mode === "link") return false;
  return (
    el.close.mode === "cue" && el.close.at !== null && el.close.at <= time
  );
}

function isFuture(el: MiseElement, time: number): boolean {
  if (el.open.mode === "link") return true;
  return el.open.at > time;
}

interface ElementRowProps {
  el: MiseElement;
  zone: "past" | "present" | "future" | "link";
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function ElementRow({ el, zone, selected, onClick, onDelete }: ElementRowProps): React.JSX.Element {
  const dimmed = zone !== "present";

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors",
          "hover:bg-accent",
          selected && "bg-accent ring-1 ring-primary/40",
          dimmed && "opacity-45",
          zone === "present" && `border-l-2 ${TYPE_COLORS[el.type]}`,
          zone !== "present" && "border-l-2 border-transparent"
        )}
      >
        <span className={cn("shrink-0", TYPE_BADGE_COLORS[el.type])}>
          <TypeIcon type={el.type} />
        </span>
        <span className="truncate text-surface-foreground">{el.id}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
        title="Delete element"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function ZoneHeader({ label, count }: { label: string; count: number }): React.JSX.Element | null {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 px-2 pt-2 pb-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/60">{count}</span>
    </div>
  );
}

const ELEMENT_TYPES: ElementType[] = [
  "video",
  "audio",
  "image",
  "text",
  "component",
  "graphic",
];

function makeDefaultElement(type: ElementType, currentTime: number, viewBox: { width: number; height: number }): MiseElement {
  const id = `${type}-${Date.now().toString(36)}`;
  const w = Math.round(viewBox.width * 0.4);
  const h = Math.round(viewBox.height * 0.4);
  const x = Math.round((viewBox.width - w) / 2);
  const y = Math.round((viewBox.height - h) / 2);

  const base: MiseElement = {
    id,
    type,
    src: type === "video" || type === "audio" || type === "image" ? "" : null,
    content: type === "text" || type === "component" ? "" : null,
    open: { mode: "cue", at: Math.round(currentTime * 10) / 10 },
    close: { mode: "none", at: null },
    persistOnLoop: false,
    position: { x, y },
    size: { width: w, height: h },
    zIndex: null,
    background: false,
    classNames: [],
    flags: { movable: false, resizable: false, closable: false, zIndexable: false },
    animation: { enter: "", exit: "" },
    mediaFit: "fill",
    visible: true,
  };

  if (type === "video" || type === "audio") {
    base.playback = {
      initial: "playing",
      loop: false,
      syncWithClock: true,
      audienceControl: false,
      bar: { visible: false, classNames: [] },
    };
    base.audio = {
      initial: "on",
      audienceControl: false,
      fadeIn: 0,
      fadeOut: 0,
    };
  }

  return base;
}

function AddElementPopover({ onClose }: { onClose: () => void }): React.JSX.Element {
  const currentTime = useEditorStore((s) => s.currentTime);
  const viewBox = useEditorStore((s) => s.composition.stage.viewBox);
  const addElement = useEditorStore((s) => s.addElement);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full z-50 mt-1 rounded border border-border bg-surface py-1 shadow-lg"
    >
      {ELEMENT_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => {
            addElement(makeDefaultElement(type, currentTime, viewBox));
            onClose();
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent",
            TYPE_BADGE_COLORS[type]
          )}
        >
          <TypeIcon type={type} />
          <span className="text-surface-foreground">{type}</span>
        </button>
      ))}
    </div>
  );
}

export function StageView(): React.JSX.Element {
  const elements = useEditorStore((s) => s.composition.elements);
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);
  const removeElement = useEditorStore((s) => s.removeElement);
  const [showAdd, setShowAdd] = useState(false);

  const { past, present, future } = useMemo(() => {
    const past: MiseElement[] = [];
    const present: MiseElement[] = [];
    const future: MiseElement[] = [];

    for (const el of elements) {
      if (isPresent(el, currentTime)) {
        present.push(el);
      } else if (isPast(el, currentTime)) {
        past.push(el);
      } else if (isFuture(el, currentTime)) {
        future.push(el);
      }
    }

    return { past, present, future };
  }, [elements, currentTime]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="relative flex h-8 items-center border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Stage View
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground/60">
            {elements.length}
          </span>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-surface-foreground"
            title="Add element"
          >
            <Plus size={14} />
          </button>
        </div>
        {showAdd && <AddElementPopover onClose={() => setShowAdd(false)} />}
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-2">
        <ZoneHeader label="Past" count={past.length} />
        {past.map((el) => (
          <ElementRow
            key={el.id}
            el={el}
            zone="past"
            selected={selectedElementId === el.id}
            onClick={() => setSelectedElementId(el.id)}
            onDelete={() => removeElement(el.id)}
          />
        ))}

        <ZoneHeader label="Present" count={present.length} />
        {present.map((el) => (
          <ElementRow
            key={el.id}
            el={el}
            zone="present"
            selected={selectedElementId === el.id}
            onClick={() => setSelectedElementId(el.id)}
            onDelete={() => removeElement(el.id)}
          />
        ))}

        <ZoneHeader label="Future" count={future.length} />
        {future.map((el) => (
          <ElementRow
            key={el.id}
            el={el}
            zone="future"
            selected={selectedElementId === el.id}
            onClick={() => setSelectedElementId(el.id)}
            onDelete={() => removeElement(el.id)}
          />
        ))}
      </div>
    </div>
  );
}
