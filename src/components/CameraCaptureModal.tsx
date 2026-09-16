import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, ChevronDown, RefreshCcw, Check, ArrowLeft, RotateCw, Video, Square, StopCircle, Zap, ZapOff } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { cn } from '@/lib/utils';
import { DocumentWorkspace } from './camera/DocumentWorkspace';

interface CameraCaptureModalProps {
  onClose: () => void;
  onCapture: (file: File) => void;
  initialImageSrc?: string | null;
}

/** "HD Webcam (04f2:b6dd)" -> "HD Webcam"; unnamed cameras get a number */
const cameraLabel = (camera: MediaDeviceInfo, index: number) => {
  const name = camera.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
  return name || `Camera ${index + 1}`;
};

export function CameraCaptureModal({ onClose, onCapture, initialImageSrc = null }: CameraCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  // Every camera the device has, the one asked for, and the one actually streaming
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);

  const [capturedImage, setCapturedImage] = useState<string | null>(initialImageSrc);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Torch state
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);

  // Cropper state
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState(0);

  // Camera names only show up once permission is granted, so this runs again after the stream starts
  const refreshCameras = useCallback(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoInputs);
      setHasMultipleCameras(videoInputs.length > 1);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    refreshCameras();
    // Plugging in or removing a webcam updates the list
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameras);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshCameras);
  }, [refreshCameras]);

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
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: mode === 'video'
        });
        if (!isMounted) {
          s.getTracks().forEach(track => track.stop());
          return;
        }

        const track = s.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const capabilities = track.getCapabilities();
          setIsTorchSupported(!!(capabilities as any).torch);
        } else {
          setIsTorchSupported(false);
        }
        setTorchEnabled(false);

        const videoTrack = s.getVideoTracks()[0];
        const settings = videoTrack?.getSettings?.();
        setActiveDeviceId(settings?.deviceId ?? null);
        // Front cameras are mirrored like a mirror; desktop webcams rarely report a facing, so fall back to the label
        setIsFrontCamera(
          settings?.facingMode
            ? settings.facingMode === 'user'
            : selectedDeviceId
              ? /front|user|facetime/i.test(videoTrack?.label ?? '')
              : facingMode === 'user'
        );
        refreshCameras();

        setStream(s);
        setErrorMsg("");
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        // The chosen camera went away (unplugged, or taken by another app): go back to the default one
        if (selectedDeviceId && (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError' || err?.name === 'NotReadableError')) {
          setSelectedDeviceId(null);
          return;
        }
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
  }, [facingMode, selectedDeviceId, capturedImage, capturedVideo, mode]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const newTorchState = !torchEnabled;
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as any]
        });
        setTorchEnabled(newTorchState);
      } catch (err) {
        console.error("Failed to toggle torch", err);
      }
    }
  };

  const switchCamera = () => {
    // With named cameras, step through them in order; otherwise flip between front and back
    const usable = cameras.filter(c => c.deviceId);
    if (usable.length > 1) {
      const at = usable.findIndex(c => c.deviceId === activeDeviceId);
      setSelectedDeviceId(usable[(at + 1) % usable.length].deviceId);
      return;
    }
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const activeCameraIndex = cameras.findIndex(c => c.deviceId === activeDeviceId);
  const activeCameraName = activeCameraIndex >= 0 ? cameraLabel(cameras[activeCameraIndex], activeCameraIndex) : 'Choose camera';

  const takePhoto = () => {
    if (!videoRef.current || !stream) return;
    const videoEl = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (isFrontCamera) {
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
    if (initialImageSrc) {
      onClose();
      return;
    }
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
    // Legacy video save, Image saving is now handled by DocumentWorkspace
    setIsProcessing(true);
    try {
      if (capturedVideo) {
        const file = new File([capturedVideo], `capture_${Date.now()}.webm`, { type: 'video/webm' });
        onCapture(file);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWorkspaceSave = (blob: Blob) => {
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    onClose();
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
        { label: '4:3', value: 4 / 3 },
        { label: '16:9', value: 16 / 9 },
        { label: '3:4', value: 3 / 4 }
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
      {!capturedImage && (
        <div className="w-full h-14 flex items-center justify-between px-4 z-10 bg-gradient-to-b from-black/50 to-transparent absolute top-0 left-0">
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
            <X size={20} />
          </button>

          {!capturedVideo && !isRecording && (
            <div className="flex bg-black/40 backdrop-blur rounded-full p-1 border border-white/10">
              <button onClick={() => setMode('photo')} className={cn("px-4 py-1 text-xs font-medium rounded-full transition-colors", mode === 'photo' ? "bg-white text-black" : "text-white")}>Photo</button>
              <button onClick={() => setMode('video')} className={cn("px-4 py-1 text-xs font-medium rounded-full transition-colors", mode === 'video' ? "bg-white text-black" : "text-white")}>Video</button>
            </div>
          )}
          {isRecording && <div className="text-red-500 animate-pulse font-bold">Recording...</div>}
          {capturedVideo && (
            <div className="text-white font-medium text-sm drop-shadow-md">
              Preview Video
            </div>
          )}

          {capturedVideo ? (
            <button onClick={handleSave} disabled={isProcessing} className="p-2 text-blue-400 font-bold hover:text-blue-300 rounded-full flex items-center gap-1 bg-black/20 backdrop-blur disabled:opacity-50">
              <Check size={18} />
              <span className="text-xs">{isProcessing ? 'Saving...' : 'Save'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {isTorchSupported && (
                <button onClick={toggleTorch} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
                  {torchEnabled ? <Zap size={20} className="fill-current text-yellow-400" /> : <ZapOff size={20} />}
                </button>
              )}
              {hasMultipleCameras ? (
                <button onClick={switchCamera} className="p-2 text-white/80 hover:text-white rounded-full bg-black/20 backdrop-blur">
                  <RefreshCcw size={20} />
                </button>
              ) : <div className="w-10"></div>}
            </div>
          )}
        </div>
      )}

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
                  isFrontCamera && "scale-x-[-1]"
                )}
              />
            )}

            {!errorMsg && cameras.length > 1 && !isRecording && (
              <div className="absolute bottom-36 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
                {isCameraMenuOpen && (
                  <div className="fixed inset-0 pointer-events-auto" onClick={() => setIsCameraMenuOpen(false)} />
                )}
                <div className="relative pointer-events-auto">
                  {isCameraMenuOpen && (
                    <ul
                      role="listbox"
                      aria-label="Available cameras"
                      className="absolute bottom-full left-1/2 mb-2 w-72 max-w-[85vw] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/95 p-1 shadow-2xl backdrop-blur"
                    >
                      <li className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        {cameras.length} cameras available
                      </li>
                      {cameras.map((cam, i) => {
                        const isActive = !!cam.deviceId && cam.deviceId === activeDeviceId;
                        return (
                          <li key={cam.deviceId || i}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              disabled={!cam.deviceId}
                              onClick={() => {
                                setSelectedDeviceId(cam.deviceId);
                                setIsCameraMenuOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40",
                                isActive ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <Camera size={15} className="shrink-0 opacity-70" />
                              <span className="flex-1 truncate">{cameraLabel(cam, i)}</span>
                              {isActive && <Check size={15} className="shrink-0 text-blue-400" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCameraMenuOpen(open => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isCameraMenuOpen}
                    className="flex max-w-[80vw] items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3.5 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/70"
                  >
                    <Camera size={14} className="shrink-0" />
                    <span className="truncate">{activeCameraName}</span>
                    <ChevronDown size={14} className={cn("shrink-0 transition-transform", isCameraMenuOpen && "rotate-180")} />
                  </button>
                </div>
              </div>
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
              <DocumentWorkspace
                imageSrc={capturedImage}
                onSave={handleWorkspaceSave}
                onCancel={retake}
              />
            )}
            {capturedVideo && (
              <>
                <video src={URL.createObjectURL(capturedVideo)} controls className="max-w-full max-h-full" autoPlay loop playsInline />
                <button onClick={retake} className="absolute left-4 bottom-24 p-3 bg-white/10 hover:bg-white/20 hover:text-white text-white/70 rounded-full backdrop-blur z-20 flex items-center gap-2 shadow-xl">
                  <ArrowLeft size={16} /> <span className="text-xs font-semibold pr-1">Retake</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

    </div>,
    document.body
  );
}

