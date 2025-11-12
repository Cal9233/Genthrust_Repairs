import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle, Truck } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
}

export function StatusBadge({ status, isOverdue }: StatusBadgeProps) {
  const getStatusStyle = () => {
    if (isOverdue) {
      return "bg-danger/10 text-danger border-danger/30 font-semibold";
    }

    if (status.includes("WAITING QUOTE")) {
      return "bg-warning/10 text-warning border-warning/30 font-medium";
    }
    if (status.includes("APPROVED")) {
      return "bg-success/10 text-success border-success/30 font-medium";
    }
    if (status.includes("BEING REPAIRED")) {
      return "bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30 font-medium";
    }
    if (status.includes("SHIPPING")) {
      return "bg-[#06b6d4]/10 text-[#06b6d4] border-[#06b6d4]/30 font-medium";
    }
    if (status.includes("PAID")) {
      return "bg-secondary text-muted-foreground border-border font-medium";
    }

    return "bg-secondary text-muted-foreground border-border font-medium";
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
