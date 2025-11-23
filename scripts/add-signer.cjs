const hre = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0x08f0760f96d5eD818267bC184c504F1309d3861D";
  const SIGNER_ADDRESS = "0x59876B0c53Bd8af33EFa3157dfcFDA4131a5A2b0";

  console.log("Adding authorized signer to ADSDemo contract...");
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("Signer:", SIGNER_ADDRESS);

  const ADSDemo = await hre.ethers.getContractAt("ADSDemo", CONTRACT_ADDRESS);

  const tx = await ADSDemo.addAuthorizedSigner(SIGNER_ADDRESS);
  await tx.wait();

  console.log("✅ Authorized signer added!");
  console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
