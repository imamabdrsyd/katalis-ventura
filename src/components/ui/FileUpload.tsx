'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, FileText, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import type { TransactionAttachment } from '@/types';
import { uploadAttachment, deleteAttachment, validateFile, formatFileSize, isImageType } from '@/lib/storage/attachments';

interface FileUploadProps {
  businessId: string;
  /** Current attachment (from existing transaction or just-uploaded) */
  value?: TransactionAttachment | null;
  /** Called when file is uploaded or removed */
  onChange: (attachment: TransactionAttachment | null) => void;
  disabled?: boolean;
}

export function FileUpload({ businessId, value, onChange, disabled = false }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAttachment(businessId, file);
      onChange(attachment);
    } catch (err: any) {
      setError(err.message || 'Gagal mengupload file');
    } finally {
      setUploading(false);
    }
  }, [businessId, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [disabled, uploading, handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleRemove = async () => {
    if (!value || disabled) return;
    // Delete from storage (fire-and-forget, don't block UI)
    deleteAttachment(value.path);
    onChange(null);
    setError(null);
  };

  // Uploaded state — show preview
  if (value) {
    const isImage = isImageType(value.mime_type);

    return (
      <div className="relative group">
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Thumbnail / Icon */}
          {isImage ? (
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-opacity"
            >
              <img
                src={value.url}
                alt={value.filename}
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <FileText className="w-6 h-6 text-red-500 dark:text-red-400" />
            </a>
          )}

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {value.filename}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(value.size)}
            </p>
          </div>

          {/* Remove button */}
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              title="Hapus lampiran"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  // Upload state — show drop zone
  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragOver
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/40'
          }
          ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
              Mengupload...
            </p>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Klik untuk upload</span>
                {' '}atau drag & drop
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                JPG, PNG, WebP, PDF (maks. 5MB)
              </p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

/**
 * Compact version — toggle button + inline upload (for QuickTransactionForm)
 */
export function FileUploadCompact({ businessId, value, onChange, disabled = false }: FileUploadProps) {
  const [expanded, setExpanded] = useState(!!value);

  if (!expanded && !value) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        disabled={disabled}
      >
        <Paperclip className="w-4 h-4" />
        <span>+ Tambah lampiran</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Lampiran (opsional)
        </label>
        {!value && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Tutup
          </button>
        )}
      </div>
      <FileUpload
        businessId={businessId}
        value={value}
        onChange={(att) => {
          onChange(att);
          if (!att) setExpanded(false);
        }}
        disabled={disabled}
      />
    </div>
  );
}
