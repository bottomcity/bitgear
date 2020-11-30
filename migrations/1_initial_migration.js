const BN = require("bn.js");

//const Token = artifacts.require("Token");
//const WETH9 = artifacts.require("WETH9");
const STAKING_BITGEAR = artifacts.require("StakingBitgear");

require('dotenv').config();
const {
    BITGEAR_ADDR,
    TOKEN_KOVAN_ADDR,
    WETH9_ADDR,
    WETH9_KOVAN_ADDR,
    PAIR_BITGEAR_WETH_ADDR,
    PAIR_BITGEAR_WETH_KOVAN_ADDR,
    DEBUG,
    SETTER,
} = process.env;

let isKovanNetwork = true;
const dayDurationSec = new BN(60 * 60 * 24);

module.exports = async function (deployer, network, accounts) {
    if (network == "test")
        return;

    if (DEBUG == "true")
        isKovanNetwork = true;

    let zeroDayStartTime = new BN((await web3.eth.getBlock("latest")).timestamp);
    let dayNumber = zeroDayStartTime.div(dayDurationSec);
    zeroDayStartTime = dayDurationSec.mul(dayNumber);

    let StakeingBitgearInst;
    if (isKovanNetwork == true)
    {
        StakeingBitgearInst =
            await deployer.deploy(
                STAKING_BITGEAR,
                PAIR_BITGEAR_WETH_KOVAN_ADDR,
                TOKEN_KOVAN_ADDR,
                zeroDayStartTime,
                dayDurationSec
            );
    }
    else
    {
        StakeingBitgearInst =
            await deployer.deploy(
                STAKING_BITGEAR,
                PAIR_BITGEAR_WETH_ADDR,
                BITGEAR_ADDR,
                zeroDayStartTime,
                dayDurationSec
            );
    }
};
