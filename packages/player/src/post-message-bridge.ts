import type { MisePlayer } from "./player";
import type { Clock } from "@mise/core";

/**
 * postMessage protocol between editor (parent) and player (iframe).
 *
 * Inbound (editor → player):
 *   { type: "mise:command", command: "play" }
 *   { type: "mise:command", command: "pause" }
 *   { type: "mise:command", command: "seek", time: number }
 *
 * Outbound (player → editor):
 *   { type: "mise:tick", time: number }
 *   { type: "mise:stateChange", state: "playing" | "paused" }
 */

interface MiseCommand {
  type: "mise:command";
  command: "play" | "pause" | "seek";
  time?: number;
}

export interface MiseTickMessage {
  type: "mise:tick";
  time: number;
}

export interface MiseStateChangeMessage {
  type: "mise:stateChange";
  state: "playing" | "paused";
}

export type MiseOutboundMessage = MiseTickMessage | MiseStateChangeMessage;

const TICK_THROTTLE_MS = 100; // ~10fps

export class PostMessageBridge {
  private readonly player: MisePlayer;
  private readonly clock: Clock;
  private readonly boundOnMessage: (event: MessageEvent) => void;
  private readonly tickHandler: () => void;
  private lastTickSent: number = 0;

  constructor(player: MisePlayer) {
    this.player = player;
    this.clock = player.getClock();

    this.boundOnMessage = (event: MessageEvent) => this.onMessage(event);
    window.addEventListener("message", this.boundOnMessage);

    this.tickHandler = () => {
      const now = performance.now();
      if (now - this.lastTickSent < TICK_THROTTLE_MS) return;
      this.lastTickSent = now;
      this.send({ type: "mise:tick", time: this.clock.currentTime });
    };
    this.clock.on("tick", this.tickHandler);
  }

  /** Notify the editor that play/pause state changed. */
  notifyStateChange(state: "playing" | "paused"): void {
    this.send({ type: "mise:stateChange", state });
  }

  destroy(): void {
    window.removeEventListener("message", this.boundOnMessage);
    this.clock.off("tick", this.tickHandler);
  }

  private onMessage(event: MessageEvent): void {
    const data = event.data as Partial<MiseCommand> | undefined;
    if (!data || data.type !== "mise:command") return;

    switch (data.command) {
      case "play":
        this.player.play();
        break;
      case "pause":
        this.player.pause();
        break;
      case "seek":
        if (typeof data.time === "number" && Number.isFinite(data.time)) {
          this.player.seek(data.time);
        }
        break;
    }
  }

  private send(message: MiseOutboundMessage): void {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }
}
