const hre = require("hardhat");

async function main() {
  const ADS_DEMO_ADDRESS = "0x0A027767aC1e4aA5474A1B98C3eF730C3994E67b";
  const SIGNER_ADDRESS = "0x59876B0c53Bd8af33EFa3157dfcFDA4131a5A2b0";

  console.log("Setting backend signer...");
  console.log("Contract:", ADS_DEMO_ADDRESS);
  console.log("Signer:", SIGNER_ADDRESS);
  console.log();

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const adsDemo = await hre.ethers.getContractAt("ADSDemo", ADS_DEMO_ADDRESS);

  console.log("Calling addAuthorizedSigner...");
  const tx = await adsDemo.addAuthorizedSigner(SIGNER_ADDRESS);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  await tx.wait();

  console.log("✅ Backend signer added successfully!");

  // Verify it was set
  const isAuthorized = await adsDemo.authorizedSigners(SIGNER_ADDRESS);
  console.log("Verified signer is authorized:", isAuthorized);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
