"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/loader";

type LoadingToken = number;

interface GlobalLoadingOptions {
  minDurationMs?: number;
  maxDurationMs?: number;
}

interface GlobalLoadingContextValue {
  hide: (token: LoadingToken) => void;
  pulse: (durationMs?: number) => void;
  run: <T>(action: () => T | Promise<T>, options?: GlobalLoadingOptions) => Promise<T>;
  show: (options?: GlobalLoadingOptions) => LoadingToken;
}

interface LoadingEntry {
  maxTimeoutId: number | null;
  minDurationMs: number;
  releaseTimeoutId: number | null;
  startedAt: number;
}

const DEFAULT_MIN_DURATION_MS = 0;
const DEFAULT_MAX_DURATION_MS = 700;
const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

function isHTMLElement(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement;
}

function isInternalNavigationAnchor(anchor: HTMLAnchorElement, event: MouseEvent) {
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }

  if (anchor.hasAttribute("download") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return false;
  }

  const nextUrl = new URL(anchor.href, window.location.href);
  const currentUrl = new URL(window.location.href);

  return (
    nextUrl.origin === currentUrl.origin &&
    (nextUrl.pathname !== currentUrl.pathname ||
      nextUrl.search !== currentUrl.search ||
      nextUrl.hash !== currentUrl.hash)
  );
}

function shouldSkipControl(element: HTMLElement) {
  if (element.closest('[data-skip-global-loading="true"]')) {
    return true;
  }

  const role = element.getAttribute("role");
  if (role === "tab" || role === "switch" || role === "checkbox" || role === "radio" || role === "combobox") {
    return true;
  }

  if (element.getAttribute("aria-haspopup")) {
    return true;
  }

  if (
    element.matches(
      '[data-slot="dialog-trigger"], [data-slot="dropdown-menu-trigger"], [data-slot="popover-trigger"], [data-slot="select-trigger"], [data-slot="sheet-trigger"]'
    )
  ) {
    return true;
  }

  if (element instanceof HTMLButtonElement) {
    return element.disabled || element.type === "reset";
  }

  if (element instanceof HTMLInputElement) {
    return element.disabled;
  }

  return false;
}

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsValue = searchParams.toString();
  const nextTokenRef = useRef(1);
  const entriesRef = useRef<Map<LoadingToken, LoadingEntry>>(new Map());
  const navigationTokenRef = useRef<LoadingToken | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  const syncVisibleCount = useCallback(() => {
    setVisibleCount(entriesRef.current.size);
  }, []);

  const clearEntryTimeouts = useCallback((entry: LoadingEntry) => {
    if (entry.releaseTimeoutId !== null) {
      window.clearTimeout(entry.releaseTimeoutId);
      entry.releaseTimeoutId = null;
    }

    if (entry.maxTimeoutId !== null) {
      window.clearTimeout(entry.maxTimeoutId);
      entry.maxTimeoutId = null;
    }
  }, []);

  const finalizeHide = useCallback(
    (token: LoadingToken) => {
      const entry = entriesRef.current.get(token);
      if (!entry) {
        return;
      }

      clearEntryTimeouts(entry);
      entriesRef.current.delete(token);
      syncVisibleCount();
    },
    [clearEntryTimeouts, syncVisibleCount]
  );

  const hide = useCallback(
    (token: LoadingToken) => {
      const entry = entriesRef.current.get(token);
      if (!entry) {
        return;
      }

      if (entry.releaseTimeoutId !== null) {
        return;
      }

      const elapsed = performance.now() - entry.startedAt;
      const remainingDuration = Math.max(0, entry.minDurationMs - elapsed);

      if (remainingDuration === 0) {
        finalizeHide(token);
        return;
      }

      entry.releaseTimeoutId = window.setTimeout(() => {
        finalizeHide(token);
      }, remainingDuration);
    },
    [finalizeHide]
  );

  const show = useCallback(
    (options?: GlobalLoadingOptions) => {
      const token = nextTokenRef.current++;
      const entry: LoadingEntry = {
        maxTimeoutId: null,
        minDurationMs: options?.minDurationMs ?? DEFAULT_MIN_DURATION_MS,
        releaseTimeoutId: null,
        startedAt: performance.now(),
      };

      entry.maxTimeoutId = window.setTimeout(() => {
        finalizeHide(token);
      }, options?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS);

      entriesRef.current.set(token, entry);
      syncVisibleCount();
      return token;
    },
    [finalizeHide, syncVisibleCount]
  );

  const pulse = useCallback(
    (durationMs = DEFAULT_MIN_DURATION_MS) => {
      const token = show({
        maxDurationMs: durationMs + 150,
        minDurationMs: durationMs,
      });
      hide(token);
    },
    [hide, show]
  );

  const run = useCallback(
    async <T,>(action: () => T | Promise<T>, options?: GlobalLoadingOptions) => {
      const token = show(options);

      try {
        return await action();
      } finally {
        hide(token);
      }
    },
    [hide, show]
  );

  useEffect(() => {
    if (navigationTokenRef.current === null) {
      return;
    }

    hide(navigationTokenRef.current);
    navigationTokenRef.current = null;
  }, [hide, pathname, searchParamsValue]);

  useEffect(() => {
    const handleClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || !isHTMLElement(event.target)) {
        return;
      }

      const anchor = event.target.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement) {
        if (isInternalNavigationAnchor(anchor, event)) {
          const token = show({
            maxDurationMs: DEFAULT_MAX_DURATION_MS,
            minDurationMs: DEFAULT_MIN_DURATION_MS,
          });
          navigationTokenRef.current = token;
        }
        return;
      }

      const control = event.target.closest(
        'button, input[type="submit"], input[type="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
      );

      if (!isHTMLElement(control) || shouldSkipControl(control)) {
        return;
      }

      if (
        (control instanceof HTMLButtonElement && (control.type === "submit" || control.form !== null)) ||
        (control instanceof HTMLInputElement && control.type === "submit")
      ) {
        pulse(0);
        return;
      }

      pulse(0);
    };

    const handleSubmitCapture = (event: Event) => {
      if (event.defaultPrevented || !isHTMLElement(event.target)) {
        return;
      }

      if (event.target.closest('[data-skip-global-loading="true"]')) {
        return;
      }

      pulse(0);
    };

    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("submit", handleSubmitCapture, true);

    return () => {
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("submit", handleSubmitCapture, true);
    };
  }, [pulse, show]);

  useEffect(() => {
    const entries = entriesRef.current;

    return () => {
      for (const [token, entry] of entries.entries()) {
        clearEntryTimeouts(entry);
        entries.delete(token);
      }
    };
  }, [clearEntryTimeouts]);

  const value = useMemo<GlobalLoadingContextValue>(
    () => ({
      hide,
      pulse,
      run,
      show,
    }),
    [hide, pulse, run, show]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      {visibleCount > 0 ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <div className="rounded-full border border-border bg-card/95 px-5 py-3 shadow-[var(--shadow-sm)]">
            <Loader label="Loading page..." size="lg" center />
          </div>
        </div>
      ) : null}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);

  if (!context) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }

  return context;
}
