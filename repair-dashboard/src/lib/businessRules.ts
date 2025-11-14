/**
 * Business rules and calculations for repair orders
 */

/**
 * Calculate the next update date based on current status and payment terms
 * @param status - Current status of the repair order
 * @param statusDate - Date when status was set
 * @param paymentTerms - Payment terms (e.g., "NET 30", "COD", etc.)
 * @returns Next date to update, or null if no follow-up needed
 */
export function calculateNextUpdateDate(
  status: string,
  statusDate: Date,
  paymentTerms?: string
): Date | null {
  const normalizedStatus = status.toUpperCase().trim();
  const baseDate = new Date(statusDate);

  // Reset time to start of day
  baseDate.setHours(0, 0, 0, 0);

  switch (normalizedStatus) {
    case "TO SEND":
      // Follow up in 3 days to confirm shipment
      return addDays(baseDate, 3);

    case "WAITING QUOTE":
      // Follow up in 14 days for quote
      return addDays(baseDate, 14);

    case "APPROVED":
      // Follow up in 7 days to check repair start
      return addDays(baseDate, 7);

    case "BEING REPAIRED":
      // Follow up in 10 days for repair progress
      return addDays(baseDate, 10);

    case "CURRENTLY BEING SHIPPED":
      // Follow up in 5 days to track inbound delivery
      return addDays(baseDate, 5);

    case "RECEIVED":
      // Part received, follow up in 3 days for payment processing
      return addDays(baseDate, 3);

    case "SHIPPING":
      // Follow up in 3 days to track delivery
      return addDays(baseDate, 3);

    case "PAID":
    case "PAID >>>>":
      // Calculate payment due date based on terms
      if (paymentTerms) {
        const terms = paymentTerms.toUpperCase().trim();

        // Extract number of days from NET terms
        if (terms.includes("NET")) {
          const match = terms.match(/NET\s*(\d+)/);
          if (match) {
            const days = parseInt(match[1]);
            console.log(`[Business Rules] PAID status with ${terms}: payment due in ${days} days`);
            return addDays(baseDate, days);
          }
        }

        // COD, Prepaid, etc. - payment already handled
        if (terms.includes("COD") || terms.includes("PREPAID") || terms.includes("C.O.D.")) {
          console.log(`[Business Rules] PAID status with ${terms}: no follow-up needed`);
          return null;
        }

        // Wire transfer - give 3 days to process
        if (terms.includes("WIRE") || terms.includes("XFER")) {
          console.log(`[Business Rules] PAID status with ${terms}: 3 days for wire processing`);
          return addDays(baseDate, 3);
        }

        // Credit card - immediate
        if (terms.includes("CREDIT CARD")) {
          console.log(`[Business Rules] PAID status with ${terms}: no follow-up needed`);
          return null;
        }

        // Default for PAID with unknown terms - 30 days
        console.log(`[Business Rules] PAID status with unknown terms "${terms}": defaulting to 30 days`);
        return addDays(baseDate, 30);
      }

      // No payment terms specified - assume complete
      console.log(`[Business Rules] PAID status with no terms: no follow-up needed`);
      return null;

    case "PAYMENT SENT":
      // Payment has been sent - order complete
      console.log(`[Business Rules] PAYMENT SENT status: order complete`);
      return null;

    case "BER":
      // Beyond economic repair - no follow-up needed
      return null;

    default:
      // Default: follow up in 7 days
      return addDays(baseDate, 7);
  }
}

/**
 * Calculate number of days since status was set
 * @param statusDate - Date when status was set
 * @returns Number of days in current status
 */
export function calculateDaysInStatus(statusDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const status = new Date(statusDate);
  status.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - status.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get color scheme for status badge
 * @param status - Current status
 * @param isOverdue - Whether the RO is overdue
 * @returns Color class names for Tailwind CSS
 */
export function getStatusColor(
  status: string,
  isOverdue: boolean
): {
  bg: string;
  text: string;
  border: string;
} {
  // Overdue takes priority
  if (isOverdue) {
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    };
  }

  const normalizedStatus = status.toUpperCase().trim();

  switch (normalizedStatus) {
    case "TO SEND":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      };

    case "WAITING QUOTE":
      return {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-200",
      };

    case "APPROVED":
      return {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
      };

    case "BEING REPAIRED":
      return {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
      };

    case "CURRENTLY BEING SHIPPED":
      return {
        bg: "bg-cyan-50",
        text: "text-cyan-700",
        border: "border-cyan-200",
      };

    case "RECEIVED":
      return {
        bg: "bg-teal-50",
        text: "text-teal-700",
        border: "border-teal-200",
      };

    case "SHIPPING":
      return {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
      };

    case "PAID":
    case "PAID >>>>":
      return {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
      };

    case "BER":
      return {
        bg: "bg-slate-50",
        text: "text-slate-700",
        border: "border-slate-200",
      };

    default:
      return {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
      };
  }
}

/**
 * Check if an RO is due today
 * @param nextDateToUpdate - Next update date
 * @returns True if due today
 */
export function isDueToday(nextDateToUpdate: Date | null): boolean {
  if (!nextDateToUpdate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(nextDateToUpdate);
  dueDate.setHours(0, 0, 0, 0);

  return today.getTime() === dueDate.getTime();
}

/**
 * Check if an RO is due within the next N days
 * @param nextDateToUpdate - Next update date
 * @param days - Number of days to check
 * @returns True if due within N days
 */
export function isDueWithinDays(
  nextDateToUpdate: Date | null,
  days: number
): boolean {
  if (!nextDateToUpdate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(nextDateToUpdate);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= days;
}

/**
 * Check if an RO is on track (next update date is more than 3 days away)
 * @param nextDateToUpdate - Next update date
 * @returns True if on track
 */
export function isOnTrack(nextDateToUpdate: Date | null): boolean {
  if (!nextDateToUpdate) return true; // No update needed = on track

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(nextDateToUpdate);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 3;
}

/**
 * Helper function to add days to a date
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format a date for display in the UI
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date | null): string {
  if (!date) return "N/A";

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "N/A";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  } catch {
    return "N/A";
  }
}
