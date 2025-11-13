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
import { excelService } from '@/lib/excelService';
import { FileText, Download, Trash2, RefreshCw, Calendar, AlertCircle, Table } from 'lucide-react';
import { toast } from 'sonner';

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LogSource = 'text' | 'excel';

interface ExcelLog {
  id: string;
  timestamp: Date;
  date: string;
  user: string;
  userMessage: string;
  aiResponse: string;
  context?: string;
  model?: string;
  duration?: number;
  success: boolean;
  error?: string;
}

export function LogsDialog({ open, onOpenChange }: LogsDialogProps) {
  const [logSource, setLogSource] = useState<LogSource>('text');
  const [logFiles, setLogFiles] = useState<Array<{ name: string; date: Date; id: string }>>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [excelLogs, setExcelLogs] = useState<ExcelLog[]>([]);
  const [selectedExcelLog, setSelectedExcelLog] = useState<ExcelLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load logs when dialog opens or source changes
  useEffect(() => {
    if (open) {
      if (logSource === 'text') {
        loadLogFiles();
      } else {
        loadExcelLogs();
      }
    }
  }, [open, logSource]);

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

  const loadExcelLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await excelService.getLogsFromExcelTable();
      setExcelLogs(logs);

      // Auto-select today's most recent log if available
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayLog = logs.find(log => log.date === todayStr);

      if (todayLog) {
        setSelectedExcelLog(todayLog);
      }
    } catch (error) {
      console.error('Failed to load Excel logs:', error);
      toast.error('Failed to load Excel logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLog = (fileName: string) => {
    setSelectedLog(fileName);
    loadLogContent(fileName);
  };

  const handleSelectExcelLog = (log: ExcelLog) => {
    setSelectedExcelLog(log);
  };

  const formatExcelLogForDisplay = (log: ExcelLog): string => {
    const timestamp = log.timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const separator = '='.repeat(80);
    const result = log.success ? '✓ SUCCESS' : '✗ FAILED';

    let logText = `${separator}\n`;
    logText += `[${timestamp}] - ${result}\n`;
    logText += `User: ${log.user}\n`;
    if (log.context) {
      logText += `Context: ${log.context}\n`;
    }
    if (log.model) {
      logText += `Model: ${log.model}\n`;
    }
    if (log.duration) {
      logText += `Duration: ${log.duration}ms\n`;
    }
    logText += `${separator}\n\n`;
    logText += `USER REQUEST:\n${log.userMessage}\n\n`;
    logText += `AI RESPONSE:\n${log.aiResponse}\n`;

    if (log.error) {
      logText += `\nERROR:\n${log.error}\n`;
    }

    logText += `\n${separator}\n\n`;

    return logText;
  };

  const handleDownload = () => {
    if (logSource === 'text') {
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
    } else {
      if (!selectedExcelLog) return;

      const content = formatExcelLogForDisplay(selectedExcelLog);
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `excel_log_${selectedExcelLog.date}_${selectedExcelLog.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Log downloaded');
    }
  };

  const handleDelete = async () => {
    if (logSource === 'text') {
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
    } else {
      if (!selectedExcelLog) return;

      if (!confirm(`Are you sure you want to delete this Excel log entry?`)) {
        return;
      }

      setIsDeleting(true);
      try {
        // Find the row index of the selected log
        const rowIndex = excelLogs.indexOf(selectedExcelLog);
        await excelService.deleteExcelLog(rowIndex);
        toast.success('Excel log deleted');

        // Refresh list and clear selection
        await loadExcelLogs();
        setSelectedExcelLog(null);
      } catch (error) {
        console.error('Failed to delete Excel log:', error);
        toast.error('Failed to delete Excel log');
      } finally {
        setIsDeleting(false);
      }
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

          {/* Log Source Toggle */}
          <div className="flex gap-2 pt-2">
            <Button
              variant={logSource === 'text' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLogSource('text')}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Text Files
            </Button>
            <Button
              variant={logSource === 'excel' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLogSource('excel')}
              className="flex items-center gap-2"
            >
              <Table className="h-4 w-4" />
              Excel Logs
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[250px_1fr] gap-4 overflow-hidden">
          {/* Log Files List */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {logSource === 'text' ? 'Log Files' : 'Excel Logs'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={logSource === 'text' ? loadLogFiles : loadExcelLogs}
                disabled={isLoading}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {logSource === 'text' ? (
                // Text file logs
                logFiles.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No text logs yet
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
                )
              ) : (
                // Excel logs
                excelLogs.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No Excel logs yet
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {excelLogs.map((log) => (
                      <button
                        key={log.id}
                        onClick={() => handleSelectExcelLog(log)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedExcelLog?.id === log.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="font-medium flex items-center gap-1">
                          {log.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {log.success ? '✓' : '✗'}
                        </div>
                        <div className="text-xs opacity-70 truncate">{log.userMessage.substring(0, 30)}...</div>
                        {log.context && <div className="text-xs opacity-60">{log.context}</div>}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Log Content */}
          <div className="flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {logSource === 'text'
                  ? (selectedLog || 'Select a log file')
                  : (selectedExcelLog ? `Log ${selectedExcelLog.timestamp.toLocaleString()}` : 'Select a log entry')
                }
              </h3>
              {((logSource === 'text' && selectedLog) || (logSource === 'excel' && selectedExcelLog)) && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={(logSource === 'text' && !logContent) || isLoading}
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
              ) : logSource === 'text' ? (
                // Text file content
                logContent ? (
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
                )
              ) : (
                // Excel log content
                selectedExcelLog ? (
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {formatExcelLogForDisplay(selectedExcelLog)}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Table className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Select an Excel log entry to view its contents</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
