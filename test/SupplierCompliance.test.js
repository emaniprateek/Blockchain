const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplierCompliance", function () {
  let contract, owner, s1, s2;
  const FEE = ethers.parseUnits("100000", "wei");

  beforeEach(async () => {
    [owner, s1, s2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SupplierCompliance");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("Should register supplier with correct fee", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    const s = await contract.getSupplier(s1.address);
    expect(s.verified).to.equal(true);
    expect(s.active).to.equal(true);
  });

  it("Should reject wrong registration fee", async () => {
    await expect(
      contract.connect(s1).registerSupplier({ value: 50000 })
    ).to.be.revertedWith("Incorrect registration fee");
  });

  it("Should prevent duplicate registration", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await expect(
      contract.connect(s1).registerSupplier({ value: FEE })
    ).to.be.revertedWith("Already registered");
  });

  it("Should register resource", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100); // Water
    const r = await contract.getSupplierResource(s1.address, 0);
    expect(r.quantity).to.equal(100);
    expect(r.registered).to.equal(true);
  });

  it("Should reject invalid resource", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await expect(
      contract.connect(s1).registerResource(99, 100)
    ).to.be.revertedWith("Invalid resource type");
  });

  it("Should update resource quantity", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100);
    await contract.connect(s1).updateResource(0, 250);
    const r = await contract.getSupplierResource(s1.address, 0);
    expect(r.quantity).to.equal(250);
  });

  it("Should be compliant immediately after registration", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100);
    expect(await contract.isCompliant(s1.address)).to.equal(true);
  });

  it("Should prevent inactive supplier from updating", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100);

    // Simulate non-compliance by advancing time
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await contract.checkAndDeactivate(s1.address);

    await expect(
      contract.connect(s1).updateResource(0, 200)
    ).to.be.revertedWith("Supplier is inactive");
  });

  it("Should calculate correct penalty", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await contract.checkAndDeactivate(s1.address);

    // 0-1 day penalty = 200000
    const penalty = await contract.calculatePenalty(s1.address);
    expect(penalty).to.equal(ethers.parseUnits("200000", "wei"));
  });

  it("Should reactivate after paying penalty", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s1).registerResource(0, 100);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");

    await contract.checkAndDeactivate(s1.address);
    const penalty = await contract.calculatePenalty(s1.address);

    await contract.connect(s1).payPenaltyAndReactivate({ value: penalty });

    const s = await contract.getSupplier(s1.address);
    expect(s.active).to.equal(true);
  });

  it("Should aggregate resource quantities", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s2).registerSupplier({ value: FEE });

    await contract.connect(s1).registerResource(0, 100);
    await contract.connect(s2).registerResource(0, 250);

    const total = await contract.getAggregateQuantity(0);
    expect(total).to.equal(350);
  });

  it("Should count active and inactive suppliers", async () => {
    await contract.connect(s1).registerSupplier({ value: FEE });
    await contract.connect(s2).registerSupplier({ value: FEE });

    expect(await contract.getTotalSuppliers()).to.equal(2);
    expect(await contract.getActiveSuppliers()).to.equal(2);

    await contract.connect(s2).registerResource(3, 50);
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await contract.checkAndDeactivate(s2.address);

    expect(await contract.getActiveSuppliers()).to.equal(1);
    expect(await contract.getInactiveSuppliers()).to.equal(1);
  });
});