import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { RepairOrder, Shop } from "../types";
import {
  generateEmail,
  getAvailableTemplates,
} from "../lib/emailTemplates";
import { Mail, Copy, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EmailComposerDialogProps {
  ro: RepairOrder;
  shop: Shop | null;
  open: boolean;
  onClose: () => void;
  onLogEmail?: (subject: string, templateName: string) => void;
}

export function EmailComposerDialog({
  ro,
  shop,
  open,
  onClose,
  onLogEmail,
}: EmailComposerDialogProps) {
  const availableTemplates = getAvailableTemplates(ro.currentStatus);
  const [selectedTemplate, setSelectedTemplate] = useState(availableTemplates[0]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [logEmail, setLogEmail] = useState(true);

  // Generate email content when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const emailContent = generateEmail(selectedTemplate, ro, shop);
      setTo(emailContent.to);
      setSubject(emailContent.subject);
      setBody(emailContent.body);
    }
  }, [selectedTemplate, ro, shop]);

  const handleCopyToClipboard = async () => {
    const fullEmail = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      toast.success("Email copied to clipboard!");

      if (logEmail && onLogEmail) {
        onLogEmail(subject, selectedTemplate);
      }
      onClose();
    } catch (error) {
      toast.error("Failed to copy to clipboard");
      console.error("Clipboard error:", error);
    }
  };

  const handleOpenInOutlook = () => {
    // Create mailto link
    const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Open in default email client
    window.location.href = mailtoLink;

    if (logEmail && onLogEmail) {
      onLogEmail(subject, selectedTemplate);
    }

    toast.success("Opening in email client...");
    onClose();
  };

  const showNoEmailWarning = !shop?.email;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Composer - RO #{ro.roNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning if no shop email */}
          {showNoEmailWarning && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">
                  No email on file for this shop
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  You'll need to manually enter the recipient's email address or add it to
                  the shop directory.
                </p>
              </div>
            </div>
          )}

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Email Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((template) => (
                  <SelectItem key={template} value={template}>
                    {template}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To field */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
            {shop?.contactName && (
              <p className="text-xs text-muted-foreground">
                Contact: {shop.contactName}
                {shop.phone && ` • ${shop.phone}`}
              </p>
            )}
          </div>

          {/* Subject field */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Body field */}
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email body..."
              rows={15}
              className="font-mono text-sm"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="bg-muted border border-border rounded-lg p-4 text-sm">
              <div className="space-y-1 mb-3 pb-3 border-b border-border">
                <div>
                  <span className="font-semibold">To:</span> {to || "(no recipient)"}
                </div>
                <div>
                  <span className="font-semibold">Subject:</span>{" "}
                  {subject || "(no subject)"}
                </div>
              </div>
              <div className="whitespace-pre-wrap text-foreground">{body}</div>
            </div>
          </div>

          {/* Log email checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="logEmail"
              checked={logEmail}
              onCheckedChange={(checked: boolean) => setLogEmail(checked)}
            />
            <label
              htmlFor="logEmail"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Log this email in RO status history
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleCopyToClipboard}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </Button>
          <Button onClick={handleOpenInOutlook} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in Email Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
