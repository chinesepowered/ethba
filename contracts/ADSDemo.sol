// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@worldcoin/world-id-contracts/src/interfaces/IWorldID.sol";
import "@worldcoin/world-id-contracts/src/libraries/ByteHasher.sol";

/**
 * @title ADS Platform Demo - Proportional Tranche Distribution
 * @notice DEMO VERSION with manual cycle progression and device-level verification
 * @dev Users click ads and claim proportional share of advertiser bids
 *
 * Demo Features:
 * - Manual cycle progression (anyone can trigger)
 * - Device-level World ID (groupId = 0)
 * - No time-based cycles - full control over progression
 *
 * World Chain Compatibility:
 * - Uses Permit2 for advertiser bids (no approve() needed)
 * - Direct transfer() for user claims and refunds
 */

// Permit2 interfaces
interface IPermit2 {
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

contract ADSDemo is Ownable, ReentrancyGuard {
    using ByteHasher for bytes;

    // ============ Types ============

    enum SlotType {
        GLOBAL,         // Anyone can claim
        US_ONLY,        // US IP addresses only
        AR_ONLY,        // Argentina IP addresses only
        EU_ONLY,        // EU IP addresses only
        ASIA_ONLY,      // Asia IP addresses only
        MOBILE_ONLY,    // Mobile devices only
        DESKTOP_ONLY,   // Desktop devices only
        IOS_ONLY,       // iOS devices only
        ANDROID_ONLY,   // Android devices only
        CUSTOM          // Custom targeting
    }

    struct AdSlot {
        address advertiser;
        string name;
        string description;
        string imageUrl;
        uint256 bidAmount;
        SlotType slotType;
        bool finalized;
        bool removed;
        uint256 totalClicks;
        uint256 claimedAmount;
        uint256 finalizedAt;
    }

    // ============ State Variables ============

    IERC20 public immutable WLD;
    IPermit2 public immutable permit2;
    IWorldID public immutable worldId;
    uint256 internal immutable externalNullifier;
    uint256 internal immutable groupId = 0; // DEMO: Device verification

    uint256 public constant AD_SLOTS_PER_CYCLE = 10;
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 public constant CLAIM_DEADLINE = 14 days;

    uint256 public currentCycle; // DEMO: Manual cycle counter
    uint256 public lastFinalizedCycle;

    // Mappings
    mapping(address => bool) public registered;
    mapping(address => bool) public bannedAdvertisers;
    mapping(address => bool) public authorizedSigners;
    mapping(uint256 => mapping(uint256 => AdSlot)) public adSlots;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClicked;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasClaimed;
    mapping(bytes32 => bool) public usedSignatures;

    uint256 public accumulatedFees;
    uint256 public lockedFunds;

    // ============ Events ============

    event UserRegistered(address indexed user);
    event AdBidPlaced(address indexed advertiser, uint256 indexed cycle, uint256 indexed slotIndex, SlotType slotType, uint256 bidAmount);
    event AdRemoved(address indexed advertiser, uint256 indexed cycle, uint256 indexed slotIndex);
    event ClickRecorded(address indexed user, uint256 indexed cycle, uint256 indexed slotIndex);
    event RewardClaimed(address indexed user, uint256 indexed cycle, uint256 indexed slotIndex, uint256 amount);
    event CycleFinalized(uint256 indexed cycle);
    event AdSlotFinalized(uint256 indexed cycle, uint256 indexed slotIndex, uint256 totalClicks);
    event ExpiredClaimCollected(uint256 indexed cycle, uint256 indexed slotIndex, uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event AdvertiserBanned(address indexed advertiser);
    event AdvertiserUnbanned(address indexed advertiser);

    // ============ Errors ============

    error NotRegistered();
    error AlreadyRegistered();
    error InvalidCycle();
    error InvalidSlot();
    error NotFinalized();
    error AlreadyFinalized();
    error AlreadyClicked();
    error AlreadyClaimed();
    error NotAuthorized();
    error TransferFailed();
    error InvalidAmount();
    error AdvertiserIsBanned();
    error AdWasRemoved();
    error ClaimDeadlinePassed();
    error ClaimDeadlineNotPassed();
    error NoClickRecorded();
    error SignatureAlreadyUsed();
    error NotAdvertiser();

    // ============ Constructor ============

    constructor(
        address _wldToken,
        address _permit2,
        address _worldId,
        string memory _appId,
        string memory _action
    ) Ownable(msg.sender) {
        WLD = IERC20(_wldToken);
        permit2 = IPermit2(_permit2);
        worldId = IWorldID(_worldId);
        externalNullifier = abi.encodePacked(abi.encodePacked(_appId).hashToField(), _action).hashToField();
    }

    // ============ Registration ============

    function register(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external nonReentrant {
        if (registered[msg.sender]) revert AlreadyRegistered();

        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            externalNullifier,
            proof
        );

        registered[msg.sender] = true;
        emit UserRegistered(msg.sender);
    }

    // ============ Advertiser Functions ============

    function placeAdBid(
        uint256 cycle,
        uint256 slotIndex,
        string calldata name,
        string calldata description,
        string calldata imageUrl,
        uint256 bidAmount,
        SlotType slotType,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant {
        if (bannedAdvertisers[msg.sender]) revert AdvertiserIsBanned();
        if (cycle != currentCycle) revert InvalidCycle();
        if (slotIndex >= AD_SLOTS_PER_CYCLE) revert InvalidSlot();

        AdSlot storage slot = adSlots[cycle][slotIndex];

        // Refund previous bidder if outbid
        if (slot.advertiser != address(0) && slot.bidAmount > 0) {
            bool refundSuccess = WLD.transfer(slot.advertiser, slot.bidAmount);
            if (!refundSuccess) revert TransferFailed();
            lockedFunds -= slot.bidAmount;
        }

        // Accept new bid via Permit2
        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2.SignatureTransferDetails({
            to: address(this),
            requestedAmount: bidAmount
        });

        permit2.permitTransferFrom(
            permit,
            transferDetails,
            msg.sender,
            signature
        );

        slot.advertiser = msg.sender;
        slot.name = name;
        slot.description = description;
        slot.imageUrl = imageUrl;
        slot.bidAmount = bidAmount;
        slot.slotType = slotType;

        lockedFunds += bidAmount;

        emit AdBidPlaced(msg.sender, cycle, slotIndex, slotType, bidAmount);
    }

    function removeAd(uint256 cycle, uint256 slotIndex) external nonReentrant {
        if (slotIndex >= AD_SLOTS_PER_CYCLE) revert InvalidSlot();

        AdSlot storage slot = adSlots[cycle][slotIndex];
        if (slot.advertiser != msg.sender) revert NotAdvertiser();
        if (slot.finalized) revert AlreadyFinalized();

        slot.removed = true;

        // Refund bid
        if (slot.bidAmount > 0) {
            lockedFunds -= slot.bidAmount;
            bool success = WLD.transfer(msg.sender, slot.bidAmount);
            if (!success) revert TransferFailed();
        }

        emit AdRemoved(msg.sender, cycle, slotIndex);
    }

    // ============ Click Recording ============

    function recordClick(
        uint256 cycle,
        uint256 slotIndex,
        uint256 nonce,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        if (!registered[msg.sender]) revert NotRegistered();
        if (cycle >= currentCycle) revert InvalidCycle();
        if (slotIndex >= AD_SLOTS_PER_CYCLE) revert InvalidSlot();

        AdSlot storage slot = adSlots[cycle][slotIndex];
        if (slot.finalized) revert AlreadyFinalized();
        if (slot.removed) revert AdWasRemoved();
        if (hasClicked[cycle][slotIndex][msg.sender]) revert AlreadyClicked();

        // Verify backend signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            cycle,
            slotIndex,
            nonce,
            timestamp
        ));

        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));

        if (usedSignatures[ethSignedHash]) revert SignatureAlreadyUsed();

        address signer = _recoverSigner(ethSignedHash, signature);
        if (!authorizedSigners[signer]) revert NotAuthorized();

        usedSignatures[ethSignedHash] = true;
        hasClicked[cycle][slotIndex][msg.sender] = true;
        slot.totalClicks++;

        emit ClickRecorded(msg.sender, cycle, slotIndex);
    }

    // ============ Reward Claiming ============

    function claimReward(
        uint256 cycle,
        uint256 slotIndex
    ) external nonReentrant {
        if (!registered[msg.sender]) revert NotRegistered();
        if (slotIndex >= AD_SLOTS_PER_CYCLE) revert InvalidSlot();

        AdSlot storage slot = adSlots[cycle][slotIndex];

        if (!slot.finalized) revert NotFinalized();
        if (slot.removed) revert AdWasRemoved();
        if (!hasClicked[cycle][slotIndex][msg.sender]) revert NoClickRecorded();
        if (hasClaimed[cycle][slotIndex][msg.sender]) revert AlreadyClaimed();

        if (block.timestamp > slot.finalizedAt + CLAIM_DEADLINE) {
            revert ClaimDeadlinePassed();
        }

        uint256 totalClicks = slot.totalClicks;
        if (totalClicks == 0) revert InvalidAmount();

        uint256 bidAmount = slot.bidAmount;
        uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
        uint256 availableAmount = bidAmount - feeAmount;
        uint256 userReward = availableAmount / totalClicks;

        hasClaimed[cycle][slotIndex][msg.sender] = true;
        slot.claimedAmount += userReward;

        bool success = WLD.transfer(msg.sender, userReward);
        if (!success) revert TransferFailed();

        emit RewardClaimed(msg.sender, cycle, slotIndex, userReward);
    }

    function collectExpiredClaims(
        uint256 cycle,
        uint256 slotIndex
    ) external nonReentrant {
        if (slotIndex >= AD_SLOTS_PER_CYCLE) revert InvalidSlot();

        AdSlot storage slot = adSlots[cycle][slotIndex];

        if (!slot.finalized) revert NotFinalized();
        if (block.timestamp <= slot.finalizedAt + CLAIM_DEADLINE) {
            revert ClaimDeadlineNotPassed();
        }

        uint256 bidAmount = slot.bidAmount;
        uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
        uint256 availableAmount = bidAmount - feeAmount;
        uint256 unclaimedAmount = availableAmount - slot.claimedAmount;

        if (unclaimedAmount == 0) revert InvalidAmount();

        slot.claimedAmount = availableAmount;

        bool success = WLD.transfer(owner(), unclaimedAmount);
        if (!success) revert TransferFailed();

        emit ExpiredClaimCollected(cycle, slotIndex, unclaimedAmount);
    }

    // ============ Cycle Management ============

    /**
     * @notice DEMO: Manually progress to next cycle - can be called by anyone
     * @dev Finalizes current cycle and increments counter
     */
    function progressCycle() external nonReentrant {
        if (currentCycle == 0) {
            // First cycle, just increment
            currentCycle = 1;
            emit CycleFinalized(0);
            return;
        }

        // Finalize the previous cycle if not already done
        uint256 cycleToFinalize = currentCycle - 1;
        if (cycleToFinalize > lastFinalizedCycle) {
            for (uint256 i = 0; i < AD_SLOTS_PER_CYCLE; i++) {
                _finalizeAdSlot(cycleToFinalize, i);
            }
            lastFinalizedCycle = cycleToFinalize;
        }

        // Move to next cycle
        currentCycle++;
        emit CycleFinalized(cycleToFinalize);
    }

    function _finalizeAdSlot(uint256 cycle, uint256 slotIndex) internal {
        AdSlot storage slot = adSlots[cycle][slotIndex];

        if (slot.advertiser == address(0)) {
            slot.finalized = true;
            return;
        }

        if (slot.removed) {
            slot.finalized = true;
            return;
        }

        uint256 bidAmount = slot.bidAmount;
        uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;

        accumulatedFees += feeAmount;
        lockedFunds -= bidAmount;

        slot.finalized = true;
        slot.finalizedAt = block.timestamp;

        emit AdSlotFinalized(cycle, slotIndex, slot.totalClicks);
    }

    // ============ View Functions ============

    function getCurrentCycle() external view returns (uint256) {
        return currentCycle;
    }

    function getCurrentAds() external view returns (AdSlot[] memory) {
        AdSlot[] memory ads = new AdSlot[](AD_SLOTS_PER_CYCLE);

        for (uint256 i = 0; i < AD_SLOTS_PER_CYCLE; i++) {
            ads[i] = adSlots[currentCycle][i];
        }

        return ads;
    }

    function calculateUserReward(
        uint256 cycle,
        uint256 slotIndex,
        address user
    ) external view returns (uint256) {
        AdSlot storage slot = adSlots[cycle][slotIndex];

        if (!hasClicked[cycle][slotIndex][user]) return 0;
        if (hasClaimed[cycle][slotIndex][user]) return 0;
        if (!slot.finalized) return 0;
        if (slot.totalClicks == 0) return 0;

        uint256 bidAmount = slot.bidAmount;
        uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
        uint256 availableAmount = bidAmount - feeAmount;

        return availableAmount / slot.totalClicks;
    }

    function getUserClaimableRewards(address user) external view returns (
        uint256[] memory cycles,
        uint256[] memory slots,
        uint256[] memory amounts
    ) {
        uint256 maxClaims = currentCycle * AD_SLOTS_PER_CYCLE;

        uint256[] memory tempCycles = new uint256[](maxClaims);
        uint256[] memory tempSlots = new uint256[](maxClaims);
        uint256[] memory tempAmounts = new uint256[](maxClaims);
        uint256 count = 0;

        for (uint256 c = 0; c <= currentCycle; c++) {
            for (uint256 s = 0; s < AD_SLOTS_PER_CYCLE; s++) {
                AdSlot storage slot = adSlots[c][s];

                if (hasClicked[c][s][user] &&
                    !hasClaimed[c][s][user] &&
                    slot.finalized &&
                    block.timestamp <= slot.finalizedAt + CLAIM_DEADLINE &&
                    slot.totalClicks > 0) {

                    uint256 bidAmount = slot.bidAmount;
                    uint256 feeAmount = (bidAmount * PLATFORM_FEE_BPS) / 10000;
                    uint256 availableAmount = bidAmount - feeAmount;
                    uint256 reward = availableAmount / slot.totalClicks;

                    tempCycles[count] = c;
                    tempSlots[count] = s;
                    tempAmounts[count] = reward;
                    count++;
                }
            }
        }

        cycles = new uint256[](count);
        slots = new uint256[](count);
        amounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            cycles[i] = tempCycles[i];
            slots[i] = tempSlots[i];
            amounts[i] = tempAmounts[i];
        }

        return (cycles, slots, amounts);
    }

    // ============ Admin Functions ============

    function addAuthorizedSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = true;
    }

    function removeAuthorizedSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = false;
    }

    function banAdvertiser(address advertiser) external onlyOwner {
        bannedAdvertisers[advertiser] = true;
        emit AdvertiserBanned(advertiser);
    }

    function unbanAdvertiser(address advertiser) external onlyOwner {
        bannedAdvertisers[advertiser] = false;
        emit AdvertiserUnbanned(advertiser);
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        if (amount == 0) revert InvalidAmount();

        accumulatedFees = 0;

        bool success = WLD.transfer(owner(), amount);
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    // ============ Internal Functions ============

    function _recoverSigner(bytes32 ethSignedHash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        return ecrecover(ethSignedHash, v, r, s);
    }
}
