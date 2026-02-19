export interface Transaction {
    transaction_id: string;
    sender_id: string;
    receiver_id: string;
    amount: number;
    timestamp: string;
}

export interface Node {
    id: string;
    riskScore: number;
    flags: string[];
    patterns: string[];
    inDegree: number;
    outDegree: number;
    totalIn: number;
    totalOut: number;
    // Visualization properties
    color?: string;
    val?: number; // size
    x?: number;
    y?: number;
    z?: number;
}

export interface Link {
    source: string | Node;
    target: string | Node;
    amount: number;
    timestamp: string;
    transaction_id: string;
}

export interface GraphData {
    nodes: Node[];
    links: Link[];
}

export interface FraudRing {
    id: string; // e.g., "RING_001"
    type: 'cycle' | 'fan_in' | 'fan_out' | 'shell';
    riskScore: number;
    members: string[]; // Account IDs
    patternDetails: string; // Description of the pattern
}

export interface SuspiciousAccount {
    account_id: string;
    suspicion_score: number;
    detected_patterns: string[];
    ring_id?: string;
}

export interface AnalysisResult {
    graph: GraphData;
    fraudRings: FraudRing[];
    suspiciousAccounts: SuspiciousAccount[];
    processingTime: number;
    summary: {
        total_accounts: number;
        flagged_accounts: number;
        rings_detected: number;
        total_transactions: number;
    };
}
