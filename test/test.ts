import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as chai from "chai";
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
import { keccak256 } from 'ethers/lib/utils';

function parseEther(amount: Number) {
  return ethers.utils.parseUnits(amount.toString(), 18);
}

//dinh nghia bang ts giup kiem tra du lieu tra ve de dang hon
describe("Vault", function () {
  let owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress;

  //smart contract
  let vault:Contract;
  let token:Contract;

  beforeEach(async () => {
    await ethers.provider.send("hardhat_reset", []);
    //lay address de test 
    [owner, alice, bob, carol] = await ethers.getSigners();

    //deploy vault tu owner
    const Vault = await ethers.getContractFactory("Vault", owner);
    vault = await Vault.deploy();
    // tiep theo la floppy
    const Token = await ethers.getContractFactory("Floppy", owner);
    token = await Token.deploy();
    //goi toi function setToken trong vault lam viec voi floppy
    await vault.setToken(token.address);        
})

  ////// Happy Path
  it("Could deposit into the Vault", async () => {
    await token.transfer(alice.address,parseEther(1 * 10**6));
    //alice cho phep sai toan bo token trong wallet
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    //sau khi approve tiep tuc cho phep connect
    await vault.connect(alice).deposit(parseEther(500*10**3));
    //so trong vault sau khi deposit
    expect(await token.balanceOf(vault.address)).equal(parseEther(500 * 10**3));
  });
  it("Could withdraw", async () => {
    //grant withdrawer role to Bob
    let WITHDRAWER_ROLE = keccak256(Buffer.from("WITHDRAWER_ROLE")).toString();
    //ban role cho bob  
    await vault.grantRole(WITHDRAWER_ROLE, bob.address);

    //set 2 function tu vault 
    await vault.setWithdrawEnable(true);
    await vault.setMaxWithdrawAmount(parseEther(1*10**6));

    // alice deposit vao vault
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await vault.connect(alice).deposit(parseEther(500*10**3));

    // bob withdraw vao alice address
    await vault.connect(bob).withdraw(parseEther(300*10**3),alice.address);
    
    expect(await token.balanceOf(vault.address)).equal(parseEther(200 * 10**3));
    expect(await token.balanceOf(alice.address)).equal(parseEther(800 * 10**3));
  });
  ///////Unhappy Path/////////
  //case 1: deposit 1 so tien lon hon transfer dang co 
  it("Could not deposit, Insufficient account balance", async () => {
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await expect (vault.connect(alice).deposit(parseEther(2 * 10**6))).revertedWith('Insufficient account balance');
  });
  //case 2: withdraw loi ko cho rut
  it("Could not withdraw, Withdraw is not available ", async () => {
    //grant withdrawer role to Bob
    let WITHDRAWER_ROLE = keccak256(Buffer.from("WITHDRAWER_ROLE")).toString();
    await vault.grantRole(WITHDRAWER_ROLE, bob.address);

    //set 2 funcion trong vault ko cho rut
    await vault.setWithdrawEnable(false);
    await vault.setMaxWithdrawAmount(parseEther(1*10**6));

    // alice deposit vao the vault
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await vault.connect(alice).deposit(parseEther(500*10**3));

    // bob withdraw vao alice address
    await expect (vault.connect(bob).withdraw(parseEther(300*10**3),alice.address)).revertedWith('Withdraw is not available');
   
  });
  //case 3: withdraw qua so tien cho phep
  it("Could not withdraw, Exceed maximum amount ", async () => {
    //grant withdrawer role to Bob
    let WITHDRAWER_ROLE = keccak256(Buffer.from("WITHDRAWER_ROLE")).toString();
    await vault.grantRole(WITHDRAWER_ROLE, bob.address);

    // setter vault functions

    await vault.setWithdrawEnable(true);
    await vault.setMaxWithdrawAmount(parseEther(1*10**3));

    // alice deposit into the vault
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await vault.connect(alice).deposit(parseEther(500*10**3));

    // bob withdraw into alice address
    await expect (vault.connect(bob).withdraw(parseEther(2*10**3),alice.address)).revertedWith('Exceed maximum amount');
   
  });
  //case 4: caller try to connect and stole token(caller = carol)
  it("Could not withdraw, Caller is not a withdrawer", async () => {
    //grant withdrawer role to Bob
    let WITHDRAWER_ROLE = keccak256(Buffer.from("WITHDRAWER_ROLE")).toString();
    await vault.grantRole(WITHDRAWER_ROLE, bob.address);

    // setter vault functions

    await vault.setWithdrawEnable(true);
    await vault.setMaxWithdrawAmount(parseEther(1*10**3));

    // alice deposit into the vault
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await vault.connect(alice).deposit(parseEther(500*10**3));

    // bob withdraw into alice address
    await expect (vault.connect(carol).withdraw(parseEther(1*10**3),alice.address)).revertedWith('Caller is not a withdrawer');
   
  })
  //case 5: withdraw qua so tien trong vault
  it("Could not withdraw, ERC20: transfer amount exceeds balance", async () => {
    //grant withdrawer role to Bob
    let WITHDRAWER_ROLE = keccak256(Buffer.from("WITHDRAWER_ROLE")).toString();
    await vault.grantRole(WITHDRAWER_ROLE, bob.address);

    // setter vault functions

    await vault.setWithdrawEnable(true);
    await vault.setMaxWithdrawAmount(parseEther(5*10**3));

    // alice deposit into the vault
    await token.transfer(alice.address,parseEther(1 * 10**6));
    await token.connect(alice).approve(vault.address,token.balanceOf(alice.address));
    await vault.connect(alice).deposit(parseEther(2*10**3));

    // bob withdraw into alice address
    await expect (vault.connect(bob).withdraw(parseEther(3*10**3),alice.address)).revertedWith('ERC20: transfer amount exceeds balance');
   
  })
});