'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AnalysisResult, Node, Link } from '@/types';
import { useWindowSize } from '@/hooks/useWindowSize'; // I'll inline this hook or create it
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center p-20 text-gold-600">Loading 3D Engine...</div>
});

interface GraphViz3DProps {
    data: AnalysisResult;
}

export default function GraphViz3D({ data, selectedRing }: GraphViz3DProps & { selectedRing: string | null }) {
    const fgRef = useRef<any>();
    const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
    const [highlightLinks, setHighlightLinks] = useState(new Set<Link>());
    const [hoverNode, setHoverNode] = useState<Node | null>(null);

    // Effect to focus on selected ring
    useEffect(() => {
        if (selectedRing && fgRef.current) {
            const ring = data.fraudRings.find(r => r.id === selectedRing);
            if (ring) {
                // Calculate centroid of ring
                let x = 0, y = 0, z = 0;
                let count = 0;
                ring.members.forEach(mid => {
                    const node = data.graph.nodes.find(n => n.id === mid);
                    if (node) {
                        x += node.x || 0;
                        y += node.y || 0;
                        z += node.z || 0;
                        count++;
                    }
                });
                if (count > 0) {
                    fgRef.current.cameraPosition(
                        { x: (x / count) * 3, y: (y / count) * 3, z: (z / count) * 3 }, // position
                        { x: x / count, y: y / count, z: z / count }, // lookAt
                        2000
                    );
                }
            }
        }
    }, [selectedRing, data]);

    // Parse graph data for consumption
    const graphData = useMemo(() => {
        // Clone to avoid mutation issues if any
        return {
            nodes: data.graph.nodes.map(n => ({ ...n })),
            links: data.graph.links.map(l => ({ ...l }))
        };
    }, [data]);

    // Node Color Logic
    const getNodeColor = (node: Node) => {
        if (selectedRing) {
            const ring = data.fraudRings.find(r => r.id === selectedRing);
            if (ring && ring.members.includes(node.id)) {
                return '#F97316'; // Highlight member (Orange)
            }
            return 'rgba(200, 200, 200, 0.1)'; // Dim others
        }

        if (highlightNodes.has(node.id)) return '#F97316'; // Highlight Orange
        if (node.riskScore > 80) return '#EF4444'; // Red
        if (node.riskScore > 50) return '#F59E0B'; // Amber
        return '#3B82F6'; // Blue (Safe)
    };

    const getLinkColor = (link: Link) => {
        if (selectedRing) {
            const ring = data.fraudRings.find(r => r.id === selectedRing);
            const srcId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
            const tgtId = typeof link.target === 'object' ? (link.target as Node).id : link.target;

            if (ring && ring.members.includes(srcId) && ring.members.includes(tgtId)) {
                return '#EF4444'; // Highlight link (Red)
            }
            return 'rgba(200, 200, 200, 0.05)'; // Dim others
        }
        return 'rgba(100, 100, 100, 0.2)';
    };

    const handleNodeClick = (node: Node) => {
        // Aim at node
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);

        fgRef.current?.cameraPosition(
            { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }, // new position
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
        );
    };

    return (
        <div className="relative w-full h-[600px] border border-cream-300 rounded-2xl overflow-hidden shadow-xl bg-cream-50">
            <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-cream-200">
                <h3 className="text-sm font-semibold text-warm-gray-900">Network Visualization</h3>
                <p className="text-xs text-warm-gray-600">{graphData.nodes.length} Accounts • {graphData.links.length} Transactions</p>
                <div className="mt-2 flex gap-2 text-xs">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>High Risk</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Medium</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Safe</div>
                </div>
            </div>

            <ForceGraph3D
                ref={fgRef}
                graphData={graphData}
                nodeLabel={(node: any) => `Account: ${node.id} (Risk: ${node.riskScore})`}
                nodeColor={(node: any) => getNodeColor(node)}
                nodeVal={(node: any) => Math.sqrt(node.val || 1) * 2} // Size by value
                linkColor={(link: any) => getLinkColor(link)}
                linkWidth={selectedRing ? 2 : 1}
                linkDirectionalParticles={selectedRing ? 4 : 2}
                linkDirectionalParticleSpeed={d => 0.005}
                backgroundColor="#FDFCF8" // Cream 50
                onNodeClick={(node: any) => handleNodeClick(node)}
            // onNodeHover={node => setHoverNode(node || null)}
            />

            {/* Zoom Controls (Optional overlays) */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                {/* Could add manual zoom buttons here interacting with ref */}
            </div>
        </div>
    );
}
