'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, TrendingUp, Clock, Users, Activity } from 'lucide-react';
import { AnalysisResult } from '@/types';

interface SummaryReportProps {
    data: AnalysisResult;
}

export default function SummaryReport({ data }: SummaryReportProps) {
    const { summary, fraudRings, suspiciousAccounts, processingTime, graph } = data;

    // Aggregate metrics
    const totalVolume = graph.links.reduce((sum, l) => sum + l.amount, 0);
    const avgTxAmount = totalVolume / Math.max(graph.links.length, 1);
    const maxRiskScore = suspiciousAccounts.length > 0 ? suspiciousAccounts[0].suspicion_score : 0;
    const cycleRings = fraudRings.filter(r => r.type === 'cycle');
    const smurfRings = fraudRings.filter(r => r.type === 'fan_in' || r.type === 'fan_out');
    const shellRings = fraudRings.filter(r => r.type === 'shell');

    const riskLevel = fraudRings.length >= 5 ? 'CRITICAL' : fraudRings.length >= 2 ? 'HIGH' : fraudRings.length >= 1 ? 'MODERATE' : 'LOW';
    const riskColor = riskLevel === 'CRITICAL' ? 'text-red-500' : riskLevel === 'HIGH' ? 'text-orange-500' : riskLevel === 'MODERATE' ? 'text-amber-500' : 'text-green-500';

    const top5 = suspiciousAccounts.slice(0, 5);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            {/* Executive Summary */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-accent-light">
                        <ShieldCheck className="text-accent" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-t-primary">Executive Summary</h2>
                        <p className="text-sm text-t-muted">Analysis completed in {processingTime.toFixed(2)}s</p>
                    </div>
                </div>
                <p className="text-t-secondary leading-relaxed">
                    Analyzed <strong className="text-t-primary">{summary.total_accounts.toLocaleString()}</strong> accounts
                    across <strong className="text-t-primary">{summary.total_transactions.toLocaleString()}</strong> transactions
                    with a total volume of <strong className="text-t-primary">${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                    Detected <strong className={riskColor}>{summary.rings_detected} fraud ring{summary.rings_detected !== 1 ? 's' : ''}</strong> involving <strong className="text-t-primary">{summary.flagged_accounts}</strong> suspicious accounts.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-light">
                    <AlertTriangle className={riskColor} size={18} />
                    <span className={`font-bold text-sm ${riskColor}`}>Overall Risk Level: {riskLevel}</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={<Activity size={18} />} label="Total Volume" value={`$${(totalVolume / 1000).toFixed(1)}K`} />
                <StatCard icon={<TrendingUp size={18} />} label="Avg Transaction" value={`$${avgTxAmount.toFixed(2)}`} />
                <StatCard icon={<Clock size={18} />} label="Processing" value={`${processingTime.toFixed(2)}s`} />
                <StatCard icon={<Users size={18} />} label="Cycle Rings" value={String(cycleRings.length)} highlight={cycleRings.length > 0} />
                <StatCard icon={<Users size={18} />} label="Smurf Rings" value={String(smurfRings.length)} highlight={smurfRings.length > 0} />
                <StatCard icon={<Users size={18} />} label="Shell Chains" value={String(shellRings.length)} highlight={shellRings.length > 0} />
            </div>

            {/* Risk Distribution */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-t-primary mb-4">Detection Breakdown</h3>
                <div className="space-y-3">
                    <RiskBar label="Circular Fund Routing" count={cycleRings.length} total={Math.max(fraudRings.length, 1)} color="bg-red-500" />
                    <RiskBar label="Smurfing (Fan-in/Fan-out)" count={smurfRings.length} total={Math.max(fraudRings.length, 1)} color="bg-orange-500" />
                    <RiskBar label="Shell Networks" count={shellRings.length} total={Math.max(fraudRings.length, 1)} color="bg-purple-500" />
                </div>
            </div>

            {/* Top 5 Highest Risk Accounts */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border-light">
                    <h3 className="text-lg font-semibold text-t-primary">Top 5 Highest Risk Accounts</h3>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-badge text-t-secondary text-xs uppercase font-semibold">
                        <tr>
                            <th className="p-4">#</th>
                            <th className="p-4">Account ID</th>
                            <th className="p-4">Suspicion Score</th>
                            <th className="p-4">Patterns</th>
                            <th className="p-4">Ring</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {top5.map((acc, i) => (
                            <tr key={acc.account_id} className="hover:bg-card-hover transition-colors">
                                <td className="p-4 font-bold text-t-muted">{i + 1}</td>
                                <td className="p-4 font-mono font-medium text-t-primary">{acc.account_id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 h-2 bg-badge rounded-full overflow-hidden">
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
                                        {acc.detected_patterns.slice(0, 3).map(p => (
                                            <span key={p} className="px-1.5 py-0.5 bg-badge text-t-secondary rounded text-[10px] uppercase">{p}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 font-mono text-sm text-t-muted">{acc.ring_id || '—'}</td>
                            </tr>
                        ))}
                        {top5.length === 0 && (
                            <tr><td colSpan={5} className="p-10 text-center text-t-muted">No suspicious accounts detected.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`bg-card rounded-xl border p-4 ${highlight ? 'border-red-400/50 shadow-sm shadow-red-500/10' : 'border-border'}`}>
            <div className="flex items-center gap-2 text-t-muted mb-1">{icon}<span className="text-xs">{label}</span></div>
            <div className={`text-xl font-bold ${highlight ? 'text-red-500' : 'text-t-primary'}`}>{value}</div>
        </div>
    );
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = (count / total) * 100;
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-t-secondary">{label}</span>
                <span className="font-mono text-t-primary">{count}</span>
            </div>
            <div className="h-3 bg-badge rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
        </div>
    );
}
