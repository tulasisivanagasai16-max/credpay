import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let colorClass = "";

  switch (status.toUpperCase()) {
    case "SUCCESS":
    case "VERIFIED":
      colorClass = "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20";
      break;
    case "PENDING":
      colorClass = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
      break;
    case "FAILED":
    case "REJECTED":
    case "REVERSED":
      colorClass = "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20";
      break;
    case "PROCESSING":
      colorClass = "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20";
      break;
    default:
      colorClass = "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20";
  }

  return (
    <Badge variant="outline" className={`${colorClass} font-medium border`}>
      {status}
    </Badge>
  );
}
