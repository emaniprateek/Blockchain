# Blockchain Supplier Compliance & Resource Management DApp

A decentralized application built with **Solidity**, **Hardhat**, and **Ethers.js** for managing humanitarian suppliers, resources, compliance, penalties, and reactivation on an Ethereum-compatible blockchain.

## Features

- Supplier registration with 100,000 wei fee
- Predefined resources: Water, Clothing, Medicine, Food
- One-day compliance mechanism using `block.timestamp`
- Automatic detection of non-compliance & supplier deactivation
- Duration-based penalty system with reactivation
- On-chain statistics for suppliers & resources
- Full event logging for auditability
- Beautiful dark-mode frontend

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Compile contract
```bash
npm run compile
```

### 3. Start local blockchain (Terminal 1)
```bash
npm run node
```

### 4. Deploy contract (Terminal 2)
```bash
npm run deploy
```

This writes `frontend/contract-info.js` with the deployed address and ABI.

### 5. Open frontend
Serve the `frontend/` folder:
```bash
cd frontend
npx http-server -p 3000
```
Or open `frontend/index.html` directly in a browser.

### 6. Configure MetaMask
- Network: `Localhost 8545` (Chain ID 31337)
- Import one of the private keys printed by `npm run node`
- Connect wallet in the DApp

### 7. Run tests
```bash
npm test
```

## Deploy to GitHub Pages

1. Push the project to GitHub.
2. Go to **Settings → Pages**, source = `main` branch, folder = `/frontend`.
3. GitHub Pages will serve `index.html`.
4. Users will connect their own MetaMask; you may want to deploy the contract to a **testnet** (Sepolia) for public access.

> For testnet deployment, update `hardhat.config.js` with an RPC URL and deployer key, then run:
> `npx hardhat run scripts/deploy.js --network sepolia`

## Architecture

```
User (MetaMask) → Frontend (HTML/CSS/JS + Ethers.js)
                       ↓
              SupplierCompliance.sol (on-chain)
                       ↓
       Hardhat node / Ethereum testnet
```

## Business Rules

| Rule | Value |
|------|-------|
| Registration Fee | 100,000 wei |
| Compliance Period | 1 day |
| Penalty 0–1 day | 200,000 wei |
| Penalty 2–7 days | 400,000 wei |
| Penalty 8–21 days | 800,000 wei |
| Penalty >21 days | 1,000,000 wei |

## License

MIT