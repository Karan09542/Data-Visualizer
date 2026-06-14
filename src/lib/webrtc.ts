
import LZString from "lz-string";

export function compressSDP(sdp: string): string {
  const lines = sdp.split(/\r?\n/);
  
  let ufrag = "";
  let pwd = "";
  let fingerprint = "";
  let setup = "actpass";
  let mid = "0";
  const candidates: any[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("a=ice-ufrag:")) {
      ufrag = trimmed.substring(12).trim();
    } else if (trimmed.startsWith("a=ice-pwd:")) {
      pwd = trimmed.substring(10).trim();
    } else if (trimmed.startsWith("a=fingerprint:")) {
      fingerprint = trimmed.substring(14).trim();
    } else if (trimmed.startsWith("a=setup:")) {
      setup = trimmed.substring(8).trim();
    } else if (trimmed.startsWith("a=mid:")) {
      mid = trimmed.substring(6).trim();
    } else if (trimmed.startsWith("a=candidate:")) {
      const parts = trimmed.substring(12).split(" ");
      if (parts.length >= 8) {
        const lower = trimmed.toLowerCase();
        // Skip IPv6 candidates to keep QR code extremely small
        if (lower.includes("ip6")) continue;
        
        const candObj: any = {
          f: parts[0],  // foundation
          c: parts[1],  // component
          pr: parts[2], // protocol (udp/tcp)
          py: parts[3], // priority
          ip: parts[4], // ip
          po: parts[5], // port
          t: parts[7]   // type (host/srflx/relay)
        };
        
        for (let i = 8; i < parts.length - 1; i++) {
          if (parts[i] === "raddr") {
            candObj.ra = parts[i+1];
          } else if (parts[i] === "rport") {
            candObj.rp = parts[i+1];
          }
        }
        candidates.push(candObj);
      }
    }
  }

  // Keep a maximum of 3 candidates to keep the QR code extremely lightweight and low density
  const selectedCandidates = candidates.slice(0, 3);

  const minObj = {
    u: ufrag,
    p: pwd,
    f: fingerprint,
    s: setup,
    m: mid,
    c: selectedCandidates
  };

  return LZString.compressToEncodedURIComponent(JSON.stringify(minObj));
}

export function decompressSDP(compressed: string): string {
  const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
  if (!decompressed) {
    throw new Error("Failed to decompress SDP data");
  }

  const data = JSON.parse(decompressed);
  
  const sdpLines = [
    "v=0",
    "o=- 81273918273 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE " + (data.m || "0"),
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    "a=mid:" + (data.m || "0"),
    "a=sctp-port:5000",
    "a=setup:" + (data.s || "actpass"),
    "a=ice-ufrag:" + data.u,
    "a=ice-pwd:" + data.p,
    "a=fingerprint:" + data.f,
  ];

  if (Array.isArray(data.c)) {
    for (const cand of data.c) {
      let candLine = `a=candidate:${cand.f} ${cand.c} ${cand.pr} ${cand.py} ${cand.ip} ${cand.po} typ ${cand.t}`;
      if (cand.ra) candLine += ` raddr ${cand.ra}`;
      if (cand.rp) candLine += ` rport ${cand.rp}`;
      sdpLines.push(candLine);
    }
  }

  return sdpLines.join("\r\n") + "\r\n";
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
          resolve("O:" + compressed);
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
    
    let decompressed = "";
    try {
      decompressed = decompressSDP(sdp);
    } catch (err) {
      try {
        decompressed = decompressSDP(atob(sdp));
      } catch (innerErr) {
        throw new Error("Invalid SDP format");
      }
    }

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
          resolve("A:" + compressed);
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
    
    let decompressed = "";
    try {
      decompressed = decompressSDP(sdp);
    } catch (err) {
      try {
        decompressed = decompressSDP(atob(sdp));
      } catch (innerErr) {
        throw new Error("Invalid SDP format");
      }
    }

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
