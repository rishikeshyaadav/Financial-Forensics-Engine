# 🛡️ Financial Forensics Engine

**Graph-Based Money Muling Detection System** — RIFT 2026 Hackathon • Graph Theory Track

> Detects circular fund routing, smurfing patterns, and layered shell networks using real-time graph analysis and interactive 3D visualization.

## 🌐 Live Demo

**[https://money-muling-engine-five.vercel.app](https://money-muling-engine-five.vercel.app)**

## 📐 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4, Framer Motion |
| **Visualization** | react-force-graph-3d, Three.js (WebGL) |
| **CSV Parsing** | PapaParse |
| **Graph Algorithms** | Custom TypeScript implementation |
| **Deployment** | Vercel |

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Client-Side)                  │
├──────────────┬───────────────┬───────────────────────────┤
│  FileUpload  │   Dashboard   │     GraphViz3D            │
│  (CSV Parse) │  (Orchestrate)│  (3D Visualization)       │
├──────────────┴───────┬───────┴───────────────────────────┤
│           graph-analysis.ts (Core Engine)                 │
│  ┌─────────┐ ┌──────────────┐ ┌────────────────────┐     │
│  │ Cycle   │ │  Smurfing    │ │  Shell Network     │     │
│  │Detector │ │  Detector    │ │  Detector          │     │
│  │(DFS)    │ │(Fan-in/out)  │ │(Chain traversal)   │     │
│  └─────────┘ └──────────────┘ └────────────────────┘     │
├──────────────────────────────────────────────────────────┤
│              types/index.ts (Type Definitions)            │
└──────────────────────────────────────────────────────────┘
```

All processing happens **client-side** — no transaction data is uploaded to any server.

## 🔬 Algorithm Approach & Complexity Analysis

### 1. Circular Fund Routing (Cycle Detection)
- **Algorithm:** Recursive DFS with depth limit (3 ≤ depth ≤ 5)
- **Deduplication:** Sorted member key set prevents duplicate ring registration
- **Complexity:** O(N × d^5) where N = nodes, d = average out-degree
- **Space:** O(N) for path tracking via Set

### 2. Smurfing Detection (Fan-in / Fan-out)
- **Algorithm:** Degree-based filtering + 72-hour temporal sliding window
- **Fan-in criteria:** inDegree ≥ 10, outDegree ≤ 2, 10+ unique senders within 72h
- **Fan-out criteria:** outDegree ≥ 10, inDegree ≤ 2, 10+ unique receivers within 72h
- **False Positive Guard:** Accounts with both high in-degree AND high out-degree (≥5 each) are skipped — these are likely legitimate merchants or payroll accounts
- **Temporal check complexity:** O(T log T) for sorting timestamps per node
- **Overall:** O(N × T_max) where T_max = max transactions per node

### 3. Layered Shell Networks
- **Algorithm:** DFS chain traversal starting from non-shell nodes
- **Shell criteria:** Total transactions = 2–3, with both in and out edges
- **Chain requirement:** 3+ hops (4+ nodes) with at least one shell intermediary
- **Complexity:** O(N × chain_length) with visited-set pruning

### Pre-computed Data Structures
- Adjacency list, link-by-source map, link-by-target map: all O(L) construction
- Node lookup map: O(N) construction, O(1) access

### Overall Performance
- **Build graph:** O(T) where T = transactions
- **Full analysis:** O(T + N × d^5) — dominated by cycle detection
- **Tested:** ≤ 30s for datasets up to 10K transactions

## 📊 Suspicion Score Methodology

Suspicion scores are computed using a **weighted multi-factor model**:

| Factor | Points | Rationale |
|--------|--------|-----------|
| Cycle membership | +50 | Circular routing is strongest indicator |
| Fan-in pattern | +30 | Aggregation behavior |
| Fan-out pattern | +30 | Dispersal behavior |
| Shell layering | +25 | Intermediate hop involvement |
| High velocity (72h) | +15 | Temporal clustering bonus |

- **Score range:** 0–100 (capped)
- **Sorted:** Descending by score in output
- **Multiple patterns stack:** A node in both a cycle and a fan-in gets 50 + 30 + 15 = 95

### False Positive Control Mechanisms
1. **Merchant/Payroll Guard:** Nodes with both inDegree ≥ 5 AND outDegree ≥ 5 are excluded from smurfing detection — legitimate high-volume actors exhibit balanced bidirectional flow
2. **Temporal Window:** Only 72-hour clustered transactions trigger smurfing alerts
3. **Minimum Thresholds:** 10+ unique counterparts required for fan-in/fan-out

## 📥 Input CSV Format

```csv
transaction_id,sender_id,receiver_id,amount,timestamp
TX001,ACC_A,ACC_B,5000.00,2023-01-01 10:00:00
TX002,ACC_B,ACC_C,4900.00,2023-01-01 10:05:00
TX003,ACC_C,ACC_A,4800.00,2023-01-01 10:10:00
```

| Column | Type | Description |
|--------|------|-------------|
| `transaction_id` | String | Unique transaction identifier |
| `sender_id` | String | Sender account ID (graph node) |
| `receiver_id` | String | Receiver account ID (graph node) |
| `amount` | Float | Transaction amount |
| `timestamp` | DateTime | Format: `YYYY-MM-DD HH:MM:SS` |

## 📤 JSON Output Format

```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00123",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle", "cycle_length_3", "high_velocity"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_00123", "ACC_00456", "ACC_00789"],
      "pattern_type": "cycle",
      "risk_score": 90.0
    }
  ],
  "summary": {
    "total_accounts_analyzed": 500,
    "suspicious_accounts_flagged": 15,
    "fraud_rings_detected": 4,
    "processing_time_seconds": 2.3
  }
}
```

## 🚀 Installation & Setup

```bash
# Clone the repository
git clone https://github.com/rishikeshyaadav/Financial-Forensics-Engine.git
cd Financial-Forensics-Engine

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Instructions

1. **Upload CSV:** Drag & drop or click the upload area on the homepage
2. **Explore the Network Graph:**
   - **Rotate:** Left-click + drag
   - **Zoom:** Scroll wheel
   - **Hover:** See account details (ID, risk score, transaction volumes, detected patterns)
   - **Click node:** Camera focuses on that account
3. **Review Fraud Rings:** Switch to the Fraud Rings tab. Click any ring row to highlight it in the graph.
4. **Inspect Suspicious Accounts:** View the full list sorted by suspicion score
5. **Export Report:** Click the "Export JSON" button for the structured JSON output file

## ⚠️ Known Limitations

1. **Cycle detection scalability:** DFS with depth limit 3-5 is sufficient for datasets up to ~10K transactions but may slow down on significantly larger graphs. Johnson's algorithm would be more efficient for large-scale production use.
2. **Client-side processing:** All computation happens in the browser's main thread. For datasets > 10K transactions, a Web Worker or server-side engine would improve responsiveness.
3. **No weighted scoring for amounts:** The current suspicion score is pattern-based. Amount anomalies (e.g., structuring just below reporting thresholds) are not factored into the score.
4. **Static thresholds:** The 72-hour window and 10+ counterpart thresholds are hardcoded. An adaptive approach would learn thresholds from the data distribution.
5. **Single CSV upload:** The engine analyzes one dataset at a time. Incremental/streaming analysis is not supported.

## 👤 Team Members

- **Rishikesh Yadav** — Full Stack Developer

---

*Built for RIFT 2026 Hackathon — Graph Theory / Financial Crime Detection Track*

`#RIFTHackathon #MoneyMulingDetection #FinancialCrime`
