"use client";

import { Bookmark, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CrmPageShareDownloadProps {
  path: string;
  shareTitle: string;
  showDownload?: boolean;
  displayMode?: "buttons" | "menu";
  triggerIcon?: "more" | "bookmark";
  compact?: boolean;
}

function toAbsoluteUrl(path: string) {
  if (!path.startsWith("/")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function CrmPageShareDownload({
  path,
  shareTitle,
  showDownload = true,
  displayMode = "buttons",
  triggerIcon = "more",
  compact = false,
}: CrmPageShareDownloadProps) {
  const handleDownload = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareUrl = toAbsoluteUrl(path);

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not share link");
    }
  };

  if (displayMode === "menu") {
    const TriggerIcon = triggerIcon === "bookmark" ? Bookmark : MoreHorizontal;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "icon-sm" : "icon"}
            aria-label="Open share and download actions"
            className={compact ? "h-10 w-10 rounded-md" : undefined}
          >
            <TriggerIcon
              className={
                triggerIcon === "bookmark"
                  ? "h-4 w-4 fill-slate-800 text-slate-800"
                  : "h-4 w-4"
              }
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {showDownload ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleDownload();
              }}
            >
              Download PDF
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleShare();
            }}
          >
            Share Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {showDownload ? (
        <Button onClick={handleDownload} variant="outline">
          Download PDF
        </Button>
      ) : null}
      <Button onClick={() => void handleShare()} variant="outline">
        Share Link
      </Button>
    </>
  );
}
