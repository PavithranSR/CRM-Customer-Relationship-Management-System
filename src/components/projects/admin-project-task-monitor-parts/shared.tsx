"use client";

import type { ProjectType } from "@prisma/client";
import {
  AlarmClock,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  CircleHelp,
  CircleOff,
  CircleX,
  Clock3,
  Download,
  Eye,
  FileText,
  Flag,
  Grid2x2,
  Grid3x3,
  Heart,
  Home,
  Info,
  Lock,
  Mail,
  Music,
  Pause,
  Pencil,
  Play,
  PlusCircle,
  Printer,
  Search,
  SearchCheck,
  Settings,
  Star,
  Trash,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import type { ProjectTask } from "@/lib/project-task-utils";

export interface TeamPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  hireDate?: string | Date | null;
  isActive?: boolean;
}

export interface TaskEmployeeProfileState {
  employee: TeamPerson;
  taskTitle: string;
}

export interface AdminProjectTaskMonitorProps {
  projectId: string;
  projectTeamId?: string | null;
  assignments: TeamPerson[];
  employees: TeamPerson[];
  projectType: ProjectType;
  projectName?: string;
  projectCategory?: string | null;
  projectManagerName?: string | null;
  projectTags?: string | null;
  initialTasks?: ProjectTask[];
  initialStages?: Array<{ id: string; name: string; sortOrder: number }>;
  initialSelectedTaskId?: string | null;
  standaloneTaskPage?: boolean;
  taskDetailMode?: "dialog" | "page";
}

export interface TaskStageItem {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MediaImageResult {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
}

export interface MediaIconResult {
  id: string;
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export interface EmojiOption {
  emoji: string;
  label: string;
  category: "smileys" | "gestures" | "objects";
}

export const STAGE_THEMES = [
  "border-cyan-200 bg-cyan-50/60",
  "border-blue-200 bg-blue-50/60",
  "border-amber-200 bg-amber-50/60",
  "border-emerald-200 bg-emerald-50/60",
  "border-rose-200 bg-rose-50/60",
] as const;

export const FOLDED_STAGE_THEMES = [
  "border-cyan-200 bg-gradient-to-b from-cyan-50 via-cyan-50/95 to-white",
  "border-blue-200 bg-gradient-to-b from-blue-50 via-blue-50/95 to-white",
  "border-amber-200 bg-gradient-to-b from-amber-50 via-amber-50/95 to-white",
  "border-emerald-200 bg-gradient-to-b from-emerald-50 via-emerald-50/95 to-white",
  "border-rose-200 bg-gradient-to-b from-rose-50 via-rose-50/95 to-white",
] as const;

export const ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY = "admin-project-task-folded-stages";

export function getEmployeeOptionLabel(employee: TeamPerson) {
  return employee.email ? `${employee.name} (${employee.email})` : employee.name;
}

export function getEmployeeAvatarLetter(name: string) {
  return name.trim().charAt(0).toUpperCase() || "U";
}

export function isTaskAssignablePerson(person: TeamPerson) {
  return person.role === "TEAMLEADER" || person.role === "EMPLOYEE";
}

export function findEmployeeByQuery(employees: TeamPerson[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  return (
    employees.find((employee) => {
      const optionLabel = getEmployeeOptionLabel(employee).toLowerCase();

      return (
        optionLabel === normalizedQuery ||
        employee.name.toLowerCase() === normalizedQuery ||
        employee.email.toLowerCase() === normalizedQuery
      );
    }) ?? null
  );
}

export function getStageRibbonClipPath(index: number, total: number) {
  if (total <= 1) {
    return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  }

  if (index === 0) {
    return "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)";
  }

  if (index === total - 1) {
    return "polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)";
  }

  return "polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)";
}

export const ICON_MEDIA_LIBRARY: MediaIconResult[] = [
  { id: "mail", name: "mail", Icon: Mail },
  { id: "music", name: "music", Icon: Music },
  { id: "search", name: "search", Icon: Search },
  { id: "search-check", name: "search check", Icon: SearchCheck },
  { id: "heart", name: "heart", Icon: Heart },
  { id: "star", name: "star", Icon: Star },
  { id: "bookmark", name: "bookmark", Icon: Bookmark },
  { id: "user", name: "user", Icon: Users },
  { id: "video", name: "video", Icon: Video },
  { id: "grid-2", name: "grid", Icon: Grid2x2 },
  { id: "grid-3", name: "grid layout", Icon: Grid3x3 },
  { id: "check", name: "check", Icon: Check },
  { id: "x", name: "close x", Icon: X },
  { id: "power", name: "power", Icon: AlarmClock },
  { id: "settings", name: "settings", Icon: Settings },
  { id: "trash", name: "trash", Icon: Trash },
  { id: "home", name: "home", Icon: Home },
  { id: "file", name: "file text", Icon: FileText },
  { id: "clock", name: "clock", Icon: Clock3 },
  { id: "download", name: "download", Icon: Download },
  { id: "lock", name: "lock", Icon: Lock },
  { id: "flag", name: "flag", Icon: Flag },
  { id: "volume", name: "volume", Icon: Volume2 },
  { id: "printer", name: "printer", Icon: Printer },
  { id: "camera", name: "camera", Icon: Camera },
  { id: "pencil", name: "pencil", Icon: Pencil },
  { id: "map", name: "location", Icon: Bell },
  { id: "play", name: "play", Icon: Play },
  { id: "pause", name: "pause", Icon: Pause },
  { id: "plus", name: "plus", Icon: PlusCircle },
  { id: "minus", name: "minus", Icon: CircleOff },
  { id: "check-circle", name: "check circle", Icon: CheckCircle2 },
  { id: "help", name: "help", Icon: CircleHelp },
  { id: "info", name: "info", Icon: Info },
  { id: "x-circle", name: "x circle", Icon: CircleX },
  { id: "left", name: "arrow left", Icon: ArrowLeft },
  { id: "right", name: "arrow right", Icon: ArrowRight },
  { id: "up", name: "arrow up", Icon: ArrowUp },
  { id: "down", name: "arrow down", Icon: ArrowDown },
  { id: "eye", name: "eye", Icon: Eye },
];

export const EMOJI_LIBRARY: EmojiOption[] = [
  { emoji: "ðŸ˜€", label: "grinning", category: "smileys" },
  { emoji: "ðŸ˜ƒ", label: "smiley", category: "smileys" },
  { emoji: "ðŸ˜„", label: "smile", category: "smileys" },
  { emoji: "ðŸ˜", label: "grin", category: "smileys" },
  { emoji: "ðŸ˜†", label: "laughing", category: "smileys" },
  { emoji: "ðŸ˜‚", label: "joy", category: "smileys" },
  { emoji: "ðŸ¤£", label: "rolling on the floor laughing", category: "smileys" },
  { emoji: "ðŸ˜Š", label: "blush", category: "smileys" },
  { emoji: "ðŸ˜‡", label: "innocent", category: "smileys" },
  { emoji: "ðŸ™‚", label: "slightly smiling", category: "smileys" },
  { emoji: "ðŸ™ƒ", label: "upside down", category: "smileys" },
  { emoji: "ðŸ˜‰", label: "wink", category: "smileys" },
  { emoji: "ðŸ˜", label: "heart eyes", category: "smileys" },
  { emoji: "ðŸ˜˜", label: "kiss", category: "smileys" },
  { emoji: "ðŸ˜—", label: "kissing", category: "smileys" },
  { emoji: "ðŸ˜™", label: "kissing smile", category: "smileys" },
  { emoji: "ðŸ˜š", label: "kissing closed eyes", category: "smileys" },
  { emoji: "ðŸ¤©", label: "star struck", category: "smileys" },
  { emoji: "ðŸ¥³", label: "partying face", category: "smileys" },
  { emoji: "ðŸ˜Ž", label: "cool", category: "smileys" },
  { emoji: "ðŸ¤”", label: "thinking", category: "smileys" },
  { emoji: "ðŸ¤¨", label: "raised eyebrow", category: "smileys" },
  { emoji: "ðŸ˜", label: "neutral face", category: "smileys" },
  { emoji: "ðŸ˜‘", label: "expressionless", category: "smileys" },
  { emoji: "ðŸ˜¶", label: "no mouth", category: "smileys" },
  { emoji: "ðŸ™„", label: "rolling eyes", category: "smileys" },
  { emoji: "ðŸ˜", label: "smirk", category: "smileys" },
  { emoji: "ðŸ˜£", label: "persevere", category: "smileys" },
  { emoji: "ðŸ˜¥", label: "sad but relieved", category: "smileys" },
  { emoji: "ðŸ˜®", label: "open mouth", category: "smileys" },
  { emoji: "ðŸ¤", label: "zipper mouth", category: "smileys" },
  { emoji: "ðŸ˜¯", label: "hushed", category: "smileys" },
  { emoji: "ðŸ˜ª", label: "sleepy", category: "smileys" },
  { emoji: "ðŸ˜´", label: "sleeping", category: "smileys" },
  { emoji: "ðŸ˜Œ", label: "relieved", category: "smileys" },
  { emoji: "ðŸ˜›", label: "tongue", category: "smileys" },
  { emoji: "ðŸ˜œ", label: "winking tongue", category: "smileys" },
  { emoji: "ðŸ¤ª", label: "zany face", category: "smileys" },
  { emoji: "ðŸ˜", label: "squinting tongue", category: "smileys" },
  { emoji: "ðŸ¤‘", label: "money mouth", category: "smileys" },
  { emoji: "ðŸ¤—", label: "hugging", category: "smileys" },
  { emoji: "ðŸ¤­", label: "hand over mouth", category: "smileys" },
  { emoji: "ðŸ¤«", label: "shushing", category: "smileys" },
  { emoji: "ðŸ¤¥", label: "lying face", category: "smileys" },
  { emoji: "ðŸ˜³", label: "flushed", category: "smileys" },
  { emoji: "ðŸ¥º", label: "pleading", category: "smileys" },
  { emoji: "ðŸ˜¢", label: "cry", category: "smileys" },
  { emoji: "ðŸ˜­", label: "sob", category: "smileys" },
  { emoji: "ðŸ˜¡", label: "angry", category: "smileys" },
  { emoji: "ðŸ¤¯", label: "mind blown", category: "smileys" },
  { emoji: "ðŸ˜±", label: "scream", category: "smileys" },
  { emoji: "ðŸ¥¶", label: "cold face", category: "smileys" },
  { emoji: "ðŸ¥µ", label: "hot face", category: "smileys" },
  { emoji: "ðŸ‘", label: "thumbs up", category: "gestures" },
  { emoji: "ðŸ‘Ž", label: "thumbs down", category: "gestures" },
  { emoji: "ðŸ‘Œ", label: "ok hand", category: "gestures" },
  { emoji: "âœŒï¸", label: "victory hand", category: "gestures" },
  { emoji: "ðŸ¤ž", label: "crossed fingers", category: "gestures" },
  { emoji: "ðŸ¤Ÿ", label: "love you gesture", category: "gestures" },
  { emoji: "ðŸ¤˜", label: "sign of the horns", category: "gestures" },
  { emoji: "ðŸ‘‹", label: "wave", category: "gestures" },
  { emoji: "ðŸ¤š", label: "raised back of hand", category: "gestures" },
  { emoji: "ðŸ–ï¸", label: "hand with fingers splayed", category: "gestures" },
  { emoji: "âœ‹", label: "raised hand", category: "gestures" },
  { emoji: "ðŸ‘", label: "clap", category: "gestures" },
  { emoji: "ðŸ™Œ", label: "raised hands", category: "gestures" },
  { emoji: "ðŸ™", label: "pray", category: "gestures" },
  { emoji: "ðŸ’ª", label: "muscle", category: "gestures" },
  { emoji: "ðŸ‘Š", label: "oncoming fist", category: "gestures" },
  { emoji: "ðŸ¤", label: "handshake", category: "gestures" },
  { emoji: "â˜ï¸", label: "index pointing up", category: "gestures" },
  { emoji: "ðŸ‘‡", label: "point down", category: "gestures" },
  { emoji: "ðŸ‘‰", label: "point right", category: "gestures" },
  { emoji: "ðŸ‘ˆ", label: "point left", category: "gestures" },
  { emoji: "ðŸ”¥", label: "fire", category: "objects" },
  { emoji: "ðŸŽ‰", label: "party", category: "objects" },
  { emoji: "âœ…", label: "check mark", category: "objects" },
  { emoji: "ðŸ’¡", label: "idea", category: "objects" },
  { emoji: "â­", label: "star object", category: "objects" },
  { emoji: "ðŸ’¯", label: "hundred", category: "objects" },
  { emoji: "ðŸ“Œ", label: "pin", category: "objects" },
  { emoji: "ðŸ“Ž", label: "paperclip", category: "objects" },
  { emoji: "ðŸ“", label: "memo", category: "objects" },
  { emoji: "ðŸ“¢", label: "loudspeaker", category: "objects" },
  { emoji: "ðŸ””", label: "bell", category: "objects" },
  { emoji: "ðŸ“…", label: "calendar", category: "objects" },
  { emoji: "ðŸ“", label: "folder", category: "objects" },
  { emoji: "ðŸ’»", label: "laptop", category: "objects" },
  { emoji: "ðŸ“±", label: "mobile phone", category: "objects" },
  { emoji: "ðŸ”", label: "magnifying glass", category: "objects" },
  { emoji: "ðŸ› ï¸", label: "tools", category: "objects" },
  { emoji: "ðŸš€", label: "rocket", category: "objects" },
  { emoji: "ðŸŽ¯", label: "target", category: "objects" },
  { emoji: "ðŸ†", label: "trophy", category: "objects" },
  { emoji: "ðŸŽ", label: "gift", category: "objects" },
];

export const ICON_TOKEN_PATTERN = /\{\{icon:([^}]+)\}\}/g;
export const VIDEO_TOKEN_PATTERN = /\[Video\]\(([^)]+)\)/g;
export const BUTTON_TOKEN_PATTERN = /\{\{button:([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|([^}]+)\}\}/g;
export const CHECKLIST_PREVIEW_PATTERN = /^\s*-\s\[( |x)\]\s(.*)$/;

export function getVideoEmbedUrl(value: string) {
  const input = value.trim();
  if (!input) return null;

  const iframeMatch = input.match(/src=["']([^"']+)["']/i);
  const source = iframeMatch?.[1] ?? input;

  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = url.pathname.slice(1);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      if (url.pathname.startsWith("/embed/")) {
        return source;
      }
    }

    if (host === "vimeo.com") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }

    if (host === "dailymotion.com") {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      return videoId ? `https://www.dailymotion.com/embed/video/${videoId}` : null;
    }

    if (host === "facebook.com" || host === "m.facebook.com") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(source)}`;
    }

    if (host === "instagram.com") {
      return source.endsWith("/embed") ? source : `${source.replace(/\/$/, "")}/embed`;
    }

    return source;
  } catch {
    return iframeMatch?.[1] ?? null;
  }
}
