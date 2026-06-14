"use client";

import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BoardAddStageColumnProps {
  isSavingStage: boolean;
  newStageName: string;
  onAddStage: () => void;
  onSetNewStageName: (value: string) => void;
  onSetShowAddStageInput: (value: boolean) => void;
  showAddStageInput: boolean;
}

export function BoardAddStageColumn({
  isSavingStage,
  newStageName,
  onAddStage,
  onSetNewStageName,
  onSetShowAddStageInput,
  showAddStageInput,
}: BoardAddStageColumnProps) {
  return (
    <div
      className={`sticky right-0 top-0 z-20 flex shrink-0 self-start items-start bg-white/95 ${
        showAddStageInput ? "w-2 justify-start" : "w-10 justify-center"
      }`}
    >
      {showAddStageInput ? (
        <div className="absolute left-0 top-0 w-[250px] overflow-hidden rounded-none border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-slate-50 px-3 py-2.5">
            <p className="text-[1.05rem] font-semibold tracking-tight text-slate-900">New Stage</p>
            <p className="mt-1 text-xs text-slate-500">Create a new task stage</p>
          </div>
          <div className="space-y-2 p-2.5">
            <Input
              value={newStageName}
              onChange={(event) => onSetNewStageName(event.target.value)}
              placeholder="Stage name..."
              className="h-9 bg-white"
              autoFocus
              disabled={isSavingStage}
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={onAddStage} className="h-8 px-3" disabled={isSavingStage}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onSetShowAddStageInput(false);
                  onSetNewStageName("");
                }}
                className="h-8 px-3"
                disabled={isSavingStage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSetShowAddStageInput(true)}
          className="group flex h-full min-h-[200px] w-10 flex-col items-center justify-start gap-2 rounded-none bg-white px-0 pt-2 text-slate-800 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-sm leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
            Add Stage
          </span>
        </Button>
      )}
    </div>
  );
}
