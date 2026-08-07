import React, { useState, useRef } from "react";
import { FileSpreadsheet, Download, Copy, Check, Upload, AlertCircle } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export const CsvToJsonConverter = () => {
  const [jsonData, setJsonData] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError("");
    setJsonData("");
    setFileName(file.name.replace(/\.[^/.]+$/, "")); // Remove extension

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Error parsing CSV: ${results.errors[0].message}`);
          } else {
            setJsonData(JSON.stringify(results.data, null, 2));
          }
        },
        error: (err) => {
          setError(`Error reading file: ${err.message}`);
        }
      });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        setJsonData(JSON.stringify(data, null, 2));
      } catch (err: any) {
        setError(`Error parsing Excel file: ${err.message || "Unknown error"}`);
      }
    } else {
      setError("Unsupported file format. Please upload a .csv or .xlsx file.");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    // Clear input so same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const copyToClipboard = async () => {
    if (!jsonData) return;
    try {
      await navigator.clipboard.writeText(jsonData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const downloadJson = () => {
    if (!jsonData) return;
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "data"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col items-stretch justify-start p-6 md:p-8 overflow-y-auto w-full max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200 dark:border-blue-800/50">
          <FileSpreadsheet size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          CSV/Excel to JSON
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Convert spreadsheets into clean, formatted JSON arrays instantly.
        </p>
      </div>

      {!jsonData ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl bg-slate-50 dark:bg-[#161b22]/50 flex flex-col items-center justify-center cursor-pointer transition-colors mb-6 group"
        >
          <Upload
            size={32}
            className="text-slate-400 group-hover:text-blue-500 mb-3 transition-colors"
          />
          <span className="text-slate-600 dark:text-slate-300 font-medium text-lg mb-1">
            Click or drag to upload
          </span>
          <span className="text-slate-400 text-sm">Supports .csv, .xlsx, .xls</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex flex-col h-[500px] bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {fileName}.json
              </span>
              <button
                onClick={() => {
                  setJsonData("");
                  setFileName("");
                }}
                className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
              >
                Upload different file
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={downloadJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-sm"
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-[#f8fafc] dark:bg-[#0d1117]">
            <pre className="text-xs font-mono text-slate-800 dark:text-slate-300 m-0">
              {jsonData}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};
