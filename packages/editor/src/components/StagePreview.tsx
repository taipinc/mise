import { useEffect, useRef, useState, useCallback } from "react";
import { create } from "zustand";
import { useEditorStore } from "../store";
import { sendCommand, listenToPlayer } from "../lib/player-bridge";

// Shared ref so Toolbar and Timeline can access the iframe
interface PlayerRefState {
  iframe: HTMLIFrameElement | null;
  setIframe: (iframe: HTMLIFrameElement | null) => void;
}
export const usePlayerRef = create<PlayerRefState>((set) => ({
  iframe: null,
  setIframe: (iframe) => set({ iframe }),
}));

const PLAYER_ORIGIN = "http://localhost:5173";
const RELOAD_DEBOUNCE_MS = 300;

export function StagePreview(): React.JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const composition = useEditorStore((s) => s.composition);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const iframeReady = useRef(false);

  const viewBox = composition.stage.viewBox;
  const aspectRatio = viewBox.width / viewBox.height;

  // Aspect-ratio-fitted iframe dimensions
  const [iframeSize, setIframeSize] = useState<{ width: number; height: number }>({
    width: viewBox.width,
    height: viewBox.height,
  });

  // Recompute iframe size when container resizes or aspect ratio changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recompute = (): void => {
      const padding = 16; // 8px on each side
      const maxW = container.clientWidth - padding;
      const maxH = container.clientHeight - padding;
      if (maxW <= 0 || maxH <= 0) return;

      let w = maxW;
      let h = w / aspectRatio;
      if (h > maxH) {
        h = maxH;
        w = h * aspectRatio;
      }
      setIframeSize({ width: Math.round(w), height: Math.round(h) });
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [aspectRatio]);

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

  // Send composition + restore playback state
  const loadComposition = useCallback(
    (iframe: HTMLIFrameElement) => {
      const { currentTime, playing } = useEditorStore.getState();
      sendCommand(iframe, "load", composition);
      // Restore playback position and state after a short delay
      // to let the player finish mounting the new instance
      setTimeout(() => {
        if (currentTime > 0) {
          sendCommand(iframe, "seek", currentTime);
        }
        if (playing) {
          sendCommand(iframe, "play");
        }
      }, 50);
    },
    [composition]
  );

  // When the iframe first loads, send the composition
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframeReady.current = true;
    loadComposition(iframe);
  }, [loadComposition]);

  // Re-send composition when store changes — debounced
  useEffect(() => {
    if (!iframeReady.current) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      loadComposition(iframe);
    }, RELOAD_DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer.current);
  }, [composition, loadComposition]);

  return (
    <div
      ref={containerRef}
      className="flex h-full items-center justify-center bg-[oklch(0.10_0_0)]"
    >
      <iframe
        ref={iframeRef}
        src={PLAYER_ORIGIN}
        onLoad={handleIframeLoad}
        className="rounded border border-border"
        style={{
          width: iframeSize.width,
          height: iframeSize.height,
          background: "#000",
        }}
        allow="autoplay"
      />
    </div>
  );
}
