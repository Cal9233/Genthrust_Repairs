import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// Using div with overflow instead of ScrollArea component
import { loggingService } from '@/lib/loggingService';
import { FileText, Download, Trash2, RefreshCw, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogsDialog({ open, onOpenChange }: LogsDialogProps) {
  const [logFiles, setLogFiles] = useState<Array<{ name: string; date: Date; id: string }>>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load log files when dialog opens
  useEffect(() => {
    if (open) {
      loadLogFiles();
    }
  }, [open]);

  const loadLogFiles = async () => {
    setIsLoading(true);
    try {
      const files = await loggingService.getLogFiles();
      setLogFiles(files);

      // Auto-select today's log if it exists
      const today = new Date();
      const todayFileName = `logs_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.txt`;
      const todayLog = files.find(f => f.name === todayFileName);

      if (todayLog) {
        setSelectedLog(todayLog.name);
        loadLogContent(todayLog.name);
      }
    } catch (error) {
      console.error('Failed to load log files:', error);
      toast.error('Failed to load log files');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogContent = async (fileName: string) => {
    setIsLoading(true);
    try {
      const content = await loggingService.getLogFileContent(fileName);
      setLogContent(content);
    } catch (error) {
      console.error('Failed to load log content:', error);
      toast.error('Failed to load log content');
      setLogContent('Error loading log content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLog = (fileName: string) => {
    setSelectedLog(fileName);
    loadLogContent(fileName);
  };

  const handleDownload = () => {
    if (!selectedLog || !logContent) return;

    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedLog;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Log file downloaded');
  };

  const handleDelete = async () => {
    if (!selectedLog) return;

    if (!confirm(`Are you sure you want to delete ${selectedLog}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await loggingService.deleteLogFile(selectedLog);
      toast.success('Log file deleted');

      // Refresh list and clear selection
      await loadLogFiles();
      setSelectedLog(null);
      setLogContent('');
    } catch (error) {
      console.error('Failed to delete log file:', error);
      toast.error('Failed to delete log file');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            AI Agent Activity Logs
          </DialogTitle>
          <DialogDescription>
            View and manage AI agent interaction logs. All conversations are automatically logged for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[250px_1fr] gap-4 overflow-hidden">
          {/* Log Files List */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Log Files
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadLogFiles}
                disabled={isLoading}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {logFiles.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No logs yet
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {logFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleSelectLog(file.name)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedLog === file.name
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">{formatDate(file.date)}</div>
                      <div className="text-xs opacity-70">{file.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Log Content */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {selectedLog || 'Select a log file'}
              </h3>
              {selectedLog && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!logContent || isLoading}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : logContent ? (
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {logContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Select a log file to view its contents</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
