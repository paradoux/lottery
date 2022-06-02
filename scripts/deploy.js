const hre = require("hardhat");

async function main() {
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(1000000000000000000); // Initial required bid set to 1 ether

  await lottery.deployed();

  console.log("Lottery deployed to:", lottery.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
