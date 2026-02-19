import { Transaction, GraphData, Node, Link, FraudRing, SuspiciousAccount, AnalysisResult } from '@/types';

// ──────────────────────────────────────────────
// 1. BUILD GRAPH — O(T) where T = transactions
// ──────────────────────────────────────────────
export const buildGraph = (transactions: Transaction[]): GraphData => {
    const nodesMap = new Map<string, Node>();
    const links: Link[] = [];

    for (const tx of transactions) {
        if (!nodesMap.has(tx.sender_id)) {
            nodesMap.set(tx.sender_id, {
                id: tx.sender_id, riskScore: 0,
                flags: [], patterns: [],
                inDegree: 0, outDegree: 0,
                totalIn: 0, totalOut: 0, val: 1,
            });
        }
        if (!nodesMap.has(tx.receiver_id)) {
            nodesMap.set(tx.receiver_id, {
                id: tx.receiver_id, riskScore: 0,
                flags: [], patterns: [],
                inDegree: 0, outDegree: 0,
                totalIn: 0, totalOut: 0, val: 1,
            });
        }

        const sender = nodesMap.get(tx.sender_id)!;
        const receiver = nodesMap.get(tx.receiver_id)!;
        sender.outDegree++;
        sender.totalOut += tx.amount;
        receiver.inDegree++;
        receiver.totalIn += tx.amount;

        links.push({
            source: tx.sender_id,
            target: tx.receiver_id,
            amount: tx.amount,
            timestamp: tx.timestamp,
            transaction_id: tx.transaction_id,
        });
    }

    return { nodes: Array.from(nodesMap.values()), links };
};

// ──────────────────────────────────────────────
// Helper: Build adjacency list once — O(L)
// ──────────────────────────────────────────────
const buildAdjacency = (links: Link[]): Map<string, string[]> => {
    const adj = new Map<string, string[]>();
    for (const link of links) {
        const src = typeof link.source === 'object' ? (link.source as Node).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as Node).id : link.target;
        if (!adj.has(src)) adj.set(src, []);
        adj.get(src)!.push(tgt);
    }
    return adj;
};

// ──────────────────────────────────────────────
// Helper: Link lookup maps for O(1) access
// ──────────────────────────────────────────────
const buildLinkMaps = (links: Link[]) => {
    const byTarget = new Map<string, Link[]>();
    const bySource = new Map<string, Link[]>();
    for (const link of links) {
        const src = typeof link.source === 'object' ? (link.source as Node).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as Node).id : link.target;
        if (!byTarget.has(tgt)) byTarget.set(tgt, []);
        byTarget.get(tgt)!.push(link);
        if (!bySource.has(src)) bySource.set(src, []);
        bySource.get(src)!.push(link);
    }
    return { byTarget, bySource };
};

// ──────────────────────────────────────────────
// 2. CYCLE DETECTION — DFS depth-limited 3-5
//    Complexity: O(N * d^5) where d = avg degree
// ──────────────────────────────────────────────
export const detectCycles = (graph: GraphData, adj: Map<string, string[]>): FraudRing[] => {
    const rings: FraudRing[] = [];
    const recordedCycles = new Set<string>();
    const path: string[] = [];
    const pathSet = new Set<string>();

    const findCycles = (curr: string, start: string, depth: number) => {
        path.push(curr);
        pathSet.add(curr);

        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
            if (neighbor === start && depth >= 3 && depth <= 5) {
                const cycleMembers = [...path];
                const key = [...cycleMembers].sort().join(',');
                if (!recordedCycles.has(key)) {
                    recordedCycles.add(key);
                    rings.push({
                        id: `RING_${String(rings.length + 1).padStart(3, '0')}`,
                        type: 'cycle',
                        riskScore: 90,
                        members: cycleMembers,
                        patternDetails: `Circular fund routing: ${cycleMembers.join(' → ')} → ${start} (length ${depth})`,
                    });
                }
            } else if (!pathSet.has(neighbor) && depth < 5) {
                findCycles(neighbor, start, depth + 1);
            }
        }

        path.pop();
        pathSet.delete(curr);
    };

    for (const node of graph.nodes) {
        findCycles(node.id, node.id, 1);
    }

    return rings;
};

// ──────────────────────────────────────────────
// 3. TEMPORAL VELOCITY CHECK — 72h sliding window
//    O(T log T) for the sort
// ──────────────────────────────────────────────
const hasHighVelocity = (timestamps: string[], countThreshold: number, windowHours: number): boolean => {
    if (timestamps.length < countThreshold) return false;
    const times = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    const windowMs = windowHours * 60 * 60 * 1000;

    for (let i = 0; i <= times.length - countThreshold; i++) {
        if (times[i + countThreshold - 1] - times[i] <= windowMs) {
            return true;
        }
    }
    return false;
};

// ──────────────────────────────────────────────
// 4. SMURFING DETECTION — Fan-in / Fan-out
//    10+ unique counterparts within 72h
//    FALSE-POSITIVE GUARD: skip nodes with both
//    high in AND high out (likely merchants)
// ──────────────────────────────────────────────
export const detectSmurfing = (
    graph: GraphData,
    linksByTarget: Map<string, Link[]>,
    linksBySource: Map<string, Link[]>,
): FraudRing[] => {
    const rings: FraudRing[] = [];

    for (const node of graph.nodes) {
        // FALSE POSITIVE CONTROL: A legitimate merchant/payroll account
        // has BOTH high inDegree AND high outDegree. Mules typically
        // only aggregate (high in, low out) or disperse (high out, low in).
        if (node.inDegree >= 5 && node.outDegree >= 5) continue;

        // Fan-in: 10+ senders → 1 receiver within 72h
        if (node.inDegree >= 10 && node.outDegree <= 2) {
            const incomingLinks = linksByTarget.get(node.id) || [];
            const senderSet = new Set(incomingLinks.map(l =>
                typeof l.source === 'object' ? (l.source as Node).id : l.source
            ));

            if (senderSet.size >= 10) {
                const timestamps = incomingLinks.map(l => l.timestamp);
                if (hasHighVelocity(timestamps, 10, 72)) {
                    rings.push({
                        id: `FANIN_${String(rings.length + 1).padStart(3, '0')}`,
                        type: 'fan_in',
                        riskScore: 85,
                        members: [node.id, ...Array.from(senderSet)],
                        patternDetails: `Fan-in aggregator: ${senderSet.size} accounts → ${node.id} within 72h window`,
                    });
                }
            }
        }

        // Fan-out: 1 sender → 10+ receivers within 72h
        if (node.outDegree >= 10 && node.inDegree <= 2) {
            const outgoingLinks = linksBySource.get(node.id) || [];
            const receiverSet = new Set(outgoingLinks.map(l =>
                typeof l.target === 'object' ? (l.target as Node).id : l.target
            ));

            if (receiverSet.size >= 10) {
                const timestamps = outgoingLinks.map(l => l.timestamp);
                if (hasHighVelocity(timestamps, 10, 72)) {
                    rings.push({
                        id: `FANOUT_${String(rings.length + 1).padStart(3, '0')}`,
                        type: 'fan_out',
                        riskScore: 85,
                        members: [node.id, ...Array.from(receiverSet)],
                        patternDetails: `Fan-out dispersal: ${node.id} → ${receiverSet.size} accounts within 72h window`,
                    });
                }
            }
        }
    }

    return rings;
};

// ──────────────────────────────────────────────
// 5. SHELL NETWORK DETECTION
//    Chains of 3+ hops through low-volume
//    intermediaries (2-3 total transactions)
// ──────────────────────────────────────────────
export const detectShells = (graph: GraphData, adj: Map<string, string[]>): FraudRing[] => {
    const rings: FraudRing[] = [];
    const shellCandidates = new Set<string>();

    for (const node of graph.nodes) {
        const totalTx = node.inDegree + node.outDegree;
        if (totalTx >= 2 && totalTx <= 3 && node.inDegree > 0 && node.outDegree > 0) {
            shellCandidates.add(node.id);
        }
    }

    const recordedChains = new Set<string>();

    const findShellChains = (curr: string, path: string[], pathSet: Set<string>) => {
        path.push(curr);
        pathSet.add(curr);

        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
            if (pathSet.has(neighbor)) continue;

            if (shellCandidates.has(neighbor)) {
                findShellChains(neighbor, path, pathSet);
            } else {
                // End of chain — require 3+ hops (4+ nodes) with shell intermediaries
                if (path.length >= 3) {
                    const hasShells = path.some(p => shellCandidates.has(p));
                    if (hasShells) {
                        const fullChain = [...path, neighbor];
                        const key = fullChain.join('→');
                        // Avoid sub-chains
                        if (!recordedChains.has(key)) {
                            recordedChains.add(key);
                            rings.push({
                                id: `SHELL_${String(rings.length + 1).padStart(3, '0')}`,
                                type: 'shell',
                                riskScore: 80,
                                members: fullChain,
                                patternDetails: `Layered shell chain: ${fullChain.join(' → ')} (${fullChain.length - 1} hops)`,
                            });
                        }
                    }
                }
            }
        }

        path.pop();
        pathSet.delete(curr);
    };

    for (const node of graph.nodes) {
        if (!shellCandidates.has(node.id)) {
            findShellChains(node.id, [], new Set());
        }
    }

    return rings;
};

// ──────────────────────────────────────────────
// 6. SUSPICION SCORE METHODOLOGY
//    Weighted multi-factor scoring:
//    - cycle membership:   +50 points
//    - fan_in membership:  +30 points  
//    - fan_out membership: +30 points
//    - shell membership:   +25 points
//    - high_velocity flag: +15 points (72h window)
//    Capped at 100. Sorted descending.
// ──────────────────────────────────────────────
const computeSuspicionScore = (patterns: string[]): number => {
    let score = 0;
    if (patterns.includes('cycle')) score += 50;
    if (patterns.includes('fan_in')) score += 30;
    if (patterns.includes('fan_out')) score += 30;
    if (patterns.includes('shell')) score += 25;
    if (patterns.includes('high_velocity')) score += 15;
    return Math.min(100, score);
};

// ──────────────────────────────────────────────
// 7. MAIN ANALYSIS ORCHESTRATOR — O(T + N * d^5)
// ──────────────────────────────────────────────
export const analyzeGraph = (transactions: Transaction[]): AnalysisResult => {
    const startTime = performance.now();

    const graph = buildGraph(transactions);

    // Pre-compute lookup structures (O(L))
    const adj = buildAdjacency(graph.links);
    const { byTarget, bySource } = buildLinkMaps(graph.links);

    // Run all detectors
    const cycles = detectCycles(graph, adj);
    const smurfs = detectSmurfing(graph, byTarget, bySource);
    const shells = detectShells(graph, adj);
    const allRings = [...cycles, ...smurfs, ...shells];

    // Build O(1) node lookup
    const nodeMap = new Map<string, Node>();
    for (const n of graph.nodes) nodeMap.set(n.id, n);

    // Mark nodes with patterns
    const flaggedNodeIds = new Set<string>();
    for (const ring of allRings) {
        for (const memberId of ring.members) {
            const node = nodeMap.get(memberId);
            if (node) {
                if (!node.patterns.includes(ring.type)) node.patterns.push(ring.type);

                // Add descriptive pattern strings matching doc format
                const descriptivePattern = ring.type === 'cycle'
                    ? `cycle_length_${ring.members.length}`
                    : ring.type === 'fan_in' ? 'fan_in_aggregation'
                        : ring.type === 'fan_out' ? 'fan_out_dispersal'
                            : 'shell_layering';
                if (!node.patterns.includes(descriptivePattern)) {
                    node.patterns.push(descriptivePattern);
                }

                // Add high_velocity if applicable
                if ((ring.type === 'fan_in' || ring.type === 'fan_out') && !node.patterns.includes('high_velocity')) {
                    node.patterns.push('high_velocity');
                }

                flaggedNodeIds.add(memberId);
            }
        }
    }

    // Compute suspicion scores
    for (const node of graph.nodes) {
        node.riskScore = computeSuspicionScore(node.patterns);
        node.val = node.riskScore > 50 ? 3 : 1; // Make suspicious nodes larger in viz
    }

    // Build suspicious accounts list
    const suspiciousAccounts: SuspiciousAccount[] = [];
    for (const id of flaggedNodeIds) {
        const node = nodeMap.get(id);
        if (node) {
            suspiciousAccounts.push({
                account_id: node.id,
                suspicion_score: node.riskScore,
                detected_patterns: [...node.patterns],
                ring_id: allRings.find(r => r.members.includes(id))?.id,
            });
        }
    }

    // Sort descending by score (required by doc)
    suspiciousAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    const endTime = performance.now();

    return {
        graph,
        fraudRings: allRings,
        suspiciousAccounts,
        processingTime: (endTime - startTime) / 1000,
        summary: {
            total_accounts: graph.nodes.length,
            flagged_accounts: suspiciousAccounts.length,
            rings_detected: allRings.length,
            total_transactions: transactions.length,
        },
    };
};
