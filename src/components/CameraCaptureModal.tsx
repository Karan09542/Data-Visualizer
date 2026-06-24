import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCcw, Check, ArrowLeft, RotateCw, Video, Square, StopCircle } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
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
  
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Cropper state
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      if (videoInputs.length > 1) {
        setHasMultipleCameras(true);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (capturedImage || capturedVideo) return;

    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: mode === 'video'
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
  }, [facingMode, capturedImage, capturedVideo, mode]);

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
    const videoEl = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    stream.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const startRecording = () => {
    if (!stream) return;
    videoChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') ? 'video/webm; codecs=vp9' : 'video/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = e => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: mimeType });
        setCapturedVideo(blob);
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
      };
      mediaRecorderRef.current = mr;
      mr.start(200);
      setIsRecording(true);
    } catch(e) {
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
    setCapturedImage(null);
    setCapturedVideo(null);
    setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
    setCompletedCrop(null);
    setRotation(0);
    setAspect(undefined);
  };

  const getCroppedImageInternal = async (imageSrc: string, pixelCrop: any, rotation = 0) => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise(resolve => { image.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
    
    canvas.width = safeArea;
    canvas.height = safeArea;
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(image, safeArea / 2 - image.width * 0.5, safeArea / 2 - image.height * 0.5);
    const data = ctx.getImageData(0, 0, safeArea, safeArea);
    
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((file) => {
        resolve(file);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (capturedVideo) {
        const file = new File([capturedVideo], `capture_${Date.now()}.webm`, { type: 'video/webm' });
        onCapture(file);
      } else if (capturedImage) {
           const image = imgRef.current;
           if (!image) throw new Error("Image not loaded");
           const scaleX = image.naturalWidth / image.width;
           const scaleY = image.naturalHeight / image.height;

           const pixelCrop = (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) ? {
              x: completedCrop.x * scaleX,
              y: completedCrop.y * scaleY,
              width: completedCrop.width * scaleX,
              height: completedCrop.height * scaleY,
           } : {
              x: 0,
              y: 0,
              width: image.naturalWidth,
              height: image.naturalHeight
           };

           const finalBlob = await getCroppedImageInternal(capturedImage, pixelCrop, rotation);
           if (finalBlob) {
             const file = new File([finalBlob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
             onCapture(file);
           }
      }
      onClose();
    } catch(err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePresetClick = useCallback((presetValue: number | undefined) => {
    setAspect(presetValue);
    
    const image = imgRef.current;
    if (!image) {
      return;
    }

    const renderedWidth = image.width || image.clientWidth;
    const renderedHeight = image.height || image.clientHeight;
    
    if (renderedWidth <= 0 || renderedHeight <= 0) {
      // Fallback to natural dimensions if layout is not ready
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      const imageAspect = naturalWidth / naturalHeight;
      
      if (!presetValue) {
        setCrop({
          unit: '%',
          width: 100,
          height: 100,
          x: 0,
          y: 0
        });
        setCompletedCrop(null);
        return;
      }

      let cropWidthPercent = 100;
      let cropHeightPercent = 100;
      let cropXPercent = 0;
      let cropYPercent = 0;

      if (imageAspect > presetValue) {
        cropWidthPercent = (presetValue / imageAspect) * 100;
        cropHeightPercent = 100;
        cropXPercent = (100 - cropWidthPercent) / 2;
        cropYPercent = 0;
      } else {
        cropWidthPercent = 100;
        cropHeightPercent = (imageAspect / presetValue) * 100;
        cropXPercent = 0;
        cropYPercent = (100 - cropHeightPercent) / 2;
      }

      setCrop({
        unit: '%',
        width: cropWidthPercent,
        height: cropHeightPercent,
        x: cropXPercent,
        y: cropYPercent
      });
      return;
    }

    const imageAspect = renderedWidth / renderedHeight;

    if (!presetValue) {
      const newCrop: Crop = {
        unit: '%',
        width: 100,
        height: 100,
        x: 0,
        y: 0
      };
      setCrop(newCrop);
      setCompletedCrop({
        unit: 'px',
        x: 0,
        y: 0,
        width: renderedWidth,
        height: renderedHeight
      });
      return;
    }

    let cropWidthPercent = 100;
    let cropHeightPercent = 100;
    let cropXPercent = 0;
    let cropYPercent = 0;

    if (imageAspect > presetValue) {
      cropWidthPercent = (presetValue / imageAspect) * 100;
      cropHeightPercent = 100;
      cropXPercent = (100 - cropWidthPercent) / 2;
      cropYPercent = 0;
    } else {
      cropWidthPercent = 100;
      cropHeightPercent = (imageAspect / presetValue) * 100;
      cropXPercent = 0;
      cropYPercent = (100 - cropHeightPercent) / 2;
    }

    setCrop({
      unit: '%',
      width: cropWidthPercent,
      height: cropHeightPercent,
      x: cropXPercent,
      y: cropYPercent
    });

    const pixelWidth = (cropWidthPercent / 100) * renderedWidth;
    const pixelHeight = (cropHeightPercent / 100) * renderedHeight;
    const pixelX = (cropXPercent / 100) * renderedWidth;
    const pixelY = (cropYPercent / 100) * renderedHeight;

    setCompletedCrop({
      unit: 'px',
      x: pixelX,
      y: pixelY,
      width: pixelWidth,
      height: pixelHeight
    });
  }, [aspect]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const renderedWidth = img.width || img.clientWidth;
    const renderedHeight = img.height || img.clientHeight;
    
    if (aspect) {
      handlePresetClick(aspect);
    } else {
      setCrop({
        unit: '%',
        width: 100,
        height: 100,
        x: 0,
        y: 0
      });
      setCompletedCrop({
        unit: 'px',
        x: 0,
        y: 0,
        width: renderedWidth || img.naturalWidth,
        height: renderedHeight || img.naturalHeight
      });
    }
  }, [aspect, handlePresetClick]);

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
          onClick={() => handlePresetClick(preset.value)}
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
       <div className="w-full h-14 flex items-center justify-between px-4 z-10 bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0">
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
             <X size={20} />
          </button>
          
          {!capturedImage && !capturedVideo && !isRecording && (
            <div className="flex bg-black/40 backdrop-blur rounded-full p-1 border border-white/10">
               <button onClick={() => setMode('photo')} className={cn("px-4 py-1 text-xs font-medium rounded-full transition-colors", mode === 'photo' ? "bg-white text-black" : "text-white")}>Photo</button>
               <button onClick={() => setMode('video')} className={cn("px-4 py-1 text-xs font-medium rounded-full transition-colors", mode === 'video' ? "bg-white text-black" : "text-white")}>Video</button>
            </div>
          )}
          {isRecording && <div className="text-red-500 animate-pulse font-bold">Recording...</div>}
          {(capturedImage || capturedVideo) && (
            <div className="text-white font-medium text-sm drop-shadow-md">
               {capturedImage ? 'Edit Photo' : 'Preview Video'}
            </div>
          )}

          {capturedImage || capturedVideo ? (
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

       <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden">
          {!capturedImage && !capturedVideo ? (
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
                   muted={mode === 'photo'}
                   className={cn(
                      "w-full h-full object-cover",
                      facingMode === 'user' && "scale-x-[-1]"
                   )}
                 />
              )}
              
              {!errorMsg && (
                 <div className="absolute bottom-10 left-0 w-full flex items-center justify-center pointer-events-none">
                    {mode === 'photo' ? (
                       <button 
                         onClick={takePhoto} 
                         className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center pointer-events-auto active:scale-95 transition-transform"
                       >
                          <div className="w-16 h-16 bg-white rounded-full shadow-lg" />
                       </button>
                    ) : (
                       <button 
                         onClick={isRecording ? stopRecording : startRecording} 
                         className={cn(
                           "w-20 h-20 rounded-full border-4 flex items-center justify-center pointer-events-auto transition-transform",
                           isRecording ? "border-red-500 bg-red-500/20" : "border-white bg-red-500"
                         )}
                       >
                          {isRecording ? <Square size={24} className="text-white fill-current" /> : <div className="w-6 h-6 bg-white rounded-full" />}
                       </button>
                    )}
                 </div>
              )}
            </>
          ) : (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
               {capturedImage && (
                  <ReactCrop
                     crop={crop}
                     onChange={(_, percentCrop) => setCrop(percentCrop)}
                     onComplete={(c) => setCompletedCrop(c)}
                     aspect={aspect}
                     className="max-h-full"
                  >
                     <img 
                        ref={imgRef}
                        src={capturedImage} 
                        onLoad={handleImageLoad}
                        style={{ transform: `rotate(${rotation}deg)`, maxHeight: '80vh', objectFit: 'contain' }}
                        alt="Captured"
                     />
                  </ReactCrop>
               )}
               {capturedVideo && (
                  <video src={URL.createObjectURL(capturedVideo)} controls className="max-w-full max-h-full" autoPlay loop playsInline />
               )}
               <button onClick={retake} className="absolute left-4 bottom-24 p-3 bg-white/10 hover:bg-white/20 hover:text-white text-white/70 rounded-full backdrop-blur z-20 flex items-center gap-2 shadow-xl">
                 <ArrowLeft size={16} /> <span className="text-xs font-semibold pr-1">Retake</span>
               </button>
            </div>
          )}
       </div>

       {capturedImage && renderCropPresets()}

    </div>,
    document.body
  );
}

