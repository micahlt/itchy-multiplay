
//#region src/core/kernel.ts
var MultiPlayKernel = class {
	pc = null;
	socket = null;
	dataChannel = null;
	iceServers;
	roomCode = "";
	projectMetadata = null;
	canvasStream = null;
	RTCPeerConnection;
	RTCSessionDescription;
	RTCIceCandidate;
	onEvent = () => {};
	onStreamReceived = () => {};
	/**
	* Creates a new MultiPlayKernel instance.
	* @param config - Configuration object containing signaling URL, TURN credentials, and WebRTC runtime.
	* @param engine - A virtual machine that implements properties similar to the Scratch VM
	*/
	constructor(config, engine) {
		this.config = config;
		this.engine = engine;
		this.RTCPeerConnection = config.runtime?.RTCPeerConnection || globalThis.RTCPeerConnection;
		this.RTCSessionDescription = config.runtime?.RTCSessionDescription || globalThis.RTCSessionDescription;
		this.RTCIceCandidate = config.runtime?.RTCIceCandidate || globalThis.RTCIceCandidate;
		this.iceServers = config.webrtc?.iceServers || [{ urls: "stun:stun.l.google.com:19302" }];
		if (config.turn && config.turn.serverUrl && config.turn.username && config.turn.credential) {
			const { serverUrl, username, credential } = config.turn;
			this.iceServers.push({
				urls: `turn:${serverUrl}:80`,
				username,
				credential
			}, {
				urls: `turn:${serverUrl}:80?transport=tcp`,
				username,
				credential
			}, {
				urls: `turn:${serverUrl}:443`,
				username,
				credential
			}, {
				urls: `turns:${serverUrl}:443?transport=tcp`,
				username,
				credential
			});
		}
	}
	/**
	* Creates and hosts a new MultiPlay room.
	* Establishes WebSocket connection to signaling server, generates a room code,
	* and sets up peer connection when a client joins.
	* Requires an engine with canvas streaming capabilities for the host role.
	*/
	async host() {
		this.onStatusChange("initial-connect");
		this.socket = new WebSocket(this.config.signalingUrl);
		this.socket.onopen = () => {
			this.send({ type: "create" });
		};
		this.socket.onmessage = async (event) => {
			const msg = JSON.parse(event.data);
			switch (msg.type) {
				case "room-created":
					this.roomCode = msg.payload.roomCode;
					this.emit("status", `Room Created: ${this.roomCode}`);
					break;
				case "peer-joined":
					this.onStatusChange("peer-joined");
					await this.setupHostPeer();
					break;
				case "signal":
					await this.handleSignaling(msg.payload);
					break;
			}
		};
	}
	/**
	* Configures the peer connection for the host side.
	* Creates a data channel, starts canvas streaming, and sends an SDP offer to the client.
	* @private
	*/
	async setupHostPeer() {
		await this.initializePeerConnection();
		this.dataChannel = this.pc.createDataChannel("metadata", { ordered: false });
		this.setupDataChannelHandlers();
		await this.startStreaming();
		const offer = await this.pc.createOffer();
		await this.pc.setLocalDescription(offer);
		this.send({
			type: "signal",
			payload: {
				type: "offer",
				sdp: offer.sdp,
				sdpType: offer.type,
				roomCode: this.roomCode
			}
		});
	}
	/**
	* Captures the canvas stream from the engine and adds it to the peer connection.
	* Configures video tracks to 640x480 resolution at 60 FPS.
	* @throws Error if canvas.captureStream is not supported.
	* @private
	*/
	async startStreaming() {
		const canvas = this.engine?.getCanvas();
		if (!canvas || !canvas.captureStream) throw new Error("Canvas captureStream not supported");
		this.canvasStream = canvas.captureStream(60);
		this.canvasStream.getTracks().forEach((track) => {
			track.applyConstraints({
				width: 640,
				height: 480
			});
			this.pc.addTrack(track, this.canvasStream);
		});
	}
	/**
	* Joins a MultiPlay room using a 6-character room code.
	* Establishes WebSocket connection to signaling server and initializes peer connection.
	* @param code - The 6-character room code to join.
	*/
	async joinRoom(code) {
		this.onStatusChange("initial-connect");
		this.socket = new WebSocket(this.config.signalingUrl);
		this.roomCode = code;
		this.socket.onopen = () => {
			this.onStatusChange("connected-joining");
			this.send({
				type: "join",
				payload: { roomCode: code }
			});
		};
		this.socket.onmessage = async (event) => {
			const { type, payload } = JSON.parse(event.data);
			switch (type) {
				case "join-success":
					this.onStatusChange("waiting-host");
					await this.initializePeerConnection();
					break;
				case "join-failed":
					this.onStatusChange("join-failed");
					break;
				case "signal":
					await this.handleSignaling(payload);
					break;
				case "peer-disconnected":
					this.cleanup();
					this.onStatusChange("disconnected-host");
			}
		};
	}
	/**
	* Initializes the WebRTC peer connection with configured ICE servers.
	* Sets up event handlers for ICE candidates, tracks, data channels, and connection state changes.
	* @private
	*/
	async initializePeerConnection() {
		this.pc = new this.RTCPeerConnection({ iceServers: this.iceServers });
		if (!this.pc) throw new Error("Empty peer connection");
		this.pc.onicecandidate = (event) => {
			if (event.candidate) this.send({
				type: "signal",
				payload: {
					roomCode: this.roomCode,
					candidate: event.candidate,
					type: "candidate"
				}
			});
		};
		this.pc.ontrack = (event) => {
			if (event.streams && event.streams[0]) this.emit("stream", event.streams[0]);
		};
		this.pc.ondatachannel = (event) => {
			this.dataChannel = event.channel;
			this.setupDataChannelHandlers();
		};
		this.pc.onconnectionstatechange = () => {
			this.emit("connectionState", this.pc?.connectionState);
		};
	}
	/**
	* Configures event handlers for the WebRTC data channel.
	* Handles incoming messages including project metadata.
	* @private
	*/
	setupDataChannelHandlers() {
		if (!this.dataChannel) return;
		this.dataChannel.onopen = () => this.emit("status", "Data channel connected.");
		this.dataChannel.onmessage = (event) => {
			const message = JSON.parse(event.data);
			if (message.type === "PROJECT_METADATA") this.emit("metadata", message.payload);
			else if (!!this.engine) this.engine?.applyInput(message);
		};
	}
	/**
	* Sends a key or mouse event to the host via the WebRTC data channel.
	* Events are serialized as JSON and transmitted to the host for game input synchronization.
	* @param key - The key string (e.g., 'space', 'left arrow') or mouse action ('up', 'down', 'move').
	* @param type - The type of event: 'keydown', 'keyup', or 'mouse'.
	* @param coords - Scratch coordinate system coordinates for mouse events (default: {x: 0, y: 0}).
	* @throws Emits an error event if the data channel is not open.
	*/
	sendKeyEvent(key, type, coords = {
		x: 0,
		y: 0
	}) {
		if (this.dataChannel && this.dataChannel.readyState === "open") {
			const payload = {
				key,
				type,
				coords
			};
			this.dataChannel.send(JSON.stringify(payload));
			if (this.config.logLevel === "debug") console.log(`[MultiPlay] Sent ${type}: ${key}`, coords);
		} else {
			console.warn("[MultiPlay] Data channel not open. Event dropped:", key);
			this.emit("error", "Input synchronization failed: Data channel disconnected.");
		}
	}
	/**
	* Handles incoming WebRTC signaling messages from the signaling server.
	* Processes SDP offers/answers and ICE candidates for establishing peer connection.
	* @param payload - Signaling payload containing SDP or ICE candidate data.
	* @private
	*/
	async handleSignaling(payload) {
		if (!this.pc) {
			console.warn("[MultiPlay] Peer connection not ready, ignoring signal");
			return;
		}
		const { sdp, candidate } = payload;
		if (sdp) {
			const remoteDescription = {
				type: payload.sdpType || "offer",
				sdp
			};
			if (remoteDescription.type === "offer") {
				if (this.pc.currentRemoteDescription) return;
				this.emit("status", "Creating answer for host...");
				await this.pc?.setRemoteDescription(new this.RTCSessionDescription(remoteDescription));
				const answer = await this.pc.createAnswer();
				await this.pc.setLocalDescription(answer);
				this.socket?.send(JSON.stringify({
					type: "signal",
					payload: {
						roomCode: this.roomCode,
						type: "answer",
						sdp: this.pc?.localDescription?.sdp
					}
				}));
			} else if (remoteDescription.type === "answer") {
				this.onStatusChange("signaling-setting-remote");
				await this.pc?.setRemoteDescription(new this.RTCSessionDescription(remoteDescription));
			}
		}
		if (candidate) try {
			await this.pc?.addIceCandidate(new this.RTCIceCandidate(candidate));
		} catch (err) {
			if (this.config.logLevel === "debug") console.warn("[MultiPlay] Failed to add ICE candidate:", err);
		}
	}
	/**
	* Updates the connection status and emits a status event.
	* @param status - The new MultiPlay connection status.
	* @param extra - Optional additional data associated with the status change.
	* @private
	*/
	onStatusChange(status, extra) {
		this.emit("status", status);
	}
	/**
	* Emits an event to the onEvent callback handler.
	* @param type - The type of event to emit.
	* @param data - The payload data for the event.
	* @private
	*/
	emit(type, data) {
		this.onEvent({
			type,
			payload: data
		});
	}
	/**
	* Sends a message to the signaling server via WebSocket.
	* @param data - The data object to serialize and send.
	* @private
	*/
	send(data) {
		this.socket?.send(JSON.stringify(data));
	}
	/**
	* Cleans up all active connections and resources.
	* Closes the data channel, peer connection, and WebSocket, then resets internal state.
	* Should be called when leaving a room or on component unmount.
	*/
	cleanup() {
		if (this.dataChannel) {
			this.dataChannel.onmessage = null;
			this.dataChannel.onopen = null;
			this.dataChannel.onclose = null;
			this.dataChannel.close();
			this.dataChannel = null;
		}
		if (this.pc) {
			this.pc.getSenders().forEach((sender) => {
				if (sender.track) sender.track.stop();
			});
			this.pc.close();
			this.pc = null;
		}
		if (this.socket) {
			this.socket.onmessage = null;
			this.socket.onopen = null;
			this.socket.onclose = null;
			this.socket.close();
			this.socket = null;
		}
		this.roomCode = "";
		this.emit("status", "Idle");
		this.emit("disconnected", void 0);
	}
};

//#endregion
//#region src/engines/turbowarp.ts
/** Implements a virtual machine compatible with TurboWarp */
var TurbowarpVMEngine = class {
	activeKeys = /* @__PURE__ */ new Set();
	mouseButtons = /* @__PURE__ */ new Set();
	getCanvas() {
		return document.querySelector("canvas");
	}
	applyInput(data) {
		const vm = window.vm;
		const keyboard = vm?.runtime?.ioDevices?.keyboard;
		const mouse = vm?.runtime?.ioDevices?.mouse;
		if (data.type === "keydown" || data.type === "keyup") {
			const twKey = keyboard?._keyStringToScratchKey(data.key);
			if (!twKey) return;
			if (data.type === "keydown") this.activeKeys.add(twKey);
			else this.activeKeys.delete(twKey);
			keyboard._keysPressed = Array.from(this.activeKeys);
		} else if (data.type === "mouse") {
			if (mouse) {
				mouse._scratchX = data.coords.x;
				mouse._scratchY = data.coords.y;
				if (data.key === "down") this.mouseButtons.add(0);
				else if (data.key === "up") this.mouseButtons.clear();
				mouse._buttons = Array.from(this.mouseButtons);
			}
		}
	}
};

//#endregion
exports.MultiPlayKernel = MultiPlayKernel;
exports.TurbowarpVMEngine = TurbowarpVMEngine;