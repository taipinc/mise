import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";

const DEBOUNCE_MS = 400;

interface CssEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CssEditor({ value, onChange }: CssEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track the last value we pushed to the store so we can skip echoed updates
  const lastEmittedRef = useRef(value);

  const handleUpdate = useCallback((newValue: string) => {
    lastEmittedRef.current = newValue;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newValue);
    }, DEBOUNCE_MS);
  }, []);

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        css(),
        oneDark,
        keymap.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleUpdate(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "12px" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "ui-monospace, monospace" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      clearTimeout(debounceRef.current);
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. file open) into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    // Skip if the change originated from our own edits
    if (value === lastEmittedRef.current) return;

    const currentDoc = view.state.doc.toString();
    if (value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
      lastEmittedRef.current = value;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="min-h-[200px] flex-1 overflow-hidden rounded border border-border"
    />
  );
}
