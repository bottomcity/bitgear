const BN = require("bn.js");
const chai = require("chai");
const { expect, assert } = require("chai");
const expectRevert = require("./utils/expectRevert.js");
const helper = require("openzeppelin-test-helpers/src/time.js");
chai.use(require("chai-bn")(BN));

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);
const SIX = new BN(6);

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
        user4NoLP,
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

        let tokenDonationAmount = ONE_TOKEN.mul(new BN(100));

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
            await token.approve(
                stakingBitgear.address,
                tokenDonationAmount,
                {from: tokenOwner}
            );
            await stakingBitgear.gearTokenDonation(tokenDonationAmount, {from: tokenOwner})
        })

        it("#0 Deploy test", async () => {
            expect(await stakingBitgear.pair()).to.be.equals(pairEthBitgear.address);
            expect(await stakingBitgear.gearAddress()).to.be.equals(token.address);
            expect(await stakingBitgear.zeroDayStartTime()).to.be.bignumber.that.equals(zeroDayStartTime);
            expect(await stakingBitgear.dayDurationSec()).to.be.bignumber.that.equals(dayDurationSec);
            expect(await stakingBitgear.numDaysInMonth()).to.be.bignumber.that.equals(new BN(30));
            expect(await stakingBitgear.monthsInYear()).to.be.bignumber.that.equals(new BN(12));
            expect(await stakingBitgear.allLpTokensStaked()).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.allGearTokens()).to.be.bignumber.that.equals(tokenDonationAmount);
            expect(await stakingBitgear.unfreezedGearTokens()).to.be.bignumber.that.equals(tokenDonationAmount);
            expect(await stakingBitgear.freezedGearTokens()).to.be.bignumber.that.equals(ZERO);
        })

        it("#1 Test checking of input params", async () => {
            expect(await stakingBitgear.stakeListCount(user1)).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.stakeListCount(user2)).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.stakeListCount(user3)).to.be.bignumber.that.equals(ZERO);
            expect(await stakingBitgear.stakeListCount(user4NoLP)).to.be.bignumber.that.equals(ZERO);

            await expectRevert(
                stakingBitgear.stakeStart(ONE, ZERO, {from: user1}),
                "StakingBitgear: Wrong number of months"
            );
            await expectRevert(
                stakingBitgear.stakeStart(
                    ONE,
                    (await stakingBitgear.maxNumMonths()).add(ONE),
                    {from: user1}
                ),
                "StakingBitgear: Wrong number of months"
            );
            await expectRevert(
                stakingBitgear.stakeStart(ONE, ONE, {from: user4NoLP}),
                "ds-math-sub-underflow"
            );
            await expectRevert(
                stakingBitgear.stakeStart(
                    ONE,
                    (await stakingBitgear.maxNumMonths()),
                    {from: user4NoLP}
                ),
                "ds-math-sub-underflow"
            );
        })

        it("#2 Test staking and unstaking one month", async () => {
            let lpTotalSupply = new BN(await pairEthBitgear.totalSupply());
            let user1LpBalance = new BN(await pairEthBitgear.balanceOf(user1));
            let user2LpBalance = new BN(await pairEthBitgear.balanceOf(user2));
            let user3LpBalance = new BN(await pairEthBitgear.balanceOf(user3));
            let res = await pairEthBitgear.getReserves();
            let token0, token1;
            token0 = await pairEthBitgear.token0();
            token1 = await pairEthBitgear.token1();
            let lpGearReserve
            if (token0 == token.address)
                lpGearReserve = new BN(res[0]);
            else
                lpGearReserve = new BN(res[1]);
            let numDaysInMonth = await stakingBitgear.numDaysInMonth();
            let monthsInYear = await stakingBitgear.numDaysInMonth();

            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(ZERO);
            await testStake(user1, user1LpBalance, ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(ONE);
            expect(await stakingBitgear.stakeListCount(user1)).to.be.bignumber.that.equals(ONE);

            await pairEthBitgear.approve(stakingBitgear.address, user2LpBalance, {from: user2});
            await testStake(user2, user2LpBalance.div(TWO), ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(TWO);
            expect(await stakingBitgear.stakeListCount(user2)).to.be.bignumber.that.equals(ONE);
            await testStake(user2, user2LpBalance.div(TWO), ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(THREE);
            expect(await stakingBitgear.stakeListCount(user2)).to.be.bignumber.that.equals(TWO);

            await pairEthBitgear.approve(stakingBitgear.address, user3LpBalance, {from: user3});
            await testStake(user3, user3LpBalance.div(THREE), ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(FOUR);
            expect(await stakingBitgear.stakeListCount(user3)).to.be.bignumber.that.equals(ONE);
            await testStake(user3, user3LpBalance.div(THREE), ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(FIVE);
            expect(await stakingBitgear.stakeListCount(user3)).to.be.bignumber.that.equals(TWO);
            await testStake(user3, user3LpBalance.div(THREE), ONE, lpTotalSupply, lpGearReserve);
            expect(await stakingBitgear.stakeIdLast()).to.be.bignumber.that.equals(SIX);
            expect(await stakingBitgear.stakeListCount(user3)).to.be.bignumber.that.equals(THREE);

            let reward = testUnstake(user2, 0, (await stakingBitgear.stakeList(user2, 0)).stakeId, numDaysInMonth, monthsInYear);
            testUnstake(user3, 0, (await stakingBitgear.stakeList(user3, 0)).stakeId, numDaysInMonth, monthsInYear);

            let timeNow = new BN((await web3.eth.getBlock("latest")).timestamp);
            await helper.increase(dayDurationSec.mul(numDaysInMonth));

            testUnstake(user1, 0, (await stakingBitgear.stakeList(user1, 0)).stakeId, numDaysInMonth, monthsInYear);
            testUnstake(user2, 0, (await stakingBitgear.stakeList(user2, 0)).stakeId, numDaysInMonth, monthsInYear);
            testUnstake(user3, 0, (await stakingBitgear.stakeList(user3, 0)).stakeId, numDaysInMonth, monthsInYear);
            testUnstake(user3, 0, (await stakingBitgear.stakeList(user3, 0)).stakeId, numDaysInMonth, monthsInYear);
            testUnstake(user3, 0, (await stakingBitgear.stakeList(user3, 0)).stakeId, numDaysInMonth, monthsInYear);
        })

        async function testStake(user, lpAmount, numMonths, lpTotalSupply, lpGearReserve)
        {
            let allLpTokensStaked = new BN(await stakingBitgear.allLpTokensStaked());

            let gearEquivalent = lpGearReserve.mul(lpAmount).div(lpTotalSupply);

            let stakeCount = await stakingBitgear.stakeListCount(user);
            let stakeId = await stakingBitgear.stakeIdLast();

            let allGearTokens = new BN(await stakingBitgear.allGearTokens());
            let unfreezedGearTokens = new BN(await stakingBitgear.unfreezedGearTokens());
            let freezedGearTokens = new BN(await stakingBitgear.freezedGearTokens());
            let gearReward = ZERO;
            let month = ONE;
            while(month <= numMonths)
            {
                gearReward =
                    gearReward.add(gearEquivalent.add(gearReward)
                        .mul(await stakingBitgear.MonthsApyPercentsNumerator(month.sub(ONE)))
                        .div(await stakingBitgear.monthsInYear())
                        .div(await stakingBitgear.MonthsApyPercentsDenominator(month.sub(ONE))));

                month = month.add(ONE)
            }

            let currDay = new BN(await stakingBitgear.currentDay());

            let userLpBalanceBefore = await pairEthBitgear.balanceOf(user);
            await pairEthBitgear.approve(stakingBitgear.address, lpAmount, {from: user});
            await stakingBitgear.stakeStart(lpAmount, numMonths, {from: user});
            let userLpBalanceAfter = await pairEthBitgear.balanceOf(user);
            expect(userLpBalanceBefore.sub(userLpBalanceAfter)).to.be.bignumber.that.equals(lpAmount);

            expect((await stakingBitgear.stakeList(user, stakeCount)).stakeId).to.be.bignumber.that.equals(stakeId.add(ONE));
            expect((await stakingBitgear.stakeList(user, stakeCount)).startDay).to.be.bignumber.that.equals(currDay);
            expect((await stakingBitgear.stakeList(user, stakeCount)).numMonthsStake).to.be.bignumber.that.equals(numMonths);
            expect((await stakingBitgear.stakeList(user, stakeCount)).stakedLP).to.be.bignumber.that.equals(lpAmount);
            expect((await stakingBitgear.stakeList(user, stakeCount)).stakedGear).to.be.bignumber.that.equals(gearEquivalent);
            expect((await stakingBitgear.stakeList(user, stakeCount)).freezedRewardGearTokens).to.be.bignumber.that.equals(gearReward);

            //expect((await stakingBitgear.stakeList(user)).freezedRewardGearTokens).to.be.bignumber.that.equals(gearEquivalent);

            let allGearTokensNew = new BN(await stakingBitgear.allGearTokens());
            let unfreezedGearTokensNew = new BN(await stakingBitgear.unfreezedGearTokens());
            let freezedGearTokensNew = new BN(await stakingBitgear.freezedGearTokens());
            expect(allGearTokensNew).to.be.bignumber.that.equals(allGearTokens);
            expect(unfreezedGearTokens.sub(unfreezedGearTokensNew)).to.be.bignumber.that.equals(gearReward);
            expect(freezedGearTokensNew.sub(freezedGearTokens)).to.be.bignumber.that.equals(gearReward);

            let allLpTokensStakedNew = new BN(await stakingBitgear.allLpTokensStaked());
            expect(allLpTokensStakedNew.sub(allLpTokensStaked)).to.be.bignumber.that.equals(lpAmount);

            expect(await stakingBitgear.stakeListCount(user)).to.be.bignumber.that.equals(stakeCount.add(ONE));
        }

        async function testUnstake(user, stakeIndex, stakeId, numDaysInMonth, monthsInYear)
        {
            let allLpTokensStaked = new BN(await stakingBitgear.allLpTokensStaked());

            let stakeCount = await stakingBitgear.stakeListCount(user);
            assert(stakeIndex < stakeCount);

            let stakeIdInternal = (await stakingBitgear.stakeList(user, 0)).stakeId;
            assert(stakeId = stakeIdInternal);

            let startDay = (await stakingBitgear.stakeList(user, 0)).startDay;
            let numMonthsStake = (await stakingBitgear.stakeList(user, 0)).numMonthsStake;
            let stakedLP = (await stakingBitgear.stakeList(user, 0)).stakedLP;
            let stakedGear = (await stakingBitgear.stakeList(user, 0)).stakedGear;
            let freezedRewardGearTokens = (await stakingBitgear.stakeList(user, 0)).freezedRewardGearTokens;

            let allGearTokens = new BN(await stakingBitgear.allGearTokens());
            let unfreezedGearTokens = new BN(await stakingBitgear.unfreezedGearTokens());
            let freezedGearTokens = new BN(await stakingBitgear.freezedGearTokens());

            let userGearBalance = new BN(await token.balanceOf(user));
            let userLpBalance = new BN(await pairEthBitgear.balanceOf(user));

            let gearReward = ZERO;
            let month = ONE;
            let currDay = new BN(await stakingBitgear.currentDay());
            let servedMonths = currDay.sub(startDay).div(numDaysInMonth);
            if (servedMonths > numMonthsStake)
                servedMonths = numMonthsStake;
            while(month <= servedMonths)
            {
                gearReward =
                    gearReward.add(stakedGear.add(gearReward)
                        .mul(await stakingBitgear.MonthsApyPercentsNumerator(month.sub(ONE)))
                        .div(monthsInYear)
                        .div(await stakingBitgear.MonthsApyPercentsDenominator(month.sub(ONE))));

                month = month.add(ONE)
            }
            assert(gearReward <= freezedRewardGearTokens);

            await pairEthBitgear.approve(stakingBitgear.address, lpAmount, {from: user});
            await stakingBitgear.stakeEnd(lpAmount, numMonths, {from: user});

            let allGearTokensNew = new BN(await stakingBitgear.allGearTokens());
            let unfreezedGearTokensNew = new BN(await stakingBitgear.unfreezedGearTokens());
            let freezedGearTokensNew = new BN(await stakingBitgear.freezedGearTokens());
            expect(allGearTokens.sub(allGearTokensNew)).to.be.bignumber.that.equals(gearReward);
            expect(unfreezedGearTokensNew.sub(unfreezedGearTokens)).to.be.bignumber.that.equals(freezedRewardGearTokens.sub(gearReward));
            expect(freezedGearTokens.sub(freezedGearTokensNew)).to.be.bignumber.that.equals(freezedRewardGearTokens);

            let allLpTokensStakedNew = new BN(await stakingBitgear.allLpTokensStaked());
            expect(allLpTokensStaked.sub(allLpTokensStakedNew)).to.be.bignumber.that.equals(stakedLP);

            let userGearBalanceNew = new BN(await token.balanceOf(user));
            let userLpBalanceNew = new BN(await pairEthBitgear.balanceOf(user));
            expect(userLpBalanceNew.sub(userLpBalance)).to.be.bignumber.that.equals(stakedLP);
            expect(userGearBalanceNew.sub(userGearBalance)).to.be.bignumber.that.equals(gearReward);

            expect(await stakingBitgear.stakeListCount(user)).to.be.bignumber.that.equals(stakeCount.sub(ONE));

            return gearReward;
        }
    }
)