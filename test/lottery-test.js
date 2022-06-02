const { expect } = require("chai");
const { ethers } = require("hardhat");

let owner, account1, account2, account3, Lottery, lottery;
const initialBid = ethers.utils.parseEther("1.0");
before(async () => {
  [owner, account1, account2, account3] = await ethers.getSigners();
  Lottery = await ethers.getContractFactory("Lottery");
});

describe("Lottery", () => {
  beforeEach(async () => {
    lottery = await Lottery.deploy(initialBid);
    await lottery.deployed();
  });

  describe("when an account sends funds to smart contract", () => {
    it("should increase smart contract balance by same amount", async () => {
      await account1.sendTransaction({
        to: lottery.address,
        value: ethers.utils.parseEther("1.0"),
      });

      expect(await lottery.getContractBalance()).to.equal(
        ethers.utils.parseEther("1.0")
      );
    });
  });

  describe("when an account joins the lottery", () => {
    describe("when the account transfer the correct bid and is not already registered", async () => {
      it("should only add this account to the lottery, increase the contract balance and decrease the account balance with the bid", async () => {
        const initialContractBalance = await lottery.getContractBalance();
        const initialAccountBalance = await account1.getBalance();
        const tx = await lottery
          .connect(account1)
          .joinLottery({ value: initialBid });

        const gasPrice = tx.gasPrice;
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;

        expect(await lottery.playersList(0)).to.equal(account1.address);
        expect(await lottery.players(account1.address)).to.equal(1);
        expect(await lottery.players(account2.address)).to.equal(0);
        expect(await lottery.getContractBalance()).to.equal(
          initialContractBalance.add(initialBid)
        );
        expect(await account1.getBalance()).to.equal(
          initialAccountBalance.sub(initialBid.add(gasPrice.mul(gasUsed)))
        );
      });
    });
    describe("when the account does not transfer the correct bid", async () => {
      it("should revert", async () => {
        const wrongBid = ethers.utils.parseEther("0.5");

        await expect(lottery.connect(account1).joinLottery({ value: wrongBid }))
          .to.be.reverted;
      });
    });
    describe("when the account is already taking part in the lottery", async () => {
      it("should revert", async () => {
        await lottery.connect(account1).joinLottery({ value: initialBid });

        await expect(
          lottery.connect(account1).joinLottery({ value: initialBid })
        ).to.be.reverted;
      });
    });
  });

  describe("when an account wants to pick the winner", () => {
    it("should revert", async () => {
      await expect(lottery.connect(account1).pickWinner()).to.be.reverted;
    });
  });

  describe("when the owner wants to pick the winner", () => {
    it("should pick a winner, transfer it the prize and reset the players list for the next lottery", async () => {
      // Accounts join lottery
      await lottery.connect(account1).joinLottery({ value: initialBid });
      await lottery.connect(account2).joinLottery({ value: initialBid });
      await lottery.connect(account3).joinLottery({ value: initialBid });

      // Prize should be contract's balance before picking a winner
      const lotteryBalanceBeforeDraw = await lottery.getContractBalance();

      // Link each account to its balance for winner prize check below
      const account1Balance = await account1.getBalance();
      const account2Balance = await account2.getBalance();
      const account3Balance = await account3.getBalance();
      const accounts = [
        { account: account1, balanceBeforeDraw: account1Balance },
        { account: account2, balanceBeforeDraw: account2Balance },
        { account: account3, balanceBeforeDraw: account3Balance },
      ];

      const tx = await lottery.connect(owner).pickWinner();
      const receipt = await tx.wait();
      const lotteryWinnerAddress = receipt.events[0].args[0];
      const lotteryPrize = receipt.events[0].args[1];

      // Find the winner account from the winner address
      const winnerAccount = accounts.find(
        (account) => account.account.address === lotteryWinnerAddress
      );

      const expectedWinnerBalance = winnerAccount.balanceBeforeDraw.add(
        lotteryBalanceBeforeDraw
      );
      const winnerBalance = await winnerAccount.account.getBalance();

      expect(lotteryBalanceBeforeDraw).to.equal(lotteryPrize);
      expect(await lottery.winner()).to.equal(lotteryWinnerAddress);
      expect(winnerBalance).to.equal(expectedWinnerBalance);
      expect(await lottery.getContractBalance()).to.equal(0);
      await expect(lottery.playersList(0)).to.be.reverted;
      expect(await lottery.players(account1.address)).to.equal(0);
      expect(await lottery.players(account2.address)).to.equal(0);
      expect(await lottery.players(account3.address)).to.equal(0);
    });
  });

  describe("when an account modifies the required bid", () => {
    it("should revert", async () => {
      await expect(
        lottery
          .connect(account1)
          .modifyRequiredBid(ethers.utils.parseEther("1.0"))
      ).to.be.reverted;
    });
  });
  describe("when owner modifies the required bid", () => {
    it("should modify the required bid", async () => {
      const newBid = ethers.utils.parseEther("1.0");
      await lottery.connect(owner).modifyRequiredBid(newBid);

      expect(await lottery.bidAmount()).to.equal(newBid);
    });
  });
});
