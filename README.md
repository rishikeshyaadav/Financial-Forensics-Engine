# Money Muling Detection Engine

A sophisticated financial forensics tool designed to detect and visualize money muling networks, smurfing patterns, and circular fund routing using advanced graph algorithms.

## Features

- **Interactive 3D Graph Visualization**: View transaction networks in a 3D space with "sphere" nodes representing accounts.
- **Automated Pattern Detection**:
  - **Cycle Detection**: Identifies circular money flows (Length 3-5).
  - **Smurfing (Fan-in/Fan-out)**: Detects aggregators and dispersers.
  - **Suspicious Account Scoring**: Assigns risk scores based on patterns.
- **Premium Dashboard**: Warm Light Theme designed for professional financial analysis.
- **Client-Side Processing**: Secure analysis within your browser; no data is uploaded to external servers.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run the Development Server**:
   ```bash
   npm run dev
   ```

3. **Open the Application**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Use

1. **Upload Data**: Drag and drop a CSV file containing transaction data.
2. **Explore the Graph**:
   - **Rotate**: Left-click and drag.
   - **Zoom**: Scroll wheel.
   - **Focus**: Click on a node to focus.
3. **Analyze Results**:
   - Check the **Fraud Rings** tab for detected groups.
   - Check **Suspicious Accounts** for risk scores.
   - **Export Report**: Download the comprehensive JSON analysis.

## Input CSV Format

Ensure your CSV has the following columns:
- `transaction_id`: Unique ID
- `sender_id`: Sender Account ID
- `receiver_id`: Receiver Account ID
- `amount`: Numeric value
- `timestamp`: Date/Time string

Example:
```csv
transaction_id,sender_id,receiver_id,amount,timestamp
TX001,ACC_A,ACC_B,5000,2023-01-01 10:00:00
TX002,ACC_B,ACC_C,4900,2023-01-01 10:05:00
TX003,ACC_C,ACC_A,4800,2023-01-01 10:10:00
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4, Framer Motion
- **Visualization**: react-force-graph-3d, Three.js
- **Logic**: Custom TypseScript Graph Algorithms
