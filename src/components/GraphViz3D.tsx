'use client';

import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AnalysisResult, Node, Link } from '@/types';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-20 text-gold-600">Loading 3D Engine...</div>
});

interface GraphViz3DProps {
    data: AnalysisResult;
    selectedRing: string | null;
}

export default function GraphViz3D({ data, selectedRing }: GraphViz3DProps) {
    const fgRef = useRef<any>(null);

    // Pre-compute ring member set for O(1) lookups
    const ringMemberSet = useMemo(() => {
        if (!selectedRing) return null;
        const ring = data.fraudRings.find(r => r.id === selectedRing);
        return ring ? new Set(ring.members) : null;
    }, [selectedRing, data.fraudRings]);

    // Focus camera on selected ring centroid
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
                const cx = x / count, cy = y / count, cz = z / count;
                fgRef.current.cameraPosition(
                    { x: cx + 150, y: cy + 100, z: cz + 150 },
                    { x: cx, y: cy, z: cz },
                    2000
                );
            }
        }
    }, [selectedRing, data.graph.nodes, ringMemberSet]);

    // Clone graph data to avoid mutation
    const graphData = useMemo(() => ({
        nodes: data.graph.nodes.map(n => ({ ...n })),
        links: data.graph.links.map(l => ({ ...l })),
    }), [data]);

    // Node color: highlight ring members, dim others when ring selected
    const getNodeColor = useCallback((node: any) => {
        if (ringMemberSet) {
            return ringMemberSet.has(node.id) ? '#F97316' : 'rgba(200, 200, 200, 0.15)';
        }
        if (node.riskScore > 80) return '#EF4444';
        if (node.riskScore > 50) return '#F59E0B';
        return '#3B82F6';
    }, [ringMemberSet]);

    // Link color: highlight ring edges
    const getLinkColor = useCallback((link: any) => {
        if (ringMemberSet) {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            if (ringMemberSet.has(srcId) && ringMemberSet.has(tgtId)) {
                return '#EF4444';
            }
            return 'rgba(200, 200, 200, 0.05)';
        }
        return 'rgba(100, 100, 100, 0.2)';
    }, [ringMemberSet]);

    // Node hover label — shows account details (required by doc)
    const getNodeLabel = useCallback((node: any) => {
        const parts = [
            `<div style="background:rgba(0,0,0,0.85);color:#fff;padding:8px 12px;border-radius:8px;font-family:monospace;font-size:12px;max-width:280px">`,
            `<div style="font-weight:bold;font-size:14px;margin-bottom:4px">${node.id}</div>`,
            `<div>Risk Score: <span style="color:${node.riskScore > 80 ? '#EF4444' : node.riskScore > 50 ? '#F59E0B' : '#3B82F6'}">${node.riskScore}</span></div>`,
            `<div>In-Degree: ${node.inDegree} | Out-Degree: ${node.outDegree}</div>`,
            `<div>Total In: $${node.totalIn.toFixed(2)} | Total Out: $${node.totalOut.toFixed(2)}</div>`,
        ];
        if (node.patterns && node.patterns.length > 0) {
            parts.push(`<div style="margin-top:4px;color:#F97316">Patterns: ${node.patterns.join(', ')}</div>`);
        }
        parts.push('</div>');
        return parts.join('');
    }, []);

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
        <div className="relative w-full h-[600px] border border-cream-300 rounded-2xl overflow-hidden shadow-xl bg-cream-50">
            <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-cream-200">
                <h3 className="text-sm font-semibold text-warm-gray-900">Network Visualization</h3>
                <p className="text-xs text-warm-gray-600">{graphData.nodes.length} Accounts • {graphData.links.length} Transactions</p>
                <div className="mt-2 flex gap-3 text-xs">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>High Risk</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>Medium</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>Safe</div>
                    {selectedRing && (
                        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>Selected Ring</div>
                    )}
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
                backgroundColor="#FDFCF8"
                onNodeClick={handleNodeClick}
            />

            {selectedRing && (
                <div className="absolute bottom-4 left-4 z-10 bg-orange-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm">
                    Viewing: {selectedRing}
                </div>
            )}
        </div>
    );
}
