import { useId, useMemo, useState } from "react";
import { parseWordList } from "../services/VocabularyService";
import type { Id, WordSet } from "../types";
import { ActionButton, inputClass } from "./primitives";

interface BulkImportProps {
  sets: WordSet[];
  setId: Id;
  onImport: (setId: Id, inputs: ReturnType<typeof parseWordList>[number]["input"][]) => void;
  onCancel: () => void;
}

/** Paste many words at once: one per line, from notes or a spreadsheet. */
export function BulkImport({ sets, setId: initialSet, onImport, onCancel }: BulkImportProps) {
  const [text, setText] = useState("");
  const [setId, setSetId] = useState(initialSet);
  const id = useId();
  const parsed = useMemo(() => parseWordList(text), [text]);
  const ready = parsed.filter((p) => !p.error);
  const problems = parsed.filter((p) => p.error);

  return (
    <div className="space-y-3.5">
      <div>
        <label htmlFor={`${id}-text`} className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          One word per line
        </label>
        <textarea
          id={`${id}-text`}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={"candid - frank and honest - She gave a candid answer.\nresilient: able to recover quickly\nserene | calm and peaceful"}
          className={`${inputClass} min-h-36 resize-y py-3 font-mono text-[13px] leading-relaxed`}
        />
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Separate word, meaning and example with a dash, colon, pipe or tab. Spreadsheet columns paste as they are.
        </p>
      </div>

      {sets.length > 1 && (
        <div>
          <label htmlFor={`${id}-set`} className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Add to set
          </label>
          <select id={`${id}-set`} value={setId} onChange={(e) => setSetId(e.target.value)} className={inputClass}>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {parsed.length > 0 && (
        <div role="status" className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">{ready.length}</span> ready to add
          {problems.length > 0 && (
            <>
              {" · "}
              <span className="text-amber-700 dark:text-amber-400">
                {problems.length} skipped (
                {problems
                  .slice(0, 3)
                  .map((p) => `line ${p.line}: ${p.error?.toLowerCase()}`)
                  .join(", ")}
                {problems.length > 3 ? ", …" : ""})
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <ActionButton
          variant="primary"
          disabled={ready.length === 0}
          onClick={() => onImport(setId, ready.map((p) => p.input))}
        >
          {ready.length ? `Add ${ready.length} ${ready.length === 1 ? "word" : "words"}` : "Add words"}
        </ActionButton>
        <ActionButton variant="ghost" onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}
