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

interface PythonIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export const PythonIcon = ({
  size = 14,
  className,
  ...props
}: PythonIconProps) => {
  return (
    <svg 
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Python"
      {...props}
    >
    <g id="SVGRepo_bgCarrier" strokeWidth="0"/>
    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"/>
    <g id="SVGRepo_iconCarrier">
    <path fillRule="evenodd" clipRule="evenodd" d="M13.0164 2C10.8193 2 9.03825 3.72453 9.03825 5.85185V8.51852H15.9235V9.25926H5.97814C3.78107 9.25926 2 10.9838 2 13.1111L2 18.8889C2 21.0162 3.78107 22.7407 5.97814 22.7407H8.27322V19.4815C8.27322 17.3542 10.0543 15.6296 12.2514 15.6296H19.5956C21.4547 15.6296 22.9617 14.1704 22.9617 12.3704V5.85185C22.9617 3.72453 21.1807 2 18.9836 2H13.0164ZM12.0984 6.74074C12.8589 6.74074 13.4754 6.14378 13.4754 5.40741C13.4754 4.67103 12.8589 4.07407 12.0984 4.07407C11.3378 4.07407 10.7213 4.67103 10.7213 5.40741C10.7213 6.14378 11.3378 6.74074 12.0984 6.74074Z" fill="url(#paint0_linear_87_8204)"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M18.9834 30C21.1805 30 22.9616 28.2755 22.9616 26.1482V23.4815L16.0763 23.4815L16.0763 22.7408L26.0217 22.7408C28.2188 22.7408 29.9998 21.0162 29.9998 18.8889V13.1111C29.9998 10.9838 28.2188 9.25928 26.0217 9.25928L23.7266 9.25928V12.5185C23.7266 14.6459 21.9455 16.3704 19.7485 16.3704L12.4042 16.3704C10.5451 16.3704 9.03809 17.8296 9.03809 19.6296L9.03809 26.1482C9.03809 28.2755 10.8192 30 13.0162 30H18.9834ZM19.9015 25.2593C19.1409 25.2593 18.5244 25.8562 18.5244 26.5926C18.5244 27.329 19.1409 27.9259 19.9015 27.9259C20.662 27.9259 21.2785 27.329 21.2785 26.5926C21.2785 25.8562 20.662 25.2593 19.9015 25.2593Z" fill="url(#paint1_linear_87_8204)"/>
    <defs>
      <linearGradient id="paint0_linear_87_8204" x1="12.4809" y1="2" x2="12.4809" y2="22.7407" gradientUnits="userSpaceOnUse">
        <stop stopColor="#327EBD"/>
        <stop offset="1" stopColor="#1565A7"/>
      </linearGradient>
      <linearGradient id="paint1_linear_87_8204" x1="19.519" y1="9.25928" x2="19.519" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFDA4B"/>
        <stop offset="1" stopColor="#F9C600"/>
      </linearGradient>
    </defs>
    </g>
    </svg>
  );
};

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
