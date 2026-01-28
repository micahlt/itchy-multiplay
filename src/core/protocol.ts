export interface MultiPlayConfig {
  // The WebSocket URL for the signaling server
  signalingUrl: string;

  webrtc?: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize?: number;
  };

  // Credentials for a TURN server (optional)
  turn?: {
    serverUrl: string;
    username: string;
    credential: string;
  };

  // Platform-specific WebRTC runtime (required for React Native)
  runtime?: {
    RTCPeerConnection: any;
    RTCSessionDescription: any;
    RTCIceCandidate: any;
  };

  logLevel?: "debug" | "info" | "warn" | "error";
}

export type MultiPlayStatus =
  | "initial-connect"
  | "connected-signaling"
  | "connected-joining"
  | "waiting-host"
  | "join-failed"
  | "signaling-creating-answer"
  | "signaling-setting-remote"
  | "disconnected-host"
  | "error-socket"
  | "disconnected-closed"
  | "peer-joined";

export type MultiPlayEvents =
  | { type: "status"; payload: MultiPlayStatus }
  | { type: "stream"; payload: MediaStream }
  | { type: "metadata"; payload: object }
  | { type: "connectionState"; payload: RTCIceConnectionState }
  | { type: "error"; payload: string }
  | { type: "disconnected"; payload: void };

/** The Scratch stage places coordinates 0,0 in the center, not the bottom left */
export interface ScratchCoords {
  x: number;
  y: number;
}

/** A virtual machine that implements properties similar to the Scratch VM */
export interface ScratchLikeVirtualMachine {
  applyInput(data: {
    key: string;
    type: string;
    coords?: { x: number; y: number };
  }): void;
  getCanvas(): HTMLCanvasElement | null;
}
