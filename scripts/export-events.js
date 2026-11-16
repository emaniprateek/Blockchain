const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // ← your current address
  const c = await hre.ethers.getContractAt("SupplierCompliance", addr);

  const events = [
    "SupplierRegistered",
    "ResourceRegistered",
    "ResourceUpdated",
    "SupplierDeactivated",
    "PenaltyPaid",
    "SupplierReactivated",
  ];

  let output = "SUPPLIER COMPLIANCE — EVENT LOG EXPORT\n";
  output += "=======================================\n";
  output += `Contract: ${addr}\n`;
  output += `Exported: ${new Date().toISOString()}\n\n`;

  for (const name of events) {
    const logs = await c.queryFilter(c.filters[name]());
    output += `\n--- ${name} (${logs.length} events) ---\n`;
    for (const log of logs) {
      // Convert BigInt args to strings so JSON.stringify works
      const args = log.args.map((a) =>
        typeof a === "bigint" ? a.toString() : a
      );
      output += `Block ${log.blockNumber} | TX ${log.transactionHash}\n`;
      output += `  ${JSON.stringify(args)}\n`;
    }
  }

  fs.writeFileSync("events-log.txt", output);
  console.log("✅ Exported to events-log.txt\n");
  console.log(output);
}

main().catch(console.error);