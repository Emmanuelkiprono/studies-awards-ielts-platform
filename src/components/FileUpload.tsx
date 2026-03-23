import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import {
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { storage } from '../services/firebase';
import { cn } from '../lib/utils';

interface FileUploadProps {
  folder: string;
  onUploaded: (url: string, fileName: string) => void;
  onClear?: () => void;
  value?: string;
  fileName?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  label?: string;
  compact?: boolean;
  appearance?: 'dark' | 'light';
}

const MAX_IMAGE_DIMENSION = 1600;

const isImageMimeType = (type: string) => /^image\//.test(type);

const resizeImageFile = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.8
): Promise<File> =>
  new Promise((resolve) => {
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

              resolve(
                new File([blob], file.name, {
                  type: outputType,
                  lastModified: Date.now(),
                })
              );
            },
            outputType,
            quality
          );
        } catch {
          URL.revokeObjectURL(img.src);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file);
      };

      img.src = URL.createObjectURL(file);
    } catch {
      resolve(file);
    }
  });

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
  appearance = 'dark',
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isLightAppearance = appearance === 'light';

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      const originalFile = acceptedFiles[0];
      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        let fileToUpload = originalFile;

        if (isImageMimeType(originalFile.type)) {
          fileToUpload = await resizeImageFile(
            originalFile,
            MAX_IMAGE_DIMENSION,
            MAX_IMAGE_DIMENSION,
            0.82
          );

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
          (uploadError) => {
            console.error('Upload error:', uploadError);
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
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Upload failed. Please try again.');
        setUploading(false);
      }
    },
    [folder, maxSize, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
    disabled: uploading,
    onDropRejected: (rejections) => {
      const rejection = rejections[0];

      if (rejection?.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB.`);
      } else {
        setError('Invalid file type. Please upload PDF or image files.');
      }
    },
  });

  const isImage = (name?: string) => name && /\.(jpg|jpeg|png|webp|gif)$/i.test(name);

  const labelClassName = isLightAppearance
    ? 'block text-sm font-medium text-gray-700'
    : 'block text-xs font-bold uppercase tracking-wider text-[var(--ui-muted)]';

  if (value && fileName) {
    return (
      <div className="space-y-1.5">
        {label && <label className={labelClassName}>{label}</label>}

        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            isLightAppearance
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-emerald-500/20 bg-emerald-500/10'
          )}
        >
          {isImage(fileName) ? (
            <ImageIcon
              size={18}
              className={cn('shrink-0', isLightAppearance ? 'text-emerald-600' : 'text-emerald-400')}
            />
          ) : (
            <FileText
              size={18}
              className={cn('shrink-0', isLightAppearance ? 'text-emerald-600' : 'text-emerald-400')}
            />
          )}

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                isLightAppearance ? 'text-emerald-700' : 'text-emerald-300'
              )}
            >
              {fileName}
            </p>
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider',
                isLightAppearance ? 'text-emerald-600' : 'text-emerald-500'
              )}
            >
              Uploaded
            </p>
          </div>

          <CheckCircle2
            size={16}
            className={cn('shrink-0', isLightAppearance ? 'text-emerald-600' : 'text-emerald-400')}
          />

          {onClear && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              className={cn(
                'rounded-lg p-1.5 transition-colors',
                isLightAppearance
                  ? 'text-gray-500 hover:bg-gray-100 hover:text-red-600'
                  : 'text-slate-400 hover:bg-white/10 hover:text-red-400'
              )}
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
      {label && <label className={labelClassName}>{label}</label>}

      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed transition-all',
          compact ? 'p-4' : 'p-6',
          isDragActive
            ? isLightAppearance
              ? 'border-purple-500 bg-purple-50'
              : 'border-[#6324eb] bg-[#6324eb]/10'
            : isLightAppearance
              ? 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50/60'
              : 'border-white/10 bg-white/[0.02] hover:border-[#6324eb]/40 hover:bg-[#6324eb]/5',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />

        <div
          className={cn(
            'flex flex-col items-center justify-center text-center',
            compact ? 'gap-1.5' : 'gap-2'
          )}
        >
          {uploading ? (
            <>
              <Loader2 size={compact ? 20 : 28} className="animate-spin text-[#6324eb]" />
              <p
                className={cn(
                  'text-sm font-medium',
                  isLightAppearance ? 'text-gray-700' : 'text-slate-300'
                )}
              >
                Uploading... {progress}%
              </p>
              <div
                className={cn(
                  'h-1.5 w-full max-w-[200px] overflow-hidden rounded-full',
                  isLightAppearance ? 'bg-gray-200' : 'bg-white/10'
                )}
              >
                <div
                  className="h-full rounded-full bg-[#6324eb] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <Upload size={compact ? 18 : 28} className="text-[#6324eb]" />
              <p
                className={cn(
                  'font-medium',
                  compact ? 'text-xs' : 'text-sm',
                  isLightAppearance ? 'text-gray-700' : 'text-slate-300'
                )}
              >
                {isDragActive ? 'Drop file here' : 'Click or drag to upload'}
              </p>
              <p
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wider',
                  isLightAppearance ? 'text-gray-500' : 'text-slate-500'
                )}
              >
                PDF or Image · Max {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className={cn('mt-1 text-xs font-medium', isLightAppearance ? 'text-red-600' : 'text-red-400')}>
          {error}
        </p>
      )}
    </div>
  );
};
