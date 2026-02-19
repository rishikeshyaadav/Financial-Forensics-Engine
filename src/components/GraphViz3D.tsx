'use client';

import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnalysisResult, Node } from '@/types';
import { useTheme } from '@/context/ThemeContext';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-20 text-accent">Loading 3D Engine...</div>
});

interface GraphViz3DProps {
    data: AnalysisResult;
    selectedRing: string | null;
    searchQuery?: string;
}

const THEME_BG: Record<string, string> = {
    bright: '#FDFCF8',
    night: '#0F172A',
    black: '#000000',
};

export default function GraphViz3D({ data, selectedRing, searchQuery = '' }: GraphViz3DProps) {
    const fgRef = useRef<any>(null);
    const { theme } = useTheme();

    // Pre-compute ring member set
    const ringMemberSet = useMemo(() => {
        if (!selectedRing) return null;
        const ring = data.fraudRings.find(r => r.id === selectedRing);
        return ring ? new Set(ring.members) : null;
    }, [selectedRing, data.fraudRings]);

    // Pre-compute search matched node set
    const searchMatchSet = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        const matched = new Set<string>();
        for (const node of data.graph.nodes) {
            if (node.id.toLowerCase().includes(q)) matched.add(node.id);
        }
        return matched.size > 0 ? matched : null;
    }, [searchQuery, data.graph.nodes]);

    // Focus camera on ring centroid
    useEffect(() => {
        if (selectedRing && fgRef.current && ringMemberSet) {
            let x = 0, y = 0, z = 0, count = 0;
            for (const node of data.graph.nodes) {
                if (ringMemberSet.has(node.id)) {
                    x += node.x || 0;
                    y += node.y || 0;
                    z += node.z || 0;
                    count++;
                }
            }
            if (count > 0) {
                fgRef.current.cameraPosition(
                    { x: x / count + 150, y: y / count + 100, z: z / count + 150 },
                    { x: x / count, y: y / count, z: z / count },
                    2000
                );
            }
        }
    }, [selectedRing, data.graph.nodes, ringMemberSet]);

    const graphData = useMemo(() => ({
        nodes: data.graph.nodes.map(n => ({ ...n })),
        links: data.graph.links.map(l => ({ ...l })),
    }), [data]);

    const getNodeColor = useCallback((node: any) => {
        // Search highlight takes priority
        if (searchMatchSet) {
            return searchMatchSet.has(node.id) ? '#22D3EE' : 'rgba(120, 120, 120, 0.12)';
        }
        // Ring highlight
        if (ringMemberSet) {
            return ringMemberSet.has(node.id) ? '#F97316' : 'rgba(120, 120, 120, 0.12)';
        }
        // Default risk-based coloring
        if (node.riskScore > 80) return '#EF4444';
        if (node.riskScore > 50) return '#F59E0B';
        return theme === 'bright' ? '#3B82F6' : '#60A5FA';
    }, [ringMemberSet, searchMatchSet, theme]);

    const getLinkColor = useCallback((link: any) => {
        if (ringMemberSet) {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            if (ringMemberSet.has(srcId) && ringMemberSet.has(tgtId)) return '#EF4444';
            return theme === 'bright' ? 'rgba(200, 200, 200, 0.06)' : 'rgba(100, 100, 100, 0.06)';
        }
        return theme === 'bright' ? 'rgba(100, 100, 100, 0.2)' : 'rgba(180, 180, 180, 0.15)';
    }, [ringMemberSet, theme]);

    const getNodeLabel = useCallback((node: any) => {
        const bgColor = theme === 'bright' ? 'rgba(0,0,0,0.88)' : 'rgba(30,41,59,0.95)';
        return [
            `<div style="background:${bgColor};color:#fff;padding:8px 12px;border-radius:8px;font-family:monospace;font-size:12px;max-width:280px;border:1px solid rgba(255,255,255,0.1)">`,
            `<div style="font-weight:bold;font-size:14px;margin-bottom:4px">${node.id}</div>`,
            `<div>Risk Score: <span style="color:${node.riskScore > 80 ? '#EF4444' : node.riskScore > 50 ? '#F59E0B' : '#60A5FA'}">${node.riskScore}</span></div>`,
            `<div>In: ${node.inDegree} | Out: ${node.outDegree}</div>`,
            `<div>$${node.totalIn.toFixed(2)} in | $${node.totalOut.toFixed(2)} out</div>`,
            node.patterns?.length > 0 ? `<div style="margin-top:4px;color:#F97316">⚠ ${node.patterns.join(', ')}</div>` : '',
            '</div>',
        ].join('');
    }, [theme]);

    const handleNodeClick = useCallback((node: any) => {
        if (!fgRef.current) return;
        const distance = 60;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
        fgRef.current.cameraPosition(
            { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
            { x: node.x, y: node.y, z: node.z },
            2000
        );
    }, []);

    return (
        <div className="relative w-full h-[600px] border border-border rounded-2xl overflow-hidden shadow-xl bg-page">
            {/* Legend */}
            <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-border">
                <h3 className="text-sm font-semibold text-t-primary">Network Visualization</h3>
                <p className="text-xs text-t-secondary">{graphData.nodes.length} Accounts • {graphData.links.length} Edges</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-t-secondary">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500" />High Risk</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" />Medium</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Safe</div>
                    {selectedRing && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" />Ring</div>}
                    {searchMatchSet && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />Match</div>}
                </div>
            </div>

            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel={getNodeLabel}
                nodeColor={getNodeColor}
                nodeVal={(node: any) => (node.riskScore > 50 ? 4 : 1.5)}
                linkColor={getLinkColor}
                linkWidth={selectedRing ? 2 : 0.5}
                linkDirectionalParticles={selectedRing ? 4 : 1}
                linkDirectionalParticleSpeed={() => 0.004}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                backgroundColor={THEME_BG[theme] || '#FDFCF8'}
                onNodeClick={handleNodeClick}
            />

            {/* Selected Ring Badge */}
            {selectedRing && (
                <div className="absolute bottom-4 left-4 z-10 bg-orange-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
                    Ring: {selectedRing}
                </div>
            )}

            {/* Search Match Badge */}
            {searchMatchSet && (
                <div className="absolute bottom-4 right-4 z-10 bg-cyan-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
                    {searchMatchSet.size} match{searchMatchSet.size !== 1 ? 'es' : ''}
                </div>
            )}
        </div>
    );
}
