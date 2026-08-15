import React, { useState, useEffect } from "react";
import { Key, Copy, Check, AlertCircle, Unlock, Lock } from "lucide-react";
import { SignJWT } from "jose";
import CustomSelect from "../CustomSelect";

export const JwtDecoder = () => {
  const [activeTab, setActiveTab] = useState<"decode" | "encode">("decode");

  // Decode State
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState<{ header: any; payload: any } | null>(null);
  const [decodeError, setDecodeError] = useState("");

  // Encode State
  const [encodePayload, setEncodePayload] = useState('{\n  "sub": "1234567890",\n  "name": "Ramesh",\n  "iat": 1516239022\n}');
  const [encodeSecret, setEncodeSecret] = useState("your-256-bit-secret");
  const [encodeAlgo, setEncodeAlgo] = useState("HS256");
  const [generatedToken, setGeneratedToken] = useState("");
  const [encodeError, setEncodeError] = useState("");

  const [copied, setCopied] = useState<"header" | "payload" | "generated" | null>(null);

  const decodeToken = (jwt: string) => {
    setToken(jwt);
    setDecodeError("");
    setDecoded(null);

    if (!jwt.trim()) return;

    const parts = jwt.split(".");
    if (parts.length !== 3) {
      setDecodeError("Invalid JWT format. Expected 3 parts separated by dots.");
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
      setDecodeError("Failed to decode token. Invalid Base64 or JSON payload.");
    }
  };

  useEffect(() => {
    const generateToken = async () => {
      if (activeTab !== "encode") return;
      try {
        const payloadObj = JSON.parse(encodePayload);
        const secretKey = new TextEncoder().encode(encodeSecret);
        const jwt = await new SignJWT(payloadObj)
          .setProtectedHeader({ alg: encodeAlgo })
          .sign(secretKey);
        setGeneratedToken(jwt);
        setEncodeError("");
      } catch (err: any) {
        setEncodeError(err.message || "Invalid input for encoding");
        setGeneratedToken("");
      }
    };
    generateToken();
  }, [encodePayload, encodeSecret, encodeAlgo, activeTab]);

  const copyToClipboard = async (content: any, type: "header" | "payload" | "generated", isString = false) => {
    try {
      const textToCopy = isString ? content : JSON.stringify(content, null, 2);
      await navigator.clipboard.writeText(textToCopy);
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
          JWT Studio
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Decode existing tokens or generate new ones.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-full max-w-md mx-auto mb-8">
        <button
          onClick={() => setActiveTab("decode")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === "decode"
              ? "bg-white dark:bg-[#161b22] text-amber-600 dark:text-amber-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
        >
          <Unlock size={16} />
          Decode
        </button>
        <button
          onClick={() => setActiveTab("encode")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === "encode"
              ? "bg-white dark:bg-[#161b22] text-amber-600 dark:text-amber-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
        >
          <Lock size={16} />
          Encode
        </button>
      </div>

      {activeTab === "decode" && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Encoded Token
            </label>
            <textarea
              value={token}
              onChange={(e) => decodeToken(e.target.value)}
              placeholder="eyJhY2NvdW50X2lkIjoxMjM0NSwiaWF0IjoxNTE2MjM5MDIyfQ..."
              className={`w-full h-24 p-4 bg-white dark:bg-[#161b22] border rounded-xl resize-none text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm break-all ${decodeError ? "border-red-400 ring-1 ring-red-400/50" : "border-slate-200 dark:border-slate-800"}`}
              spellCheck={false}
            />
            {decodeError && (
              <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle size={14} /> {decodeError}
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
      )}

      {activeTab === "encode" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Algorithm
              </label>
              <CustomSelect
                value={encodeAlgo}
                onChange={(val) => setEncodeAlgo(val)}
                className="w-full"
                options={[
                  { label: "HS256 (HMAC with SHA-256)", value: "HS256" },
                  { label: "HS384 (HMAC with SHA-384)", value: "HS384" },
                  { label: "HS512 (HMAC with SHA-512)", value: "HS512" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Payload (JSON)
              </label>
              <textarea
                value={encodePayload}
                onChange={(e) => setEncodePayload(e.target.value)}
                className="w-full h-48 p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl resize-none text-sm font-mono text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
                spellCheck={false}
              />
              {encodeError && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1.5">
                  <AlertCircle size={14} /> {encodeError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Secret Key
              </label>
              <input
                type="text"
                value={encodeSecret}
                onChange={(e) => setEncodeSecret(e.target.value)}
                className="w-full p-3 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-mono text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm"
                placeholder="Enter secret key..."
              />
            </div>
          </div>

          <div className="flex flex-col h-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Generated Token
              </span>
              <button
                onClick={() => copyToClipboard(generatedToken, "generated", true)}
                className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title="Copy Token"
                disabled={!generatedToken}
              >
                {copied === "generated" ? <Check size={14} className="text-amber-500" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex-1 p-4 bg-transparent">
              {generatedToken ? (
                <textarea
                  readOnly
                  value={generatedToken}
                  className="w-full h-full bg-transparent resize-none text-sm font-mono text-slate-800 dark:text-slate-200 focus:outline-none break-all"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm italic">
                  Token will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
