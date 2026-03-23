import { useEffect, useRef, useState, useCallback } from 'react';

const SAVE_INTERVAL_MS = 5000;

export interface UseFormDraftOptions<T> {
  /** Unique key for localStorage, e.g. 'new-action' or 'edit-action-{id}' */
  key: string;
  /** Current form data to persist */
  data: T;
  /** Whether the form has been initialised and is ready to save */
  enabled?: boolean;
}

export interface UseFormDraftReturn<T> {
  /** Stored draft (if any) found when hook mounts */
  draft: T | null;
  /** Accept the draft – caller restores state, then calls clearDraft */
  clearDraft: () => void;
  /** Dismiss the draft without restoring */
  discardDraft: () => void;
  /** Call after successful save to wipe the draft */
  clearAfterSave: () => void;
  /** Visual indicator text */
  draftStatus: 'idle' | 'saving' | 'saved';
}

function storageKey(key: string) {
  return `form-draft:${key}`;
}

export function useFormDraft<T>({
  key,
  data,
  enabled = true,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const [draft, setDraft] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey(key));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });

  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const discardedRef = useRef(false);

  // Periodic auto-save
  useEffect(() => {
    if (!enabled || discardedRef.current) return;

    const interval = setInterval(() => {
      try {
        setDraftStatus('saving');
        localStorage.setItem(storageKey(key), JSON.stringify(data));
        setDraftStatus('saved');
        // Reset to idle after 2s
        setTimeout(() => setDraftStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
      } catch {
        // localStorage full – ignore
      }
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [key, data, enabled]);

  const clearDraft = useCallback(() => {
    setDraft(null);
    localStorage.removeItem(storageKey(key));
  }, [key]);

  const discardDraft = useCallback(() => {
    setDraft(null);
    discardedRef.current = true;
    localStorage.removeItem(storageKey(key));
  }, [key]);

  const clearAfterSave = useCallback(() => {
    localStorage.removeItem(storageKey(key));
    setDraftStatus('idle');
  }, [key]);

  return { draft, clearDraft, discardDraft, clearAfterSave, draftStatus };
}
