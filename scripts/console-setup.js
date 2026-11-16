// Paste this into the Hardhat console after running:
// npx hardhat console --network localhost

async function setup() {
  const addr = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const abi = require("../artifacts/contracts/SupplierCompliance.sol/SupplierCompliance.json").abi;
  const signers = await ethers.getSigners();
  const c = new ethers.Contract(addr, abi, signers[0]);

  console.log("✅ Setup complete");
  console.log("   Contract:", addr);
  console.log("   s1:", signers[0].address);
  console.log("   s2:", signers[1]?.address || "not loaded");

  return { addr, abi, s1: signers[0], s2: signers[1], c };
}

setup();