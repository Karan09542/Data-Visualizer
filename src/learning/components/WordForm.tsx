import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  EXAMPLE_MAX_LENGTH,
  MEANING_MAX_LENGTH,
  WORD_MAX_LENGTH,
} from "../services/VocabularyService";
import type { Id, WordInput, WordSet } from "../types";
import type { WordResult } from "../store/useLearningStore";
import { ActionButton, inputClass } from "./primitives";

interface WordFormProps {
  initial?: WordInput;
  submitLabel: string;
  /** Shown when there is more than one set and the word is new. */
  sets?: WordSet[];
  setId?: Id;
  onSetChange?: (id: Id) => void;
  onSubmit: (input: WordInput) => WordResult;
  onCancel: () => void;
  cancelLabel?: string;
  /** Clear and refocus after a successful submit, for adding several words in a row. */
  keepOpen?: boolean;
}

const EMPTY: WordInput = { word: "", meaning: "", example: "" };

export function WordForm({
  initial = EMPTY,
  submitLabel,
  sets,
  setId,
  onSetChange,
  onSubmit,
  onCancel,
  cancelLabel = "Cancel",
  keepOpen,
}: WordFormProps) {
  const [values, setValues] = useState<WordInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof WordInput, string>>>({});
  const [added, setAdded] = useState<string | null>(null);
  const wordRef = useRef<HTMLInputElement>(null);
  const meaningRef = useRef<HTMLInputElement>(null);
  const exampleRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    wordRef.current?.focus();
  }, []);

  const update = (key: keyof WordInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }));
    setAdded(null);
  };

  const submit = () => {
    const result = onSubmit(values);
    if (result.ok === false) {
      setErrors(result.errors);
      const first = result.errors.word ? wordRef : result.errors.meaning ? meaningRef : exampleRef;
      first.current?.focus();
      return;
    }
    if (keepOpen) {
      setValues(EMPTY);
      setErrors({});
      setAdded(result.word.word);
      wordRef.current?.focus();
    }
  };

  const onKeyDown = (next: React.RefObject<HTMLInputElement | null> | null) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey || !next) submit();
    else next.current?.focus();
  };

  const field = (
    key: keyof WordInput,
    label: string,
    ref: React.RefObject<HTMLInputElement | null>,
    next: React.RefObject<HTMLInputElement | null> | null,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <input
        ref={ref}
        id={`${id}-${key}`}
        value={values[key]}
        onChange={update(key)}
        onKeyDown={onKeyDown(next)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        className={cn(inputClass, errors[key] && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/70")}
        {...props}
      />
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form
      className="space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {field("word", "Word", wordRef, meaningRef, {
        placeholder: "e.g. Serendipity",
        maxLength: WORD_MAX_LENGTH,
        autoComplete: "off",
        autoCapitalize: "none",
        spellCheck: false,
        enterKeyHint: "next",
      })}
      {field("meaning", "Meaning", meaningRef, exampleRef, {
        placeholder: "Becomes the clue",
        maxLength: MEANING_MAX_LENGTH,
        autoComplete: "off",
        enterKeyHint: "next",
      })}
      {field("example", "Example sentence (optional)", exampleRef, null, {
        placeholder: "Use the word in a sentence",
        maxLength: EXAMPLE_MAX_LENGTH,
        autoComplete: "off",
        enterKeyHint: "done",
      })}

      {sets && sets.length > 1 && setId && onSetChange && (
        <div>
          <label htmlFor={`${id}-set`} className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Set
          </label>
          <select id={`${id}-set`} value={setId} onChange={(e) => onSetChange(e.target.value)} className={inputClass}>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <ActionButton type="submit" variant="primary">
          {submitLabel}
        </ActionButton>
        <ActionButton variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </ActionButton>
        <span role="status" className="ml-auto truncate text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {added && `Added “${added}”`}
        </span>
      </div>
    </form>
  );
}
