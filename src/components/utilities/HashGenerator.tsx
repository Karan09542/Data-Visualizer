import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Hash,
  Copy,
  Check,
  Type,
  FileUp,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Braces,
  X,
  Timer,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { formatFileSize } from "../../lib/formatFileSize";
import HashWorker from "../../utils/hashWorker?worker";
import type { HashFailure, HashResponse } from "../../utils/hashWorker";

/* ─────────────────────────── Algorithms ─────────────────────────── */

type AlgorithmId = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "CRC-32";

interface AlgorithmInfo {
  id: AlgorithmId;
  bits: number;
  /** HMAC block size in bytes; 0 means HMAC doesn't apply */
  blockSize: number;
  strength: "secure" | "legacy" | "checksum";
  note: string;
}

const ALGORITHMS: AlgorithmInfo[] = [
  { id: "MD5", bits: 128, blockSize: 64, strength: "legacy", note: "Fine for file checksums, broken for security" },
  { id: "SHA-1", bits: 160, blockSize: 64, strength: "legacy", note: "Still used by Git, broken for signatures" },
  { id: "SHA-256", bits: 256, blockSize: 64, strength: "secure", note: "The common choice for integrity and signing" },
  { id: "SHA-384", bits: 384, blockSize: 128, strength: "secure", note: "Truncated SHA-512, used in TLS and SRI" },
  { id: "SHA-512", bits: 512, blockSize: 128, strength: "secure", note: "Largest SHA-2 digest" },
  { id: "CRC-32", bits: 32, blockSize: 0, strength: "checksum", note: "Detects accidental changes (ZIP, PNG), not tampering" },
];

type InputEncoding = "utf8" | "hex" | "base64";
type OutputFormat = "hex" | "HEX" | "base64" | "base64url";

const INPUT_ENCODINGS: { id: InputEncoding; label: string }[] = [
  { id: "utf8", label: "UTF-8" },
  { id: "hex", label: "Hex" },
  { id: "base64", label: "Base64" },
];

const OUTPUT_FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "hex", label: "hex" },
  { id: "HEX", label: "HEX" },
  { id: "base64", label: "Base64" },
  { id: "base64url", label: "Base64URL" },
];

/* ─────────────────────────── Byte helpers ─────────────────────────── */

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const formatDigest = (bytes: Uint8Array, format: OutputFormat) => {
  switch (format) {
    case "hex": return toHex(bytes);
    case "HEX": return toHex(bytes).toUpperCase();
    case "base64": return toBase64(bytes);
    case "base64url": return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
};

/** Throws with a readable message when the text isn't valid for the chosen encoding */
const decodeInput = (value: string, encoding: InputEncoding): Uint8Array => {
  if (encoding === "utf8") return new TextEncoder().encode(value);

  if (encoding === "hex") {
    const clean = value.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
    if (!/^[0-9a-f]*$/i.test(clean)) throw new Error("Hex can only contain 0-9 and a-f");
    if (clean.length % 2 !== 0) throw new Error("Hex needs an even number of digits");
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  const clean = value.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    throw new Error("That isn't valid Base64");
  }
};

/** Reads a pasted hash as hex or Base64, whichever fits */
const parseExpectedDigest = (value: string): Uint8Array | null => {
  const clean = value.trim().replace(/^[a-z0-9-]+[:=]/i, "").replace(/\s/g, "");
  if (!clean) return null;
  if (/^[0-9a-f]+$/i.test(clean) && clean.length % 2 === 0) {
    try { return decodeInput(clean, "hex"); } catch { /* fall through */ }
  }
  try { return decodeInput(clean, "base64"); } catch { return null; }
};

const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ─────────────────────────── Component ─────────────────────────── */

const cardClass = "bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm";
const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0d1117] p-0.5">
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        onClick={() => onChange(option.id)}
        aria-pressed={value === option.id}
        className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-colors ${value === option.id
          ? "bg-white dark:bg-[#1f2630] text-slate-800 dark:text-slate-100 shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const StrengthBadge = ({ strength }: { strength: AlgorithmInfo["strength"] }) => {
  if (strength === "secure") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <ShieldCheck size={11} /> Secure
      </span>
    );
  }
  if (strength === "legacy") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <ShieldAlert size={11} /> Legacy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
      Checksum
    </span>
  );
};

export const HashGenerator = () => {
  const [source, setSource] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [inputEncoding, setInputEncoding] = useState<InputEncoding>("utf8");

  const [file, setFile] = useState<{ name: string; size: number; bytes: Uint8Array } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [useHmac, setUseHmac] = useState(false);
  const [hmacKey, setHmacKey] = useState("");
  const [keyEncoding, setKeyEncoding] = useState<InputEncoding>("utf8");
  const [showKey, setShowKey] = useState(false);

  const [enabled, setEnabled] = useState<Set<AlgorithmId>>(new Set(["MD5", "SHA-1", "SHA-256", "SHA-512"]));
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("hex");
  const [expected, setExpected] = useState("");

  const [results, setResults] = useState<Partial<Record<AlgorithmId, Uint8Array>>>({});
  const [inputError, setInputError] = useState("");
  const [inputBytes, setInputBytes] = useState(0);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);

  // One worker for the tool's lifetime; results are matched to the latest request by id
  useEffect(() => {
    const worker = new HashWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<HashResponse>) => {
      const data = e.data;
      if (data.id !== runIdRef.current) return; // a newer request already went out
      if (data.success) {
        const next: Partial<Record<AlgorithmId, Uint8Array>> = {};
        for (const [algo, buffer] of Object.entries(data.results)) {
          next[algo as AlgorithmId] = new Uint8Array(buffer);
        }
        setResults(next);
        setElapsedMs(data.elapsedMs);
        setIsHashing(false);
      } else {
        // The project builds without strictNullChecks, so the union does not narrow on its own here
        setInputError((data as HashFailure).error);
        setResults({});
        setElapsedMs(null);
        setIsHashing(false);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const activeAlgorithms = ALGORITHMS.filter((a) => enabled.has(a.id));

  useEffect(() => {
    const runId = ++runIdRef.current;
    const hasInput = source === "text" ? text.length > 0 : !!file;

    if (!hasInput) {
      setResults({});
      setInputError("");
      setInputBytes(0);
      setElapsedMs(null);
      setIsHashing(false);
      return;
    }

    // A short pause while typing, so every keystroke doesn't start a new round
    const timer = setTimeout(() => {
      let message: Uint8Array;
      let key: Uint8Array | null = null;
      try {
        message = source === "text" ? decodeInput(text, inputEncoding) : file!.bytes;
        if (useHmac) key = decodeInput(hmacKey, keyEncoding);
      } catch (err) {
        setInputError(err instanceof Error ? err.message : "Couldn't read the input");
        setResults({});
        setElapsedMs(null);
        setIsHashing(false);
        return;
      }

      setInputError("");
      setInputBytes(message.length);
      setIsHashing(true);

      const algorithms = ALGORITHMS.filter((a) => enabled.has(a.id)).map((a) => a.id);
      // The buffers are transferred, so copy first: the file's bytes must survive for later runs
      const messageBuffer = message.slice().buffer;
      const keyBuffer = key ? key.slice().buffer : null;
      workerRef.current?.postMessage(
        { id: runId, algorithms, message: messageBuffer, key: keyBuffer },
        keyBuffer ? [messageBuffer, keyBuffer] : [messageBuffer],
      );
    }, source === "text" ? 150 : 0);

    return () => clearTimeout(timer);
  }, [source, text, inputEncoding, file, useHmac, hmacKey, keyEncoding, enabled]);

  const expectedBytes = useMemo(() => parseExpectedDigest(expected), [expected]);
  const matchedAlgorithm = expectedBytes
    ? activeAlgorithms.find((a) => results[a.id] && bytesEqual(results[a.id]!, expectedBytes))
    : undefined;

  const loadFile = async (picked: File) => {
    setIsReadingFile(true);
    try {
      const buffer = await picked.arrayBuffer();
      setFile({ name: picked.name, size: picked.size, bytes: new Uint8Array(buffer) });
      setSource("file");
    } catch (err) {
      console.error("Couldn't read the file", err);
      setInputError("Couldn't read that file");
    } finally {
      setIsReadingFile(false);
    }
  };

  const toggleAlgorithm = (id: AlgorithmId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyText = async (content: string, key: string) => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const formatted = activeAlgorithms
    .filter((a) => results[a.id])
    .map((a) => ({ id: a.id, value: formatDigest(results[a.id]!, outputFormat) }));

  const copyAllText = () => {
    const label = useHmac ? "HMAC-" : "";
    const width = Math.max(...formatted.map((f) => label.length + f.id.length));
    copyText(formatted.map((f) => `${(label + f.id).padEnd(width)}  ${f.value}`).join("\n"), "all-text");
  };

  const copyAllJson = () => {
    const payload: Record<string, unknown> = {
      input: source === "file" && file ? { file: file.name, bytes: file.size } : { bytes: inputBytes, encoding: inputEncoding },
      hmac: useHmac,
      format: outputFormat,
      hashes: Object.fromEntries(formatted.map((f) => [f.id, f.value])),
    };
    copyText(JSON.stringify(payload, null, 2), "all-json");
  };

  const hasResults = formatted.length > 0;

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center border border-red-200 dark:border-red-800/50">
              <Hash size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Hash Generator</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                MD5, SHA-1/2, CRC-32 and HMAC for text or files. Everything runs in your browser.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
          {/* ───────── Left: input ───────── */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0d1117] p-0.5">
                  {([
                    { id: "text", label: "Text", icon: Type },
                    { id: "file", label: "File", icon: FileUp },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSource(id)}
                      aria-pressed={source === id}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${source === id
                        ? "bg-white dark:bg-[#1f2630] text-slate-800 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        }`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
                {source === "text" && (
                  <Segmented<InputEncoding> options={INPUT_ENCODINGS} value={inputEncoding} onChange={setInputEncoding} />
                )}
              </div>

              {source === "text" ? (
                <div className="relative">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      inputEncoding === "utf8"
                        ? "Type or paste text to hash…"
                        : inputEncoding === "hex"
                          ? "48 65 6c 6c 6f  or  0x48656c6c6f"
                          : "SGVsbG8gd29ybGQ="
                    }
                    className="block w-full h-48 p-4 bg-transparent resize-y font-mono text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none"
                    spellCheck={false}
                  />
                  {text && (
                    <button
                      type="button"
                      onClick={() => setText("")}
                      title="Clear"
                      className="absolute top-2 right-2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (picked) loadFile(picked);
                      e.target.value = "";
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragOver(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped) loadFile(dropped);
                    }}
                    className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors ${isDragOver
                      ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                      : "border-slate-300 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500/60"
                      }`}
                  >
                    {isReadingFile ? (
                      <Loader2 size={22} className="animate-spin text-red-500" />
                    ) : file ? (
                      <>
                        <FileUp size={22} className="text-red-500" />
                        <span className="max-w-full truncate font-mono text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
                        <span className="text-xs text-slate-400">{formatFileSize(file.size)} · click or drop to replace</span>
                      </>
                    ) : (
                      <>
                        <FileUp size={22} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Drop a file or click to choose</span>
                        <span className="text-xs text-slate-400">Any file type. Nothing is uploaded.</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0d1117]/60 px-3 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {inputError ? (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle size={12} /> {inputError}
                  </span>
                ) : (
                  <>
                    <span>{inputBytes.toLocaleString()} bytes</span>
                    {source === "text" && <span>{text.length.toLocaleString()} chars</span>}
                    {elapsedMs !== null && (
                      <span className="flex items-center gap-1">
                        <Timer size={11} /> {elapsedMs < 1 ? "<1" : elapsedMs.toFixed(0)} ms
                      </span>
                    )}
                    {isHashing && <Loader2 size={11} className="animate-spin" />}
                  </>
                )}
              </div>
            </div>

            {/* HMAC */}
            <div className={`${cardClass} p-4 flex flex-col gap-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound size={15} className="text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">HMAC</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Sign the input with a secret key</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useHmac}
                  onClick={() => setUseHmac((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#161b22] ${useHmac ? "bg-red-500" : "bg-slate-300 dark:bg-slate-700"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${useHmac ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
                </button>
              </div>

              {useHmac && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={labelClass}>Secret key</span>
                    <Segmented<InputEncoding> options={INPUT_ENCODINGS} value={keyEncoding} onChange={setKeyEncoding} />
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={hmacKey}
                      onChange={(e) => setHmacKey(e.target.value)}
                      placeholder="your-secret-key"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1117] py-2 pl-3 pr-9 font-mono text-[13px] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      title={showKey ? "Hide key" : "Show key"}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {enabled.has("CRC-32") && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">CRC-32 is skipped: it isn't a keyed hash.</p>
                  )}
                </div>
              )}
            </div>

            {/* Verify */}
            <div className={`${cardClass} p-4 flex flex-col gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className={labelClass}>Compare with a known hash</span>
                {expected && (
                  <button type="button" onClick={() => setExpected("")} className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    Clear
                  </button>
                )}
              </div>
              <input
                type="text"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="Paste a hex or Base64 digest, e.g. from a download page"
                spellCheck={false}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1117] px-3 py-2 font-mono text-[13px] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
              {expected.trim() && hasResults && (
                matchedAlgorithm ? (
                  <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Match: this is the {useHmac ? "HMAC-" : ""}{matchedAlgorithm.id} of the input
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400">
                    <XCircle size={14} />
                    {expectedBytes ? "No match with any enabled algorithm" : "That doesn't look like a hex or Base64 hash"}
                  </p>
                )
              )}
            </div>
          </div>

          {/* ───────── Right: output ───────── */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className={`${cardClass} p-3 flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={labelClass}>Algorithms</span>
                <div className="flex items-center gap-2">
                  <span className={labelClass}>Output</span>
                  <Segmented<OutputFormat> options={OUTPUT_FORMATS} value={outputFormat} onChange={setOutputFormat} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALGORITHMS.map((info) => {
                  const on = enabled.has(info.id);
                  return (
                    <button
                      key={info.id}
                      type="button"
                      onClick={() => toggleAlgorithm(info.id)}
                      aria-pressed={on}
                      title={info.note}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${on
                        ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                        }`}
                    >
                      {on && <Check size={12} />}
                      {info.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5">
                <span className={labelClass}>{useHmac ? "HMAC digests" : "Digests"}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={copyAllText}
                    disabled={!hasResults}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {copied === "all-text" ? <Check size={12} /> : <Copy size={12} />} Copy all
                  </button>
                  <button
                    type="button"
                    onClick={copyAllJson}
                    disabled={!hasResults}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {copied === "all-json" ? <Check size={12} /> : <Braces size={12} />} JSON
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeAlgorithms.map((info) => {
                  const bytes = results[info.id];
                  const value = bytes ? formatDigest(bytes, outputFormat) : "";
                  const skipped = useHmac && info.blockSize === 0;
                  const isMatch = matchedAlgorithm?.id === info.id;
                  const key = `row-${info.id}`;
                  return (
                    <div key={info.id} className={`px-4 py-3 transition-colors ${isMatch ? "bg-emerald-500/5" : ""}`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
                            {useHmac && !skipped ? "HMAC-" : ""}{info.id}
                          </span>
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                            {info.bits} bit
                          </span>
                          <StrengthBadge strength={info.strength} />
                          {isMatch && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={11} /> Match
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(value, key)}
                          disabled={!value}
                          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
                        >
                          {copied === key ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          {copied === key ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div
                        className={`rounded-lg border px-3 py-2 font-mono text-[12.5px] leading-relaxed break-all ${isMatch
                          ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1117] text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        {skipped ? (
                          <span className="font-sans text-xs italic text-slate-400">Not available with HMAC</span>
                        ) : value ? (
                          <span className="select-all">{value}</span>
                        ) : (
                          <span className="font-sans text-xs italic text-slate-400">
                            {inputError ? "Fix the input to see a hash" : "Waiting for input…"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        {info.note}
                        {value && <span className="font-mono"> · {value.length} chars</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
