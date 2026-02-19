'use client';

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnalysisResult } from '@/types';
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

// Reusable geometry to prevent memory leaks (16 segments is enough for small nodes)
const NODE_GEOMETRY = new THREE.SphereGeometry(4, 16, 16);
const RING_GEOMETRY = new THREE.SphereGeometry(6, 16, 16);

export default function GraphViz3D({ data, selectedRing, searchQuery = '' }: GraphViz3DProps) {
    const fgRef = useRef<any>(null);
    const { theme } = useTheme();
    const [hoverNode, setHoverNode] = useState<string | null>(null);
    const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
    const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());

    // Pre-compute lookup sets
    const ringMemberSet = useMemo(() => {
        if (!selectedRing) return null;
        const ring = data.fraudRings.find(r => r.id === selectedRing);
        return ring ? new Set(ring.members) : null;
    }, [selectedRing, data.fraudRings]);

    const searchMatchSet = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        const matched = new Set<string>();
        for (const node of data.graph.nodes) {
            if (node.id.toLowerCase().includes(q)) matched.add(node.id);
        }
        return matched.size > 0 ? matched : null;
    }, [searchQuery, data.graph.nodes]);

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

    // Create pooled materials to avoid creating 1000s of material instances
    // We use MeshPhongMaterial for better performance than MeshPhysicalMaterial
    const materials = useMemo(() => {
        const createMat = (color: string, opacity = 1) => new THREE.MeshPhongMaterial({
            color,
            transparent: opacity < 1,
            opacity,
            shininess: 50,
        });

        return {
            highRisk: createMat('#EF4444'),
            medRisk: createMat('#F59E0B'),
            safe: createMat(theme === 'bright' ? '#3B82F6' : '#60A5FA'),
            match: createMat('#22D3EE'),
            ring: createMat('#F97316'),
            dimmed: createMat(theme === 'bright' ? '#E5E7EB' : '#1E293B', 0.3), // Transparent for dimmed
        };
    }, [theme]);

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

    const nodeThreeObject = useCallback((node: any) => {
        let mat = materials.safe;

        // Priority 1: Search Match
        if (searchMatchSet && searchMatchSet.has(node.id)) mat = materials.match;
        // Priority 2: Ring Member
        else if (ringMemberSet && ringMemberSet.has(node.id)) mat = materials.ring;
        // Priority 3: Hover Logic (Dimming)
        else if (hoverNode && !highlightNodes.has(node.id)) mat = materials.dimmed;
        // Priority 4: Risk Score
        else {
            if (node.riskScore > 80) mat = materials.highRisk;
            else if (node.riskScore > 50) mat = materials.medRisk;
        }

        const mesh = new THREE.Mesh(node.riskScore > 50 ? RING_GEOMETRY : NODE_GEOMETRY, mat);
        return mesh;
    }, [materials, searchMatchSet, ringMemberSet, hoverNode, highlightNodes]);

    // Cleanup materials on unmount
    useEffect(() => {
        return () => {
            Object.values(materials).forEach(m => m.dispose());
        };
    }, [materials]);

    const getLinkColor = useCallback((link: any) => {
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

    // Memoize graph data to prevent re-renders
    const graphData = useMemo(() => {
        return {
            nodes: data.graph.nodes,
            links: data.graph.links
        };
    }, [data]);

    return (
        <div className="relative w-full h-[600px] border border-border rounded-2xl overflow-hidden shadow-xl bg-graph">
            {/* Legend - preserved */}
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
                nodeLabel={() => ''} // Disable default label
                linkColor={getLinkColor}
                linkWidth={link => (hoverNode && highlightLinks.has(link.transaction_id || '') ? 2 : selectedRing ? 1.5 : 0.5)}
                linkCurvature={0.2} // Reduced curvature for performance
                // Reduced particles for performance: only show on highlighted or ring links
                linkDirectionalParticles={link => (selectedRing || (hoverNode && highlightLinks.has(link.transaction_id || ''))) ? 2 : 0}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                backgroundColor={THEME_BG[theme] || '#FDFCF8'}
                onNodeClick={(node: any) => {
                    const dist = 80;
                    const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z);
                    fgRef.current?.cameraPosition(
                        { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
                        { x: node.x, y: node.y, z: node.z },
                        1000
                    );
                }}
                onNodeHover={handleNodeHover}
                showNavInfo={false}
                warmupTicks={20} // Provide some initial stability
                cooldownTicks={100} // Stop simulation sooner to save GPU
            />

            {/* Tooltip - preserved */}
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
                                    <div>In: <span className="text-t-primary">${node.totalIn.toLocaleString()}</span></div>
                                    <div>Out: <span className="text-t-primary">${node.totalOut.toLocaleString()}</span></div>
                                </div>
                                {node.patterns.length > 0 && (
                                    <div className="pt-2 border-t border-border mt-2">
                                        <div className="text-xs font-semibold text-t-muted mb-1">Detected Patterns:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {node.patterns.map(p => (
                                                <span key={p} className="px-1.5 py-0.5 bg-badge text-t-secondary rounded-[4px] text-[10px] uppercase border border-border">{p}</span>
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
