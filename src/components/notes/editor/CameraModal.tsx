import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_IMAGE_COMMAND } from './plugins/ImagePlugin';

interface CameraModalProps {
  onClose: () => void;
}

export default function CameraModal({ onClose }: CameraModalProps) {
  const [editor] = useLexicalComposerContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Could not access the camera. Please check permissions.');
      }
    }
    
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
            onClose();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Camera size={18} />
            Camera
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 flex flex-col items-center bg-black/50">
          {error ? (
            <div className="text-red-400 text-sm p-4 text-center">{error}</div>
          ) : (
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>
        
        {!error && (
          <div className="p-4 border-t border-white/10 flex justify-center bg-[#1a1a1a]">
            <button 
              onClick={captureImage}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Camera size={18} />
              Take Photo
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
