"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { toast } from "sonner";
import { updateProjectTask } from "@/actions/project-task.actions";
import {
  BUTTON_TOKEN_PATTERN,
  ICON_MEDIA_LIBRARY,
  ICON_TOKEN_PATTERN,
  VIDEO_TOKEN_PATTERN,
  type MediaImageResult,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import type { DescriptionPreviewPart } from "@/components/projects/admin-project-task-monitor-parts/detail-description-preview";
import { getTaskPriorityLevel, normalizeTask, type ProjectTask } from "@/lib/project-task-utils";

interface UseAdminProjectTaskDescriptionProps {
  projectId: string;
  selectedTask: ProjectTask | null;
  setTasks: Dispatch<SetStateAction<ProjectTask[]>>;
  onRefreshTaskActivity: (taskId: string) => void;
}

export function useAdminProjectTaskDescription({
  projectId,
  selectedTask,
  setTasks,
  onRefreshTaskActivity,
}: UseAdminProjectTaskDescriptionProps) {
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [showButtonBuilder, setShowButtonBuilder] = useState(false);
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonVariant, setButtonVariant] = useState("primary");
  const [buttonSize, setButtonSize] = useState("medium");
  const [buttonTheme, setButtonTheme] = useState("default");
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState("images");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [videoCode, setVideoCode] = useState("");
  const [selectedMediaFileName, setSelectedMediaFileName] = useState("");
  const [mediaResultFilter, setMediaResultFilter] = useState("all");
  const [mediaResults, setMediaResults] = useState<MediaImageResult[]>([]);
  const [selectedMediaImageUrl, setSelectedMediaImageUrl] = useState("");
  const [selectedMediaImageTitle, setSelectedMediaImageTitle] = useState("");
  const [selectedMediaIconId, setSelectedMediaIconId] = useState("");
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);
  const [mediaSearchError, setMediaSearchError] = useState("");
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionUploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const deferredDescriptionDraft = useDeferredValue(descriptionDraft);
  const deferredMediaSearch = useDeferredValue(mediaSearch);

  useEffect(() => {
    setDescriptionDraft(selectedTask?.description ?? "");
  }, [selectedTask]);

  const filteredIconResults = useMemo(() => {
    const query = deferredMediaSearch.trim().toLowerCase();
    return query ? ICON_MEDIA_LIBRARY.filter((icon) => icon.name.includes(query)) : ICON_MEDIA_LIBRARY;
  }, [deferredMediaSearch]);

  const filteredMediaResults = useMemo(() => {
    if (mediaResultFilter === "all") {
      return mediaResults;
    }

    return mediaResults.filter((image) => {
      const isIllustration = image.fullUrl.toLowerCase().includes(".svg");
      if (mediaResultFilter === "illustrations") return isIllustration;
      if (mediaResultFilter === "photos") return !isIllustration;
      return true;
    });
  }, [mediaResultFilter, mediaResults]);

  const descriptionPreviewContent = useMemo(() => {
    const parts: DescriptionPreviewPart[] = [];
    const matches = [
      ...Array.from(deferredDescriptionDraft.matchAll(ICON_TOKEN_PATTERN)).map((match) => ({
        kind: "icon" as const,
        token: match[0],
        value: (match[1] ?? "").trim(),
        index: match.index ?? 0,
      })),
      ...Array.from(deferredDescriptionDraft.matchAll(VIDEO_TOKEN_PATTERN)).map((match) => ({
        kind: "video" as const,
        token: match[0],
        value: (match[1] ?? "").trim(),
        index: match.index ?? 0,
      })),
      ...Array.from(deferredDescriptionDraft.matchAll(BUTTON_TOKEN_PATTERN)).map((match) => ({
        kind: "button" as const,
        token: match[0],
        value: {
          label: (match[1] ?? "").trim(),
          url: (match[2] ?? "").trim(),
          variant: (match[3] ?? "").trim(),
          size: (match[4] ?? "").trim(),
          theme: (match[5] ?? "").trim(),
        },
        index: match.index ?? 0,
      })),
    ].sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    for (const match of matches) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: deferredDescriptionDraft.slice(lastIndex, match.index) });
      }
      if (match.kind === "button") {
        parts.push({ type: "button", value: match.value });
      } else {
        parts.push({ type: match.kind, value: match.value });
      }
      lastIndex = match.index + match.token.length;
    }

    if (lastIndex < deferredDescriptionDraft.length) {
      parts.push({ type: "text", value: deferredDescriptionDraft.slice(lastIndex) });
    }

    return parts;
  }, [deferredDescriptionDraft]);

  const insertIntoDescription = (snippet: string) => {
    const textarea = descriptionInputRef.current;
    if (!textarea) {
      setDescriptionDraft((current) => `${current}${current ? "\n" : ""}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? descriptionDraft.length;
    const end = textarea.selectionEnd ?? descriptionDraft.length;
    const nextValue = `${descriptionDraft.slice(0, start)}${snippet}${descriptionDraft.slice(end)}`;
    setDescriptionDraft(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const caretPosition = start + snippet.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  };

  const saveTaskDescription = () => {
    if (!selectedTask) {
      toast.error("Please open a task first");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", selectedTask.id);
    formData.append("title", selectedTask.title);
    formData.append("description", descriptionDraft.trim());
    formData.append("assigneeId", selectedTask.employeeAssigneeId || selectedTask.assigneeId);
    formData.append("priority", String(getTaskPriorityLevel(selectedTask)));
    if (selectedTask.dueDate) formData.append("dueDate", selectedTask.dueDate.slice(0, 10));
    if (selectedTask.stageId) formData.append("stageId", selectedTask.stageId);

    setIsSavingDescription(true);
    updateProjectTask(formData).then((result) => {
      setIsSavingDescription(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const nextTasks = (result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item));
      startTransition(() => {
        setTasks(nextTasks);
      });
      const updatedTask = nextTasks.find((task) => task.id === selectedTask.id);
      setDescriptionDraft(updatedTask?.description ?? "");
      toast.success("Description updated");
      onRefreshTaskActivity(selectedTask.id);
    });
  };

  const closeMediaPicker = () => {
    setIsMediaPickerOpen(false);
    setMediaSearch("");
    setMediaUrl("");
    setVideoCode("");
    setSelectedMediaFileName("");
    setSelectedMediaImageUrl("");
    setSelectedMediaImageTitle("");
    setSelectedMediaIconId("");
    setMediaResults([]);
    setMediaSearchError("");
    if (mediaUploadInputRef.current) mediaUploadInputRef.current.value = "";
  };

  const addSelectedMediaToDescription = () => {
    const trimmedUrl = mediaUrl.trim();
    if (mediaTab === "images") {
      if (selectedMediaImageUrl) {
        insertIntoDescription(`![${selectedMediaImageTitle || "Selected image"}](${selectedMediaImageUrl})`);
      } else if (trimmedUrl) {
        insertIntoDescription(`![Selected image](${trimmedUrl})`);
      } else if (selectedMediaFileName) {
        insertIntoDescription(`![${selectedMediaFileName}](uploaded-image-url)`);
      } else {
        toast.error("Add an image URL or upload an image first");
        return;
      }
    } else if (mediaTab === "documents") {
      if (trimmedUrl) {
        insertIntoDescription(`[Document](${trimmedUrl})`);
      } else if (selectedMediaFileName) {
        insertIntoDescription(`[${selectedMediaFileName}](uploaded-document-url)`);
      } else {
        toast.error("Add a document URL or upload a file first");
        return;
      }
    } else if (mediaTab === "icons") {
      const selectedIcon = ICON_MEDIA_LIBRARY.find((icon) => icon.id === selectedMediaIconId);
      if (!selectedIcon && !mediaSearch.trim()) {
        toast.error("Select an icon first");
        return;
      }
      insertIntoDescription(`{{icon:${selectedIcon?.name || mediaSearch.trim()}}}`);
    } else {
      if (videoCode.trim()) {
        insertIntoDescription(`[Video](${videoCode.trim()})`);
      } else if (selectedMediaFileName) {
        insertIntoDescription(`[${selectedMediaFileName}](uploaded-video-url)`);
      } else {
        toast.error("Add a video URL, embed code, or upload a file first");
        return;
      }
    }

    closeMediaPicker();
  };

  const addMediaUrl = () => {
    if (!mediaUrl.trim()) {
      toast.error("Enter a URL first");
      return;
    }

    toast.success("URL added");
  };

  const handleDescriptionUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const normalizedName = file.name.replace(/[()\[\]]/g, "");
    if (file.type.startsWith("image/")) {
      insertIntoDescription(`![${normalizedName}](${objectUrl})`);
    } else if (file.type.startsWith("video/")) {
      insertIntoDescription(`[Video](${objectUrl})`);
    } else {
      insertIntoDescription(`[${normalizedName}](${objectUrl})`);
    }

    event.target.value = "";
    toast.success("File added to description");
  };

  const insertBulletListItem = () => insertIntoDescription(descriptionDraft.trim() ? "\n• " : "• ");
  const insertNumberedListItem = () => {
    const lines = descriptionDraft.split("\n");
    const lastLine = lines[lines.length - 1] ?? "";
    const numberMatch = lastLine.match(/^\s*(\d+)\.\s/);
    const nextNumber = numberMatch ? Number(numberMatch[1]) + 1 : 1;
    insertIntoDescription(descriptionDraft.trim() ? `\n${nextNumber}. ` : "1. ");
  };
  const insertChecklistItem = () => insertIntoDescription(descriptionDraft.trim() ? "\n- [ ] " : "- [ ] ");

  const handleDescriptionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;

    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const value = descriptionDraft;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const currentLine = value.slice(lineStart, start);
    const bulletMatch = currentLine.match(/^(\s*(?:•|â€¢)\s)(.*)$/);

    if (bulletMatch) {
      event.preventDefault();
      const bulletPrefix = bulletMatch[1];
      const bulletText = bulletMatch[2];
      if (!bulletText.trim()) {
        const nextValue = `${value.slice(0, lineStart)}${value.slice(end)}`;
        setDescriptionDraft(nextValue);
        requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
        return;
      }

      const insertion = `\n${bulletPrefix}`;
      const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      setDescriptionDraft(nextValue);
      requestAnimationFrame(() => textarea.setSelectionRange(start + insertion.length, start + insertion.length));
      return;
    }

    const checklistMatch = currentLine.match(/^(\s*-\s\[(?: |x)\]\s)(.*)$/);
    if (checklistMatch) {
      event.preventDefault();
      const checklistPrefix = checklistMatch[1];
      const checklistText = checklistMatch[2];
      if (!checklistText.trim()) {
        const nextValue = `${value.slice(0, lineStart)}${value.slice(end)}`;
        setDescriptionDraft(nextValue);
        requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
        return;
      }

      const insertion = `\n${checklistPrefix.replace("[x]", "[ ]")}`;
      const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      setDescriptionDraft(nextValue);
      requestAnimationFrame(() => textarea.setSelectionRange(start + insertion.length, start + insertion.length));
      return;
    }

    const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (!numberMatch) return;

    event.preventDefault();
    const indent = numberMatch[1];
    const currentNumber = Number(numberMatch[2]);
    const numberText = numberMatch[3];
    if (!numberText.trim()) {
      const nextValue = `${value.slice(0, lineStart)}${value.slice(end)}`;
      setDescriptionDraft(nextValue);
      requestAnimationFrame(() => textarea.setSelectionRange(lineStart, lineStart));
      return;
    }

    const insertion = `\n${indent}${currentNumber + 1}. `;
    const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    setDescriptionDraft(nextValue);
    requestAnimationFrame(() => textarea.setSelectionRange(start + insertion.length, start + insertion.length));
  };

  const searchMediaImages = async () => {
    const query = mediaSearch.trim();
    if (!query) {
      toast.error("Enter an image search term");
      return;
    }

    setIsSearchingMedia(true);
    setMediaSearchError("");
    setSelectedMediaImageUrl("");
    setSelectedMediaImageTitle("");

    try {
      const response = await fetch(`/api/media-search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Unable to load image results");
      const payload = (await response.json()) as { error?: string; results?: MediaImageResult[] };
      const results = payload.results ?? [];
      setMediaResults(results);
      if (results.length === 0) setMediaSearchError(payload.error || "No matching images found.");
    } catch (error) {
      setMediaResults([]);
      setMediaSearchError(error instanceof Error ? error.message : "Image search failed");
    } finally {
      setIsSearchingMedia(false);
    }
  };

  const applyDescriptionButton = () => {
    const label = buttonLabel.trim();
    if (!label) {
      toast.error("Button label is required");
      return;
    }

    insertIntoDescription(`{{button:${label}|${buttonUrl.trim()}|${buttonVariant}|${buttonSize}|${buttonTheme}}}`);
    setShowButtonBuilder(false);
    setButtonLabel("");
    setButtonUrl("");
    setButtonVariant("primary");
    setButtonSize("medium");
    setButtonTheme("default");
  };

  const selectMediaIcon = (iconId: string) => {
    setSelectedMediaIconId(iconId);
    const selectedIcon = ICON_MEDIA_LIBRARY.find((icon) => icon.id === iconId);
    if (!selectedIcon) {
      toast.error("Select a valid icon");
      return;
    }

    insertIntoDescription(`{{icon:${selectedIcon.name}}}`);
    closeMediaPicker();
  };

  return {
    addMediaUrl,
    addSelectedMediaToDescription,
    applyDescriptionButton,
    buttonLabel,
    buttonSize,
    buttonTheme,
    buttonUrl,
    buttonVariant,
    closeMediaPicker,
    descriptionDraft,
    descriptionInputRef,
    descriptionPreviewContent,
    descriptionUploadInputRef,
    filteredIconResults,
    filteredMediaResults,
    handleDescriptionKeyDown,
    handleDescriptionUpload,
    insertBulletListItem,
    insertChecklistItem,
    insertIntoDescription,
    insertNumberedListItem,
    isMediaPickerOpen,
    isSavingDescription,
    isSearchingMedia,
    mediaResultFilter,
    mediaSearch,
    mediaSearchError,
    mediaTab,
    mediaUploadInputRef,
    mediaUrl,
    searchMediaImages,
    selectMediaIcon,
    selectedMediaFileName,
    selectedMediaIconId,
    selectedMediaImageTitle,
    selectedMediaImageUrl,
    setButtonLabel,
    setButtonSize,
    setButtonTheme,
    setButtonUrl,
    setButtonVariant,
    setDescriptionDraft,
    setIsMediaPickerOpen,
    setMediaResultFilter,
    setMediaSearch,
    setMediaTab,
    setMediaUrl,
    setSelectedMediaFileName,
    setSelectedMediaImageTitle,
    setSelectedMediaImageUrl,
    setShowButtonBuilder,
    setVideoCode,
    showButtonBuilder,
    saveTaskDescription,
    videoCode,
  };
}
