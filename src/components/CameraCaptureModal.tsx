import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCcw, Check, ArrowLeft, RotateCw, Image as ImageIcon, Crop } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { cn } from '@/lib/utils';
import getCroppedImg from '../utils/cropImage';

interface CameraCaptureModalProps {
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({ onClose, onCapture }: CameraCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cropper state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    // Check if device has multiple cameras
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      if (videoInputs.length > 1) {
        setHasMultipleCameras(true);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (capturedImage) return; // don't open camera if we already captured

    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (!isMounted) {
           s.getTracks().forEach(track => track.stop());
           return;
        }
        setStream(s);
        setErrorMsg("");
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setErrorMsg(err.message || "Failed to access camera");
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode, capturedImage]);

  // Make sure to clean up the stream when unmounting
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const takePhoto = () => {
    if (!videoRef.current || !stream) return;
    
    // Flash effect
    const videoEl = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // If user-facing, it's often mirrored in preview but we want to capture it properly?
    // Usually we just draw as is, or mirror it if needed.
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    
    // Stop camera
    stream.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const retake = () => {
    setCapturedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(undefined);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    
    try {
      let finalBlob: Blob | null;
      if (croppedAreaPixels) {
        finalBlob = await getCroppedImg(capturedImage, croppedAreaPixels, rotation);
      } else {
        // Just convert base64 to blob if no crop was applied?
        const res = await fetch(capturedImage);
        finalBlob = await res.blob();
      }
      
      if (finalBlob) {
        const file = new File([finalBlob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        onClose();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCropPresets = () => (
    <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar bg-black items-center shrink-0 w-full z-10 bottom-safe">
      {[ 
         { label: 'Free', value: undefined }, 
         { label: '1:1', value: 1 }, 
         { label: '4:3', value: 4/3 }, 
         { label: '16:9', value: 16/9 },
         { label: '3:4', value: 3/4 }
      ].map(preset => (
        <button 
          key={preset.label}
          onClick={() => setAspect(preset.value)}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors", 
            aspect === preset.value ? "bg-blue-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
          )}
        >
          {preset.label}
        </button>
      ))}
      
      <div className="w-px h-6 bg-white/20 mx-1 shrink-0" />
      
      <button 
         onClick={() => setRotation(r => (r + 90) % 360)}
         className="px-3 py-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 shrink-0"
         title="Rotate 90°"
      >
        <RotateCw size={14} />
      </button>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center">
       {/* Top Bar */}
       <div className="w-full h-14 flex items-center justify-between px-4 z-10 bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0">
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
             <X size={20} />
          </button>
          <div className="text-white font-medium text-sm drop-shadow-md">
             {capturedImage ? 'Edit Photo' : 'Take Photo'}
          </div>
          {capturedImage ? (
            <button onClick={handleSave} disabled={isProcessing} className="p-2 text-blue-400 font-bold hover:text-blue-300 rounded-full flex items-center gap-1 bg-black/20 backdrop-blur disabled:opacity-50">
               <Check size={18} />
               <span className="text-xs">{isProcessing ? 'Saving...' : 'Save'}</span>
            </button>
          ) : (
            hasMultipleCameras ? (
              <button onClick={switchCamera} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
                <RefreshCcw size={20} />
              </button>
            ) : <div className="w-10"></div>
          )}
       </div>

       {/* Main Content Area */}
       <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden">
          {!capturedImage ? (
            <>
              {errorMsg ? (
                 <div className="text-red-400 p-8 text-center bg-white/5 rounded-xl border border-red-500/20">
                    <Camera size={48} className="mx-auto mb-4 opacity-50" />
                    <div>{errorMsg}</div>
                 </div>
              ) : (
                 <video 
                   ref={videoRef} 
                   autoPlay 
                   playsInline 
                   muted
                   className={cn(
                      "w-full h-full object-cover",
                      facingMode === 'user' && "scale-x-[-1]"
                   )}
                 />
              )}
              
              {/* Camera Controls */}
              {!errorMsg && (
                 <div className="absolute bottom-10 left-0 w-full flex items-center justify-center pointer-events-none">
                    <button 
                      onClick={takePhoto} 
                      className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center pointer-events-auto active:scale-95 transition-transform"
                    >
                       <div className="w-16 h-16 bg-white rounded-full shadow-lg" />
                    </button>
                 </div>
              )}
            </>
          ) : (
            <div className="w-full h-full relative">
               <Cropper
                 image={capturedImage}
                 crop={crop}
                 zoom={zoom}
                 aspect={aspect}
                 rotation={rotation}
                 onCropChange={setCrop}
                 onCropComplete={onCropComplete}
                 onZoomChange={setZoom}
                 onRotationChange={setRotation}
                 classes={{ containerClassName: 'bg-black w-full h-full' }}
               />
               <button onClick={retake} className="absolute left-4 bottom-24 p-3 bg-white/10 hover:bg-white/20 hover:text-white text-white/70 rounded-full backdrop-blur z-20 flex items-center gap-2">
                 <ArrowLeft size={16} /> <span className="text-xs font-semibold pr-1">Retake</span>
               </button>
            </div>
          )}
       </div>

       {/* Crop presets if image is captured */}
       {capturedImage && renderCropPresets()}

    </div>,
    document.body
  );
}
