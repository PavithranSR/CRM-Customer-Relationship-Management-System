"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuotationRecordNavigatorProps {
  currentIndex: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

export function QuotationRecordNavigator({
  currentIndex,
  total,
  previousHref,
  nextHref,
}: QuotationRecordNavigatorProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && previousHref) {
        event.preventDefault();
        router.push(previousHref);
      } else if (event.key === "ArrowRight" && nextHref) {
        event.preventDefault();
        router.push(nextHref);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextHref, previousHref, router]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-700">
        {total === 0 ? "0 / 0" : `${currentIndex + 1} / ${total}`}
      </span>
      {previousHref ? (
        <Button asChild variant="outline" size="icon" className="h-8 w-8">
          <Link href={previousHref} aria-label="Previous quotation">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled aria-label="Previous quotation">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {nextHref ? (
        <Button asChild variant="outline" size="icon" className="h-8 w-8">
          <Link href={nextHref} aria-label="Next quotation">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled aria-label="Next quotation">
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
