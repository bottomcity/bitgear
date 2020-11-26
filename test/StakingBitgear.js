const BN = require("bn.js");
const chai = require("chai");
const { expect, assert } = require("chai");
const expectRevert = require("./utils/expectRevert.js");
chai.use(require("chai-bn")(BN));

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const STAKING_BITGEAR = artifacts.require('StakingBitgear');
//UniswapV2Factory
const UNISWAP_FACTORY = artifacts.require('UniswapV2Factory');
const UNISWAP_PAIR = artifacts.require('UniswapV2Pair');
const WETH9 = artifacts.require('WETH9');
const TOKEN = artifacts.require('Token');

require('dotenv').config();
const {
    TOKEN_KOVAN_ADDR,
    PAIR_BITGEAR_WETH_KOVAN_ADDR,
    SETTER
} = process.env;

let zeroDayStartTime;
const dayDurationSec = new BN(60 * 60 * 24);
const ONE_TOKEN = new BN((10 ** 18).toString());

contract(
    'StakingBitgear-test',
    ([
        user1,
        user2,
        user3,
        tokenOwner
    ]) => {
        let stakingBitgear;
        let uniswapFactory;
        let Weth9;
        let token;
        let pairEthBitgear;

        let firstAmount = ONE_TOKEN.mul(TWO);
        let secAmount = ONE_TOKEN.mul(THREE);
        let thirdAmount = ONE_TOKEN.mul(TWO);

        beforeEach(async () => {
            // Init contracts
            Weth9 = await WETH9.new();
            token = await TOKEN.new("Test", "TST", {from: tokenOwner});

            uniswapFactory = await UNISWAP_FACTORY.new(
                user1
            );
            await uniswapFactory.createPair(token.address, Weth9.address);
            pairEthBitgear = await uniswapFactory.getPair(token.address, Weth9.address);
            pairEthBitgear = await UNISWAP_PAIR.at(pairEthBitgear);

            await token.transfer(user1, firstAmount, {from: tokenOwner});
            await token.transfer(user2, secAmount, {from: tokenOwner});
            await token.transfer(user3, thirdAmount, {from: tokenOwner});
            await token.transfer(pairEthBitgear.address, firstAmount, {from: user1});
            await Weth9.deposit({from: user1, value: ONE_TOKEN.mul(THREE)});
            await Weth9.transfer(pairEthBitgear.address, ONE_TOKEN.mul(THREE), {from: user1});
            await pairEthBitgear.mint(user1);
            await token.transfer(pairEthBitgear.address, secAmount, {from: user2});
            await Weth9.deposit({from: user2, value: ONE_TOKEN.mul(FOUR)});
            await Weth9.transfer(pairEthBitgear.address, ONE_TOKEN.mul(FOUR), {from: user2});
            await pairEthBitgear.mint(user2);
            await token.transfer(pairEthBitgear.address, thirdAmount, {from: user3});
            await Weth9.deposit({from: user3, value: ONE_TOKEN.mul(FIVE)});
            await Weth9.transfer(pairEthBitgear.address, ONE_TOKEN.mul(FIVE), {from: user3});
            await pairEthBitgear.mint(user3);

            zeroDayStartTime = new BN((await web3.eth.getBlock("latest")).timestamp);
            stakingBitgear = await STAKING_BITGEAR.new(
                pairEthBitgear.address,
                token.address,
                zeroDayStartTime,
                dayDurationSec
            );
        })

        it("#0 Deploy test", async () => {
            expect(await stakingBitgear.pair()).to.be.equals(pairEthBitgear.address);
            expect(await stakingBitgear.gearAddress()).to.be.equals(token.address);
            expect(await stakingBitgear.zeroDayStartTime()).to.be.bignumber.that.equals(zeroDayStartTime);
            expect(await stakingBitgear.dayDurationSec()).to.be.bignumber.that.equals(dayDurationSec);
            expect(await stakingBitgear.numDaysInMonth()).to.be.bignumber.that.equals(new BN(30));
            expect(await stakingBitgear.monthsInYear()).to.be.bignumber.that.equals(new BN(12));
            expect(await stakingBitgear.allLpTokensStaked()).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.allGearTokens()).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.unfreezedGearTokens()).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.freezedGearTokens()).to.be.bignumber.that.equals(ZERO);
        })

        it("#1 Test stake", async () => {

        })
    }
)