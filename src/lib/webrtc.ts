
export function compressSDP(sdp: string): string {
  const lines = sdp.split(/\r?\n/);
  const remainingLines: string[] = [];
  let candidateCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("a=candidate:")) {
      const lower = trimmed.toLowerCase();
      // Keep only UDP candidates, skip IPv6, limit to max 3 candidates for ultra compactness
      if (lower.includes("udp") && !lower.includes("ip6") && candidateCount < 3) {
        remainingLines.push(trimmed);
        candidateCount++;
      }
    } else if (
      trimmed.startsWith("a=rtcp-") || 
      trimmed.startsWith("a=extmap:") || 
      trimmed.includes("ice-options:trickle")
    ) {
      // Drop optional non-essential metadata to save space
      continue;
    } else {
      remainingLines.push(trimmed);
    }
  }

  let cleanSdp = remainingLines.join("\r\n");

  const replacements: [RegExp, string][] = [
    [/a=fingerprint:sha-256 /g, "F:"],
    [/a=ice-ufrag:/g, "U:"],
    [/a=ice-pwd:/g, "P:"],
    [/a=candidate:/g, "C:"],
    [/a=setup:/g, "S:"],
    [/a=mid:/g, "M:"],
    [/a=sctp-port:5000/g, "K:"],
    [/c=IN IP4 /g, "I:"],
    [/a=max-message-size:/g, "X:"],
    [/a=rtcp-mux/g, "R:"],
    [/a=rtcp-rsize/g, "Z:"],
  ];

  for (const [pattern, rep] of replacements) {
    cleanSdp = cleanSdp.replace(pattern, rep);
  }

  return cleanSdp;
}

export function decompressSDP(compressed: string): string {
  let sdp = compressed;

  const replacements: [string, RegExp][] = [
    ["a=fingerprint:sha-256 ", /F:/g],
    ["a=ice-ufrag:", /U:/g],
    ["a=ice-pwd:", /P:/g],
    ["a=candidate:", /C:/g],
    ["a=setup:", /S:/g],
    ["a=mid:", /M:/g],
    ["a=sctp-port:5000", /K:/g],
    ["c=IN IP4 ", /I:/g],
    ["a=max-message-size:", /X:/g],
    ["a=rtcp-mux", /R:/g],
    ["a=rtcp-rsize", /Z:/g],
  ];

  for (const [rep, pattern] of replacements) {
    sdp = sdp.replace(pattern, rep);
  }

  return sdp;
}

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
      const handleGathered = () => {
        if (this.pc.localDescription) {
          const compressed = compressSDP(this.pc.localDescription.sdp);
          resolve("O:" + btoa(compressed));
        }
      };

      if (this.pc.iceGatheringState === "complete") {
        handleGathered();
      } else {
        this.pc.onicecandidate = (event) => {
          if (event.candidate === null) {
            handleGathered();
          }
        };
      }
    });
  }

  async acceptOffer(offerStr: string): Promise<string> {
    let sdp = offerStr;
    if (sdp.startsWith("O:")) {
      sdp = sdp.slice(2);
    }
    const decompressed = decompressSDP(atob(sdp));

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: "offer",
      sdp: decompressed
    }));
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return new Promise((resolve) => {
      const handleGathered = () => {
        if (this.pc.localDescription) {
          const compressed = compressSDP(this.pc.localDescription.sdp);
          resolve("A:" + btoa(compressed));
        }
      };

      if (this.pc.iceGatheringState === "complete") {
        handleGathered();
      } else {
        this.pc.onicecandidate = (event) => {
          if (event.candidate === null) {
            handleGathered();
          }
        };
      }
    });
  }

  async acceptAnswer(answerStr: string) {
    let sdp = answerStr;
    if (sdp.startsWith("A:")) {
      sdp = sdp.slice(2);
    }
    const decompressed = decompressSDP(atob(sdp));
    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: "answer",
      sdp: decompressed
    }));
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
