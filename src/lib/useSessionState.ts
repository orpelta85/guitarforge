"use client";
import { useState, useEffect, Dispatch, SetStateAction } from "react";

/**
 * Like useState but persists to sessionStorage so refresh preserves value.
 * Value survives F5; cleared when tab closes.
 */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {}
    return initial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (state === null || state === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}
