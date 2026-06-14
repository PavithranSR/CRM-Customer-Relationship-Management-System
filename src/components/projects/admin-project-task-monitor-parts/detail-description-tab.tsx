"use client";

import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import {
  ImagePlus,
  List,
  ListOrdered,
  MoreVertical,
  Sparkles,
  Square,
  SquareCheckBig,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DetailDescriptionPreview,
  type DescriptionPreviewPart,
} from "@/components/projects/admin-project-task-monitor-parts/detail-description-preview";

interface DetailDescriptionTabProps {
  buttonLabel: string;
  buttonSize: string;
  buttonTheme: string;
  buttonUrl: string;
  buttonVariant: string;
  descriptionDraft: string;
  descriptionInputRef: RefObject<HTMLTextAreaElement | null>;
  descriptionPreviewContent: DescriptionPreviewPart[];
  descriptionUploadInputRef: RefObject<HTMLInputElement | null>;
  isSavingDescription: boolean;
  onApplyDescriptionButton: () => void;
  onButtonLabelChange: (value: string) => void;
  onButtonSizeChange: (value: string) => void;
  onButtonThemeChange: (value: string) => void;
  onButtonUrlChange: (value: string) => void;
  onButtonVariantChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onDescriptionUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleDescriptionKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInsertBulletListItem: () => void;
  onInsertChecklistItem: () => void;
  onInsertIntoDescription: (snippet: string) => void;
  onInsertNumberedListItem: () => void;
  onSaveTaskDescription: () => void;
  onSetIsMediaPickerOpen: (value: boolean) => void;
  onSetShowButtonBuilder: (value: boolean | ((current: boolean) => boolean)) => void;
  showButtonBuilder: boolean;
  standaloneTaskPage: boolean;
}

export function DetailDescriptionTab({
  buttonLabel,
  buttonSize,
  buttonTheme,
  buttonUrl,
  buttonVariant,
  descriptionDraft,
  descriptionInputRef,
  descriptionPreviewContent,
  descriptionUploadInputRef,
  isSavingDescription,
  onApplyDescriptionButton,
  onButtonLabelChange,
  onButtonSizeChange,
  onButtonThemeChange,
  onButtonUrlChange,
  onButtonVariantChange,
  onDescriptionDraftChange,
  onDescriptionUploadChange,
  onHandleDescriptionKeyDown,
  onInsertBulletListItem,
  onInsertChecklistItem,
  onInsertIntoDescription,
  onInsertNumberedListItem,
  onSaveTaskDescription,
  onSetIsMediaPickerOpen,
  onSetShowButtonBuilder,
  showButtonBuilder,
  standaloneTaskPage,
}: DetailDescriptionTabProps) {
  return (
    <TabsContent value="description" className={standaloneTaskPage ? "mt-0 bg-white" : "mt-0 min-h-[320px] bg-white"}>
      {standaloneTaskPage ? (
        <div className="px-5 py-5">
          <Textarea
            ref={descriptionInputRef}
            value={descriptionDraft}
            onChange={(event) => onDescriptionDraftChange(event.target.value)}
            onKeyDown={onHandleDescriptionKeyDown}
            placeholder="Add details about this task..."
            className="min-h-[420px] resize-none border-0 bg-transparent px-0 py-0 text-[1.05rem] leading-8 text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-md bg-[#44a2de] text-white hover:bg-[#3991ca]"
              onClick={onSaveTaskDescription}
              disabled={isSavingDescription}
            >
              {isSavingDescription ? "Saving..." : "Save description"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 px-5 py-3">
            <div className="flex flex-wrap items-center gap-4 text-slate-500">
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Add image"
                onClick={() => onSetIsMediaPickerOpen(true)}
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Upload"
                onClick={() => descriptionUploadInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
              </button>
              <input
                ref={descriptionUploadInputRef}
                type="file"
                className="hidden"
                onChange={onDescriptionUploadChange}
              />
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Add button"
                onClick={() => onSetShowButtonBuilder((current) => !current)}
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Bullet list"
                onClick={onInsertBulletListItem}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Numbered list"
                onClick={onInsertNumberedListItem}
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="Checklist"
                onClick={onInsertChecklistItem}
              >
                <SquareCheckBig className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="AI tools"
                onClick={() => onInsertIntoDescription("Summary:\n\nAction items:\n- ")}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="transition hover:text-slate-200"
                aria-label="More options"
                onClick={() => onInsertIntoDescription("\n---\n")}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {showButtonBuilder ? (
              <div className="mt-4 max-w-md rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <Input
                    value={buttonLabel}
                    onChange={(event) => onButtonLabelChange(event.target.value)}
                    placeholder="Add a label for your link"
                    className="border-cyan-200 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={buttonUrl}
                      onChange={(event) => onButtonUrlChange(event.target.value)}
                      placeholder="e.g. https://www.odoo.com"
                      className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    <span className="text-sm text-slate-500">or</span>
                    <button
                      type="button"
                      className="rounded-md bg-slate-200 p-2 text-slate-700 transition hover:bg-slate-300"
                      onClick={() => descriptionUploadInputRef.current?.click()}
                      aria-label="Upload link asset"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                  <Select value={buttonVariant} onValueChange={onButtonVariantChange}>
                    <SelectTrigger className="border-slate-300 bg-white text-slate-900">
                      <SelectValue placeholder="Button Primary" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200 bg-white text-slate-900">
                      <SelectItem value="primary">Button Primary</SelectItem>
                      <SelectItem value="secondary">Button Secondary</SelectItem>
                      <SelectItem value="outline">Button Outline</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select value={buttonSize} onValueChange={onButtonSizeChange}>
                      <SelectTrigger className="border-slate-300 bg-white text-slate-900">
                        <SelectValue placeholder="Medium" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-200 bg-white text-slate-900">
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={buttonTheme} onValueChange={onButtonThemeChange}>
                      <SelectTrigger className="border-slate-300 bg-white text-slate-900">
                        <SelectValue placeholder="Default" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-200 bg-white text-slate-900">
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="accent">Accent</SelectItem>
                        <SelectItem value="muted">Muted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        className="bg-[#44a2de] text-white hover:bg-[#3991ca]"
                        onClick={onApplyDescriptionButton}
                      >
                        Apply
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                        onClick={() => onSetShowButtonBuilder(false)}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-[260px] px-5 py-4">
            {descriptionDraft.trim() ? (
              <DetailDescriptionPreview descriptionPreviewContent={descriptionPreviewContent} />
            ) : null}
            <Textarea
              ref={descriptionInputRef}
              value={descriptionDraft}
              onChange={(event) => onDescriptionDraftChange(event.target.value)}
              onKeyDown={onHandleDescriptionKeyDown}
              placeholder='Type "/" for commands'
              className="min-h-[220px] resize-none border-0 bg-transparent px-0 py-0 text-sm leading-7 text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="rounded-md bg-[#44a2de] text-white hover:bg-[#3991ca]"
                onClick={onSaveTaskDescription}
                disabled={isSavingDescription}
              >
                {isSavingDescription ? "Saving..." : "Save description"}
              </Button>
            </div>
          </div>
        </>
      )}
    </TabsContent>
  );
}
