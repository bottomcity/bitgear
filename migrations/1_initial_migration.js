const BN = require("bn.js");

const Token = artifacts.require("Token");
const WETH9 = artifacts.require("WETH9");

require('dotenv').config();
const {
    BITGEAR_ADDR,
    PAIR_BITGEAR_WETH_ADDR,
    DEBUG,
    SETTER,
    WETH9_ADDR
} = process.env;

module.exports = async function (deployer) {
    let TokenAddr;
    let weth9Inst;

    if (DEBUG == "true")
    {
        await deployer.deploy(Token, "test", "TST");
        TokenAddr = Token.deployed();
        TokenAddr = TokenAddr.address
    }
    else
        TokenAddr = BITGEAR_ADDR;

    if (DEBUG == "true")
    {
        await deployer.deploy(WETH9);
        weth9Inst = WETH9.deployed();
    }
    else
        uniswapPairAddr = PAIR_BITGEAR_WETH_ADDR;

    console.log("Token addr = ", TokenAddr);
    console.log("weth9 address = ", weth9Inst.address);
};
