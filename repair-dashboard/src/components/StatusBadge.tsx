import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, Truck } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  const getStatusStyle = () => {
    if (isOverdue) {
      return "bg-red-100 text-red-800 border-red-300";
    }

    if (status.includes("WAITING QUOTE")) {
      return "bg-yellow-100 text-yellow-800";
    }
    if (status.includes("APPROVED")) {
      return "bg-green-100 text-green-800";
    }
    if (status.includes("BEING REPAIRED")) {
      return "bg-purple-100 text-purple-800";
    }
    if (status.includes("SHIPPING")) {
      return "bg-blue-100 text-blue-800";
    }
    if (status.includes("PAID")) {
      return "bg-gray-100 text-gray-800";
    }

    return "bg-gray-100 text-gray-800";
  };

  const getIcon = () => {
    if (isOverdue) return <AlertCircle className="h-3 w-3" />;
    if (status.includes("WAITING")) return <Clock className="h-3 w-3" />;
    if (status.includes("APPROVED")) return <CheckCircle className="h-3 w-3" />;
    if (status.includes("SHIPPING")) return <Truck className="h-3 w-3" />;
    return null;
  };

  return (
    <Badge className={`${getStatusStyle()} flex items-center gap-1`}>
      {getIcon()}
      {isOverdue ? "⚠️ " : ""}
      {status}
    </Badge>
  );
}
