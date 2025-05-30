import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, FileText, Image, Check, Files } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onSuccess?: (fileData: { url: string; key: string; mimetype: string; size: number } | { files: { url: string; key: string; mimetype: string; size: number }[] }) => void;
  onError?: (error: Error) => void;
  endpoint?: 'upload' | 'upload/product-image' | 'upload/multiple';
  className?: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  buttonText?: string;
  showPreview?: boolean;
  multiple?: boolean;
}

export default function S3FileUpload({
  onSuccess,
  onError,
  endpoint = 'upload',
  className,
  accept = 'image/*',
  maxFiles = 1,
  maxSizeMB = 5,
  buttonText = 'Upload File',
  showPreview = true,
  multiple = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Mutation for file upload
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      const fieldName = endpoint === 'upload/product-image' ? 'image' : 'file';
      formData.append(fieldName, file);

      const res = await apiRequest(
        'POST', 
        `/api/s3/${endpoint}`, 
        formData,
        {
          'Content-Type': 'multipart/form-data',
        }
      );
      
      return res.json();
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      }
      toast({
        title: 'Upload successful',
        description: 'Your file has been uploaded successfully.',
      });
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      if (onError) {
        onError(error);
      }
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload the file. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Multiple files upload mutation
  const multipleUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('files', file);
      });

      const res = await apiRequest(
        'POST', 
        `/api/s3/${endpoint}`, 
        formData,
        {
          'Content-Type': 'multipart/form-data',
        }
      );
      
      return res.json();
    },
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      }
      const fileCount = selectedFiles.length;
      toast({
        title: 'Upload successful',
        description: `${fileCount} ${fileCount === 1 ? 'file has' : 'files have'} been uploaded successfully.`,
      });
      
      // Clear selection
      setSelectedFiles([]);
      setSelectedFile(null);
      setPreviewUrl(null);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      if (onError) {
        onError(error);
      }
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload files. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
      return;
    }

    if (multiple) {
      const fileArray = Array.from(files);
      
      // Check size for each file
      const oversizedFiles = fileArray.filter(file => file.size > maxSizeMB * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast({
          title: 'Files too large',
          description: `${oversizedFiles.length} ${oversizedFiles.length === 1 ? 'file exceeds' : 'files exceed'} the maximum size of ${maxSizeMB}MB.`,
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFiles(fileArray);
      // For multiple files, only set preview for the first image
      const firstImage = fileArray.find(file => file.type.startsWith('image/'));
      if (firstImage && showPreview) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(firstImage);
      } else {
        setPreviewUrl(null);
      }
    } else {
      const file = files[0];
      
      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `Maximum file size is ${maxSizeMB}MB.`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL for images
      if (file.type.startsWith('image/') && showPreview) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleUpload = () => {
    if (multiple && selectedFiles.length > 0) {
      multipleUploadMutation.mutate(selectedFiles);
    } else if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setSelectedFiles([]);
    setPreviewUrl(null);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return null;
    
    if (selectedFile.type.startsWith('image/')) {
      return <Image className="h-5 w-5 mr-2" />;
    }
    
    return <FileText className="h-5 w-5 mr-2" />;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={accept}
        multiple={multiple}
      />
      
      {!selectedFile && selectedFiles.length === 0 ? (
        <Button 
          type="button" 
          variant="outline"
          onClick={handleButtonClick}
          className="w-full border-dashed p-8 h-auto flex flex-col items-center justify-center"
        >
          <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
          <div className="text-sm font-medium">{buttonText}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {accept === 'image/*' 
              ? 'PNG, JPG, WEBP or GIF' 
              : 'Select a file'} up to {maxSizeMB}MB
          </p>
        </Button>
      ) : (
        <div className="border rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {multiple && selectedFiles.length > 0 ? (
                <>
                  <Files className="h-5 w-5 mr-2 text-blue-500" />
                  <div className="truncate max-w-xs">
                    <div className="font-medium text-sm">
                      {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)} MB total
                    </div>
                  </div>
                </>
              ) : selectedFile ? (
                <>
                  {getFileIcon()}
                  <div className="truncate max-w-xs">
                    <div className="font-medium text-sm">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {previewUrl && showPreview && (
            <div className="mt-3 relative w-full h-40 overflow-hidden rounded-md">
              <img
                src={previewUrl}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          )}
          
          <div className="mt-3 flex space-x-2">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploadMutation.isPending || multipleUploadMutation.isPending}
              className="flex-1"
            >
              {uploadMutation.isPending || multipleUploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : uploadMutation.isSuccess || multipleUploadMutation.isSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Uploaded
                </>
              ) : (
                'Upload'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleButtonClick}
              disabled={uploadMutation.isPending}
            >
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}