"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { addProjectComment, CommentNode, getProjectComments } from "@/actions/project-comment.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ProjectCommentsProps {
  projectId: string;
}

function CommentItem({
  projectId,
  comment,
  depth,
  onRefresh,
}: {
  projectId: string;
  comment: CommentNode;
  depth: number;
  onRefresh: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const submitReply = async () => {
    const text = replyText.trim();
    if (!text) {
      toast.error("Reply is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("text", text);
    formData.append("parentId", comment.id);

    const result = await addProjectComment(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setReplyText("");
    setShowReply(false);
    onRefresh();
  };

  return (
    <div className="space-y-2 rounded-md border p-3" style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{comment.author.name}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, yyyy h:mm a")}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{comment.text}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowReply((value) => !value)}>
        Reply
      </Button>

      {showReply ? (
        <div className="space-y-2">
          <Textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            rows={2}
            placeholder="Write a reply"
          />
          <Button type="button" size="sm" onClick={submitReply}>
            Post Reply
          </Button>
        </div>
      ) : null}

      {comment.replies.length > 0 ? (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              projectId={projectId}
              comment={reply}
              depth={depth + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectComments({ projectId }: ProjectCommentsProps) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [newComment, setNewComment] = useState("");

  const loadComments = useCallback(async () => {
    const result = await getProjectComments(projectId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setComments(result.data);
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getProjectComments(projectId);
      if (!mounted) return;
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setComments(result.data);
    })();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const submitComment = async () => {
    const text = newComment.trim();
    if (!text) {
      toast.error("Comment is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("text", text);

    const result = await addProjectComment(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setNewComment("");
    setComments(result.data ?? []);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Project Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            rows={3}
            placeholder="Write project-level comment"
          />
          <Button type="button" onClick={submitComment}>
            Add Comment
          </Button>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project comments yet.</p>
        ) : (
          <div className="space-y-2">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                projectId={projectId}
                comment={comment}
                depth={0}
                onRefresh={loadComments}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
