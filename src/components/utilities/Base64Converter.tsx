import React, { useState } from "react";
import { Binary, ArrowRightLeft, Copy, Check } from "lucide-react";

export const Base64Converter = () => {
  const [text, setText] = useState("");
  const [base64, setBase64] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [copied, setCopied] = useState<"text" | "base64" | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (mode === "encode") {
      try {
        setBase64(btoa(unescape(encodeURIComponent(val))));
      } catch (err) {
        setBase64("Invalid input");
      }
    }
  };

  const handleBase64Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBase64(val);
    if (mode === "decode") {
      try {
        setText(decodeURIComponent(escape(atob(val))));
      } catch (err) {
        setText("Invalid Base64");
      }
    }
  };

  const handleModeToggle = () => {
    setMode(mode === "encode" ? "decode" : "encode");
  };

  const copyToClipboard = async (content: string, type: "text" | "base64") => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800/50">
          <Binary size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Base64 Encoder / Decoder
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Instantly convert text to Base64 format and vice versa.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-center mb-2">
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 shadow-inner border border-slate-300 dark:border-slate-700/50">
            <button
              onClick={() => setMode("encode")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "encode"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Encode (Text → Base64)
            </button>
            <button
              onClick={() => setMode("decode")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === "decode"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Decode (Base64 → Text)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[350px]">
          {/* Plain Text Area */}
          <div className={`flex flex-col h-full bg-white dark:bg-[#161b22] border rounded-xl overflow-hidden shadow-sm transition-all ${mode === "encode" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Plain Text</span>
              <button
                onClick={() => copyToClipboard(text, "text")}
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Copy to clipboard"
              >
                {copied === "text" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
            <textarea
              value={text}
              onChange={handleTextChange}
              readOnly={mode === "decode"}
              placeholder="Enter plain text here..."
              className="w-full h-full p-4 resize-none bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400"
              spellCheck={false}
            />
          </div>

          {/* Base64 Area */}
          <div className={`flex flex-col h-full bg-white dark:bg-[#161b22] border rounded-xl overflow-hidden shadow-sm transition-all ${mode === "decode" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Base64</span>
              <button
                onClick={() => copyToClipboard(base64, "base64")}
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Copy to clipboard"
              >
                {copied === "base64" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
            <textarea
              value={base64}
              onChange={handleBase64Change}
              readOnly={mode === "encode"}
              placeholder="Enter Base64 string here..."
              className="w-full h-full p-4 resize-none bg-transparent text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 break-all"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
