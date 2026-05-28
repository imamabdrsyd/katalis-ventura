'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, FileText, Upload, Loader2, Plus } from 'lucide-react';
import type { TransactionAttachment } from '@/types';
import {
  uploadAttachment,
  deleteAttachment,
  validateFile,
  formatFileSize,
  isImageType,
  MAX_FILES,
} from '@/lib/storage/attachments';
import { useSignedAttachmentUrl } from '@/lib/storage/signedUrl';

interface FileUploadProps {
  businessId: string;
  value: TransactionAttachment[];
  onChange: (attachments: TransactionAttachment[]) => void;
  disabled?: boolean;
}

export function FileUpload({ businessId, value, onChange, disabled = false }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = value.length < MAX_FILES;

  const handleFiles = useCallback(async (files: File[]) => {
    setError(null);
    const slots = MAX_FILES - value.length;
    const toUpload = files.slice(0, slots);

    if (files.length > slots) {
      setError(`Hanya ${slots} file lagi yang bisa ditambahkan (maks ${MAX_FILES} file).`);
    }

    if (toUpload.length === 0) return;

    for (const file of toUpload) {
      const err = validateFile(file);
      if (err) { setError(err); return; }
    }

    setUploading(true);
    try {
      const results: TransactionAttachment[] = [];
      for (const file of toUpload) {
        const att = await uploadAttachment(businessId, file);
        results.push(att);
      }
      onChange([...value, ...results]);
    } catch (err: any) {
      setError(err.message || 'Gagal mengupload file');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [businessId, onChange, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading || !canAddMore) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  }, [disabled, uploading, canAddMore, handleFiles]);

  const handleRemove = async (att: TransactionAttachment) => {
    if (disabled) return;
    deleteAttachment(att.path, businessId, att.resource_type ?? 'image');
    onChange(value.filter((a) => a.path !== att.path));
    setError(null);
  };

  return (
    <div className="space-y-2">
      {/* Daftar file yang sudah diupload */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((att) => (
            <AttachmentRow
              key={att.path}
              attachment={att}
              disabled={disabled}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Drop zone — hanya tampil jika masih bisa tambah file */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
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
              <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Uploading...</p>
            </>
          ) : value.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Plus className="w-4 h-4" />
              <span>Add file ({value.length}/{MAX_FILES})</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Click to upload</span>
                  {' '}or drag & drop
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  JPG, PNG, WebP, PDF (max 5MB · up to {MAX_FILES} files)
                </p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled || uploading}
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/**
 * Subkomponen baris attachment. Pakai useSignedAttachmentUrl supaya URL
 * legacy bucket Supabase Storage (yang kini private) di-resolve ke signed
 * URL — kalau URL sudah Cloudinary atau external, di-return apa adanya.
 */
function AttachmentRow({
  attachment,
  disabled,
  onRemove,
}: {
  attachment: TransactionAttachment;
  disabled?: boolean;
  onRemove: (att: TransactionAttachment) => void;
}) {
  const url = useSignedAttachmentUrl(attachment.url);
  const isImg = isImageType(attachment.mime_type);
  const ready = !!url;

  return (
    <div className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
      {isImg ? (
        <a
          href={ready ? url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ready}
          className={`flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 transition-opacity ${ready ? 'hover:opacity-80' : 'pointer-events-none opacity-60'}`}
        >
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={attachment.filename} className="w-full h-full object-cover" />
          ) : null}
        </a>
      ) : (
        <a
          href={ready ? url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ready}
          className={`flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center transition-opacity ${ready ? 'hover:opacity-80' : 'pointer-events-none opacity-60'}`}
        >
          <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />
        </a>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{attachment.filename}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(attachment.size)}</p>
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(attachment)}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
          title="Remove attachment"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Compact version — toggle button + inline upload (untuk QuickTransactionForm)
 */
interface FileUploadCompactProps {
  businessId: string;
  value: TransactionAttachment[];
  onChange: (attachments: TransactionAttachment[]) => void;
  disabled?: boolean;
}

export function FileUploadCompact({ businessId, value, onChange, disabled = false }: FileUploadCompactProps) {
  const [expanded, setExpanded] = useState(value.length > 0);

  if (!expanded && value.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        disabled={disabled}
      >
        <Paperclip className="w-4 h-4" />
        <span>+ Add attachment</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Attachments (optional)
        </label>
        {value.length === 0 && (
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
        onChange={(atts) => {
          onChange(atts);
          if (atts.length === 0) setExpanded(false);
        }}
        disabled={disabled}
      />
    </div>
  );
}
