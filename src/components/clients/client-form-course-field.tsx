"use client";

import { BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ClientFormCourseFieldProps {
  courseName: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function ClientFormCourseField({
  courseName,
  disabled,
  onChange,
}: ClientFormCourseFieldProps) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <BookOpen className="h-5 w-5 text-[#7c4a69]" />
      <div className="relative w-full max-w-[24rem]">
        <Input
          id="courseName"
          name="courseName"
          value={courseName}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Course Name"
          disabled={disabled}
          autoComplete="off"
          className="h-8 border-0 px-0 pr-8 text-2xl shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
