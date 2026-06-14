"use client";

import { Check, ImagePlus, Search, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ICON_MEDIA_LIBRARY,
  getVideoEmbedUrl,
  type MediaImageResult,
} from "@/components/projects/admin-project-task-monitor-parts/shared";

interface DetailMediaDialogProps {
  isOpen: boolean;
  isSearchingMedia: boolean;
  mediaResultFilter: string;
  mediaSearch: string;
  mediaSearchError: string;
  mediaTab: string;
  mediaUrl: string;
  onAddSelectedMediaToDescription: () => void;
  onAddMediaUrl: () => void;
  onMediaResultFilterChange: (value: string) => void;
  onMediaSearchChange: (value: string) => void;
  onMediaTabChange: (value: string) => void;
  onMediaUrlChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSearchMediaImages: () => void | Promise<void>;
  onSelectMediaFileName: (value: string) => void;
  onSelectMediaIconId: (value: string) => void;
  onSelectMediaImage: (image: MediaImageResult) => void;
  onVideoCodeChange: (value: string) => void;
  selectedMediaFileName: string;
  selectedMediaIconId: string;
  selectedMediaImageTitle: string;
  selectedMediaImageUrl: string;
  filteredIconResults: Array<(typeof ICON_MEDIA_LIBRARY)[number]>;
  filteredMediaResults: MediaImageResult[];
  mediaUploadInputRef: React.RefObject<HTMLInputElement | null>;
  setMediaUploadInputAccept?: never;
  videoCode: string;
}

export function DetailMediaDialog({
  filteredIconResults,
  filteredMediaResults,
  isOpen,
  isSearchingMedia,
  mediaResultFilter,
  mediaSearch,
  mediaSearchError,
  mediaTab,
  mediaUploadInputRef,
  mediaUrl,
  onAddSelectedMediaToDescription,
  onAddMediaUrl,
  onMediaResultFilterChange,
  onMediaSearchChange,
  onMediaTabChange,
  onMediaUrlChange,
  onOpenChange,
  onSearchMediaImages,
  onSelectMediaFileName,
  onSelectMediaIconId,
  onSelectMediaImage,
  onVideoCodeChange,
  selectedMediaFileName,
  selectedMediaIconId,
  selectedMediaImageUrl,
  videoCode,
}: DetailMediaDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] max-w-[88vw] overflow-hidden border-slate-200 bg-white p-0 text-slate-900 sm:max-w-6xl"
        showCloseButton={true}
      >
        <DialogHeader className="border-b border-slate-200 px-5 py-5">
          <DialogTitle className="text-[2rem] font-semibold text-slate-900">Select a media</DialogTitle>
        </DialogHeader>

        <div className="space-y-0">
          <Tabs value={mediaTab} onValueChange={onMediaTabChange} className="space-y-0">
            <div className="border-b border-slate-200 bg-white px-5 pt-4">
              <TabsList className="grid h-auto w-full max-w-[560px] grid-cols-4 rounded-none bg-transparent px-0 py-0">
                <TabsTrigger
                  value="images"
                  className="rounded-none border-t-2 border-transparent px-4 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-cyan-700"
                >
                  Images
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="rounded-none border-t-2 border-transparent px-4 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900"
                >
                  Documents
                </TabsTrigger>
                <TabsTrigger
                  value="icons"
                  className="rounded-none border-t-2 border-transparent px-4 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900"
                >
                  Icons
                </TabsTrigger>
                <TabsTrigger
                  value="videos"
                  className="rounded-none border-t-2 border-transparent px-4 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900"
                >
                  Videos
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="px-5 py-6">
              {mediaTab === "videos" ? (
                <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-2xl font-semibold text-slate-900">
                        Video code <span className="font-normal text-slate-500">(URL or Embed)</span>
                      </p>
                      <p className="text-base text-slate-500">
                        Accepts <span className="font-semibold italic">Youtube, Vimeo, Dailymotion, Facebook and Instagram</span> videos
                      </p>
                    </div>
                    <Textarea
                      value={videoCode}
                      onChange={(event) => onVideoCodeChange(event.target.value)}
                      placeholder="Copy-paste your URL or embed code here"
                      className="min-h-[140px] resize-none border-slate-300 bg-white text-lg text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>

                  <div className="rounded-md bg-slate-50">
                    <div className="flex min-h-[340px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-6 text-center">
                      {videoCode.trim() ? (
                        (() => {
                          const embedUrl = getVideoEmbedUrl(videoCode.trim());

                          if (!embedUrl) {
                            return (
                              <div className="space-y-3">
                                <Video className="mx-auto h-12 w-12 text-slate-400" />
                                <p className="text-lg font-medium text-slate-700">Unable to preview this video</p>
                                <p className="break-words text-sm text-slate-500">{videoCode.trim()}</p>
                              </div>
                            );
                          }

                          return (
                            <div className="w-full overflow-hidden rounded-md border border-slate-200 bg-black">
                              <div className="aspect-video w-full">
                                <iframe
                                  src={embedUrl}
                                  title="Video preview"
                                  className="h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="space-y-3">
                          <Video className="mx-auto h-12 w-12 text-slate-500" />
                          <p className="text-lg font-medium text-slate-500">Video preview area</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
                  <div className="flex w-full max-w-2xl items-end gap-4">
                    <div className="w-full max-w-sm">
                      <div className="flex items-center border-b border-slate-300 pb-2">
                        <Input
                          value={mediaSearch}
                          onChange={(event) => onMediaSearchChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && mediaTab === "images") {
                              event.preventDefault();
                              void onSearchMediaImages();
                            }
                          }}
                          placeholder={
                            mediaTab === "images"
                              ? "Search an image"
                              : mediaTab === "icons"
                                ? "Search a pictogram"
                                : `Search ${mediaTab}`
                          }
                          className="h-auto border-0 bg-transparent px-0 py-0 text-lg text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <button
                          type="button"
                          className="text-slate-500 transition hover:text-slate-900"
                          onClick={() => {
                            if (mediaTab === "images") {
                              void onSearchMediaImages();
                            }
                          }}
                          aria-label="Search media"
                        >
                          <Search className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                    <Select value={mediaResultFilter} onValueChange={onMediaResultFilterChange}>
                      <SelectTrigger className="h-11 min-w-36 border-slate-300 bg-white text-base text-slate-900">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-200 bg-white text-slate-900">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="photos">Photos</SelectItem>
                        <SelectItem value="illustrations">Illustrations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Input
                      value={mediaUrl}
                      onChange={(event) => onMediaUrlChange(event.target.value)}
                      placeholder="https://www.odoo.com/..."
                      className="h-11 w-72 border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      className="h-11 bg-slate-200 px-5 text-slate-900 hover:bg-slate-300"
                      onClick={onAddMediaUrl}
                    >
                      Add URL
                    </Button>
                    <Button
                      type="button"
                      className="h-11 bg-slate-200 px-5 text-slate-900 hover:bg-slate-300"
                      onClick={() => mediaUploadInputRef.current?.click()}
                    >
                      {mediaTab === "images"
                        ? "Upload an image"
                        : mediaTab === "documents"
                          ? "Upload a document"
                          : mediaTab === "icons"
                            ? "Upload an icon"
                            : "Upload a video"}
                    </Button>
                    <input
                      ref={mediaUploadInputRef}
                      type="file"
                      accept={
                        mediaTab === "images"
                          ? "image/*"
                          : mediaTab === "documents"
                            ? ".pdf,.doc,.docx,.txt"
                            : mediaTab === "icons"
                              ? "image/*,.svg"
                              : "video/*"
                      }
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        onSelectMediaFileName(file?.name ?? "");
                      }}
                    />
                  </div>
                </div>
              )}

              {mediaTab === "videos" ? null : (
                <div className="max-h-[calc(88vh-310px)] min-h-[360px] overflow-y-auto rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                  {mediaTab === "images" && filteredMediaResults.length > 0 ? (
                    <div className="pr-1">
                      <div className="grid grid-cols-2 gap-1 md:grid-cols-3 xl:grid-cols-5">
                        {filteredMediaResults.map((image) => {
                          const isSelected = selectedMediaImageUrl === image.fullUrl;
                          const sourceLabel = image.title.toLowerCase().includes("undraw")
                            ? "Undraw"
                            : image.title.split(" ").slice(0, 2).join(" ");

                          return (
                            <button
                              key={image.id}
                              type="button"
                              className={`group relative aspect-[1.2/1] overflow-hidden border text-left transition ${
                                isSelected
                                  ? "border-cyan-500 ring-2 ring-cyan-500/30"
                                  : "border-slate-300 hover:border-slate-400"
                              }`}
                              onClick={() => onSelectMediaImage(image)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image.thumbUrl} alt={image.title} className="h-full w-full bg-slate-100 object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-white/85 px-3 py-2 backdrop-blur-sm">
                                <p className="truncate text-sm text-slate-800">{sourceLabel || image.title}</p>
                              </div>
                              {isSelected ? (
                                <div className="absolute inset-0 flex items-end justify-center bg-cyan-500/10">
                                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg">
                                    <Check className="h-6 w-6" />
                                  </div>
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : mediaTab === "icons" ? (
                    <div className="pr-1">
                      <div className="grid grid-cols-4 gap-3 md:grid-cols-6 xl:grid-cols-10">
                        {filteredIconResults.map((icon) => {
                          const isSelected = selectedMediaIconId === icon.id;
                          const IconComponent = icon.Icon;

                          return (
                            <button
                              key={icon.id}
                              type="button"
                              className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 transition ${
                                isSelected
                                  ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20"
                                  : "border-slate-300 hover:border-slate-400 hover:bg-slate-100"
                              }`}
                              onClick={() => onSelectMediaIconId(icon.id)}
                              title={icon.name}
                            >
                              <IconComponent className="h-7 w-7 text-slate-700" />
                              <span className="truncate text-center text-xs text-slate-600">{icon.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      {filteredIconResults.length === 0 ? (
                        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                          <ImagePlus className="mb-6 h-16 w-16 text-slate-400" />
                          <p className="text-3xl font-semibold text-slate-800">No matching icons found</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                      <ImagePlus className="mb-6 h-16 w-16 text-slate-400" />
                      <p className="text-4xl font-semibold text-slate-800">
                        {isSearchingMedia
                          ? "Searching images..."
                          : mediaTab === "images"
                            ? "Search the web for royalty-free images"
                            : mediaTab === "documents"
                              ? "Search or add documents"
                              : mediaTab === "icons"
                                ? "Select an icon for the description"
                                : "Search or add videos"}
                      </p>
                      {mediaSearchError ? <p className="mt-4 text-base text-rose-500">{mediaSearchError}</p> : null}
                      {selectedMediaFileName ? (
                        <p className="mt-4 text-base text-slate-500">Selected file: {selectedMediaFileName}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-slate-200 px-5 py-5 sm:justify-start">
          <Button type="button" className="bg-[#44a2de] text-white hover:bg-[#3991ca]" onClick={onAddSelectedMediaToDescription}>
            Add
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="bg-slate-200 text-slate-900 hover:bg-slate-300">
              Discard
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
