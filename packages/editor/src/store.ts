import { create } from "zustand";
import type { MiseComposition } from "@mise/core";
import { CompositionSchema } from "@mise/core";
import testComposition from "../../../compositions/test04.json";

interface EditorState {
  composition: MiseComposition;
  currentTime: number;
  playing: boolean;
  fileName: string | null;
  selectedElementId: string | null;

  setComposition: (composition: MiseComposition, fileName?: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setSelectedElementId: (id: string | null) => void;
}

function parseComposition(raw: unknown): MiseComposition {
  const result = CompositionSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      "Invalid composition: " +
        result.error.issues.map((i) => i.message).join(", ")
    );
  }
  return result.data;
}

const initialComposition = parseComposition(testComposition);

export const useEditorStore = create<EditorState>((set) => ({
  composition: initialComposition,
  currentTime: 0,
  playing: false,
  fileName: "test04.json",
  selectedElementId: null,

  setComposition: (composition, fileName) =>
    set({ composition, fileName: fileName ?? null, currentTime: 0, playing: false, selectedElementId: null }),

  setCurrentTime: (currentTime) => set({ currentTime }),

  setPlaying: (playing) => set({ playing }),

  setSelectedElementId: (selectedElementId) => set({ selectedElementId }),
}));

export { parseComposition };
