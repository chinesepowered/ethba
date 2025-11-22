const hre = require("hardhat");

async function main() {
  console.log("Deploying ADS Platform contracts to World Chain...\n");

  // World Chain contract addresses
  const WLD_TOKEN = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003"; // WLD on World Chain Mainnet
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";     // Universal Permit2
  const WORLD_ID = "0x57f928158C3EE7CDad1e4D8642503c4D0201f611";   // World ID Router on World Chain

  // World ID configuration
  const APP_ID = process.env.NEXT_PUBLIC_APP_ID || "app_staging_ethba";
  const ACTION = process.env.NEXT_PUBLIC_WLD_ACTION || "verify-human";

  console.log("Using addresses:");
  console.log("  WLD Token:", WLD_TOKEN);
  console.log("  Permit2:", PERMIT2);
  console.log("  World ID:", WORLD_ID);
  console.log("  App ID:", APP_ID);
  console.log("  Action:", ACTION);
  console.log();

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.log();

  // Deploy ADSDemo contract
  console.log("Deploying ADSDemo contract...");
  const ADSDemo = await hre.ethers.getContractFactory("ADSDemo");
  const adsDemo = await ADSDemo.deploy(WLD_TOKEN, PERMIT2, WORLD_ID, APP_ID, ACTION);

  await adsDemo.waitForDeployment();
  const adsDemoAddress = await adsDemo.getAddress();

  console.log("✅ ADSDemo deployed to:", adsDemoAddress);
  console.log();

  // Deploy ADS contract (production version with 24-hour cycles)
  console.log("Deploying ADS contract (production)...");
  const ADS = await hre.ethers.getContractFactory("ADS");
  const ads = await ADS.deploy(WLD_TOKEN, PERMIT2, WORLD_ID, APP_ID, ACTION);

  await ads.waitForDeployment();
  const adsAddress = await ads.getAddress();

  console.log("✅ ADS deployed to:", adsAddress);
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log();
  console.log("Copy these addresses to your .env.local file:");
  console.log();
  console.log(`NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS=${adsDemoAddress}`);
  console.log(`NEXT_PUBLIC_WLD_TOKEN_ADDRESS=${WLD_TOKEN}`);
  console.log();
  console.log("Next steps:");
  console.log("1. Copy the addresses above to .env.local");
  console.log("2. Generate a backend signer key:");
  console.log("   node -e \"console.log('0x' + require('crypto').randomBytes(32).toString('hex'))\"");
  console.log("3. Set the backend signer in the contract:");
  console.log(`   await contract.setBackendSigner(YOUR_SIGNER_ADDRESS)`);
  console.log();
  console.log("Verifying contracts on block explorer...");
  console.log(`npx hardhat verify --network worldchain ${adsDemoAddress} ${WLD_TOKEN} ${PERMIT2} ${WORLD_ID} "${APP_ID}" "${ACTION}"`);
  console.log(`npx hardhat verify --network worldchain ${adsAddress} ${WLD_TOKEN} ${PERMIT2} ${WORLD_ID} "${APP_ID}" "${ACTION}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
