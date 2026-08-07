import React, { useState, useEffect } from "react";
import { Hash, Copy, Check } from "lucide-react";

type Algorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

const ALGORITHMS: Algorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export const HashGenerator = () => {
  const [text, setText] = useState("");
  const [hashes, setHashes] = useState<Record<Algorithm, string>>({
    "SHA-1": "",
    "SHA-256": "",
    "SHA-384": "",
    "SHA-512": "",
  });
  const [copied, setCopied] = useState<Algorithm | null>(null);

  useEffect(() => {
    const generateHashes = async () => {
      if (!text) {
        setHashes({
          "SHA-1": "",
          "SHA-256": "",
          "SHA-384": "",
          "SHA-512": "",
        });
        return;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      const newHashes = { ...hashes };

      for (const algo of ALGORITHMS) {
        try {
          const hashBuffer = await window.crypto.subtle.digest(algo, data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          newHashes[algo] = hashHex;
        } catch (err) {
          newHashes[algo] = "Error generating hash";
        }
      }

      setHashes(newHashes);
    };

    generateHashes();
  }, [text]);

  const copyToClipboard = async (content: string, algo: Algorithm) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(algo);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-red-200 dark:border-red-800/50">
          <Hash size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Hash Generator
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Instantly generate secure cryptographic hashes (SHA) from your text.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Input Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to hash..."
            className="w-full h-32 p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl resize-none text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-sm"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col gap-3">
          {ALGORITHMS.map((algo) => (
            <div key={algo} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {algo}
                </label>
                {hashes[algo] && (
                  <button
                    onClick={() => copyToClipboard(hashes[algo], algo)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    {copied === algo ? (
                      <><Check size={12} className="text-red-500" /> Copied</>
                    ) : (
                      <><Copy size={12} /> Copy</>
                    )}
                  </button>
                )}
              </div>
              <div className="w-full bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-lg p-3 min-h-[42px] flex items-center shadow-inner">
                {hashes[algo] ? (
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all select-all">
                    {hashes[algo]}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Waiting for input...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
