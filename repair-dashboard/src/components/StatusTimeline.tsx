import type { StatusHistoryEntry } from "../types";
import {
  Package,
  FileText,
  CheckCircle,
  Wrench,
  Truck,
  DollarSign,
  Calendar,
  User,
  MessageSquare
} from "lucide-react";

interface StatusTimelineProps {
  history: StatusHistoryEntry[];
}

const getStatusIcon = (status: string) => {
  const statusLower = status.toLowerCase();

  if (statusLower.includes("send")) return Package;
  if (statusLower.includes("quote")) return FileText;
  if (statusLower.includes("approved")) return CheckCircle;
  if (statusLower.includes("repair")) return Wrench;
  if (statusLower.includes("shipping")) return Truck;
  if (statusLower.includes("paid")) return DollarSign;

  return FileText;
};

const getStatusColor = (status: string) => {
  const statusLower = status.toLowerCase();

  if (statusLower.includes("send")) return "bg-blue-500";
  if (statusLower.includes("quote")) return "bg-yellow-500";
  if (statusLower.includes("approved")) return "bg-green-500";
  if (statusLower.includes("repair")) return "bg-purple-500";
  if (statusLower.includes("shipping")) return "bg-orange-500";
  if (statusLower.includes("paid")) return "bg-emerald-500";

  return "bg-gray-500";
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export function StatusTimeline({ history }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No status history available</p>
      </div>
    );
  }

  // Reverse to show most recent first
  const sortedHistory = [...history].reverse();

  return (
    <div className="relative">
      {sortedHistory.map((entry, index) => {
        const Icon = getStatusIcon(entry.status);
        const colorClass = getStatusColor(entry.status);
        const isLast = index === sortedHistory.length - 1;

        return (
          <div key={index} className="relative flex gap-4 pb-8">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[15px] top-[32px] bottom-0 w-[2px] bg-gray-200" />
            )}

            {/* Icon circle */}
            <div className="relative z-10">
              <div className={`${colorClass} rounded-full p-2 text-white`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass} text-white`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(entry.date)}
                  </div>
                </div>

                {/* User */}
                <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                  <User className="w-3.5 h-3.5" />
                  <span>{entry.user}</span>
                </div>

                {/* Additional details */}
                {(entry.cost !== undefined || entry.deliveryDate || entry.notes) && (
                  <div className="mt-3 space-y-1.5 border-t border-gray-200 pt-3">
                    {entry.cost !== undefined && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                        <span className="font-medium">{formatCurrency(entry.cost)}</span>
                      </div>
                    )}

                    {entry.deliveryDate && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span>Delivery: {formatDate(entry.deliveryDate)}</span>
                      </div>
                    )}

                    {entry.notes && (
                      <div className="flex items-start gap-1.5 text-sm">
                        <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                        <span className="text-gray-700">{entry.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
