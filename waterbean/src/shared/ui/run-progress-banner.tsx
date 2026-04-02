import { Loader2 } from "lucide-react";
import { Card } from "./card";

interface RunProgressBannerProps {
  message: string | null;
}

export function RunProgressBanner({ message }: RunProgressBannerProps) {
  if (!message) return null;

  return (
    <Card className="border-accent/20 bg-accent/5">
      <p className="flex items-center gap-2 text-sm text-zinc-700">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
        <span>{message}</span>
      </p>
    </Card>
  );
}
