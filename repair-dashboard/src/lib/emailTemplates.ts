import type { RepairOrder, Shop } from "../types";

export interface EmailContent {
  to: string;
  subject: string;
  body: string;
}

const COMPANY_NAME = "GenThrust";
const COMPANY_CONTACT = "repairs@genthrust.com"; // Update with actual contact info

/**
 * Format date for email display
 */
function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Generate email to request a quote from the repair shop
 */
export function generateQuoteRequestEmail(
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  const shopEmail = shop?.email || "";
  const shopContact = shop?.contactName || "Sir/Madam";

  const subject = `Quote Request - RO #${ro.roNumber} - ${ro.partDescription}`;

  const body = `Dear ${shopContact},

We would like to request a quote for the following repair:

REPAIR ORDER DETAILS:
- RO Number: ${ro.roNumber}
- Part Description: ${ro.partDescription}
- Part Number: ${ro.partNumber || "N/A"}
- Serial Number: ${ro.serialNumber || "N/A"}
- Required Work: ${ro.requiredWork || "N/A"}
${ro.shopReferenceNumber ? `- Your Reference Number: ${ro.shopReferenceNumber}` : ""}

Date Dropped Off: ${formatDate(ro.dateDroppedOff)}

Could you please provide us with:
1. Estimated cost for the repair
2. Estimated delivery date
3. Any additional information or concerns

Please reply at your earliest convenience.

Thank you for your assistance.

Best regards,
${COMPANY_NAME} Repairs Team
${COMPANY_CONTACT}`;

  return { to: shopEmail, subject, body };
}

/**
 * Generate follow-up email to request status update
 */
export function generateFollowUpEmail(
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  const shopEmail = shop?.email || "";
  const shopContact = shop?.contactName || "Sir/Madam";

  const subject = `Status Update Request - RO #${ro.roNumber}`;

  const body = `Dear ${shopContact},

We are following up on the repair order below:

REPAIR ORDER DETAILS:
- RO Number: ${ro.roNumber}
- Part Description: ${ro.partDescription}
- Part Number: ${ro.partNumber || "N/A"}
${ro.shopReferenceNumber ? `- Your Reference Number: ${ro.shopReferenceNumber}` : ""}

Current Status: ${ro.currentStatus}
Last Updated: ${formatDate(ro.currentStatusDate)}

Could you please provide us with an update on the status of this repair? We would appreciate any information regarding:
1. Current repair progress
2. Expected completion date
3. Any issues or concerns

Thank you for your attention to this matter.

Best regards,
${COMPANY_NAME} Repairs Team
${COMPANY_CONTACT}`;

  return { to: shopEmail, subject, body };
}

/**
 * Generate email to approve a repair quote
 */
export function generateApprovalEmail(
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  const shopEmail = shop?.email || "";
  const shopContact = shop?.contactName || "Sir/Madam";

  const subject = `Repair Approved - RO #${ro.roNumber} - Please Proceed`;

  const estimatedCost = ro.estimatedCost
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(ro.estimatedCost)
    : "N/A";

  const body = `Dear ${shopContact},

We are pleased to approve the repair quote for the following order:

REPAIR ORDER DETAILS:
- RO Number: ${ro.roNumber}
- Part Description: ${ro.partDescription}
- Part Number: ${ro.partNumber || "N/A"}
- Serial Number: ${ro.serialNumber || "N/A"}
${ro.shopReferenceNumber ? `- Your Reference Number: ${ro.shopReferenceNumber}` : ""}

Approved Quote Amount: ${estimatedCost}
Terms: ${ro.terms || "As agreed"}

Please proceed with the repair work. We would appreciate:
1. Confirmation of receipt of this approval
2. Expected completion/delivery date
3. Any updates if circumstances change

Thank you for your service.

Best regards,
${COMPANY_NAME} Repairs Team
${COMPANY_CONTACT}`;

  return { to: shopEmail, subject, body };
}

/**
 * Generate email to expedite/rush a repair
 */
export function generateExpeditedRequestEmail(
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  const shopEmail = shop?.email || "";
  const shopContact = shop?.contactName || "Sir/Madam";

  const subject = `URGENT: Expedite Request - RO #${ro.roNumber}`;

  const body = `Dear ${shopContact},

We have an urgent need to expedite the following repair order:

REPAIR ORDER DETAILS:
- RO Number: ${ro.roNumber}
- Part Description: ${ro.partDescription}
- Part Number: ${ro.partNumber || "N/A"}
${ro.shopReferenceNumber ? `- Your Reference Number: ${ro.shopReferenceNumber}` : ""}

Current Status: ${ro.currentStatus}
Original Expected Delivery: ${formatDate(ro.estimatedDeliveryDate)}

We would greatly appreciate if you could prioritize this repair. Please let us know:
1. If expedited service is possible
2. Revised completion date if expedited
3. Any additional costs for expedited service

Please contact us as soon as possible to discuss.

Thank you for your understanding and cooperation.

Best regards,
${COMPANY_NAME} Repairs Team
${COMPANY_CONTACT}`;

  return { to: shopEmail, subject, body };
}

/**
 * Generate email to confirm receipt of repaired item
 */
export function generateReceiptConfirmationEmail(
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  const shopEmail = shop?.email || "";
  const shopContact = shop?.contactName || "Sir/Madam";

  const subject = `Receipt Confirmation - RO #${ro.roNumber}`;

  const body = `Dear ${shopContact},

This email confirms that we have received the repaired item:

REPAIR ORDER DETAILS:
- RO Number: ${ro.roNumber}
- Part Description: ${ro.partDescription}
- Part Number: ${ro.partNumber || "N/A"}
${ro.trackingNumber ? `- Tracking Number: ${ro.trackingNumber}` : ""}
${ro.shopReferenceNumber ? `- Your Reference Number: ${ro.shopReferenceNumber}` : ""}

The item has been received and will be inspected. We will contact you if there are any concerns.

Thank you for completing this repair.

Best regards,
${COMPANY_NAME} Repairs Team
${COMPANY_CONTACT}`;

  return { to: shopEmail, subject, body };
}

/**
 * Get available email templates based on RO status
 */
export function getAvailableTemplates(status: string): string[] {
  const allTemplates = [
    "Request Quote",
    "Request Status Update",
    "Approve Repair",
    "Expedite Request",
    "Confirm Receipt",
    "Custom",
  ];

  // Filter templates based on current status
  if (status.includes("TO SEND")) {
    return ["Request Quote", "Custom"];
  }
  if (status.includes("WAITING QUOTE")) {
    return ["Request Status Update", "Custom"];
  }
  if (status.includes("APPROVED") || status.includes("BEING REPAIRED")) {
    return ["Request Status Update", "Expedite Request", "Custom"];
  }
  if (status.includes("SHIPPING")) {
    return ["Confirm Receipt", "Custom"];
  }

  return allTemplates;
}

/**
 * Generate email based on template name
 */
export function generateEmail(
  templateName: string,
  ro: RepairOrder,
  shop: Shop | null
): EmailContent {
  switch (templateName) {
    case "Request Quote":
      return generateQuoteRequestEmail(ro, shop);
    case "Request Status Update":
      return generateFollowUpEmail(ro, shop);
    case "Approve Repair":
      return generateApprovalEmail(ro, shop);
    case "Expedite Request":
      return generateExpeditedRequestEmail(ro, shop);
    case "Confirm Receipt":
      return generateReceiptConfirmationEmail(ro, shop);
    case "Custom":
      return {
        to: shop?.email || "",
        subject: `Regarding RO #${ro.roNumber}`,
        body: `Dear ${shop?.contactName || "Sir/Madam"},\n\n\n\nBest regards,\n${COMPANY_NAME} Repairs Team\n${COMPANY_CONTACT}`,
      };
    default:
      return generateFollowUpEmail(ro, shop);
  }
}
