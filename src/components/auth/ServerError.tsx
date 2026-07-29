import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className="flex items-center gap-2 rounded-lg border border-[#C95B5B]/35 bg-[#C95B5B]/10 px-3 py-2 text-sm text-[#C95B5B]">
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
