"use client";

import { useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { sendAdminMessage } from "@/actions/admin-message.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AdminMessageComposerProps {
  userRole: string;
}

const roleOptionsBySender: Record<string, { value: string; label: string }[]> = {
  ADMIN: [
    { value: "ALL", label: "All" },
    { value: "TEAMLEADER", label: "Team Leader" },
    { value: "BA", label: "BA" },
    { value: "EMPLOYEE", label: "Employee" },
  ],
  BA: [
    { value: "ALL", label: "My TL + Employees" },
    { value: "TEAMLEADER", label: "My Team Leaders" },
    { value: "EMPLOYEE", label: "My Employees" },
  ],
  TEAMLEADER: [
    { value: "ALL", label: "My Employees" },
    { value: "EMPLOYEE", label: "My Employees" },
  ],
};

export function AdminMessageComposer({ userRole }: AdminMessageComposerProps) {
  const roleOptions = roleOptionsBySender[userRole] ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const [targetRole, setTargetRole] = useState(roleOptions[0]?.value ?? "ALL");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (userRole === "EMPLOYEE") {
    return null;
  }

  const handleSend = () => {
    const text = message.trim();
    if (!text) {
      toast.error("Message is required");
      return;
    }

    const formData = new FormData();
    formData.append("targetRole", targetRole);
    formData.append("message", text);

    startTransition(async () => {
      const result = await sendAdminMessage(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Message sent");
      setMessage("");
      setTargetRole(roleOptions[0]?.value ?? "ALL");
      setIsOpen(false);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Send Message">
          <MessageSquare className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            Select recipients and send message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Send To</Label>
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select recipient role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={4}
              placeholder="Type your message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isPending}>
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
