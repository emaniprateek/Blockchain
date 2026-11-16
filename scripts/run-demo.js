const hre = require("hardhat");

async function main() {
  // IMPORTANT: Replace with your actual deployed contract address
  const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const [s1, s2] = await hre.ethers.getSigners();
  const c = await hre.ethers.getContractAt("SupplierCompliance", addr);
  const names = ["Water", "Clothing", "Medicine", "Food"];

  console.log("\n==============================================");
  console.log("SUPPLIER COMPLIANCE - FULL DEMONSTRATION");
  console.log("==============================================");
  console.log("Contract:", addr);
  console.log("Supplier 1:", s1.address);
  console.log("Supplier 2:", s2.address);

  // STEP 1: Register Supplier 1
  console.log("\n--- STEP 1: Register Supplier 1 ---");
  const reg = await c.getSupplier(s1.address);
  if (!reg.verified) {
    const tx = await c.connect(s1).registerSupplier({ value: 100000n });
    const rc = await tx.wait();
    console.log("✅ Registered. TX:", rc.hash);
  } else {
    console.log("Already registered.");
  }

  // STEP 2: Register Resources
  console.log("\n--- STEP 2: Register Resources ---");
  const initialQty = [1000, 300, 200, 750];
  for (let i = 0; i < 4; i++) {
    const r = await c.getSupplierResource(s1.address, i);
    if (!r.registered) {
      const tx = await c.connect(s1).registerResource(i, initialQty[i]);
      const rc = await tx.wait();
      console.log(`✅ ${names[i]} registered (qty ${initialQty[i]}). TX: ${rc.hash}`);
    } else {
      console.log(`   ${names[i]} already registered.`);
    }
  }

  // STEP 3: Show Resources
  console.log("\n--- STEP 3: Current Resources for Supplier 1 ---");
  for (let i = 0; i < 4; i++) {
    const r = await c.getSupplierResource(s1.address, i);
    if (r.registered) {
      console.log(`  ${names[i].padEnd(10)} qty=${r.quantity} lastUpdated=${new Date(Number(r.lastUpdated) * 1000).toLocaleString()}`);
    }
  }

  // STEP 4: Aggregate Stats
  console.log("\n--- STEP 4: Aggregate Statistics ---");
  for (let i = 0; i < 4; i++) {
    const q = await c.getAggregateQuantity(i);
    const cnt = await c.getSuppliersByResource(i);
    console.log(`  ${names[i].padEnd(10)} totalQty=${q} suppliers=${cnt}`);
  }
  console.log("  Total Suppliers:", (await c.getTotalSuppliers()).toString());
  console.log("  Active Suppliers:", (await c.getActiveSuppliers()).toString());

  // STEP 5: Advance Time
  console.log("\n--- STEP 5: Advance Blockchain Time by 2 Days ---");
  await hre.network.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
  await hre.network.provider.send("evm_mine");
  console.log("✅ Time advanced.");

  // STEP 6: Compliance Check
  console.log("\n--- STEP 6: Compliance Check ---");
  const isCompliant = await c.isCompliant(s1.address);
  console.log("  Supplier 1 compliant?", isCompliant);
  if (!isCompliant) console.log("  ⚠️  NON-COMPLIANT DETECTED");

  // STEP 7: Deactivate
  console.log("\n--- STEP 7: Deactivate Non-Compliant Supplier ---");
  const s1info = await c.getSupplier(s1.address);
  if (s1info.active && !isCompliant) {
    const tx = await c.connect(s2).checkAndDeactivate(s1.address);
    const rc = await tx.wait();
    console.log("✅ Supplier 1 deactivated. TX:", rc.hash);
  } else if (!s1info.active) {
    console.log("Already inactive.");
  } else {
    console.log("Supplier is compliant — cannot deactivate.");
  }

  // STEP 8: Try Update While Inactive
  console.log("\n--- STEP 8: Try Update While Inactive (should FAIL) ---");
  try {
    await c.connect(s1).updateResource(0, 9999);
    console.log("❌ Unexpectedly succeeded (BUG!)");
  } catch (err) {
    console.log("✅ Correctly rejected:", err.reason || err.message);
  }

  // STEP 9: Calculate Penalty
  console.log("\n--- STEP 9: Calculate Penalty ---");
  const penalty = await c.calculatePenalty(s1.address);
  console.log("  Penalty due:", penalty.toString(), "wei");

  // STEP 10: Pay Penalty & Reactivate
  console.log("\n--- STEP 10: Pay Penalty & Reactivate ---");
  const tx10 = await c.connect(s1).payPenaltyAndReactivate({ value: penalty });
  const rc10 = await tx10.wait();
  console.log("✅ Reactivated. TX:", rc10.hash);

  // STEP 11: Post-Reactivation State
  console.log("\n--- STEP 11: Post-Reactivation State ---");
  const s1after = await c.getSupplier(s1.address);
  console.log("  Active?", s1after.active);
  console.log("  Total penalty paid by S1:", s1after.totalPenaltyPaid.toString(), "wei");
  console.log("  Total collected by contract:", (await c.totalPenaltiesCollected()).toString(), "wei");

  // STEP 12: Resume Updates
  console.log("\n--- STEP 12: Resume Updates (should SUCCEED) ---");
  const tx12 = await c.connect(s1).updateResource(0, 1500);
  const rc12 = await tx12.wait();
  console.log("✅ Water updated to 1500. TX:", rc12.hash);

  // STEP 13: Register Supplier 2
  console.log("\n--- STEP 13: Register Supplier 2 ---");
  const s2info = await c.getSupplier(s2.address);
  if (!s2info.verified) {
    const tx = await c.connect(s2).registerSupplier({ value: 100000n });
    const rc = await tx.wait();
    console.log("✅ Supplier 2 registered. TX:", rc.hash);
    const tx2 = await c.connect(s2).registerResource(3, 400);
    await tx2.wait();
    console.log("✅ Supplier 2 registered Food (400).");
  } else {
    console.log("Supplier 2 already registered.");
  }

  // STEP 14: Final Stats
  console.log("\n--- STEP 14: Final Statistics ---");
  console.log("  Total Suppliers:", (await c.getTotalSuppliers()).toString());
  console.log("  Active Suppliers:", (await c.getActiveSuppliers()).toString());
  console.log("  Inactive Suppliers:", (await c.getInactiveSuppliers()).toString());
  console.log("  Verified Suppliers:", (await c.getVerifiedSuppliers()).toString());
  console.log("  Total Penalties Collected:", (await c.totalPenaltiesCollected()).toString(), "wei");
  for (let i = 0; i < 4; i++) {
    const q = await c.getAggregateQuantity(i);
    const cnt = await c.getSuppliersByResource(i);
    console.log(`  ${names[i].padEnd(10)} aggregateQty=${q} suppliers=${cnt}`);
  }

  console.log("\n✅ DEMONSTRATION COMPLETE\n");
}

main().catch((err) => {
  console.error("ERROR:", err.reason || err.message || err);
  process.exit(1);
});