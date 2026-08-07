import React, { useState } from "react";
import { Key, Copy, Check, AlertCircle } from "lucide-react";

export const JwtDecoder = () => {
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState<{ header: any; payload: any } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"header" | "payload" | null>(null);

  const decodeToken = (jwt: string) => {
    setToken(jwt);
    setError("");
    setDecoded(null);

    if (!jwt.trim()) return;

    const parts = jwt.split(".");
    if (parts.length !== 3) {
      setError("Invalid JWT format. Expected 3 parts separated by dots.");
      return;
    }

    try {
      // Decode Base64Url to Base64
      const base64UrlToJSON = (str: string) => {
        const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(jsonPayload);
      };

      const header = base64UrlToJSON(parts[0]);
      const payload = base64UrlToJSON(parts[1]);

      setDecoded({ header, payload });
    } catch (err) {
      setError("Failed to decode token. Invalid Base64 or JSON payload.");
    }
  };

  const copyToClipboard = async (content: any, type: "header" | "payload") => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-amber-200 dark:border-amber-800/50">
          <Key size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          JWT Decoder
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Paste your JSON Web Token to instantly decode the header and payload.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Encoded Token
          </label>
          <textarea
            value={token}
            onChange={(e) => decodeToken(e.target.value)}
            placeholder="eyJhY2NvdW50X2lkIjoxMjM0NSwiaWF0IjoxNTE2MjM5MDIyfQ..."
            className={`w-full h-24 p-4 bg-white dark:bg-[#161b22] border rounded-xl resize-none text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm break-all ${error ? "border-red-400 ring-1 ring-red-400/50" : "border-slate-200 dark:border-slate-800"}`}
            spellCheck={false}
          />
          {error && (
            <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        {decoded && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Header */}
            <div className="flex flex-col h-[350px] bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Header <span className="text-slate-400 font-normal lowercase ml-1">(Algorithm & Type)</span>
                </span>
                <button
                  onClick={() => copyToClipboard(decoded.header, "header")}
                  className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title="Copy Header"
                >
                  {copied === "header" ? <Check size={14} className="text-amber-500" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-transparent">
                <pre className="text-xs font-mono text-amber-700 dark:text-amber-400 m-0">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </div>
            </div>

            {/* Payload */}
            <div className="flex flex-col h-[350px] bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Payload <span className="text-slate-400 font-normal lowercase ml-1">(Data)</span>
                </span>
                <button
                  onClick={() => copyToClipboard(decoded.payload, "payload")}
                  className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title="Copy Payload"
                >
                  {copied === "payload" ? <Check size={14} className="text-amber-500" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-transparent">
                <pre className="text-xs font-mono text-blue-600 dark:text-blue-400 m-0">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
