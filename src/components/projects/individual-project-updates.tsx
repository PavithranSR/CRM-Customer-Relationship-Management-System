"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  addIndividualProjectDailyUpdate,
  getIndividualProjectUpdates,
  IndividualProjectUpdateItem,
} from "@/actions/individual-project-update.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface IndividualProjectUpdatesProps {
  projectId: string;
  canSubmit: boolean;
  title?: string;
}

export function IndividualProjectUpdates({
  projectId,
  canSubmit,
  title = "Individual Project Daily Work Updates",
}: IndividualProjectUpdatesProps) {
  const [comment, setComment] = useState("");
  const [updates, setUpdates] = useState<IndividualProjectUpdateItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadUpdates = useCallback(async () => {
    const result = await getIndividualProjectUpdates(projectId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setUpdates(result.data);
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getIndividualProjectUpdates(projectId);
      if (!mounted) return;
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setUpdates(result.data);
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const saveUpdate = async () => {
    const text = comment.trim();
    if (!text) {
      toast.error("Daily comment is required");
      return;
    }

    setIsSaving(true);
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("comment", text);

    const result = await addIndividualProjectDailyUpdate(formData);
    setIsSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setComment("");
    toast.success("Daily update saved");
    loadUpdates();
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canSubmit ? (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="individual-daily-comment">Today&apos;s Work Comment</Label>
            <Textarea
              id="individual-daily-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write what you completed today"
              rows={3}
            />
            <Button type="button" onClick={saveUpdate} disabled={isSaving}>
              Save Daily Update
            </Button>
          </div>
        ) : null}

        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No daily updates yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Auto Progress</p>
                <Badge variant="secondary">{updates[0]?.totalCompleted ?? 0}%</Badge>
              </div>
              <Progress value={updates[0]?.totalCompleted ?? 0} />
            </div>
            {updates.map((update) => (
              <div key={update.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{update.createdBy.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{update.createdBy.role}</Badge>
                    <Badge variant="secondary">+{update.completedToday}%</Badge>
                    <Badge variant="outline">Total {update.totalCompleted}%</Badge>
                    <Badge variant="secondary">
                      {format(new Date(update.createdAt), "MMM d, yyyy h:mm a")}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{update.comment}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
