'use client';

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        const firstError = rejectedFiles[0].errors[0];
        if (firstError.message.includes('larger')) {
          setError('File is too large. Maximum size is 10MB.');
        } else {
          setError('Invalid file type. Accepted: PDF, DOCX, DOC, TXT, PNG, JPG');
        }
        setSelectedFile(null);
        return;
      }

      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        setError(null);
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div
              {...getRootProps()}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-xl p-10 cursor-pointer transition-all duration-300',
                'border-2 border-dashed'
              )}
              style={{
                background: isDragActive ? 'rgba(99, 102, 241, 0.06)' : 'var(--bg-input)',
                borderColor: isDragActive ? '#6366f1' : error ? '#ef4444' : 'var(--border-secondary)',
                boxShadow: isDragActive ? '0 0 30px rgba(99, 102, 241, 0.15)' : 'none',
              }}
            >
              <input {...getInputProps()} />

              <motion.div
                animate={!isDragActive ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, repeatType: 'loop' }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: isDragActive
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'rgba(99, 102, 241, 0.08)',
                }}
              >
                <Upload
                  size={28}
                  style={{ color: isDragActive ? '#818cf8' : 'var(--text-tertiary)' }}
                />
              </motion.div>

              <p className="text-base font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
                or click to browse files
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                PDF, DOCX, DOC, TXT, PNG, JPG • Max 10MB
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4 p-5 rounded-xl"
            style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16, 185, 129, 0.12)' }}
            >
              <CheckCircle size={24} style={{ color: '#10b981' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <File size={14} style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {selectedFile.name}
                </p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertCircle size={14} style={{ color: '#ef4444' }} />
            <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
