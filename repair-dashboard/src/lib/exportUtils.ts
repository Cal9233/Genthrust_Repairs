import type { RepairOrder } from "../types";
import { createLogger } from '@/utils/logger';

const logger = createLogger('exportUtils');

/**
 * Format date for CSV export
 */
function formatDateForCSV(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US");
}

/**
 * Format currency for CSV export
 */
function formatCurrencyForCSV(amount: number | null): string {
  if (!amount) return "";
  return amount.toFixed(2);
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return "";

  const str = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert array of repair orders to CSV string
 */
function convertToCSV(ros: RepairOrder[]): string {
  // Define CSV headers
  const headers = [
    "RO Number",
    "Date Made",
    "Shop Name",
    "Part Number",
    "Serial Number",
    "Part Description",
    "Required Work",
    "Date Dropped Off",
    "Estimated Cost",
    "Final Cost",
    "Terms",
    "Shop Reference Number",
    "Estimated Delivery Date",
    "Current Status",
    "Current Status Date",
    "GenThrust Status",
    "Shop Status",
    "Tracking Number",
    "Notes",
    "Last Date Updated",
    "Next Date to Update",
    "Days Overdue",
    "Is Overdue",
  ];

  // Create CSV rows
  const rows = ros.map((ro) => [
    escapeCSVField(ro.roNumber),
    escapeCSVField(formatDateForCSV(ro.dateMade)),
    escapeCSVField(ro.shopName),
    escapeCSVField(ro.partNumber),
    escapeCSVField(ro.serialNumber),
    escapeCSVField(ro.partDescription),
    escapeCSVField(ro.requiredWork),
    escapeCSVField(formatDateForCSV(ro.dateDroppedOff)),
    escapeCSVField(formatCurrencyForCSV(ro.estimatedCost)),
    escapeCSVField(formatCurrencyForCSV(ro.finalCost)),
    escapeCSVField(ro.terms),
    escapeCSVField(ro.shopReferenceNumber),
    escapeCSVField(formatDateForCSV(ro.estimatedDeliveryDate)),
    escapeCSVField(ro.currentStatus),
    escapeCSVField(formatDateForCSV(ro.currentStatusDate)),
    escapeCSVField(ro.genThrustStatus),
    escapeCSVField(ro.shopStatus),
    escapeCSVField(ro.trackingNumber),
    escapeCSVField(ro.notes),
    escapeCSVField(formatDateForCSV(ro.lastDateUpdated)),
    escapeCSVField(formatDateForCSV(ro.nextDateToUpdate)),
    escapeCSVField(ro.daysOverdue),
    escapeCSVField(ro.isOverdue ? "Yes" : "No"),
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Export repair orders to CSV file
 */
export function exportToCSV(ros: RepairOrder[], filename?: string): void {
  if (ros.length === 0) {
    logger.warn('No repair orders to export');
    return;
  }

  // Generate CSV content
  const csvContent = convertToCSV(ros);

  // Create blob
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  // Generate filename with timestamp if not provided
  const timestamp = new Date().toISOString().split("T")[0];
  const finalFilename =
    filename || `repair_orders_export_${timestamp}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", finalFilename);
  link.style.visibility = "hidden";

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}
