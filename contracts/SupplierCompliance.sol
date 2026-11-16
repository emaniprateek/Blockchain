// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
contract SupplierCompliance {
    uint256 public constant REGISTRATION_FEE = 100000 wei;
    uint256 public constant COMPLIANCE_PERIOD = 1 days; 

    // Chainlink Price Feeds
    AggregatorV3Interface internal ethUsdFeed;
    uint256 public usdToInrRate = 8300000000; // 83.00 INR per USD (8 decimals)

    enum ResourceType { Water, Clothing, Medicine, Food }

    struct Resource {
        ResourceType rType;
        uint256 quantity;
        uint256 lastUpdated;
        bool registered;
    }

    struct Supplier {
        address wallet;
        uint256 registeredAt;
        bool verified;
        bool active;
        uint256 deactivatedAt;
        uint256 totalPenaltyPaid;
        ResourceType[] registeredResources;
        mapping(ResourceType => Resource) resources;
    }

    mapping(address => Supplier) private suppliers;
    address[] private supplierList;
    uint256 public totalPenaltiesCollected;

    event SupplierRegistered(address indexed supplier, uint256 timestamp);
    event ResourceRegistered(address indexed supplier, string resource);
    event ResourceUpdated(address indexed supplier, string resource, uint256 quantity);
    event SupplierDeactivated(address indexed supplier, uint256 timestamp);
    event PenaltyPaid(address indexed supplier, uint256 amount);
    event SupplierReactivated(address indexed supplier, uint256 timestamp);

    modifier onlyRegistered() {
        require(suppliers[msg.sender].verified, "Not a registered supplier");
        _;
    }

    modifier onlyActive() {
        require(suppliers[msg.sender].active, "Supplier is inactive");
        _;
    }

    constructor(address _ethUsdFeed) {
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
    }

    // ============================================================
    // CHAINLINK & CONVERSION FUNCTIONS
    // ============================================================
    function getLatestEthUsdPrice() public view returns (int256) {
        (, int256 answer, , , ) = ethUsdFeed.latestRoundData();
        require(answer > 0, "Invalid price");
        return answer; // 8 decimals
    }

    function getLiveEthInrPrice() public view returns (uint256) {
        int256 ethUsdPrice = getLatestEthUsdPrice();
        return (uint256(ethUsdPrice) * usdToInrRate) / 1e8;
    }

    function setUsdToInrRate(uint256 _rate) external {
        usdToInrRate = _rate;
    }

        function calculatePenaltyInINR(address supplier) public view returns (uint256) {
        uint256 penaltyWei = calculatePenalty(supplier);
        if (penaltyWei == 0) return 0;

        int256 ethUsdPrice = getLatestEthUsdPrice(); 
        
        // We multiply by 100 at the end to keep 2 decimal places (e.g., 34.50 INR = 3450)
        uint256 penaltyInr = (penaltyWei * uint256(ethUsdPrice) * usdToInrRate * 100) / 1e34;
        return penaltyInr;
    }

    // ============================================================
    // EXISTING LOGIC
    // ============================================================
    function registerSupplier() external payable {
        require(!suppliers[msg.sender].verified, "Already registered");
        require(msg.value == REGISTRATION_FEE, "Incorrect registration fee");

        Supplier storage s = suppliers[msg.sender];
        s.wallet = msg.sender;
        s.registeredAt = block.timestamp;
        s.verified = true;
        s.active = true;
        s.deactivatedAt = 0;

        supplierList.push(msg.sender);
        emit SupplierRegistered(msg.sender, block.timestamp);
    }

    function registerResource(uint8 rType, uint256 quantity) external onlyRegistered onlyActive {
        require(rType <= uint8(ResourceType.Food), "Invalid resource type");
        require(quantity > 0, "Quantity must be > 0");

        ResourceType rt = ResourceType(rType);
        Supplier storage s = suppliers[msg.sender];

        if (!s.resources[rt].registered) {
            s.resources[rt] = Resource({ rType: rt, quantity: quantity, lastUpdated: block.timestamp, registered: true });
            s.registeredResources.push(rt);
            emit ResourceRegistered(msg.sender, _resourceName(rt));
        } else {
            s.resources[rt].quantity += quantity;
            s.resources[rt].lastUpdated = block.timestamp;
            emit ResourceUpdated(msg.sender, _resourceName(rt), s.resources[rt].quantity);
        }
    }

    function updateResource(uint8 rType, uint256 quantity) external onlyRegistered onlyActive {
        require(rType <= uint8(ResourceType.Food), "Invalid resource type");
        require(quantity > 0, "Quantity must be > 0");

        ResourceType rt = ResourceType(rType);
        Supplier storage s = suppliers[msg.sender];
        require(s.resources[rt].registered, "Resource not registered");

        s.resources[rt].quantity = quantity;
        s.resources[rt].lastUpdated = block.timestamp;

        emit ResourceUpdated(msg.sender, _resourceName(rt), quantity);
    }

    function isCompliant(address supplier) public view returns (bool) {
        Supplier storage s = suppliers[supplier];
        if (!s.verified || !s.active) return false;
        for (uint256 i = 0; i < s.registeredResources.length; i++) {
            ResourceType rt = s.registeredResources[i];
            if (block.timestamp > s.resources[rt].lastUpdated + COMPLIANCE_PERIOD) return false;
        }
        return true;
    }

    function remainingComplianceTime(address supplier, uint8 rType) external view returns (uint256) {
        Supplier storage s = suppliers[supplier];
        ResourceType rt = ResourceType(rType);
        if (!s.resources[rt].registered) return 0;
        uint256 deadline = s.resources[rt].lastUpdated + COMPLIANCE_PERIOD;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function checkAndDeactivate(address supplier) external {
        Supplier storage s = suppliers[supplier];
        require(s.verified, "Supplier not verified");
        require(s.active, "Already inactive");
        require(!isCompliant(supplier), "Supplier is compliant");

        s.active = false;
        s.deactivatedAt = block.timestamp;
        emit SupplierDeactivated(supplier, block.timestamp);
    }

    function calculatePenalty(address supplier) public view returns (uint256) {
        Supplier storage s = suppliers[supplier];
        if (s.active || s.deactivatedAt == 0) return 0;

        uint256 daysInactive = (block.timestamp - s.deactivatedAt) / 1 days;
        if (daysInactive == 0) return 200000 wei;           
        if (daysInactive <= 7) return 400000 wei;           
        if (daysInactive <= 21) return 800000 wei;          
        return 1000000 wei;                                 
    }

    function payPenaltyAndReactivate() external payable onlyRegistered {
        Supplier storage s = suppliers[msg.sender];
        require(!s.active, "Supplier already active");

        uint256 penalty = calculatePenalty(msg.sender);
        require(msg.value == penalty, "Incorrect penalty amount");

        s.active = true;
        s.deactivatedAt = 0;
        s.totalPenaltyPaid += penalty;
        totalPenaltiesCollected += penalty;

        for (uint256 i = 0; i < s.registeredResources.length; i++) {
            ResourceType rt = s.registeredResources[i];
            s.resources[rt].lastUpdated = block.timestamp;
        }

        emit PenaltyPaid(msg.sender, penalty);
        emit SupplierReactivated(msg.sender, block.timestamp);
    }

    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    function getSupplier(address addr) external view returns (
        address wallet, uint256 registeredAt, bool verified, bool active,
        uint256 deactivatedAt, uint256 totalPenaltyPaid, uint256 resourceCount
    ) {
        Supplier storage s = suppliers[addr];
        return (s.wallet, s.registeredAt, s.verified, s.active, s.deactivatedAt, s.totalPenaltyPaid, s.registeredResources.length);
    }

    function getSupplierResource(address supplier, uint8 rType) external view returns (uint256 quantity, uint256 lastUpdated, bool registered) {
        Resource storage r = suppliers[supplier].resources[ResourceType(rType)];
        return (r.quantity, r.lastUpdated, r.registered);
    }

    function getTotalSuppliers() external view returns (uint256) { return supplierList.length; }
    function getActiveSuppliers() external view returns (uint256 count) {
        for (uint256 i = 0; i < supplierList.length; i++) {
            if (suppliers[supplierList[i]].active) count++;
        }
    }
    function getInactiveSuppliers() external view returns (uint256 count) {
        for (uint256 i = 0; i < supplierList.length; i++) {
            if (!suppliers[supplierList[i]].active) count++;
        }
    }
    function getVerifiedSuppliers() external view returns (uint256 count) {
        for (uint256 i = 0; i < supplierList.length; i++) {
            if (suppliers[supplierList[i]].verified) count++;
        }
    }
    function getSuppliersByResource(uint8 rType) external view returns (uint256 count) {
        ResourceType rt = ResourceType(rType);
        for (uint256 i = 0; i < supplierList.length; i++) {
            if (suppliers[supplierList[i]].resources[rt].registered) count++;
        }
    }
    function getAggregateQuantity(uint8 rType) external view returns (uint256 total) {
        ResourceType rt = ResourceType(rType);
        for (uint256 i = 0; i < supplierList.length; i++) {
            total += suppliers[supplierList[i]].resources[rt].quantity;
        }
    }
    function getAllSupplierAddresses() external view returns (address[] memory) { return supplierList; }

    function _resourceName(ResourceType rt) internal pure returns (string memory) {
        if (rt == ResourceType.Water) return "Water";
        if (rt == ResourceType.Clothing) return "Clothing";
        if (rt == ResourceType.Medicine) return "Medicine";
        return "Food";
    }
}