//#region src/core/protocol.d.ts
interface MultiPlayConfig {
  signalingUrl: string;
  webrtc?: {
    iceServers: RTCIceServer[];
    iceCandidatePoolSize?: number;
  };
  turn?: {
    serverUrl: string;
    username: string;
    credential: string;
  };
  runtime?: {
    RTCPeerConnection: any;
    RTCSessionDescription: any;
    RTCIceCandidate: any;
  };
  logLevel?: "debug" | "info" | "warn" | "error";
}
type MultiPlayStatus = "initial-connect" | "connected-signaling" | "connected-joining" | "waiting-host" | "join-failed" | "signaling-creating-answer" | "signaling-setting-remote" | "disconnected-host" | "error-socket" | "disconnected-closed" | "peer-joined";
type MultiPlayEvents = {
  type: "status";
  payload: MultiPlayStatus;
} | {
  type: "stream";
  payload: MediaStream;
} | {
  type: "metadata";
  payload: object;
} | {
  type: "connectionState";
  payload: RTCIceConnectionState;
} | {
  type: "error";
  payload: string;
} | {
  type: "disconnected";
  payload: void;
};
/** The Scratch stage places coordinates 0,0 in the center, not the bottom left */
interface ScratchCoords {
  x: number;
  y: number;
}
/** A virtual machine that implements properties similar to the Scratch VM */
interface ScratchLikeVirtualMachine {
  applyInput(data: {
    key: string;
    type: string;
    coords?: {
      x: number;
      y: number;
    };
  }): void;
  getCanvas(): HTMLCanvasElement | null;
}
//#endregion
//#region src/core/kernel.d.ts
declare class MultiPlayKernel {
  private config;
  private engine?;
  private pc;
  private socket;
  private dataChannel;
  private iceServers;
  roomCode: string;
  projectMetadata: any | null;
  private canvasStream;
  private RTCPeerConnection;
  private RTCSessionDescription;
  private RTCIceCandidate;
  onEvent: (event: MultiPlayEvents) => void;
  onStreamReceived: (stream: MediaStream) => void;
  /**
   * Creates a new MultiPlayKernel instance.
   * @param config - Configuration object containing signaling URL, TURN credentials, and WebRTC runtime.
   * @param engine - A virtual machine that implements properties similar to the Scratch VM
   */
  constructor(config: MultiPlayConfig, engine?: ScratchLikeVirtualMachine);
  /**
   * Creates and hosts a new MultiPlay room.
   * Establishes WebSocket connection to signaling server, generates a room code,
   * and sets up peer connection when a client joins.
   * Requires an engine with canvas streaming capabilities for the host role.
   */
  host(): Promise<void>;
  /**
   * Configures the peer connection for the host side.
   * Creates a data channel, starts canvas streaming, and sends an SDP offer to the client.
   * @private
   */
  private setupHostPeer;
  /**
   * Captures the canvas stream from the engine and adds it to the peer connection.
   * Configures video tracks to 640x480 resolution at 60 FPS.
   * @throws Error if canvas.captureStream is not supported.
   * @private
   */
  private startStreaming;
  /**
   * Joins a MultiPlay room using a 6-character room code.
   * Establishes WebSocket connection to signaling server and initializes peer connection.
   * @param code - The 6-character room code to join.
   */
  joinRoom(code: string): Promise<void>;
  /**
   * Initializes the WebRTC peer connection with configured ICE servers.
   * Sets up event handlers for ICE candidates, tracks, data channels, and connection state changes.
   * @private
   */
  private initializePeerConnection;
  /**
   * Configures event handlers for the WebRTC data channel.
   * Handles incoming messages including project metadata.
   * @private
   */
  private setupDataChannelHandlers;
  /**
   * Sends a key or mouse event to the host via the WebRTC data channel.
   * Events are serialized as JSON and transmitted to the host for game input synchronization.
   * @param key - The key string (e.g., 'space', 'left arrow') or mouse action ('up', 'down', 'move').
   * @param type - The type of event: 'keydown', 'keyup', or 'mouse'.
   * @param coords - Scratch coordinate system coordinates for mouse events (default: {x: 0, y: 0}).
   * @throws Emits an error event if the data channel is not open.
   */
  sendKeyEvent(key: string, type: "keydown" | "keyup" | "mouse", coords?: ScratchCoords): void;
  /**
   * Handles incoming WebRTC signaling messages from the signaling server.
   * Processes SDP offers/answers and ICE candidates for establishing peer connection.
   * @param payload - Signaling payload containing SDP or ICE candidate data.
   * @private
   */
  private handleSignaling;
  /**
   * Updates the connection status and emits a status event.
   * @param status - The new MultiPlay connection status.
   * @param extra - Optional additional data associated with the status change.
   * @private
   */
  private onStatusChange;
  /**
   * Emits an event to the onEvent callback handler.
   * @param type - The type of event to emit.
   * @param data - The payload data for the event.
   * @private
   */
  private emit;
  /**
   * Sends a message to the signaling server via WebSocket.
   * @param data - The data object to serialize and send.
   * @private
   */
  private send;
  /**
   * Cleans up all active connections and resources.
   * Closes the data channel, peer connection, and WebSocket, then resets internal state.
   * Should be called when leaving a room or on component unmount.
   */
  cleanup(): void;
}
//#endregion
//#region src/engines/turbowarp.d.ts
/** Implements a virtual machine compatible with TurboWarp */
declare class TurbowarpVMEngine implements ScratchLikeVirtualMachine {
  private activeKeys;
  private mouseButtons;
  getCanvas(): HTMLCanvasElement;
  applyInput(data: any): void;
}
//#endregion
export { MultiPlayConfig, MultiPlayEvents, MultiPlayKernel, MultiPlayStatus, ScratchCoords, ScratchLikeVirtualMachine, TurbowarpVMEngine };