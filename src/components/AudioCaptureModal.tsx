import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Square, X, Check, RotateCcw, Play, Pause, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioCaptureModalProps {
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function AudioCaptureModal({ onClose, onCapture }: AudioCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedAudio, setCapturedAudio] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      onClose();
    }
  };

  useEffect(() => {
    if (capturedAudio) {
      const url = URL.createObjectURL(capturedAudio);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [capturedAudio]);

  useEffect(() => {
    if (capturedAudio) return;

    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const startMic = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          s.getTracks().forEach(track => track.stop());
          return;
        }
        setStream(s);
        setErrorMsg("");
      } catch (err: any) {
        console.error("Mic access error:", err);
        setErrorMsg(err.message || "Failed to access microphone");
      }
    };

    startMic();

    return () => {
      isMounted = false;
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [capturedAudio]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = () => {
    if (!stream) return;
    audioChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus') ? 'audio/webm; codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setCapturedAudio(blob);
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mediaRecorderRef.current = mr;
      mr.start(200);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.error(e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const retake = () => {
    setCapturedAudio(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    setIsPlaying(false);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (capturedAudio) {
        const file = new File([capturedAudio], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        onCapture(file);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/10 dark:border-white/15 rounded-full shadow-2xl flex items-center w-max max-w-[95vw] p-1.5 ring-1 ring-black/5 dark:ring-white/5">
        {!capturedAudio ? (
          <>
            {errorMsg ? (
              <div className="flex items-center gap-3 px-4 py-2">
                <Mic size={16} className="text-red-500" />
                <span className="text-sm font-medium text-red-500">{errorMsg}</span>
                <button onClick={onClose} className="ml-2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pr-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 shrink-0">
                  <div className={cn("w-3 h-3 rounded-full bg-red-500", isRecording && "animate-pulse")} />
                </div>
                
                <span className="text-black/80 dark:text-white/90 font-mono text-sm tracking-wider min-w-[45px] text-center shrink-0">
                  {formatTime(recordingTime)}
                </span>
                
                <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
                
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 shrink-0",
                    isRecording 
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                      : "bg-black/5 dark:bg-white/10 text-black/80 dark:text-white hover:bg-black/10 dark:hover:bg-white/20"
                  )}
                >
                  {isRecording ? (
                    <><Square size={14} className="fill-current" /> Stop</>
                  ) : (
                    <><Mic size={14} /> Start</>
                  )}
                </button>
                
                {!isRecording && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 shrink-0 bg-black/5 dark:bg-white/10 text-black/80 dark:text-white hover:bg-black/10 dark:hover:bg-white/20"
                    >
                      <Upload size={14} /> Upload
                    </button>
                    <input
                      type="file"
                      accept="audio/*"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </>
                )}
                
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors ml-1 shrink-0">
                  <X size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1 pl-3 pr-1 py-1">
            <button onClick={togglePlay} className="w-8 h-8 shrink-0 flex items-center justify-center bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 dark:hover:bg-white/20 text-black/80 dark:text-white transition-colors">
              {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
            </button>
            <span className="text-black/60 dark:text-white/70 text-xs mx-2 font-mono shrink-0">
              {formatTime(Math.floor(playbackTime))} / {formatTime(recordingTime)}
            </span>
            
            <audio 
              ref={audioRef} 
              src={audioUrl || undefined} 
              onEnded={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
              }} 
              onTimeUpdate={() => {
                if (audioRef.current) setPlaybackTime(audioRef.current.currentTime);
              }}
              className="hidden" 
            />
            
            <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1 shrink-0" />
            
            <button 
              onClick={retake}
              className="px-2.5 py-1.5 shrink-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/60 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Retake
            </button>
            
            <button 
              onClick={handleSave}
              disabled={isProcessing}
              className="px-3 py-1.5 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 ml-0.5 shadow-md shadow-blue-500/20"
            >
              <Check size={14} /> {isProcessing ? 'Saving...' : 'Save'}
            </button>
            
            <button onClick={onClose} className="p-1.5 shrink-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-black/40 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors ml-0.5">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
