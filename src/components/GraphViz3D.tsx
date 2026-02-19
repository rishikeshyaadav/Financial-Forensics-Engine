'use client';

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnalysisResult, Node, Link } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import * as THREE from 'three';

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
    const [hoverNode, setHoverNode] = useState<string | null>(null);
    const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
    const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());

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

    // Pre-compute neighbors map for O(1) hover lookup
    const neighborsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        data.graph.links.forEach(link => {
            const src = typeof link.source === 'object' ? (link.source as any).id : link.source;
            const tgt = typeof link.target === 'object' ? (link.target as any).id : link.target;
            if (!map.has(src)) map.set(src, []);
            if (!map.has(tgt)) map.set(tgt, []);
            map.get(src)!.push(tgt);
            map.get(tgt)!.push(src);
        });
        return map;
    }, [data.graph.links]);

    // Handle node hover
    const handleNodeHover = useCallback((node: any | null) => {
        setHoverNode(node ? node.id : null);
        if (node) {
            const neighbors = neighborsMap.get(node.id) || [];
            setHighlightNodes(new Set([node.id, ...neighbors]));
            const links = new Set<string>();
            data.graph.links.forEach(l => {
                const src = typeof l.source === 'object' ? (l.source as any).id : l.source;
                const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target;
                if (src === node.id || tgt === node.id) {
                    links.add(l.transaction_id || `${src}-${tgt}`);
                }
            });
            setHighlightLinks(links);
        } else {
            setHighlightNodes(new Set());
            setHighlightLinks(new Set());
        }
    }, [neighborsMap, data.graph.links]);

    // Focus camera
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

    // Custom 3D Object for Nodes (Glassmorphism)
    const nodeThreeObject = useCallback((node: any) => {
        // Base color
        let color = theme === 'bright' ? '#3B82F6' : '#60A5FA';
        if (node.riskScore > 80) color = '#EF4444';
        else if (node.riskScore > 50) color = '#F59E0B';

        // Override if matched/ring/highlighted
        if (searchMatchSet && searchMatchSet.has(node.id)) color = '#22D3EE';
        else if (ringMemberSet && ringMemberSet.has(node.id)) color = '#F97316';

        // Dim if hovering another node and not related
        if (hoverNode && !highlightNodes.has(node.id)) {
            color = theme === 'bright' ? '#E5E7EB' : '#1E293B'; // Grayed out
        }

        const size = node.riskScore > 50 ? 6 : 4;
        const geometry = new THREE.SphereGeometry(size, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.6, // Glass effect
            thickness: 2,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
        });

        return new THREE.Mesh(geometry, material);
    }, [theme, ringMemberSet, searchMatchSet, hoverNode, highlightNodes]);

    const getLinkColor = useCallback((link: any) => {
        // Highlight logic
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        const linkId = link.transaction_id || `${srcId}-${tgtId}`;

        if (hoverNode) {
            return highlightLinks.has(linkId) ? (theme === 'bright' ? '#1C1917' : '#F1F5F9') : 'rgba(100,100,100,0.02)';
        }

        if (ringMemberSet) {
            if (ringMemberSet.has(srcId) && ringMemberSet.has(tgtId)) return '#EF4444';
            return 'rgba(100, 100, 100, 0.03)';
        }

        return theme === 'bright' ? 'rgba(150, 150, 150, 0.2)' : 'rgba(180, 180, 180, 0.15)';
    }, [ringMemberSet, theme, hoverNode, highlightLinks]);

    const handleNodeClick = useCallback((node: any) => {
        if (!fgRef.current) return;
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
        fgRef.current.cameraPosition(
            { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
            { x: node.x, y: node.y, z: node.z },
            1500
        );
    }, []);

    return (
        <div className="relative w-full h-[600px] border border-border rounded-2xl overflow-hidden shadow-xl bg-graph">
            {/* Legend */}
            <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-border">
                <h3 className="text-sm font-semibold text-t-primary">Network Visualization</h3>
                <p className="text-xs text-t-secondary">{graphData.nodes.length} Accounts • {graphData.links.length} Edges</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-t-secondary">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500" />High Risk</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" />Medium</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Safe</div>
                    {selectedRing && <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" />Ring</div>}
                </div>
            </div>

            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeThreeObject={nodeThreeObject}
                nodeLabel={(node: any) => node.id} // Simple label for now, or custom HTML tooltip
                linkColor={getLinkColor}
                linkWidth={link => (hoverNode && highlightLinks.has(link.transaction_id || '') ? 2 : selectedRing ? 1.5 : 0.5)}
                linkCurvature={0.25}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={1.5}
                backgroundColor={THEME_BG[theme] || '#FDFCF8'}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                showNavInfo={false}
            />

            {/* Hover Tooltip (Bottom Left) */}
            {hoverNode && (
                <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-md border border-border p-4 rounded-xl shadow-lg max-w-sm pointer-events-none">
                    {(() => {
                        const node = data.graph.nodes.find(n => n.id === hoverNode);
                        if (!node) return null;
                        return (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-t-primary text-lg">{node.id}</h4>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${node.riskScore > 80 ? 'bg-red-500/20 text-red-600' : node.riskScore > 50 ? 'bg-amber-500/20 text-amber-600' : 'bg-blue-500/20 text-blue-600'}`}>
                                        Risk: {node.riskScore.toFixed(1)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs text-t-secondary">
                                    <div>In-Degree: <span className="text-t-primary">{node.inDegree}</span></div>
                                    <div>Out-Degree: <span className="text-t-primary">{node.outDegree}</span></div>
                                    <div>Total In: <span className="text-t-primary">${node.totalIn.toLocaleString()}</span></div>
                                    <div>Total Out: <span className="text-t-primary">${node.totalOut.toLocaleString()}</span></div>
                                </div>
                                {node.patterns.length > 0 && (
                                    <div className="pt-2 border-t border-border mt-2">
                                        <div className="text-xs font-semibold text-t-muted mb-1">Detected Patterns:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {node.patterns.map(p => (
                                                <span key={p} className="px-1.5 py-0.5 bg-badge text-t-secondary rounded-[4px] text-[10px] uppercase border border-border">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
