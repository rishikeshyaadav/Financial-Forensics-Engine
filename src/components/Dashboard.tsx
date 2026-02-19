'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, LayoutDashboard, Target, Users, ShieldAlert, FileText, Search, Sun, Moon, Monitor } from 'lucide-react';
import { Transaction, AnalysisResult } from '@/types';
import { analyzeGraph } from '@/lib/graph-analysis';
import { useTheme, Theme } from '@/context/ThemeContext';
import FileUpload from './FileUpload';
import GraphViz3D from './GraphViz3D';
import SummaryReport from './SummaryReport';

const themeIcons: Record<Theme, React.ReactNode> = {
    bright: <Sun size={16} />,
    night: <Moon size={16} />,
    black: <Monitor size={16} />,
};

const themeLabels: Record<Theme, string> = {
    bright: 'Bright',
    night: 'Night',
    black: 'Black',
};

export default function Dashboard() {
    const [data, setData] = useState<AnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState<'graph' | 'rings' | 'accounts' | 'report'>('graph');
    const [selectedRing, setSelectedRing] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { theme, cycleTheme } = useTheme();

    const handleDataLoaded = (transactions: Transaction[]) => {
        const result = analyzeGraph(transactions);
        setData(result);
    };

    // Filtered data based on search
    const filteredRings = useMemo(() => {
        if (!data || !searchQuery.trim()) return data?.fraudRings ?? [];
        const q = searchQuery.toLowerCase();
        return data.fraudRings.filter(r =>
            r.id.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            r.members.some(m => m.toLowerCase().includes(q))
        );
    }, [data, searchQuery]);

    const filteredAccounts = useMemo(() => {
        if (!data || !searchQuery.trim()) return data?.suspiciousAccounts ?? [];
        const q = searchQuery.toLowerCase();
        return data.suspiciousAccounts.filter(a =>
            a.account_id.toLowerCase().includes(q) ||
            a.detected_patterns.some(p => p.toLowerCase().includes(q)) ||
            (a.ring_id && a.ring_id.toLowerCase().includes(q))
        );
    }, [data, searchQuery]);

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
            <div className="min-h-screen flex flex-col items-center justify-center bg-page p-4">
                {/* Theme toggle on upload page */}
                <button
                    onClick={cycleTheme}
                    className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-t-secondary hover:text-t-primary hover:bg-card-hover transition-all text-sm"
                >
                    {themeIcons[theme]}
                    {themeLabels[theme]}
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-4 mb-10"
                >
                    <div className="inline-flex items-center justify-center p-4 bg-accent-light rounded-full text-accent mb-4 shadow-sm border border-border">
                        <ShieldAlert size={48} />
                    </div>
                    <h1 className="text-4xl font-bold text-t-primary tracking-tight">Financial Forensics Engine</h1>
                    <p className="text-lg text-t-secondary max-w-lg mx-auto">
                        Upload transaction data to detect money muling rings, smurfing patterns, and suspicious networks using advanced graph analysis.
                    </p>
                </motion.div>

                <FileUpload onDataLoaded={handleDataLoaded} />

                <p className="mt-8 text-xs text-t-muted">
                    Secure Processing • Client-side Analysis • No Data Uploaded
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page pb-20">
            {/* Header */}
            <header className="bg-header backdrop-blur-md border-b border-border sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="text-accent" />
                        <span className="font-bold text-t-primary text-lg">Forensics Engine</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative hidden sm:block">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search accounts, rings..."
                                className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-t-primary placeholder-t-muted focus:outline-none focus:border-accent w-48 transition-colors"
                            />
                        </div>

                        <div className="text-xs text-t-muted hidden md:block">
                            {data.summary.total_transactions} txns • {data.processingTime.toFixed(2)}s
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={cycleTheme}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-t-secondary hover:text-t-primary hover:bg-card-hover transition-all text-xs"
                            title={`Theme: ${themeLabels[theme]}`}
                        >
                            {themeIcons[theme]}
                            <span className="hidden lg:inline">{themeLabels[theme]}</span>
                        </button>

                        <button
                            onClick={() => { setData(null); setSelectedRing(null); setSearchQuery(''); }}
                            className="text-sm text-t-secondary hover:text-t-primary px-3 py-1 rounded-lg hover:bg-card-hover transition-colors"
                        >
                            New
                        </button>
                        <button
                            onClick={downloadJson}
                            id="export-json-btn"
                            className="flex items-center gap-2 bg-t-primary text-t-inverse px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-lg"
                        >
                            <Download size={16} />
                            Export JSON
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <KpiCard title="Fraud Rings" value={data.summary.rings_detected} icon={<Target className="text-red-500" size={18} />} color="red" />
                    <KpiCard title="Suspicious Accounts" value={data.summary.flagged_accounts} icon={<Users className="text-orange-500" size={18} />} color="orange" />
                    <KpiCard title="Total Accounts" value={data.summary.total_accounts} icon={<LayoutDashboard className="text-blue-500" size={18} />} color="blue" />
                    <KpiCard title="Flagged Rate" value={`${((data.summary.flagged_accounts / Math.max(data.summary.total_accounts, 1)) * 100).toFixed(1)}%`} icon={<FileText className="text-purple-500" size={18} />} color="purple" />
                </div>

                {/* Mobile Search */}
                <div className="sm:hidden relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search accounts, rings..."
                        className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-xl text-sm text-t-primary placeholder-t-muted focus:outline-none focus:border-accent transition-colors"
                    />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-badge/50 p-1 rounded-xl w-fit overflow-x-auto">
                    <TabButton active={activeTab === 'graph'} onClick={() => setActiveTab('graph')}>Graph</TabButton>
                    <TabButton active={activeTab === 'rings'} onClick={() => setActiveTab('rings')}>Rings ({filteredRings.length})</TabButton>
                    <TabButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')}>Accounts ({filteredAccounts.length})</TabButton>
                    <TabButton active={activeTab === 'report'} onClick={() => setActiveTab('report')}>Report</TabButton>
                </div>

                {/* Content */}
                <AnimatePresence mode='wait'>
                    {activeTab === 'graph' && (
                        <motion.div key="graph" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                            <GraphViz3D data={data} selectedRing={selectedRing} searchQuery={searchQuery} />
                        </motion.div>
                    )}

                    {activeTab === 'rings' && (
                        <motion.div key="rings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-badge text-t-secondary text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Ring ID</th>
                                            <th className="p-4">Pattern Type</th>
                                            <th className="p-4">Members</th>
                                            <th className="p-4">Risk Score</th>
                                            <th className="p-4">Member Account IDs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light">
                                        {filteredRings.map((ring) => (
                                            <tr
                                                key={ring.id}
                                                onClick={() => { setSelectedRing(selectedRing === ring.id ? null : ring.id); setActiveTab('graph'); }}
                                                className={`cursor-pointer transition-colors ${selectedRing === ring.id ? 'bg-accent-light border-l-4 border-accent' : 'hover:bg-card-hover'}`}
                                            >
                                                <td className="p-4 font-medium text-t-primary">{ring.id}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                                        ${ring.type === 'cycle' ? 'bg-red-500/15 text-red-500' :
                                                            ring.type === 'fan_in' ? 'bg-orange-500/15 text-orange-500' :
                                                                ring.type === 'shell' ? 'bg-purple-500/15 text-purple-500' :
                                                                    'bg-amber-500/15 text-amber-500'}`}>
                                                        {ring.type.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-t-primary">{ring.members.length}</td>
                                                <td className="p-4 font-mono text-t-primary">{ring.riskScore.toFixed(1)}</td>
                                                <td className="p-4 text-xs text-t-secondary max-w-md">
                                                    <div className="truncate" title={ring.members.join(', ')}>{ring.members.join(', ')}</div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRings.length === 0 && (
                                            <tr><td colSpan={5} className="p-10 text-center text-t-muted">{searchQuery ? 'No matching rings.' : 'No fraud rings detected.'}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'accounts' && (
                        <motion.div key="accounts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden"
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-badge text-t-secondary text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-4">Account ID</th>
                                            <th className="p-4">Suspicion Score</th>
                                            <th className="p-4">Detected Patterns</th>
                                            <th className="p-4">Ring ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light">
                                        {filteredAccounts.map((acc) => (
                                            <tr key={acc.account_id} className="hover:bg-card-hover transition-colors">
                                                <td className="p-4 font-medium text-t-primary">{acc.account_id}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-2 bg-badge rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${acc.suspicion_score > 80 ? 'bg-red-500' : acc.suspicion_score > 50 ? 'bg-orange-400' : 'bg-amber-400'}`}
                                                                style={{ width: `${acc.suspicion_score}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-mono text-t-primary">{acc.suspicion_score.toFixed(1)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {acc.detected_patterns.map(p => (
                                                            <span key={p} className="px-1.5 py-0.5 bg-badge text-t-secondary rounded text-[10px] uppercase">{p}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-mono text-t-muted">{acc.ring_id || '—'}</td>
                                            </tr>
                                        ))}
                                        {filteredAccounts.length === 0 && (
                                            <tr><td colSpan={4} className="p-10 text-center text-t-muted">{searchQuery ? 'No matching accounts.' : 'No suspicious accounts flagged.'}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'report' && (
                        <SummaryReport data={data} />
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

function KpiCard({ title, value, icon, color }: { title: string; value: number | string; icon: React.ReactNode; color: string }) {
    return (
        <div className="bg-card p-5 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-t-muted uppercase tracking-wide">{title}</h3>
                <div className={`p-1.5 rounded-lg bg-${color}-500/10`}>{icon}</div>
            </div>
            <span className="text-2xl font-bold text-t-primary">{value}</span>
        </div>
    );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${active
                ? 'bg-card text-t-primary shadow-sm'
                : 'text-t-secondary hover:text-t-primary hover:bg-card/50'
                }`}
        >
            {children}
        </button>
    );
}
