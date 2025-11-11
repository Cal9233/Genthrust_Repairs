import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sharePointService } from '../services/sharepoint';
import type { Attachment } from '../types';
import { toast } from 'sonner';

/**
 * Hook to fetch attachments for a repair order
 */
export function useAttachments(roNumber: string) {
  return useQuery({
    queryKey: ['attachments', roNumber],
    queryFn: async () => {
      return await sharePointService.getAttachments(roNumber);
    },
    enabled: !!roNumber,
  });
}

/**
 * Hook to upload an attachment
 */
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roNumber, file }: { roNumber: string; file: File }) => {
      return await sharePointService.uploadFile(roNumber, file);
    },
    onSuccess: (_uploadedFile, variables) => {
      // Invalidate and refetch attachments
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.roNumber] });
      toast.success(`File "${variables.file.name}" uploaded successfully`);
    },
    onError: (error: Error, variables) => {
      console.error('Upload error:', error);
      toast.error(`Failed to upload "${variables.file.name}": ${error.message}`);
    },
  });
}

/**
 * Hook to upload multiple attachments
 */
export function useUploadMultipleAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roNumber, files }: { roNumber: string; files: File[] }) => {
      const results: Attachment[] = [];

      // Upload files sequentially to avoid overwhelming the API
      for (const file of files) {
        try {
          const result = await sharePointService.uploadFile(roNumber, file);
          results.push(result);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          throw error;
        }
      }

      return results;
    },
    onSuccess: (uploadedFiles, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.roNumber] });
      toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)`);
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast.error(`Failed to upload files: ${error.message}`);
    },
  });
}

/**
 * Hook to delete an attachment
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roNumber, fileId, fileName }: { roNumber: string; fileId: string; fileName: string }) => {
      await sharePointService.deleteFile(fileId);
      return { roNumber, fileName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', data.roNumber] });
      toast.success(`File "${data.fileName}" deleted`);
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast.error(`Failed to delete file: ${error.message}`);
    },
  });
}

/**
 * Hook to get the SharePoint folder URL for an RO
 */
export function useROFolderUrl(roNumber: string) {
  return useQuery({
    queryKey: ['ro-folder-url', roNumber],
    queryFn: async () => {
      return await sharePointService.getFolderUrl(roNumber);
    },
    enabled: !!roNumber,
    staleTime: 1000 * 60 * 60, // 1 hour - folder URL doesn't change often
  });
}

/**
 * Hook to download an attachment
 */
export function useDownloadAttachment() {
  return useMutation({
    mutationFn: async ({ fileId, fileName }: { fileId: string; fileName: string }) => {
      const downloadUrl = await sharePointService.getDownloadUrl(fileId);

      // Trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.click();

      return { fileName };
    },
    onSuccess: (data) => {
      toast.success(`Downloading "${data.fileName}"`);
    },
    onError: (error: Error) => {
      console.error('Download error:', error);
      toast.error(`Failed to download file: ${error.message}`);
    },
  });
}
