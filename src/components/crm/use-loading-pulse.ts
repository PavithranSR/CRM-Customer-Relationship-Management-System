"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_LOADING_DURATION_MS = 700;

export function useLoadingPulse(durationMs = 0) {
  const timeoutRef = useRef<number | null>(null);
  const maxTimeoutRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number>(0);
  const [isActive, setIsActive] = useState(false);

  const clearTimeoutRef = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (maxTimeoutRef.current !== null) {
      window.clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimeoutRef();
    visibleSinceRef.current = performance.now();
    setIsActive(true);

    maxTimeoutRef.current = window.setTimeout(() => {
      maxTimeoutRef.current = null;
      setIsActive(false);
    }, MAX_LOADING_DURATION_MS);
  }, [clearTimeoutRef]);

  const hide = useCallback((nextDurationMs?: number) => {
    clearTimeoutRef();

    const elapsed = performance.now() - visibleSinceRef.current;
    const remainingDuration = Math.max(0, (nextDurationMs ?? durationMs) - elapsed);

    if (remainingDuration === 0) {
      setIsActive(false);
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setIsActive(false);
    }, remainingDuration);
  }, [clearTimeoutRef, durationMs]);

  const trigger = useCallback((nextDurationMs?: number) => {
    show();
    hide(nextDurationMs);
  }, [hide, show]);

  const run = useCallback((action: () => void | Promise<void>, nextDurationMs?: number) => {
    show();
    void Promise.resolve()
      .then(action)
      .finally(() => {
        hide(nextDurationMs);
      });
  }, [hide, show]);

  useEffect(() => {
    return () => {
      clearTimeoutRef();
    };
  }, [clearTimeoutRef]);

  return { isActive, trigger, run };
}
