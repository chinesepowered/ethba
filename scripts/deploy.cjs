const hre = require("hardhat");

async function main() {
  console.log("Deploying ADSDemo contract to World Chain...\n");

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

  // Deploy ADSDemo contract (manual cycle progression for demo/testing)
  console.log("Deploying ADSDemo contract (manual cycles for demo)...");
  const ADSDemo = await hre.ethers.getContractFactory("ADSDemo");
  const adsDemo = await ADSDemo.deploy(WLD_TOKEN, PERMIT2, WORLD_ID, APP_ID, ACTION);

  await adsDemo.waitForDeployment();
  const adsDemoAddress = await adsDemo.getAddress();

  console.log("✅ ADSDemo deployed to:", adsDemoAddress);
  console.log();

  // Summary
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log();
  console.log("Copy this address to your .env.local file:");
  console.log();
  console.log(`NEXT_PUBLIC_ADS_DEMO_CONTRACT_ADDRESS=${adsDemoAddress}`);
  console.log();
  console.log("Next steps:");
  console.log("1. Copy the address above to .env.local");
  console.log("2. Add authorized signer:");
  console.log("   pnpm hardhat run scripts/add-signer.cjs --network worldchain");
  console.log();
  console.log("Verify contract on block explorer:");
  console.log(`npx hardhat verify --network worldchain ${adsDemoAddress} ${WLD_TOKEN} ${PERMIT2} ${WORLD_ID} "${APP_ID}" "${ACTION}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
