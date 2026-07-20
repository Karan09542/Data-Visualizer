import React, { useEffect, useState } from "react";

export const FilterSlider = ({ label, min, max, step, onChange, value }: any) => {
   const [val, setVal] = useState(value !== undefined ? value : 0);

   useEffect(() => {
      if (value !== undefined) setVal(value);
   }, [value]);
   
   return (
      <div className="py-1">
         <div className="flex justify-between items-center text-[11px] text-[#A0A0A0] mb-2 font-semibold md:text-[10px]">
           <span>{label}</span>
           <span className="bg-[#181818] px-2 py-0.5 rounded border border-[#3A3A3A] min-w-[36px] text-center font-mono">{val}</span>
         </div>
         <input 
           type="range" min={min} max={max} step={step} value={val} 
           onClick={(e) => e.stopPropagation()} 
           onChange={(e) => {
              const v = Number(e.target.value);
              setVal(v);
              if (onChange) onChange(v);
           }} 
           className="w-full accent-blue-500 hover:accent-blue-400 h-2 md:h-1 bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer" 
         />
      </div>
   );
};
