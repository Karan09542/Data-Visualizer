import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { useStore } from "../store/useStore";
import { getValueAtPath, setValueAtPath } from "../utils/pathUtils";
import { 
  Type, Save, Upload, Download, Undo, Redo, 
  Layers, MousePointer2, Brush, Circle, Square, Minus, Edit2, RotateCw, Image as ImageIcon,
  SquareDashed, X, Crop
} from "lucide-react";

// jSquash imports for processing/compression
import decodePng from '@jsquash/png/decode';
import encodePng from '@jsquash/png/encode';
import decodeJpeg from '@jsquash/jpeg/decode';
import encodeJpeg from '@jsquash/jpeg/encode';
import decodeWebp from '@jsquash/webp/decode';
import encodeWebp from '@jsquash/webp/encode';

interface ImageWorkspaceProps {
  path: string;
}

export default function ImageWorkspace({ path }: ImageWorkspaceProps) {
  const { parsedData, updateNodeValue } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState("select");
  const [layers, setLayers] = useState<any[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);

  const [filterBrightness, setFilterBrightness] = useState(0);
  const [filterContrast, setFilterContrast] = useState(0);

  // File loading
  const storedData = getValueAtPath(parsedData, path);
  
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Initialize Fabric
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: containerRef.current.clientWidth - 300,
      height: containerRef.current.clientHeight,
      backgroundColor: '#1e1e1e',
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = canvas;

    // Window resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === containerRef.current && fabricRef.current) {
          fabricRef.current.setDimensions({
            width: entry.contentRect.width - 300,
            height: entry.contentRect.height
          });
          fabricRef.current.renderAll();
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Initial load from state
    if (storedData && typeof storedData === 'string' && storedData.startsWith('data:image')) {
      fabric.Image.fromURL(storedData).then((img) => {
        if (img) {
          img.set({ left: 100, top: 100 });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          updateLayersList();
        }
      });
    }

    // Events
    canvas.on('object:added', updateLayersList);
    canvas.on('object:removed', updateLayersList);
    canvas.on('object:modified', updateLayersList);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [path]);

  // Sync canvas state with external React states
  const updateLayersList = () => {
    if (!fabricRef.current) return;
    const items = fabricRef.current.getObjects();
    setLayers([...items].reverse()); // Top layer first
    
    // Save state back to document logic
    // Using simple dataURL export to fit into single file node logic temporarily
    const dataUrl = fabricRef.current.toDataURL({ multiplier: 1, format: 'png' });
    // avoid infinite update loops if too frequent, normally debounce this
    setTimeout(() => {
       updateNodeValue(path, dataUrl);
    }, 1000);
  };

  const handleSelection = (e: any) => {
    const active = fabricRef.current?.getActiveObject();
    if (active) {
      // Logic for selected layer id would be matching object refs, 
      // simplified here
    } else {
      setSelectedLayerId(null);
    }
  };

  // Tools
  const setTool = (tool: string) => {
    setActiveTool(tool);
    if (!fabricRef.current) return;
    
    fabricRef.current.isDrawingMode = (tool === "brush" || tool === "eraser");
    
    if (tool === "brush") {
      const brush = new fabric.PencilBrush(fabricRef.current);
      brush.color = brushColor;
      brush.width = brushSize;
      fabricRef.current.freeDrawingBrush = brush;
    } else if (tool === "eraser") {
      // basic eraser logic requires newer fabric features or compositing,
      // stick to simple drawing for now
      const brush = new fabric.PencilBrush(fabricRef.current);
      brush.color = '#1e1e1e'; // pseudo eraser
      brush.width = brushSize * 2;
      fabricRef.current.freeDrawingBrush = brush;
    }
  };

  const addRect = () => {
    const rect = new fabric.Rect({
      left: 100, top: 100, width: 100, height: 100,
      fill: 'transparent',
      stroke: brushColor,
      strokeWidth: 2
    });
    fabricRef.current?.add(rect);
    fabricRef.current?.setActiveObject(rect);
  };

  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 100, top: 100, radius: 50,
      fill: 'transparent',
      stroke: brushColor,
      strokeWidth: 2
    });
    fabricRef.current?.add(circle);
    fabricRef.current?.setActiveObject(circle);
  };

  const addText = () => {
    const text = new fabric.IText('Text', {
      left: 100, top: 100,
      fill: brushColor,
      fontFamily: 'Inter, sans-serif'
    });
    fabricRef.current?.add(text);
    fabricRef.current?.setActiveObject(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const result = f.target?.result as string;
      
      // Basic jSquash decode flow mapping to canvas: 
      // For standard browser flow, we can use fabric URL load. 
      // To strictly use jSquash, we would decode here, pass ImageData to canvas.
      // Here we load via fabric for simplicity in React.
      
      fabric.Image.fromURL(result).then((img) => {
        if (img) {
          fabricRef.current?.add(img);
          fabricRef.current?.setActiveObject(img);
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const flipX = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      obj.set('flipX', !obj.flipX);
      fabricRef.current?.renderAll();
    }
  };

  const flipY = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (obj) {
      obj.set('flipY', !obj.flipY);
      fabricRef.current?.renderAll();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-200" ref={containerRef}>
      
      {/* Top Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-950 flex items-center px-4 gap-2">
        <ImageIcon size={18} className="text-purple-400 mr-2" />
        <span className="font-semibold text-sm mr-6">Image Workspace</span>
        
        <button className="h-8 w-8 hover:bg-slate-800 flex items-center justify-center rounded transition-colors" title="Import Image" onClick={() => document.getElementById('img-upload')?.click()}>
          <Upload size={16} />
        </button>
        <input id="img-upload" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />

        <div className="w-px h-6 bg-slate-800 mx-2" />
        
        <button className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${activeTool === 'select' ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-slate-800'}`} title="Select (V)" onClick={() => setTool('select')}>
          <MousePointer2 size={16} />
        </button>
        
        <button className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${activeTool === 'brush' ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-slate-800'}`} title="Brush" onClick={() => setTool('brush')}>
          <Brush size={16} />
        </button>
        
        <button className="h-8 w-8 hover:bg-slate-800 flex items-center justify-center rounded transition-colors" title="Text Label" onClick={addText}>
          <Type size={16} />
        </button>
        
        <button className="h-8 w-8 hover:bg-slate-800 flex items-center justify-center rounded transition-colors" title="Rectangle" onClick={addRect}>
          <Square size={16} />
        </button>
        
        <button className="h-8 w-8 hover:bg-slate-800 flex items-center justify-center rounded transition-colors" title="Circle" onClick={addCircle}>
          <Circle size={16} />
        </button>

        <div className="flex-1" />
        
        <button className="px-3 py-1.5 border border-slate-700 bg-slate-900 rounded hover:bg-slate-800 flex items-center text-xs font-semibold transition-colors">
          <Download size={14} className="mr-2" /> Export (jSquash)
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 h-full bg-[#1e1e1e] overflow-hidden flex items-center justify-center relative">
          <canvas ref={canvasRef} />
        </div>

        {/* Right Sidebar - Layers & Props */}
        <div className="w-[300px] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full overflow-hidden">
          
          <div className="w-full bg-slate-900 border-b border-slate-800 h-10 px-2 flex justify-start gap-2 pt-1 text-xs font-semibold">
            <button className="px-3 border-b-2 border-blue-500 text-blue-400">Layers</button>
            <button className="px-3 border-b-2 border-transparent text-slate-400 hover:text-slate-200">Properties</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Transform Tools</label>
              <div className="flex gap-2">
                <button className="flex-1 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded text-xs transition-colors" onClick={flipX}>Flip X</button>
                <button className="flex-1 py-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded text-xs transition-colors" onClick={flipY}>Flip Y</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Fill Color</label>
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => {
                  setBrushColor(e.target.value);
                  const active = fabricRef.current?.getActiveObject();
                  if (active) {
                    if (active.type === 'i-text') active.set('fill', e.target.value);
                    else if (active.type === 'path') active.set('stroke', e.target.value);
                    else if (active.type !== 'image') active.set('stroke', e.target.value);
                    fabricRef.current?.renderAll();
                  }
                }}
                className="h-8 p-0 border-0 w-full bg-slate-900 rounded cursor-pointer" 
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">Brush / Stroke Size</label>
              <input 
                type="number" 
                value={brushSize} 
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="h-8 px-2 w-full bg-slate-900 border border-slate-800 rounded text-sm text-slate-200 outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="h-px bg-slate-800 my-4" />
            
            <label className="text-xs font-semibold text-slate-400 mb-2 block">Layers</label>
            <div className="flex flex-col border border-slate-800 rounded bg-slate-900/50 overflow-hidden">
              {layers.map((layer, idx) => (
                <div key={idx} className="flex items-center px-3 py-2 border-b border-slate-800/50 last:border-b-0 hover:bg-slate-800/80 cursor-pointer transition-colors">
                  <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center mr-2">
                    {layer.type === 'image' ? <ImageIcon size={10}/> : 
                     layer.type === 'i-text' ? <Type size={10}/> : 
                     layer.type === 'path' ? <Brush size={10}/> :
                     <Square size={10}/>}
                  </div>
                  <span className="text-xs">{layer.type.charAt(0).toUpperCase() + layer.type.slice(1)}</span>
                </div>
              ))}
              {layers.length === 0 && (
                <div className="p-3 text-xs text-slate-500 text-center italic">No layers</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
