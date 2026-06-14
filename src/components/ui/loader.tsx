import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoaderSize = "sm" | "md" | "lg";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  size?: LoaderSize;
  center?: boolean;
}

const iconSizeClasses: Record<LoaderSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const textSizeClasses: Record<LoaderSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
};

function Loader({
  className,
  label = "Loading...",
  size = "md",
  center = false,
  ...props
}: LoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-muted-foreground",
        center && "w-full justify-center text-center",
        textSizeClasses[size],
        className
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <Loader2 className={cn("animate-spin text-primary", iconSizeClasses[size])} />
      <span>{label}</span>
    </div>
  );
}

export { Loader };
