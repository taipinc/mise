import { FolderOpen, Save, Play, Pause } from "lucide-react";
import { useEditorStore, parseComposition } from "../store";
import { usePlayerRef } from "./StagePreview";
import { sendCommand } from "../lib/player-bridge";

export function Toolbar(): React.JSX.Element {
  const { composition, playing, fileName } = useEditorStore();

  const handleOpen = async (): Promise<void> => {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Mise Composition",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const file = await fileHandle.getFile();
    const text = await file.text();
    const raw: unknown = JSON.parse(text);
    const parsed = parseComposition(raw);
    useEditorStore.getState().setComposition(parsed, file.name);
  };

  const handleSave = async (): Promise<void> => {
    const json = JSON.stringify(composition, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const handle = await window.showSaveFilePicker({
      suggestedName: fileName ?? "composition.json",
      types: [
        {
          description: "Mise Composition",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const handlePlayPause = (): void => {
    const iframe = usePlayerRef.getState().iframe;
    if (!iframe) return;
    sendCommand(iframe, playing ? "pause" : "play");
  };

  return (
    <div className="flex h-10 items-center gap-1 border-b border-border bg-surface px-2">
      <span className="mr-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Mise
      </span>

      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-surface-foreground hover:bg-accent"
        title="Open composition"
      >
        <FolderOpen size={14} />
        Open
      </button>

      <button
        onClick={handleSave}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-surface-foreground hover:bg-accent"
        title="Save composition"
      >
        <Save size={14} />
        Save
      </button>

      <div className="mx-2 h-4 w-px bg-border" />

      <button
        onClick={handlePlayPause}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-surface-foreground hover:bg-accent"
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        {playing ? "Pause" : "Play"}
      </button>

      <div className="flex-1" />

      <span className="text-xs text-muted-foreground">
        {fileName ?? "untitled"}
      </span>
    </div>
  );
}
