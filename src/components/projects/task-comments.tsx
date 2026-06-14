"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { addTaskComment, CommentNode, getTaskComments } from "@/actions/project-comment.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TaskCommentsProps {
  projectId: string;
  taskId: string;
  onChange?: () => void;
}

function TaskCommentItem({
  projectId,
  taskId,
  comment,
  depth,
  onRefresh,
  onChange,
}: {
  projectId: string;
  taskId: string;
  comment: CommentNode;
  depth: number;
  onRefresh: () => void;
  onChange?: () => void;
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
    formData.append("taskId", taskId);
    formData.append("text", text);
    formData.append("parentId", comment.id);

    const result = await addTaskComment(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setReplyText("");
    setShowReply(false);
    onRefresh();
    onChange?.();
  };

  return (
    <div className="space-y-2 rounded border p-2" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{comment.author.name}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(comment.createdAt), "MMM d, h:mm a")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{comment.text}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowReply((value) => !value)}>
        Reply
      </Button>
      {showReply ? (
        <div className="space-y-2">
          <Textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            rows={2}
            placeholder="Reply on task"
          />
          <Button type="button" size="sm" onClick={submitReply}>
            Post Reply
          </Button>
        </div>
      ) : null}

      {comment.replies.length > 0 ? (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <TaskCommentItem
              key={reply.id}
              projectId={projectId}
              taskId={taskId}
              comment={reply}
              depth={depth + 1}
              onRefresh={onRefresh}
              onChange={onChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaskComments({ projectId, taskId, onChange }: TaskCommentsProps) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [text, setText] = useState("");

  const loadComments = useCallback(async () => {
    const result = await getTaskComments(projectId, taskId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setComments(result.data);
  }, [projectId, taskId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await getTaskComments(projectId, taskId);
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
  }, [projectId, taskId]);

  const submitComment = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Comment is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);
    formData.append("text", trimmed);

    const result = await addTaskComment(formData);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setText("");
    setComments(result.data ?? []);
    onChange?.();
  };

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-medium text-muted-foreground">Task Comments</p>
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        placeholder="Comment on this task"
      />
      <Button type="button" size="sm" onClick={submitComment}>
        Add Task Comment
      </Button>
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No task comments yet.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <TaskCommentItem
              key={comment.id}
              projectId={projectId}
              taskId={taskId}
              comment={comment}
              depth={0}
              onRefresh={loadComments}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
