"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProjectFromTemplate } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const templateOptions = [
  { key: "HARDWARE", label: "Hardware Project - 15000" },
  { key: "SOFTWARE", label: "Software Project - 10000" },
  { key: "INTERNSHIP", label: "Internship Project - 5000" },
] as const;

export function ProjectTemplateCreateButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = (templateKey: (typeof templateOptions)[number]["key"]) => {
    startTransition(async () => {
      const result = await createProjectFromTemplate(templateKey);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not create template project");
        return;
      }
      toast.success("Template project created");
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templateOptions.map((option) => (
          <DropdownMenuItem key={option.key} onClick={() => handleCreate(option.key)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
