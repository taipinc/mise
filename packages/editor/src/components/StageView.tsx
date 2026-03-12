import { useMemo } from "react";
import {
  Video,
  Volume2,
  Image,
  Type,
  Puzzle,
  PenTool,
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
}

function ElementRow({ el, zone, selected, onClick }: ElementRowProps): React.JSX.Element {
  const dimmed = zone !== "present";

  return (
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

export function StageView(): React.JSX.Element {
  const elements = useEditorStore((s) => s.composition.elements);
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedElementId = useEditorStore((s) => s.selectedElementId);
  const setSelectedElementId = useEditorStore((s) => s.setSelectedElementId);

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
      <div className="flex h-8 items-center border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground">
          Stage View
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {elements.length}
        </span>
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
          />
        ))}
      </div>
    </div>
  );
}
