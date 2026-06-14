
export type ConnectionState = "Waiting" | "Pairing" | "Connected" | "Transferring" | "Completed" | "Failed";

export interface TransferProgress {
  progress: number;
  total: number;
  current: number;
  fileName?: string;
}

type Listener = (...args: any[]) => void;

export class WebRTCPeer {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private state: ConnectionState = "Waiting";
  private listeners: Record<string, Listener[]> = {};

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });

    this.pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === "connected") {
        this.updateState("Connected");
      } else if (this.pc.iceConnectionState === "failed" || this.pc.iceConnectionState === "disconnected") {
        this.updateState("Failed");
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setDataChannel(event.channel);
    };
  }

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  private emit(event: string, ...args: any[]) {
    this.listeners[event]?.forEach(l => l(...args));
  }

  private updateState(state: ConnectionState) {
    this.state = state;
    this.emit("stateChange", state);
  }

  private setDataChannel(channel: RTCDataChannel) {
    this.dc = channel;
    this.dc.onopen = () => this.updateState("Connected");
    this.dc.onclose = () => this.updateState("Waiting");
    this.dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.emit("message", data);
      } catch (err) {
        console.error("Failed to parse data channel message", err);
      }
    };
  }

  async createOffer(): Promise<string> {
    this.dc = this.pc.createDataChannel("transfer");
    this.setDataChannel(this.dc);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === "complete") {
        resolve(btoa(JSON.stringify(this.pc.localDescription)));
      } else {
        this.pc.onicecandidate = (event) => {
          if (event.candidate === null) {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        };
      }
    });
  }

  async acceptOffer(offerStr: string): Promise<string> {
    const offer = JSON.parse(atob(offerStr));
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return new Promise((resolve) => {
       if (this.pc.iceGatheringState === "complete") {
        resolve(btoa(JSON.stringify(this.pc.localDescription)));
      } else {
        this.pc.onicecandidate = (event) => {
          if (event.candidate === null) {
            resolve(btoa(JSON.stringify(this.pc.localDescription)));
          }
        };
      }
    });
  }

  async acceptAnswer(answerStr: string) {
    const answer = JSON.parse(atob(answerStr));
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  send(data: any) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  destroy() {
    this.pc.close();
    this.listeners = {};
  }

  getState() {
    return this.state;
  }
}
