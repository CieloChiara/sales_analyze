"use client";

import React, { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
}

export function FileUpload({ onFileSelect, accept = ".csv", className }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (accept && !file.name.match(new RegExp(accept.replace("*", ".*")))) {
          alert(`ファイル形式が正しくありません。${accept} ファイルを選択してください。`);
          return;
        }
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [accept, onFileSelect]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setSelectedFile(files[0]);
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          "p-8"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          {selectedFile ? (
            <>
              <FileText className="h-12 w-12 text-blue-500" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  {selectedFile.name}
                </span>
                <button
                  onClick={handleRemoveFile}
                  className="pointer-events-auto p-1 hover:bg-gray-100 rounded-full transition-colors"
                  type="button"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </span>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  ファイルをドラッグ＆ドロップ
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  または クリックして選択
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                対応形式: {accept}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}