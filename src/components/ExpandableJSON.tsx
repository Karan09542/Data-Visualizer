import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

export function ExpandableJSON({ value, defaultExpanded = false, level = 0 }: { value: any, defaultExpanded?: boolean, level?: number }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (value === null) return <span className="text-slate-500 font-bold">null</span>;
  if (value === undefined) return <span className="text-slate-400">undefined</span>;
  if (typeof value === 'boolean') return <span className="text-blue-500">{value ? 'true' : 'false'}</span>;
  if (typeof value === 'number') return <span className="text-blue-400">{value}</span>;
  if (typeof value === 'string') return <span className="text-green-500">"{value}"</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500">[]</span>;
    return (
      <div className="inline-flex mt-0.5">
        <div className="flex items-start">
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded mr-1">
            {expanded ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
          </button>
          <span>
            {expanded ? (
              <span className="text-slate-600 dark:text-slate-400">
                Array({value.length}) {'['}
                <div className="pl-4 border-l border-slate-200 dark:border-slate-800 ml-1.5 my-1">
                  {value.map((v, i) => (
                    <div key={i} className="flex gap-2">
                       <span className="text-slate-400 select-none">{i}:</span>
                       <ExpandableJSON value={v} level={level + 1} />
                    </div>
                  ))}
                </div>
                {']'}
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-400 cursor-pointer" onClick={() => setExpanded(true)}>
                Array({value.length}) {'[...]'}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return <span className="text-slate-500">{'{ }'}</span>;
    return (
      <div className="inline-flex mt-0.5">
        <div className="flex items-start">
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded mr-1">
            {expanded ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
          </button>
          <span>
            {expanded ? (
              <span className="text-slate-600 dark:text-slate-400">
                Object {'{'}
                <div className="pl-4 border-l border-slate-200 dark:border-slate-800 ml-1.5 my-1">
                  {keys.map((k) => (
                    <div key={k} className="flex gap-2">
                       <span className="text-purple-500 font-medium">{k}:</span>
                       <ExpandableJSON value={value[k]} level={level + 1} />
                    </div>
                  ))}
                </div>
                {'}'}
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-400 cursor-pointer" onClick={() => setExpanded(true)}>
                Object {'{...}'}
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return <span>{String(value)}</span>;
}
