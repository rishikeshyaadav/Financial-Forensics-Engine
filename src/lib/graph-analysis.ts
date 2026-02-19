import { Transaction, GraphData, Node, Link, FraudRing, SuspiciousAccount, AnalysisResult } from '@/types';

// Helper to calculate risk score based on patterns
const calculateRiskScore = (patterns: string[], flags: string[]): number => {
    let score = 0;
    if (patterns.includes('cycle')) score += 50;
    if (patterns.includes('fan_in')) score += 30;
    if (patterns.includes('fan_out')) score += 30;
    if (rowsIncludes(patterns, 'shell')) score += 40;

    // Cap at 100
    return Math.min(100, score);
};

const rowsIncludes = (arr: string[], str: string) => arr.some(el => el.includes(str));

export const buildGraph = (transactions: Transaction[]): GraphData => {
    const nodesMap = new Map<string, Node>();
    const links: Link[] = [];

    transactions.forEach(tx => {
        // Ensure nodes exist
        if (!nodesMap.has(tx.sender_id)) {
            nodesMap.set(tx.sender_id, {
                id: tx.sender_id,
                riskScore: 0,
                flags: [],
                patterns: [],
                inDegree: 0, outDegree: 0,
                totalIn: 0, totalOut: 0,
                val: 1
            });
        }
        if (!nodesMap.has(tx.receiver_id)) {
            nodesMap.set(tx.receiver_id, {
                id: tx.receiver_id,
                riskScore: 0,
                flags: [],
                patterns: [],
                inDegree: 0, outDegree: 0,
                totalIn: 0, totalOut: 0,
                val: 1
            });
        }

        const sender = nodesMap.get(tx.sender_id)!;
        const receiver = nodesMap.get(tx.receiver_id)!;

        // Update stats
        sender.outDegree++;
        sender.totalOut += tx.amount;
        receiver.inDegree++;
        receiver.totalIn += tx.amount;

        links.push({
            source: tx.sender_id,
            target: tx.receiver_id,
            amount: tx.amount,
            timestamp: tx.timestamp,
            transaction_id: tx.transaction_id
        });
    });

    return {
        nodes: Array.from(nodesMap.values()),
        links
    };
};

export const detectCycles = (graph: GraphData): FraudRing[] => {
    const rings: FraudRing[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    // Adjacency list
    const adj = new Map<string, string[]>();

    graph.links.forEach(link => {
        const src = typeof link.source === 'object' ? (link.source as Node).id : link.source;
        const tgt = typeof link.target === 'object' ? (link.target as Node).id : link.target;
        if (!adj.has(src)) adj.set(src, []);
        adj.get(src)!.push(tgt);
    });

    const path: string[] = [];

    // Simple DFS for cycle detection (limited depth 3-5)
    // Note: This is a simplified version. For large graphs, Johnson's algorithm is better but complex.
    // We use DFS with depth limit.

    const findCycles = (curr: string, start: string, depth: number) => {
        path.push(curr);
        visited.add(curr);

        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
            if (neighbor === start && depth >= 3 && depth <= 5) {
                // Found cycle
                const cycleMembers = [...path];
                // Check if this cycle is already recorded (simple distinct check)
                const sortedMembers = [...cycleMembers].sort().join(',');
                const exists = rings.some(r => [...r.members].sort().join(',') === sortedMembers);
                if (!exists) {
                    rings.push({
                        id: `RING_${rings.length + 1}`,
                        type: 'cycle',
                        riskScore: 90, // Cycles are high risk
                        members: cycleMembers,
                        patternDetails: `Circular flow of length ${depth}`
                    });
                }
            } else if (!path.includes(neighbor) && depth < 5) {
                findCycles(neighbor, start, depth + 1);
            }
        }

        path.pop();
        visited.delete(curr); // Backtrack allows finding all cycles
    };

    // Run for each node
    graph.nodes.forEach(node => {
        findCycles(node.id, node.id, 1);
    });

    return rings;
};

const hasHighVelocity = (timestamps: string[], countThreshold: number, windowHours: number): boolean => {
    if (timestamps.length < countThreshold) return false;

    const times = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    const windowMs = windowHours * 60 * 60 * 1000;

    for (let i = 0; i <= times.length - countThreshold; i++) {
        const start = times[i];
        const end = times[i + countThreshold - 1]; // e.g., if threshold is 10, index i+9
        if (end - start <= windowMs) {
            return true;
        }
    }
    return false;
};

export const detectSmurfing = (graph: GraphData): FraudRing[] => {
    const rings: FraudRing[] = [];

    graph.nodes.forEach(node => {
        // Fan-in: 10+ senders -> 1 receiver WITHIN 72 HOURS
        if (node.inDegree >= 10 && node.outDegree <= 1) {
            const incomingLinks = graph.links.filter(l => (typeof l.target === 'object' ? (l.target as Node).id : l.target) === node.id);
            const senders = incomingLinks.map(l => (typeof l.source === 'object' ? (l.source as Node).id : l.source));
            const uniqueSenders = new Set(senders);

            if (uniqueSenders.size >= 10) {
                // Check temporal condition
                const timestamps = incomingLinks.map(l => l.timestamp);
                if (hasHighVelocity(timestamps, 10, 72)) {
                    rings.push({
                        id: `FANIN_${rings.length + 1}`,
                        type: 'fan_in',
                        riskScore: 85, // Increased confidence due to time window
                        members: [node.id, ...Array.from(uniqueSenders)],
                        patternDetails: `Fan-in: ${uniqueSenders.size} accounts sending to ${node.id} within 72h`
                    });
                }
            }
        }

        // Fan-out: 1 sender -> 10+ receivers WITHIN 72 HOURS
        if (node.outDegree >= 10 && node.inDegree <= 1) {
            const outgoingLinks = graph.links.filter(l => (typeof l.source === 'object' ? (l.source as Node).id : l.source) === node.id);
            const receivers = outgoingLinks.map(l => (typeof l.target === 'object' ? (l.target as Node).id : l.target));
            const uniqueReceivers = new Set(receivers);

            if (uniqueReceivers.size >= 10) {
                // Check temporal condition
                const timestamps = outgoingLinks.map(l => l.timestamp);
                if (hasHighVelocity(timestamps, 10, 72)) {
                    rings.push({
                        id: `FANOUT_${rings.length + 1}`,
                        type: 'fan_out',
                        riskScore: 85,
                        members: [node.id, ...Array.from(uniqueReceivers)],
                        patternDetails: `Fan-out: ${node.id} sending to ${uniqueReceivers.size} accounts within 72h`
                    });
                }
            }
        }
    });

    return rings;
};

export const detectShells = (graph: GraphData): FraudRing[] => {
    const rings: FraudRing[] = [];
    const shellCandidates = new Set<string>();

    // Identify potential shell accounts (low volume intermediaries)
    graph.nodes.forEach(node => {
        const totalTx = node.inDegree + node.outDegree;
        // Requirement: "intermediate accounts have only 2–3 total transactions"
        if (totalTx >= 2 && totalTx <= 3 && node.inDegree > 0 && node.outDegree > 0) {
            shellCandidates.add(node.id);
        }
    });

    const adj = new Map<string, string[]>();
    graph.links.forEach(l => {
        const src = typeof l.source === 'object' ? (l.source as Node).id : l.source;
        const tgt = typeof l.target === 'object' ? (l.target as Node).id : l.target;
        if (!adj.has(src)) adj.set(src, []);
        adj.get(src)!.push(tgt);
    });

    // DFS to find chains: Start -> Shell -> ... -> Shell -> End
    const findShellChains = (curr: string, path: string[]) => {
        path.push(curr);

        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
            if (shellCandidates.has(neighbor)) {
                // Continue chain if not revisiting
                if (!path.includes(neighbor)) {
                    findShellChains(neighbor, path);
                }
            } else {
                // Potential end of chain
                // Valid chain: Non-Shell -> Shell -> ... -> Shell -> Non-Shell
                // Check length. "3+ hops" means 4 nodes: Start, S1, S2, End.
                // Current path has [Start, S1, S2]. Neighbor is End.
                if (path.length >= 3) {
                    // Ensure at least intermediate nodes are shells (guaranteed by recursion logic)
                    // and check we have actual shell content
                    const hasShells = path.some(p => shellCandidates.has(p));
                    if (hasShells) {
                        const fullChain = [...path, neighbor];

                        // Simple check to avoid duplicates or sub-segments
                        const chainId = fullChain.join('->');
                        const exists = rings.some(r => r.members.join('->').includes(chainId) || chainId.includes(r.members.join('->')));

                        if (!exists) {
                            rings.push({
                                id: `SHELL_${rings.length + 1}`,
                                type: 'shell', // matches FraudRing type definition in types/index.ts? Need to check.
                                riskScore: 85,
                                members: fullChain,
                                patternDetails: `Layered Shell Chain: ${fullChain.length - 1} hops`
                            });
                        }
                    }
                }
            }
        }
        path.pop();
    };

    graph.nodes.forEach(node => {
        // Start DFS from non-shell nodes
        if (!shellCandidates.has(node.id)) {
            findShellChains(node.id, []);
        }
    });

    return rings;
};

// Main Analysis Function
export const analyzeGraph = (transactions: Transaction[]): AnalysisResult => {
    const startTime = performance.now();

    const graph = buildGraph(transactions);
    const cycles = detectCycles(graph);
    const smurfs = detectSmurfing(graph);
    const shells = detectShells(graph);

    const allRings = [...cycles, ...smurfs, ...shells];

    const suspiciousAccounts: SuspiciousAccount[] = [];
    const flaggedNodeIds = new Set<string>();

    // Mark nodes
    allRings.forEach(ring => {
        ring.members.forEach(memberId => {
            const node = graph.nodes.find(n => n.id === memberId);
            if (node) {
                if (!node.patterns.includes(ring.type)) node.patterns.push(ring.type);
                node.riskScore = Math.max(node.riskScore, ring.riskScore);
                flaggedNodeIds.add(memberId);
            }
        });
    });

    // Generate suspicious accounts list
    flaggedNodeIds.forEach(id => {
        const node = graph.nodes.find(n => n.id === id);
        if (node) {
            suspiciousAccounts.push({
                account_id: node.id,
                suspicion_score: node.riskScore,
                detected_patterns: node.patterns,
                ring_id: allRings.find(r => r.members.includes(id))?.id
            });
        }
    });

    // Sort by score
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
            total_transactions: transactions.length
        }
    };
};
