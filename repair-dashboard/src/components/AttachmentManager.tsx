import { useState, useRef } from 'react';
import {
  useAttachments,
  useUploadMultipleAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
} from '../hooks/useAttachments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Upload,
  Download,
  Trash2,
  File,
  FileText,
  Image,
  Film,
  FileArchive,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { formatBytes } from '../lib/utils';

interface AttachmentManagerProps {
  roNumber: string;
}

export function AttachmentManager({ roNumber }: AttachmentManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments, isLoading, isError } = useAttachments(roNumber);
  const uploadMutation = useUploadMultipleAttachments();
  const deleteMutation = useDeleteAttachment();
  const downloadMutation = useDownloadAttachment();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (files: File[]) => {
    await uploadMutation.mutateAsync({ roNumber, files });
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      await deleteMutation.mutateAsync({ roNumber, fileId, fileName });
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    await downloadMutation.mutateAsync({ fileId, fileName });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (mimeType.startsWith('video/')) return <Film className="h-5 w-5" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5" />;
    if (mimeType.includes('zip') || mimeType.includes('compressed'))
      return <FileArchive className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attachments</CardTitle>
          <CardDescription className="text-red-600">
            Failed to load attachments. Please try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>
              Upload and manage documents for RO-{roNumber}
            </CardDescription>
          </div>
          {attachments && attachments.length > 0 && (
            <Badge variant="secondary">{attachments.length} file(s)</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'}
          `}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-gray-600">Uploading files...</p>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Support for all file types. Max 10MB per file.
              </p>
            </>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-gray-600">Loading attachments...</span>
          </div>
        )}

        {/* Attachments List */}
        {!isLoading && attachments && attachments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Uploaded Files</h3>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="text-gray-600">{getFileIcon(attachment.mimeType)}</div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatBytes(attachment.size)}</span>
                      <span>•</span>
                      <span>
                        {attachment.createdBy.user.displayName || 'Unknown User'}
                      </span>
                      <span>•</span>
                      <span>{formatDate(attachment.createdDateTime)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(attachment.id, attachment.name)}
                      disabled={downloadMutation.isPending}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(attachment.webUrl, '_blank')}
                      title="Open in browser"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(attachment.id, attachment.name)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && attachments && attachments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <File className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No attachments yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload files using the area above
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
