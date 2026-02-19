'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileType, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Transaction } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface FileUploadProps {
    onDataLoaded: (data: Transaction[]) => void;
}

export default function FileUpload({ onDataLoaded }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const processFile = (file: File) => {
        setError(null);
        setSuccess(null);

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            setError('Please upload a valid CSV file.');
            return;
        }

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setLoading(false);
                if (results.errors.length > 0) {
                    setError(`Error parsing CSV: ${results.errors[0].message}`);
                    return;
                }

                const data = results.data as any[];
                // Basic validation of columns
                const requiredColumns = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];
                const headers = results.meta.fields;

                const missing = requiredColumns.filter(col => !headers?.includes(col));
                if (missing.length > 0) {
                    setError(`Missing columns: ${missing.join(', ')}`);
                    return;
                }

                // Transform and validate types
                const transactions: Transaction[] = data.map(row => ({
                    transaction_id: row.transaction_id,
                    sender_id: row.sender_id,
                    receiver_id: row.receiver_id,
                    amount: parseFloat(row.amount),
                    timestamp: row.timestamp
                })).filter(t => !isNaN(t.amount) && t.sender_id && t.receiver_id);

                if (transactions.length === 0) {
                    setError('No valid transactions found.');
                    return;
                }

                setSuccess(`Successfully parsed ${transactions.length} transactions.`);
                onDataLoaded(transactions);
            },
            error: (err) => {
                setLoading(false);
                setError(`File error: ${err.message}`);
            }
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300
          ${isDragging
                        ? 'border-accent bg-accent-light scale-[1.02]'
                        : 'border-border bg-input hover:border-accent hover:bg-card-hover'}
        `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className={`p-4 rounded-full ${isDragging ? 'bg-accent-light text-accent' : 'bg-badge text-t-primary'}`}>
                        <UploadCloud size={40} />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-t-primary">
                            Upload Transaction Data
                        </h3>
                        <p className="text-t-secondary">
                            Drag & drop your CSV file here, or click to browse
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-t-muted">
                        <FileType size={14} />
                        <span>Required: transaction_id, sender_id, receiver_id, amount, timestamp</span>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-red-500/10 text-red-500 rounded-xl flex items-center gap-3 border border-red-500/20"
                    >
                        <AlertCircle size={20} />
                        <span className="font-medium">{error}</span>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-green-500/10 text-green-500 rounded-xl flex items-center gap-3 border border-green-500/20"
                    >
                        <CheckCircle2 size={20} />
                        <span className="font-medium">{success}</span>
                    </motion.div>
                )}

                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 text-center text-accent font-medium"
                    >
                        Processing transactions...
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
