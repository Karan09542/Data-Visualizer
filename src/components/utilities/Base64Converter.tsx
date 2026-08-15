import React, { useState, useEffect, useRef } from "react";
import { Binary, Copy, Check, Image as ImageIcon, Upload } from "lucide-react";

export const Base64Converter = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [base64, setBase64] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [copied, setCopied] = useState<"text" | "base64" | "css" | null>(null);
  const [asSvgDataUri, setAsSvgDataUri] = useState(false);
  const [uploadedImageFile, setUploadedImageFile] = useState<{ name: string, url: string } | null>(null);

  // Auto-detect SVG in text (handles optional XML/DOCTYPE declarations)
  const isTextSvg = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg/i.test(text);
  
  // Auto-detect standard image in base64 output
  const isBase64Image = base64.startsWith("data:image/") && !base64.includes("svg+xml");

  // Auto-enable Data URI mode if we detect SVG in encode mode
  useEffect(() => {
    if (isTextSvg && mode === "encode" && base64 === "") {
      setAsSvgDataUri(true);
    }
  }, [isTextSvg, mode]);

  useEffect(() => {
    if (mode === "encode") {
      try {
        if (!text) {
          setBase64("");
          return;
        }
        
        // If we have an uploaded binary image and the text hasn't been manually cleared/changed
        if (uploadedImageFile && text === `[Binary Image: ${uploadedImageFile.name}]`) {
          setBase64(uploadedImageFile.url);
          return;
        }

        // Properly encode unicode characters to base64
        const b64 = btoa(
          encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (match, p1) =>
            String.fromCharCode(parseInt(p1, 16))
          )
        );
        setBase64(asSvgDataUri ? `data:image/svg+xml;base64,${b64}` : b64);
      } catch (err) {
        setBase64("Invalid input");
      }
    }
  }, [text, mode, asSvgDataUri, uploadedImageFile]);

  useEffect(() => {
    if (mode === "decode") {
      try {
        if (!base64) {
          setText("");
          return;
        }
        
        // If it's a binary image Data URI, we can't decode it to plain text usefully
        if (base64.startsWith("data:image/") && !base64.includes("svg+xml")) {
          setText("[Binary Image Data]");
          return;
        }

        // Strip data URI prefix if it exists
        const cleanVal = base64.replace(/^data:image\/[a-z+]+;base64,/, "");
        
        // Properly decode unicode characters from base64
        const decodedText = decodeURIComponent(
          atob(cleanVal)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        setText(decodedText);
      } catch (err) {
        setText("Invalid Base64");
      }
    }
  }, [base64, mode]);

  const copyToClipboard = async (content: string, type: "text" | "base64" | "css") => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const getCssBackground = () => {
    return `background-image: url('${base64}');`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    // Handle binary images (PNG, JPEG, WebP, GIF, etc.)
    if (file.type.startsWith("image/") && !file.type.includes("svg")) {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setUploadedImageFile({ name: file.name, url: content });
        setText(`[Binary Image: ${file.name}]`);
        setMode("encode");
        setAsSvgDataUri(false);
      };
      reader.readAsDataURL(file);
    } 
    // Handle SVG and plain text files
    else {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setUploadedImageFile(null);
        setText(content);
        if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
           setMode("encode");
           setAsSvgDataUri(true);
        }
      };
      reader.readAsText(file);
    }
    
    e.target.value = "";
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setUploadedImageFile(null); // Clear image state if text is manually edited
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
          <Binary size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Base64 & Image Converter
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Instantly convert text, SVGs, and Images (PNG, JPG, WebP) to Base64 format and vice versa.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 shadow-inner border border-slate-300 dark:border-slate-700/50">
            <button
              onClick={() => setMode("encode")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "encode"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Encode (Data → Base64)
            </button>
            <button
              onClick={() => setMode("decode")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "decode"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Decode (Base64 → Data)
            </button>
          </div>

          {mode === "encode" && !uploadedImageFile && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={asSvgDataUri} 
                  onChange={(e) => setAsSvgDataUri(e.target.checked)} 
                />
                <div className={`w-10 h-5.5 rounded-full transition-colors ${asSvgDataUri ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                <div className={`absolute left-1 top-1 w-3.5 h-3.5 bg-white rounded-full transition-transform ${asSvgDataUri ? 'translate-x-4.5' : 'translate-x-0'}`}></div>
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                Format as SVG Data URI
              </span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[350px]">
          {/* Plain Text Area */}
          <div className={`flex flex-col h-full bg-white dark:bg-[#161b22] border rounded-xl overflow-hidden shadow-sm transition-all ${mode === "encode" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center">
                Input Data
                {isTextSvg && <span className="ml-2 text-emerald-500 font-normal normal-case">(SVG Detected)</span>}
                {uploadedImageFile && <span className="ml-2 text-emerald-500 font-normal normal-case">(Image Uploaded)</span>}
              </span>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*, .svg" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium"
                  title="Upload Image/SVG file"
                >
                  <Upload size={12} /> Upload File
                </button>
                <button
                  onClick={() => copyToClipboard(text, "text")}
                  className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied === "text" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={handleTextChange}
              readOnly={mode === "decode"}
              placeholder="Enter plain text, SVG code, or upload an image..."
              className="w-full h-full p-4 resize-none bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 font-mono"
              spellCheck={false}
            />
          </div>

          {/* Base64 Area */}
          <div className={`flex flex-col h-full bg-white dark:bg-[#161b22] border rounded-xl overflow-hidden shadow-sm transition-all ${mode === "decode" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Base64 Output</span>
              <div className="flex items-center gap-2">
                {(asSvgDataUri || isBase64Image) && mode === "encode" && (
                   <button
                    onClick={() => copyToClipboard(getCssBackground(), "css")}
                    className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-medium"
                    title="Copy CSS Background"
                  >
                    {copied === "css" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} CSS
                  </button>
                )}
                <button
                  onClick={() => copyToClipboard(base64, "base64")}
                  className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  title="Copy Base64"
                >
                  {copied === "base64" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <textarea
              value={base64}
              onChange={(e) => setBase64(e.target.value)}
              readOnly={mode === "encode"}
              placeholder="Enter Base64 string here..."
              className="w-full h-full p-4 resize-none bg-transparent text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 break-all"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Preview Pane for SVG or Images */}
        {(isTextSvg || isBase64Image) && (text.trim().length > 0 || base64.trim().length > 0) && (
          <div className="mt-4 flex flex-col h-64 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
             <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={14} /> {isBase64Image ? "Image Preview" : "SVG Preview"}
              </span>
            </div>
            <div className="flex-1 p-4 bg-slate-100/50 dark:bg-slate-900/20 flex items-center justify-center relative overflow-hidden" 
                 style={{ 
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.05' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`
                 }}>
               {isTextSvg ? (
                 <div dangerouslySetInnerHTML={{ __html: text }} className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full" />
               ) : (
                 <img src={base64} alt="Preview" className="max-w-full max-h-full object-contain drop-shadow-sm rounded" />
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
