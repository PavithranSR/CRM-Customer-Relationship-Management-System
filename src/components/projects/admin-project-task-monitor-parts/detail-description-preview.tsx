"use client";

import { Check } from "lucide-react";
import {
  CHECKLIST_PREVIEW_PATTERN,
  ICON_MEDIA_LIBRARY,
  getVideoEmbedUrl,
} from "@/components/projects/admin-project-task-monitor-parts/shared";

export type DescriptionPreviewPart =
  | { type: "text"; value: string }
  | { type: "icon"; value: string }
  | { type: "video"; value: string }
  | {
      type: "button";
      value: { label: string; url: string; variant: string; size: string; theme: string };
    };

interface DetailDescriptionPreviewProps {
  descriptionPreviewContent: DescriptionPreviewPart[];
}

export function DetailDescriptionPreview({
  descriptionPreviewContent,
}: DetailDescriptionPreviewProps) {
  return (
    <div className="mb-4 min-h-[72px] rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-slate-900">
        {descriptionPreviewContent.map((part, index) => {
          if (part.type === "icon") {
            const matchedIcon = ICON_MEDIA_LIBRARY.find((icon) => icon.name === part.value);

            if (!matchedIcon) {
              return (
                <span key={`preview-missing-${index}`} className="text-sm text-slate-400">
                  {`{{icon:${part.value}}}`}
                </span>
              );
            }

            const IconComponent = matchedIcon.Icon;
            return (
              <span
                key={`preview-icon-${index}`}
                className="inline-flex items-center justify-center text-slate-900"
              >
                <IconComponent className="h-7 w-7" />
              </span>
            );
          }

          if (part.type === "video") {
            const embedUrl = getVideoEmbedUrl(part.value);

            if (!embedUrl) {
              return (
                <span key={`preview-video-${index}`} className="text-sm text-slate-400">
                  {`[Video](${part.value})`}
                </span>
              );
            }

            return (
              <div
                key={`preview-video-${index}`}
                className="my-2 w-full max-w-2xl overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              >
                <div className="aspect-video w-full">
                  <iframe
                    src={embedUrl}
                    title={`Embedded video ${index + 1}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            );
          }

          if (part.type === "button") {
            const sizeClass =
              part.value.size === "small"
                ? "px-3 py-1.5 text-xs"
                : part.value.size === "large"
                  ? "px-5 py-3 text-base"
                  : "px-4 py-2 text-sm";
            const variantClass =
              part.value.variant === "secondary"
                ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
                : part.value.variant === "outline"
                  ? "border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100"
                  : "bg-[#44a2de] text-white hover:bg-[#3991ca]";
            const themeClass =
              part.value.theme === "accent"
                ? "shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                : part.value.theme === "muted"
                  ? "opacity-90"
                  : "";

            return (
              <a
                key={`preview-button-${index}`}
                href={part.value.url || "#"}
                className={`inline-flex items-center rounded-md font-semibold transition ${sizeClass} ${variantClass} ${themeClass}`}
                target={part.value.url ? "_blank" : undefined}
                rel={part.value.url ? "noreferrer" : undefined}
              >
                {part.value.label}
              </a>
            );
          }

          return (
            <div key={`preview-text-${index}`} className="w-full space-y-2">
              {part.value.split("\n").map((line, lineIndex) => {
                const checklistMatch = line.match(CHECKLIST_PREVIEW_PATTERN);

                if (checklistMatch) {
                  return (
                    <div
                      key={`preview-checklist-${index}-${lineIndex}`}
                      className="flex items-center gap-3 text-slate-900"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-slate-300">
                        {checklistMatch[1] === "x" ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="text-sm leading-7 text-slate-700">{checklistMatch[2]}</span>
                    </div>
                  );
                }

                return line ? (
                  <span
                    key={`preview-line-${index}-${lineIndex}`}
                    className="block whitespace-pre-wrap text-sm leading-7 text-slate-700"
                  >
                    {line}
                  </span>
                ) : (
                  <span key={`preview-line-${index}-${lineIndex}`} className="block h-4" />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
