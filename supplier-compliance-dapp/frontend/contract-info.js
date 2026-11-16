// AUTO-GENERATED — DO NOT EDIT
window.CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Update this if your deploy address is different
window.CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "string", "name": "name", "type": "string"}],
    "name": "registerSupplier",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint8", "name": "rType", "type": "uint8"}, {"internalType": "uint256", "name": "quantity", "type": "uint256"}],
    "name": "registerResource",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint8", "name": "rType", "type": "uint8"}, {"internalType": "uint256", "name": "quantity", "type": "uint256"}],
    "name": "updateResource",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalSuppliers",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "addr", "type": "address"}],
    "name": "getSupplier",
    "outputs": [
      {"internalType": "address", "name": "wallet", "type": "address"},
      {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
      {"internalType": "bool", "name": "verified", "type": "bool"},
      {"internalType": "bool", "name": "active", "type": "bool"},
      {"internalType": "uint256", "name": "deactivatedAt", "type": "uint256"},
      {"internalType": "uint256", "name": "totalPenaltyPaid", "type": "uint256"},
      {"internalType": "uint256", "name": "resourceCount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "supplier", "type": "address"}],
    "name": "isCompliant",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint8", "name": "rType", "type": "uint8"}],
    "name": "getAggregateQuantity",
    "outputs": [{"internalType": "uint256", "name": "total", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "supplier", "type": "address"}],
    "name": "calculatePenalty",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "payPenaltyAndReactivate",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "supplier", "type": "address"}],
    "name": "checkAndDeactivate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "supplier", "type": "address"}, {"internalType": "uint8", "name": "rType", "type": "uint8"}],
    "name": "getSupplierResource",
    "outputs": [
      {"internalType": "uint256", "name": "quantity", "type": "uint256"},
      {"internalType": "uint256", "name": "lastUpdated", "type": "uint256"},
      {"internalType": "bool", "name": "registered", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveSuppliers",
    "outputs": [{"internalType": "uint256", "name": "count", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getInactiveSuppliers",
    "outputs": [{"internalType": "uint256", "name": "count", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalPenaltiesCollected",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];