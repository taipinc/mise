import { create } from "zustand";
import type { MiseComposition, MiseElement, MiseStage } from "@mise/core";
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
  updateElement: (id: string, patch: DeepPartial<MiseElement>) => void;
  updateStage: (patch: DeepPartial<MiseStage>) => void;
}

// Recursive partial that works for objects but leaves primitives alone
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal merge utility, typed at call sites
function deepMerge(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    const patchVal = patch[key];
    const targetVal = target[key];
    if (
      patchVal !== undefined &&
      patchVal !== null &&
      typeof patchVal === "object" &&
      !Array.isArray(patchVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, patchVal);
    } else if (patchVal !== undefined) {
      result[key] = patchVal;
    }
  }
  return result;
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

  updateElement: (id, patch) =>
    set((state) => ({
      composition: {
        ...state.composition,
        elements: state.composition.elements.map((el) =>
          el.id === id ? (deepMerge(el, patch) as MiseElement) : el
        ),
      },
    })),

  updateStage: (patch) =>
    set((state) => ({
      composition: {
        ...state.composition,
        stage: deepMerge(state.composition.stage, patch) as MiseStage,
      },
    })),
}));

export { parseComposition };
export type { DeepPartial };
