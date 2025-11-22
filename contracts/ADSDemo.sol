// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@worldcoin/world-id-contracts/src/interfaces/IWorldID.sol";
import "@worldcoin/world-id-contracts/src/libraries/ByteHasher.sol";

/**
 * @title ADSDemo - Ads Token Platform (DEMO VERSION)
 * @dev DEMO variant with:
 *      - Device-level World ID verification (groupId = 0)
 *      - 1 minute cycles instead of daily
 *      - Deployer pre-seeded with 5 ADS tokens
 *      - Same mechanics as production contract otherwise
 */
contract ADSDemo is ERC20, Ownable, ReentrancyGuard {
    using ByteHasher for bytes;

    // ============================================
    // CONSTANTS & IMMUTABLES
    // ============================================

    IWorldID public immutable worldId;
    uint256 internal immutable externalNullifier;
    uint256 internal immutable groupId = 0; // DEMO: Device verified users (was 1 for orb)

    IERC20 public immutable WLD;

    uint256 public constant CLICK_REWARD = 1 * 10**18; // 1 ADS per click
    uint256 public constant SIGNATURE_VALIDITY = 10 minutes;
    uint256 public constant MIN_BID = 0.01 * 10**18; // 0.01 WLD minimum
    uint256 public constant MIN_BID_INCREMENT_PERCENT = 5; // 5% increase required
    uint256 public constant BID_INCREMENT_PRECISION = 0.01 * 10**18; // Round to 0.01 WLD
    uint256 public constant CYCLE_DURATION = 1 minutes; // DEMO: 1 minute cycles (was 1 days)

    // ============================================
    // STATE VARIABLES
    // ============================================

    // Fee configuration
    uint256 public platformFeePercent = 5; // 5% platform fee (no maximum, fully adjustable)

    // Reward pool (WLD available for swaps)
    uint256 public rewardPool;

    // Locked funds (bids for active/future ads that can't be swapped yet)
    uint256 public lockedFunds;

    // Accumulated platform fees (owner can withdraw)
    uint256 public accumulatedFees;

    // Track last finalized cycle to enable automatic cycle transitions
    uint256 public lastFinalizedCycle;

    // Admin configuration
    uint256 public numCycleSlots = 2; // Number of ad slots per cycle
    mapping(address => bool) public authorizedSigners; // Backend wallets that can sign clicks
    mapping(address => bool) public bannedAdvertisers; // Banned from bidding

    // Ad slot structure
    struct AdSlot {
        address advertiser;
        string name;        // Ad name (max 100 chars)
        string description; // Ad description (max 500 chars)
        string actionUrl;   // Click-through link (max 200 chars)
        uint256 bidAmount;  // Amount bid in WLD
        bool exists;
        bool removed;       // Admin can remove bad ads
    }

    // Bidding structure
    struct Bid {
        address advertiser;
        uint256 amount;
        uint256 timestamp;
        string name;
        string description;
        string actionUrl;
    }

    // Cycle ad slots: cycle => slotIndex => AdSlot
    mapping(uint256 => mapping(uint256 => AdSlot)) public cycleAds;

    // Current highest bids for future slots: cycle => slotIndex => Bid
    mapping(uint256 => mapping(uint256 => Bid)) public highestBids;

    // Track claims: user => cycle => slotIndex => claimed
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) public hasClaimed;

    // Track used nonces: user => nonce => used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // World ID nullifier tracking
    mapping(uint256 => bool) public nullifierUsed;

    // Track user registration
    mapping(address => bool) public isRegistered;

    // Track which cycles have had funds unlocked: cycle => unlocked
    mapping(uint256 => bool) public cycleFundsUnlocked;

    // ============================================
    // EVENTS
    // ============================================

    event UserRegistered(address indexed user, uint256 nullifierHash);
    event BidPlaced(address indexed advertiser, uint256 indexed cycle, uint256 indexed slotIndex, uint256 amount);
    event BidRefunded(address indexed advertiser, uint256 amount);
    event AdSlotFinalized(uint256 indexed cycle, uint256 indexed slotIndex, address indexed winner, uint256 amount);
    event AdClicked(address indexed user, uint256 indexed cycle, uint256 indexed slotIndex, uint256 reward);
    event AdRemoved(uint256 indexed cycle, uint256 indexed slotIndex, address indexed advertiser);
    event AdvertiserBanned(address indexed advertiser);
    event AdvertiserUnbanned(address indexed advertiser);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event NumSlotsUpdated(uint256 newNumSlots);
    event PlatformFeeUpdated(uint256 newFeePercent);
    event TokensSwapped(address indexed user, uint256 adsAmount, uint256 wldAmount);
    event CycleTransitioned(uint256 indexed newCycle);
    event FundsUnlocked(uint256 indexed cycle, uint256 amount);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    // ============================================
    // ERRORS
    // ============================================

    error NotRegistered();
    error AlreadyRegistered();
    error InvalidNullifier();
    error InvalidSignature();
    error SignatureExpired();
    error NonceAlreadyUsed();
    error AlreadyClaimed();
    error SlotDoesNotExist();
    error AdRemoved();
    error NotAuthorizedSigner();
    error AdvertiserBanned();
    error InvalidSlotIndex();
    error InvalidCycle();
    error BidTooLow();
    error TransferFailed();
    error CannotBidOnPastOrCurrent();
    error InvalidNumSlots();
    error InsufficientRewardPool();
    error NoADSToSwap();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _worldId,
        string memory _appId,
        string memory _actionId,
        address _wld,
        address _initialSigner
    ) ERC20("Ads Token (Demo)", "ADS") Ownable(msg.sender) {
        worldId = IWorldID(_worldId);
        externalNullifier = abi.encodePacked(abi.encodePacked(_appId).hashToField(), _actionId).hashToField();

        WLD = IERC20(_wld);

        authorizedSigners[_initialSigner] = true;
        emit SignerAdded(_initialSigner);

        // Initialize to previous cycle so first claim triggers current cycle's finalization
        lastFinalizedCycle = (block.timestamp / CYCLE_DURATION) - 1;

        // DEMO: Seed deployer with 5 ADS tokens
        _mint(msg.sender, 5 * 10**18);
    }

    // ============================================
    // USER REGISTRATION (WORLD ID)
    // ============================================

    /**
     * @notice Register with World ID (required before claiming rewards)
     * @param signal User's address
     * @param root Merkle root
     * @param nullifierHash World ID nullifier
     * @param proof World ID proof
     */
    function register(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();
        if (signal != msg.sender) revert InvalidNullifier();
        if (nullifierUsed[nullifierHash]) revert InvalidNullifier();

        // Verify World ID proof
        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(signal).hashToField(),
            nullifierHash,
            externalNullifier,
            proof
        );

        nullifierUsed[nullifierHash] = true;
        isRegistered[msg.sender] = true;

        emit UserRegistered(msg.sender, nullifierHash);
    }

    // ============================================
    // AUTOMATIC CYCLE MANAGEMENT
    // ============================================

    /**
     * @notice Automatically handle cycle transition when needed
     * @dev Called internally before claims to ensure cycle management is up to date
     * This bundles: unlocking previous cycle funds + finalizing current cycle slots
     */
    function _handleCycleTransition() internal {
        uint256 currentCycle = block.timestamp / CYCLE_DURATION;

        // If we're already up to date, return
        if (lastFinalizedCycle >= currentCycle) {
            return;
        }

        // Process all cycles from lastFinalizedCycle+1 up to currentCycle
        for (uint256 cycle = lastFinalizedCycle + 1; cycle <= currentCycle; cycle++) {
            // First, unlock funds from the previous cycle (cycle - 1) if it exists and hasn't been unlocked
            if (cycle > 0 && !cycleFundsUnlocked[cycle - 1]) {
                _unlockCycleFunds(cycle - 1);
            }

            // Then, finalize all slots for the current cycle
            for (uint256 slotIndex = 0; slotIndex < numCycleSlots; slotIndex++) {
                _finalizeAdSlot(cycle, slotIndex);
            }

            emit CycleTransitioned(cycle);
        }

        lastFinalizedCycle = currentCycle;
    }

    /**
     * @notice Internal function to unlock all funds for a completed cycle
     * @param cycle The cycle to unlock funds for
     */
    function _unlockCycleFunds(uint256 cycle) internal {
        if (cycleFundsUnlocked[cycle]) {
            return; // Already unlocked
        }

        uint256 totalUnlocked = 0;

        for (uint256 slotIndex = 0; slotIndex < numCycleSlots; slotIndex++) {
            AdSlot storage ad = cycleAds[cycle][slotIndex];

            // Only unlock if slot exists, not removed, and has a bid amount
            if (ad.exists && !ad.removed && ad.bidAmount > 0) {
                // Calculate reward amount (after fee was already taken during finalization)
                uint256 feeAmount = (ad.bidAmount * platformFeePercent) / 100;
                uint256 rewardAmount = ad.bidAmount - feeAmount;

                // Move from locked to reward pool
                lockedFunds -= rewardAmount;
                rewardPool += rewardAmount;
                totalUnlocked += rewardAmount;

                // Mark as processed
                ad.bidAmount = 0;
            }
        }

        cycleFundsUnlocked[cycle] = true;

        if (totalUnlocked > 0) {
            emit FundsUnlocked(cycle, totalUnlocked);
        }
    }

    /**
     * @notice Internal function to finalize a specific ad slot
     * @param cycle The cycle to finalize
     * @param slotIndex The slot index
     */
    function _finalizeAdSlot(uint256 cycle, uint256 slotIndex) internal {
        AdSlot storage ad = cycleAds[cycle][slotIndex];
        if (ad.exists) {
            return; // Already finalized
        }

        Bid storage winningBid = highestBids[cycle][slotIndex];

        if (winningBid.amount > 0) {
            // Calculate platform fee
            uint256 feeAmount = (winningBid.amount * platformFeePercent) / 100;
            uint256 rewardAmount = winningBid.amount - feeAmount;

            // Create ad slot from winning bid
            ad.advertiser = winningBid.advertiser;
            ad.name = winningBid.name;
            ad.description = winningBid.description;
            ad.actionUrl = winningBid.actionUrl;
            ad.bidAmount = winningBid.amount;
            ad.exists = true;
            ad.removed = false;

            // Unlock from bidding locked funds
            lockedFunds -= winningBid.amount;

            // Lock the reward amount (will unlock when cycle ends)
            lockedFunds += rewardAmount;

            // Accumulate fee (owner can withdraw later via withdrawFees)
            accumulatedFees += feeAmount;

            emit AdSlotFinalized(cycle, slotIndex, winningBid.advertiser, winningBid.amount);
        }
    }

    // ============================================
    // CLAIMING REWARDS
    // ============================================

    /**
     * @notice Claim ADS reward for clicking an ad
     * @dev Automatically handles cycle transitions before processing claim
     * @param cycle The cycle of the ad (block.timestamp / CYCLE_DURATION)
     * @param slotIndex The slot index (0 to numCycleSlots-1)
     * @param nonce Unique nonce to prevent replay
     * @param timestamp When the click happened
     * @param signature Backend signature proving the click
     */
    function claimReward(
        uint256 cycle,
        uint256 slotIndex,
        uint256 nonce,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        // AUTOMATIC: Handle cycle transition first (unlocks past funds + finalizes current cycle's slots)
        _handleCycleTransition();

        // 1. Check user is registered
        if (!isRegistered[msg.sender]) revert NotRegistered();

        // 2. Verify slot exists and is valid
        if (slotIndex >= numCycleSlots) revert InvalidSlotIndex();

        AdSlot storage ad = cycleAds[cycle][slotIndex];
        if (!ad.exists) revert SlotDoesNotExist();
        if (ad.removed) revert AdRemoved();

        // 3. Check not already claimed
        if (hasClaimed[msg.sender][cycle][slotIndex]) revert AlreadyClaimed();

        // 4. Verify nonce not used
        if (usedNonces[msg.sender][nonce]) revert NonceAlreadyUsed();

        // 5. Verify timestamp freshness
        if (timestamp > block.timestamp ||
            timestamp + SIGNATURE_VALIDITY < block.timestamp) {
            revert SignatureExpired();
        }

        // 6. Verify backend signature
        // Each signature is unique per (user, cycle, slotIndex, nonce, timestamp)
        // This means user needs a new signature for each ad slot each cycle
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

        address signer = _recoverSigner(ethSignedHash, signature);
        if (!authorizedSigners[signer]) revert NotAuthorizedSigner();

        // 7. Mark as claimed
        hasClaimed[msg.sender][cycle][slotIndex] = true;
        usedNonces[msg.sender][nonce] = true;

        // 8. Mint reward (1 ADS per click)
        _mint(msg.sender, CLICK_REWARD);

        emit AdClicked(msg.sender, cycle, slotIndex, CLICK_REWARD);
    }

    // ============================================
    // BIDDING SYSTEM
    // ============================================

    /**
     * @notice Calculate minimum bid required for a slot
     * @param cycle The cycle
     * @param slotIndex The slot index
     * @return Minimum bid amount required
     */
    function getMinimumBid(uint256 cycle, uint256 slotIndex)
        public
        view
        returns (uint256)
    {
        Bid storage currentBid = highestBids[cycle][slotIndex];

        if (currentBid.amount == 0) {
            return MIN_BID;
        }

        // Must be 5% higher
        uint256 minRequired = (currentBid.amount * (100 + MIN_BID_INCREMENT_PERCENT)) / 100;

        // Round up to nearest 0.01 WLD
        uint256 remainder = minRequired % BID_INCREMENT_PRECISION;
        if (remainder > 0) {
            minRequired = minRequired - remainder + BID_INCREMENT_PRECISION;
        }

        return minRequired;
    }

    /**
     * @notice Place a bid for a future ad slot
     * @param cycle The cycle to bid for (must be next cycle or later)
     * @param slotIndex The slot index (0 to numCycleSlots-1)
     * @param amount Bid amount (must meet minimum requirements)
     * @param name Ad name (max 100 chars)
     * @param description Ad description (max 500 chars)
     * @param actionUrl Click-through URL (max 200 chars)
     */
    function placeBid(
        uint256 cycle,
        uint256 slotIndex,
        uint256 amount,
        string calldata name,
        string calldata description,
        string calldata actionUrl
    ) external nonReentrant {
        uint256 currentCycle = block.timestamp / CYCLE_DURATION;

        // Validations
        if (bannedAdvertisers[msg.sender]) revert AdvertiserBanned();
        if (cycle <= currentCycle) revert CannotBidOnPastOrCurrent();
        if (slotIndex >= numCycleSlots) revert InvalidSlotIndex();
        if (bytes(name).length == 0 || bytes(name).length > 100) revert("Name must be 1-100 chars");
        if (bytes(description).length == 0 || bytes(description).length > 500) revert("Description must be 1-500 chars");
        if (bytes(actionUrl).length == 0 || bytes(actionUrl).length > 200) revert("URL must be 1-200 chars");

        // Check bid meets minimum requirements
        uint256 minRequired = getMinimumBid(cycle, slotIndex);
        if (amount < minRequired) revert BidTooLow();

        Bid storage currentBid = highestBids[cycle][slotIndex];

        // Refund previous bidder if exists (full refund)
        if (currentBid.amount > 0) {
            lockedFunds -= currentBid.amount;
            bool refundSuccess = WLD.transfer(currentBid.advertiser, currentBid.amount);
            if (!refundSuccess) revert TransferFailed();
            emit BidRefunded(currentBid.advertiser, currentBid.amount);
        }

        // Transfer new bid amount to contract
        bool success = WLD.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        // Lock the funds (can't be swapped until ad slot is complete)
        lockedFunds += amount;

        // Update highest bid
        highestBids[cycle][slotIndex] = Bid({
            advertiser: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            name: name,
            description: description,
            actionUrl: actionUrl
        });

        emit BidPlaced(msg.sender, cycle, slotIndex, amount);
    }

    /**
     * @notice Update ad content for a finalized slot (only winning advertiser)
     * @param cycle The cycle
     * @param slotIndex The slot index
     * @param name Ad name
     * @param description Ad description
     * @param actionUrl Click-through URL
     */
    function updateAdContent(
        uint256 cycle,
        uint256 slotIndex,
        string calldata name,
        string calldata description,
        string calldata actionUrl
    ) external {
        AdSlot storage ad = cycleAds[cycle][slotIndex];

        if (!ad.exists) revert SlotDoesNotExist();
        if (ad.advertiser != msg.sender) revert("Not advertiser");
        if (bytes(name).length == 0 || bytes(name).length > 100) revert("Name must be 1-100 chars");
        if (bytes(description).length == 0 || bytes(description).length > 500) revert("Description must be 1-500 chars");
        if (bytes(actionUrl).length == 0 || bytes(actionUrl).length > 200) revert("URL must be 1-200 chars");

        ad.name = name;
        ad.description = description;
        ad.actionUrl = actionUrl;
    }

    // ============================================
    // TOKEN SWAP FUNCTIONS
    // ============================================

    /**
     * @notice Swap ADS tokens for WLD from reward pool
     * @param adsAmount Amount of ADS to burn
     * @dev Exchange rate: (your ADS / total ADS) × available pool
     */
    function swapADSForWLD(uint256 adsAmount) external nonReentrant {
        if (adsAmount == 0) revert NoADSToSwap();
        if (balanceOf(msg.sender) < adsAmount) revert NoADSToSwap();

        uint256 totalADS = totalSupply();
        if (totalADS == 0) revert NoADSToSwap();

        uint256 availablePool = rewardPool;
        if (availablePool == 0) revert InsufficientRewardPool();

        // Calculate proportional share: (adsAmount / totalSupply) × availablePool
        uint256 wldAmount = (adsAmount * availablePool) / totalADS;

        if (wldAmount == 0) revert InsufficientRewardPool();

        // Burn ADS tokens
        _burn(msg.sender, adsAmount);

        // Decrease reward pool
        rewardPool -= wldAmount;

        // Transfer WLD to user
        bool success = WLD.transfer(msg.sender, wldAmount);
        if (!success) revert TransferFailed();

        emit TokensSwapped(msg.sender, adsAmount, wldAmount);
    }

    /**
     * @notice Calculate swap output before executing
     * @param adsAmount Amount of ADS to swap
     * @return Expected WLD amount
     */
    function calculateSwapOutput(uint256 adsAmount)
        external
        view
        returns (uint256)
    {
        if (adsAmount == 0) return 0;

        uint256 totalADS = totalSupply();
        if (totalADS == 0) return 0;

        uint256 availablePool = rewardPool;
        return (adsAmount * availablePool) / totalADS;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Add an authorized signer (backend wallet)
     */
    function addSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = true;
        emit SignerAdded(signer);
    }

    /**
     * @notice Remove an authorized signer
     */
    function removeSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    /**
     * @notice Ban an advertiser from bidding
     */
    function banAdvertiser(address advertiser) external onlyOwner {
        bannedAdvertisers[advertiser] = true;
        emit AdvertiserBanned(advertiser);
    }

    /**
     * @notice Unban an advertiser
     */
    function unbanAdvertiser(address advertiser) external onlyOwner {
        bannedAdvertisers[advertiser] = false;
        emit AdvertiserUnbanned(advertiser);
    }

    /**
     * @notice Remove a bad ad
     */
    function removeAd(uint256 cycle, uint256 slotIndex) external onlyOwner {
        AdSlot storage ad = cycleAds[cycle][slotIndex];
        if (!ad.exists) revert SlotDoesNotExist();

        ad.removed = true;
        emit AdRemoved(cycle, slotIndex, ad.advertiser);
    }

    /**
     * @notice Set number of cycle ad slots
     */
    function setNumCycleSlots(uint256 _numSlots) external onlyOwner {
        if (_numSlots == 0 || _numSlots > 10) revert InvalidNumSlots();
        numCycleSlots = _numSlots;
        emit NumSlotsUpdated(_numSlots);
    }

    /**
     * @notice Set platform fee percentage
     * @param _feePercent New fee percentage (no maximum limit)
     */
    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        platformFeePercent = _feePercent;
        emit PlatformFeeUpdated(_feePercent);
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = accumulatedFees;
        if (amount == 0) revert("No fees to withdraw");

        accumulatedFees = 0;

        bool success = WLD.transfer(owner(), amount);
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(owner(), amount);
    }

    /**
     * @notice Emergency withdraw WLD (only owner)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        bool success = WLD.transfer(owner(), amount);
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Manual cycle transition trigger (public function, though auto-triggered by claims)
     * @dev Useful if no claims happen for multiple cycles
     */
    function triggerCycleTransition() external {
        _handleCycleTransition();
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get current cycle number
     */
    function getCurrentCycle() external view returns (uint256) {
        return block.timestamp / CYCLE_DURATION;
    }

    /**
     * @notice Get ad slot for a specific cycle
     */
    function getAdSlot(uint256 cycle, uint256 slotIndex)
        external
        view
        returns (
            address advertiser,
            string memory name,
            string memory description,
            string memory actionUrl,
            uint256 bidAmount,
            bool exists,
            bool removed
        )
    {
        AdSlot storage ad = cycleAds[cycle][slotIndex];
        return (
            ad.advertiser,
            ad.name,
            ad.description,
            ad.actionUrl,
            ad.bidAmount,
            ad.exists,
            ad.removed
        );
    }

    /**
     * @notice Get highest bid for a future slot
     */
    function getHighestBid(uint256 cycle, uint256 slotIndex)
        external
        view
        returns (
            address advertiser,
            uint256 amount,
            uint256 timestamp,
            string memory name,
            string memory description,
            string memory actionUrl
        )
    {
        Bid storage bid = highestBids[cycle][slotIndex];
        return (bid.advertiser, bid.amount, bid.timestamp, bid.name, bid.description, bid.actionUrl);
    }

    /**
     * @notice Check if user has claimed for a specific ad
     */
    function hasUserClaimed(address user, uint256 cycle, uint256 slotIndex)
        external
        view
        returns (bool)
    {
        return hasClaimed[user][cycle][slotIndex];
    }

    /**
     * @notice Get all current cycle's ads
     */
    function getCurrentAds() external view returns (AdSlot[] memory) {
        uint256 current = block.timestamp / CYCLE_DURATION;
        AdSlot[] memory ads = new AdSlot[](numCycleSlots);

        for (uint256 i = 0; i < numCycleSlots; i++) {
            ads[i] = cycleAds[current][i];
        }

        return ads;
    }

    /**
     * @notice Check which ads user can still claim in current cycle
     */
    function getClaimableAds(address user) external view returns (bool[] memory) {
        uint256 current = block.timestamp / CYCLE_DURATION;
        bool[] memory claimable = new bool[](numCycleSlots);

        for (uint256 i = 0; i < numCycleSlots; i++) {
            AdSlot storage ad = cycleAds[current][i];
            claimable[i] = ad.exists &&
                           !ad.removed &&
                           !hasClaimed[user][current][i] &&
                           isRegistered[user];
        }

        return claimable;
    }

    /**
     * @notice Get pool balances
     * @return availablePool WLD available in reward pool
     * @return locked WLD locked (for active/future ads)
     * @return fees Accumulated platform fees
     */
    function getPoolBalances() external view returns (
        uint256 availablePool,
        uint256 locked,
        uint256 fees
    ) {
        return (rewardPool, lockedFunds, accumulatedFees);
    }

    /**
     * @notice Get user's potential swap value
     * @param user User address
     * @return adsBalance User's ADS balance
     * @return wldValue Value in WLD if swapped all ADS
     */
    function getUserSwapInfo(address user) external view returns (
        uint256 adsBalance,
        uint256 wldValue
    ) {
        adsBalance = balanceOf(user);
        uint256 totalADS = totalSupply();

        if (totalADS > 0 && adsBalance > 0) {
            wldValue = (adsBalance * rewardPool) / totalADS;
        }

        return (adsBalance, wldValue);
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    /**
     * @notice Recover signer from signature
     */
    function _recoverSigner(bytes32 ethSignedHash, bytes memory signature)
        internal
        pure
        returns (address)
    {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        return ecrecover(ethSignedHash, v, r, s);
    }
}
