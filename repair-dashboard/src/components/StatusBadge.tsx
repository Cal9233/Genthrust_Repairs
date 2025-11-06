import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, Truck } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  const getStatusStyle = () => {
    if (isOverdue) {
      return "bg-red-100 text-red-700 border-red-300 font-semibold";
    }

    if (status.includes("WAITING QUOTE")) {
      return "bg-yellow-100 text-yellow-700 border-yellow-300 font-medium";
    }
    if (status.includes("APPROVED")) {
      return "bg-green-100 text-green-700 border-green-300 font-medium";
    }
    if (status.includes("BEING REPAIRED")) {
      return "bg-purple-100 text-purple-700 border-purple-300 font-medium";
    }
    if (status.includes("SHIPPING")) {
      return "bg-blue-100 text-blue-700 border-blue-300 font-medium";
    }
    if (status.includes("PAID")) {
      return "bg-gray-100 text-gray-700 border-gray-300 font-medium";
    }

    return "bg-gray-100 text-gray-700 border-gray-300 font-medium";
  };

  const getIcon = () => {
    if (isOverdue) return <AlertCircle className="h-3.5 w-3.5" />;
    if (status.includes("WAITING")) return <Clock className="h-3.5 w-3.5" />;
    if (status.includes("APPROVED")) return <CheckCircle className="h-3.5 w-3.5" />;
    if (status.includes("SHIPPING")) return <Truck className="h-3.5 w-3.5" />;
    return null;
  };

  return (
    <Badge className={`${getStatusStyle()} flex items-center gap-1.5 px-3 py-1 border`}>
      {getIcon()}
      {status}
    </Badge>
  );
}
