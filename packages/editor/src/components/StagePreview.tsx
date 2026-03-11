import { useEffect, useRef, useCallback } from "react";
import { create } from "zustand";
import { useEditorStore } from "../store";
import { sendCommand, listenToPlayer } from "../lib/player-bridge";

// Shared ref so Toolbar can access the iframe
interface PlayerRefState {
  iframe: HTMLIFrameElement | null;
  setIframe: (iframe: HTMLIFrameElement | null) => void;
}
export const usePlayerRef = create<PlayerRefState>((set) => ({
  iframe: null,
  setIframe: (iframe) => set({ iframe }),
}));

const PLAYER_ORIGIN = "http://localhost:5173";

export function StagePreview(): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const composition = useEditorStore((s) => s.composition);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);

  // Register iframe ref globally
  useEffect(() => {
    usePlayerRef.getState().setIframe(iframeRef.current);
    return () => usePlayerRef.getState().setIframe(null);
  }, []);

  // Listen for messages from the player
  useEffect(() => {
    return listenToPlayer({
      onTick: (time) => setCurrentTime(time),
      onStateChange: (state) => setPlaying(state === "playing"),
    });
  }, [setCurrentTime, setPlaying]);

  // When composition changes, send it to the player once the iframe is ready
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    sendCommand(iframe, "load", composition);
  }, [composition]);

  // Re-send composition when store changes (e.g. file open)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    sendCommand(iframe, "load", composition);
  }, [composition]);

  return (
    <div className="flex h-full items-center justify-center bg-[oklch(0.10_0_0)] p-2">
      <iframe
        ref={iframeRef}
        src={PLAYER_ORIGIN}
        onLoad={handleIframeLoad}
        className="h-full w-full rounded border border-border"
        style={{ background: "#000" }}
        allow="autoplay"
      />
    </div>
  );
}
