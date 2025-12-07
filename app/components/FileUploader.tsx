import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useCallback } from "react";

interface FileUploaderProps {
    onFileSelect ?: (file: File | null) => void;
}

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const FileUploader: React.FC<FileUploaderProps> = ({onFileSelect}) => {
    const [file, setFile] = useState<File | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const uploadedFile = acceptedFiles[0] || null;
        setFile(uploadedFile);
        if (onFileSelect) {
            onFileSelect(uploadedFile);
        }
    }, [onFileSelect])

    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,
        multiple: false,
        accept: {'application/pdf': ['.pdf']},
        maxSize: 20 * 1024 * 1024,
    })
    
    return (
        <div className="w-full gradient-border">
            <div {...getRootProps()}>
                <input {...getInputProps()} />
                <div className="space-y-4 cursor-pointer">
                    {file ? (
                        <div className="uploader-selected-file" onClick={(e) => e.stopPropagation()}>
                            <img src="/images/pdf.png" alt="pdf" className="size-10" />
                            <div className="text-center">
                                <div>
                                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">{file.name}</p>
                                    <p className="text-sm text-gray-500">{formatSize(file.size)}</p>
                                </div>
                            </div>
                            <button className="p-2 cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                setFile(null);
                                onFileSelect?.(null);
                            }}>
                                <img src="/icons/cross.svg" alt="remove" className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                                <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                                    <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
                                </svg>
                            </div>

                            <p className="text-lg text-gray-500">
                                <span className="font-semibold">
                                    Click to upload
                                </span> or drag and drop
                            </p>
                            <p className="text-lg text-gray-500">PDF (max 20MB)</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default FileUploader