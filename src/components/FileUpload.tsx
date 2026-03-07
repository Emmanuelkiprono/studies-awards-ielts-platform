import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { Upload, FileText, Image, X, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
  /** Firebase Storage folder path, e.g. "lessons" or "submissions" */
  folder: string;
  /** Called with the download URL and original file name once upload completes */
  onUploaded: (url: string, fileName: string) => void;
  /** Called when the file is cleared */
  onClear?: () => void;
  /** Already-uploaded file URL (controlled) */
  value?: string;
  /** Already-uploaded file name (controlled) */
  fileName?: string;
  /** accepted mime types – defaults to PDF + images */
  accept?: Record<string, string[]>;
  /** Max file size in bytes – defaults to 10 MB */
  maxSize?: number;
  /** Label displayed above the dropzone */
  label?: string;
  /** Compact mode for inline usage */
  compact?: boolean;
}

const MAX_IMAGE_DIMENSION = 1600; // px

const isImageMimeType = (type: string) => /^image\//.test(type);

const resizeImageFile = (file: File, maxWidth: number, maxHeight: number, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          if (width <= maxWidth && height <= maxHeight) {
            resolve(file);
            URL.revokeObjectURL(img.src);
            return;
          }

          const ratio = Math.min(maxWidth / width, maxHeight / height);
          const targetWidth = Math.round(width * ratio);
          const targetHeight = Math.round(height * ratio);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(img.src);
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const outputType = file.type && isImageMimeType(file.type) ? file.type : 'image/jpeg';

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(img.src);
              if (!blob) {
                resolve(file);
                return;
              }
              const resizedFile = new File([blob], file.name, { type: outputType, lastModified: Date.now() });
              resolve(resizedFile);
            },
            outputType,
            quality
          );
        } catch (err) {
          URL.revokeObjectURL(img.src);
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file);
      };
      img.src = URL.createObjectURL(file);
    } catch (err) {
      resolve(file);
    }
  });
};

export const FileUpload: React.FC<FileUploadProps> = ({
  folder,
  onUploaded,
  onClear,
  value,
  fileName,
  accept = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  },
  maxSize = 10 * 1024 * 1024,
  label = 'Upload File',
  compact = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const originalFile = acceptedFiles[0];
      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        let fileToUpload = originalFile;

        if (isImageMimeType(originalFile.type)) {
          fileToUpload = await resizeImageFile(originalFile, MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, 0.82);

          if (fileToUpload.size > maxSize) {
            setUploading(false);
            setProgress(0);
            setError(`Image too large even after compression. Max ${Math.round(maxSize / 1024 / 1024)}MB.`);
            return;
          }
        }

        const timestamp = Date.now();
        const safeName = originalFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageRef = ref(storage, `${folder}/${timestamp}_${safeName}`);
        const metadata = fileToUpload.type ? { contentType: fileToUpload.type } : undefined;
        const task = uploadBytesResumable(storageRef, fileToUpload, metadata);

        task.on(
          'state_changed',
          (snapshot) => {
            setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          (err) => {
            console.error('Upload error:', err);
            setError('Upload failed. Please try again.');
            setUploading(false);
          },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            onUploaded(url, originalFile.name);
            setUploading(false);
            setProgress(0);
          }
        );
      } catch (err) {
        console.error('Upload error:', err);
        setError('Upload failed. Please try again.');
        setUploading(false);
      }
    },
    [folder, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: uploading,
    onDropRejected: (rejections) => {
      const r = rejections[0];
      if (r?.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB.`);
      } else {
        setError('Invalid file type. Please upload PDF or image files.');
      }
    },
  });

  const isImage = (name?: string) => name && /\.(jpg|jpeg|png|webp|gif)$/i.test(name);

  // Already uploaded state
  if (value && fileName) {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider block">
            {label}
          </label>
        )}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          {isImage(fileName) ? (
            <Image size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <FileText size={18} className="text-emerald-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-300 font-semibold truncate">{fileName}</p>
            <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Uploaded</p>
          </div>
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          {onClear && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider block">
          {label}
        </label>
      )}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl transition-all cursor-pointer',
          compact ? 'p-4' : 'p-6',
          isDragActive
            ? 'border-[#6324eb] bg-[#6324eb]/10'
            : 'border-white/10 bg-white/[0.02] hover:border-[#6324eb]/40 hover:bg-[#6324eb]/5',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />
        <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5' : 'gap-2')}>
          {uploading ? (
            <>
              <Loader2 size={compact ? 20 : 28} className="text-[#6324eb] animate-spin" />
              <p className="text-sm text-slate-300 font-medium">Uploading… {progress}%</p>
              <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6324eb] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload size={compact ? 18 : 28} className="text-[#6324eb]" />
              <p className={cn('text-slate-300 font-medium', compact ? 'text-xs' : 'text-sm')}>
                {isDragActive ? 'Drop file here' : 'Click or drag to upload'}
              </p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                PDF or Image · Max {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-400 font-medium mt-1">{error}</p>
      )}
    </div>
  );
};
