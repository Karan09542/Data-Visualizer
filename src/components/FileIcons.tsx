import React from "react";

export const JavaScriptIcon = () => (
  <div className="w-[14px] h-[14px] rounded bg-[#f7df1e] text-black font-sans font-extrabold text-[8px] flex items-end justify-end pr-[1px] pb-[0.3px] select-none shrink-0" style={{ width: '14px', height: '14px' }}>
    JS
  </div>
);

export const TypeScriptIcon = () => (
  <div className="w-[14px] h-[14px] rounded bg-[#3178c6] text-white font-sans font-extrabold text-[8px] flex items-end justify-end pr-[1px] pb-[0.3px] select-none shrink-0" style={{ width: '14px', height: '14px' }}>
    TS
  </div>
);

export const PythonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 110 110" className="shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px' }}>
    <path d="M51.8 1.4C30.6 1.4 32.2 10.5 32.2 14.8v10.1h20.4V28H23.8C9.5 28 1.4 34.6 1.4 51.7c0 17 8.3 22.4 18.5 22.4h11V58c0-8.9 7.7-16.7 16.7-16.7H75V25c0-14.8-10.7-23.6-23.2-23.6z" fill="#387EB8"/>
    <path d="M58.2 108.6C79.4 108.6 77.8 99.5 77.8 95.2V85.1H57.4V82h28.8c14.3 0 22.4-6.6 22.4-23.7C108.6 41.3 100.3 36 90.1 36h-11v16.1c0 8.9-7.7 16.7-16.7 16.7H35V85c0 14.8 10.7 23.6 23.2 23.6z" fill="#FFE052"/>
    <circle cx="41.3" cy="11.4" r="5.5" fill="#F4F4F4"/>
    <circle cx="68.8" cy="98.6" r="5.5" fill="#387EBA"/>
  </svg>
);

export const JsonIcon = () => (
  <div className="w-[14px] h-[14px] rounded bg-[#cb7c0a] text-white font-sans font-bold text-[8px] flex items-center justify-center select-none shrink-0" style={{ width: '14px', height: '14px' }}>
    {"{}"}
  </div>
);

export const MarkdownIcon = () => (
  <div className="w-[14px] h-[14px] rounded bg-[#0083fd] text-white font-sans font-bold text-[8px] flex items-center justify-center select-none shrink-0" style={{ width: '14px', height: '14px' }}>
    MD
  </div>
);

export const TextIcon = () => (
  <div className="w-[14px] h-[14px] rounded bg-[#8292a6] dark:bg-[#5c6f84] text-white font-sans font-bold text-[7px] flex items-center justify-center select-none shrink-0" style={{ width: '14px', height: '14px' }}>
    TXT
  </div>
);
