'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, LayoutDashboard, Target, Users, ShieldAlert } from 'lucide-react';
import { Transaction, AnalysisResult } from '@/types';
import { analyzeGraph } from '@/lib/graph-analysis';
import FileUpload from './FileUpload';
import GraphViz3D from './GraphViz3D';

export default function Dashboard() {
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState<'graph' | 'rings' | 'accounts'>('graph');
    const [selectedRing, setSelectedRing] = useState<string | null>(null);

    const handleDataLoaded = (transactions: Transaction[]) => {
        const result = analyzeGraph(transactions);
        setData(result);
    };

    const downloadJson = () => {
        if (!data) return;
        const exportData = {
            suspicious_accounts: data.suspiciousAccounts.map(acc => ({
                account_id: acc.account_id,
                suspicion_score: parseFloat(acc.suspicion_score.toFixed(1)),
                detected_patterns: acc.detected_patterns,
                ring_id: acc.ring_id ?? null,
            })),
            fraud_rings: data.fraudRings.map(ring => ({
                ring_id: ring.id,
                member_accounts: ring.members,
                pattern_type: ring.type,
                risk_score: parseFloat(ring.riskScore.toFixed(1)),
            })),
            summary: {
                total_accounts_analyzed: data.summary.total_accounts,
                suspicious_accounts_flagged: data.summary.flagged_accounts,
                fraud_rings_detected: data.summary.rings_detected,
                processing_time_seconds: parseFloat(data.processingTime.toFixed(2)),
            },
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fraud_analysis_report_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4 mb-10"
                >
                    <div className="inline-flex items-center justify-center p-4 bg-gold-100 rounded-full text-gold-600 mb-4 shadow-sm border border-gold-200">
                        <ShieldAlert size={48} />
                    </div>
                    <h1 className="text-4xl font-bold text-warm-gray-900 tracking-tight">Financial Forensics Engine</h1>
                    <p className="text-lg text-warm-gray-600 max-w-lg mx-auto">
                        Upload transaction data to detect money muling rings, smurfing patterns, and suspicious networks using advanced graph analysis.
                    </p>
                </motion.div>

                <FileUpload onDataLoaded={handleDataLoaded} />

                <p className="mt-8 text-xs text-warm-gray-400">
                    Secure Processing • Client-side Analysis • No Data Uploaded
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-cream-50 pb-20">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-cream-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="text-gold-500" />
                        <span className="font-bold text-warm-gray-900 text-lg">Forensics Engine</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-warm-gray-500 hidden sm:block">
                            Processed {data.summary.total_transactions} txns in {data.processingTime.toFixed(2)}s
                        </div>
                        <button
                            onClick={() => { setData(null); setSelectedRing(null); }}
                            className="text-sm text-warm-gray-600 hover:text-warm-gray-900 px-3 py-1 rounded-lg hover:bg-cream-100 transition-colors"
                        >
                            New Analysis
                        </button>
                        <button
                            onClick={downloadJson}
                            id="export-json-btn"
                            className="flex items-center gap-2 bg-warm-gray-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-all shadow-lg shadow-warm-gray-900/10"
                        >
                            <Download size={16} />
                            Export JSON
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KpiCard
                        title="Fraud Rings Detected"
                        value={data.summary.rings_detected}
                        icon={<Target className="text-red-500" />}
                        trend="High Priority"
                        color="red"
                    />
                    <KpiCard
                        title="Suspicious Accounts"
                        value={data.summary.flagged_accounts}
                        icon={<Users className="text-orange-500" />}
                        trend={`${((data.summary.flagged_accounts / Math.max(data.summary.total_accounts, 1)) * 100).toFixed(1)}% of total`}
                        color="orange"
                    />
                    <KpiCard
                        title="Total Accounts"
                        value={data.summary.total_accounts}
                        icon={<LayoutDashboard className="text-blue-500" />}
                        trend="Analyzed"
                        color="blue"
                    />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-cream-200/50 p-1 rounded-xl w-fit">
                    <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')}>Network Graph</TabButton>
                    <TabButton active={activeTab === 'rings'} onClick={() => setActiveTab('rings')}>Fraud Rings ({data.fraudRings.length})</TabButton>
                    <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')}>Suspicious Accounts ({data.suspiciousAccounts.length})</TabButton>
                </div>

                {/* Content Area */}
                <AnimatePresence mode='wait'>
                    {activeTab === 'graph' && (
                        <motion.div
                            key="graph"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            <GraphViz3D data={data} selectedRing={selectedRing} />
                        </motion.div>
                    )}

                    {activeTab === 'rings' && (
                        <motion.div
                            key="rings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-cream-100 text-warm-gray-600 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Ring ID</th>
                                            <th className="p-4">Pattern Type</th>
                                            <th className="p-4">Member Count</th>
                                            <th className="p-4">Risk Score</th>
                                            <th className="p-4">Member Account IDs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-cream-100">
                                        {data.fraudRings.map((ring) => (
                                            <tr
                                                key={ring.id}
                                                onClick={() => {
                                                    setSelectedRing(selectedRing === ring.id ? null : ring.id);
                                                    setActiveTab('graph');
                                                }}
                                                className={`cursor-pointer transition-colors ${selectedRing === ring.id ? 'bg-gold-50 border-l-4 border-gold-500' : 'hover:bg-cream-50'}`}
                                            >
                                                <td className="p-4 font-medium text-warm-gray-900">{ring.id}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium 
                                                        ${ring.type === 'cycle' ? 'bg-red-100 text-red-700' :
                                                            ring.type === 'fan_in' ? 'bg-orange-100 text-orange-700' :
                                                                ring.type === 'shell' ? 'bg-purple-100 text-purple-700' :
                                                                    'bg-amber-100 text-amber-700'}`}>
                                                        {ring.type.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-warm-gray-700">{ring.members.length}</td>
                                                <td className="p-4 font-mono text-warm-gray-700">{ring.riskScore.toFixed(1)}</td>
                                                <td className="p-4 text-xs text-warm-gray-600 max-w-md">
                                                    <div className="truncate" title={ring.members.join(', ')}>
                                                        {ring.members.join(', ')}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {data.fraudRings.length === 0 && (
                                            <tr><td colSpan={5} className="p-10 text-center text-warm-gray-400">No fraud rings detected.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'accounts' && (
                        <motion.div
                            key="accounts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-cream-100 text-warm-gray-600 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Account ID</th>
                                            <th className="p-4">Suspicion Score</th>
                                            <th className="p-4">Detected Patterns</th>
                                            <th className="p-4">Ring ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-cream-100">
                                        {data.suspiciousAccounts.map((acc) => (
                                            <tr key={acc.account_id} className="hover:bg-cream-50 transition-colors">
                                                <td className="p-4 font-medium text-warm-gray-900">{acc.account_id}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-2 bg-cream-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${acc.suspicion_score > 80 ? 'bg-red-500' : acc.suspicion_score > 50 ? 'bg-orange-400' : 'bg-amber-400'}`}
                                                                style={{ width: `${acc.suspicion_score}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-mono">{acc.suspicion_score.toFixed(1)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {acc.detected_patterns.map(p => (
                                                            <span key={p} className="px-1.5 py-0.5 bg-cream-200 text-warm-gray-700 rounded text-[10px] uppercase">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-mono text-warm-gray-500">{acc.ring_id || '—'}</td>
                                            </tr>
                                        ))}
                                        {data.suspiciousAccounts.length === 0 && (
                                            <tr><td colSpan={4} className="p-10 text-center text-warm-gray-400">No suspicious accounts flagged.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    );
}

function KpiCard({ title, value, icon, trend, color }: { title: string; value: number; icon: React.ReactNode; trend: string; color: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-cream-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-warm-gray-500 uppercase tracking-wide">{title}</h3>
                <div className={`p-2 rounded-lg bg-${color}-50`}>{icon}</div>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-warm-gray-900">{value}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${color}-100 text-${color}-700`}>
                    {trend}
                </span>
            </div>
        </div>
    );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
                ? 'bg-white text-warm-gray-900 shadow-sm'
                : 'text-warm-gray-600 hover:text-warm-gray-900 hover:bg-white/50'
                }`}
        >
            {children}
        </button>
    );
}
