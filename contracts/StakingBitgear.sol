// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./uniswap/interface/IUniswapV2Pair.sol";

contract StakingBitgear is Ownable
{
    using SafeMath for uint256;

    IUniswapV2Pair public pair;
    bool private ifGearZeroTokenInPair;
    IERC20 public gearAddress;

    uint256 public zeroDayStartTime;
    uint256 public dayDurationSec;
    uint256 constant public numDaysInMonth = 30;
    uint256 constant public monthsInYear = 12;
    modifier onlyWhenOpen
    {
        require(
            now >= zeroDayStartTime,
            "StakingBitgear: Contract is not open yet"
        );
        _;
    }

    uint256 public allLpTokensStaked;
    uint256 public allGearTokens;
    uint256 public unfreezedGearTokens;
    uint256 public freezedGearTokens;
    event LpTokensIncome(address who, uint256 amount, uint256 day);
    event LpTokensOutcome(address who, uint256 amount, uint256 day);
    event GearTokenIncome(address who, uint256 amount, uint256 day);
    event GearTokenOutcome(address who, uint256 amount, uint256 day);
    event TokenFreezed(address who, uint256 amount, uint256 day);
    event TokenUnfreezed(address who, uint256 amount, uint256 day);

    uint256 private stakeIdLast;
    uint256 constant public maxNumMonths = 3;
    uint256[] public MonthsApyPercentsNumerator = [15, 20, 30];
    uint256[] public MonthsApyPercentsDenominator = [100, 100, 100];
    struct StakeInfo
    {
        uint256 stakeId;
        uint256 startDay;
        uint256 numMonthsStake;
        uint256 stakedLP;
        uint256 stakedGear;
        uint256 freezedRewardGearTokens;
    }
    mapping(address => StakeInfo[]) public stakeList;
    event StakeStart(
        address who,
        uint256 LpIncome,
        uint256 gearEquivalent,
        uint256 gearEarnings,
        uint256 numMonths,
        uint256 day,
        uint256 stakeId
    );
    event StakeEnd(
        address who,
        uint256 stakeId,
        uint256 LpOutcome,
        uint256 gearEarnings,
        uint256 servedNumMonths,
        uint256 day
    );

    constructor(
        IUniswapV2Pair _pair,
        IERC20 _gearAddress,
        uint256 _zeroDayStartTime,
        uint256 _dayDurationSec
    )
        public
    {
        pair = _pair;
        gearAddress = _gearAddress;
        address token0 = pair.token0();
        address token1 = pair.token1();
        require(
            token0 == address(gearAddress) || token1 == address(gearAddress),
            "StakingBitgear: Invalid LP address"
        );
        zeroDayStartTime = _zeroDayStartTime;
        dayDurationSec = _dayDurationSec;
        ifGearZeroTokenInPair = (token0 == address(gearAddress));
        _testMonthsApyPercents();
    }

    function gearTokenDonation(uint256 amount) external
    {
        address sender = _msgSender();
        require(
            gearAddress.transferFrom(sender, address(this), amount),
            "StakingBitgear: Could not get gear tokens"
        );
        allGearTokens = allGearTokens.add(amount);
        unfreezedGearTokens = unfreezedGearTokens.add(amount);
        emit GearTokenIncome(sender, amount, _currentDay());
    }

    function stakeStart(uint256 amount, uint256 numMonthsStake) external onlyWhenOpen
    {
        require(
            numMonthsStake > 0 && numMonthsStake <= maxNumMonths,
            "StakingBitgear: Wrong number of months"
        );
        address sender = _msgSender();
        // Get LP tokens
        require(
            pair.transferFrom(sender, address(this), amount),
            "StakingBitgear: LP token transfer failed"
        );
        allLpTokensStaked = allLpTokensStaked.add(amount);
        uint256 currDay = _currentDay();
        emit LpTokensIncome(sender, amount, currDay);
        // Calculate equivalent of LP tokens in Gear tokens
        uint256 LpPairTotalSupply = pair.totalSupply();
        uint256 gearPairTotalReserves;
        //uint256 ethPairTotalReserves;
        if (ifGearZeroTokenInPair)
            (gearPairTotalReserves, /* ethPairTotalReserves */,) = pair.getReserves();
        else
            (/* ethPairTotalReserves */, gearPairTotalReserves,) = pair.getReserves();
        uint256 gearEquivalent = gearPairTotalReserves.mul(amount).div(LpPairTotalSupply);
        // Calculate earnings in Gear tokens that user will get
        uint256 gearEarnings = _getGearEarnings(gearEquivalent, numMonthsStake);
        // Freeze Gear tokens on contract
        require(
            unfreezedGearTokens >= gearEarnings,
            "StakingBitgear: Insufficient funds of Gear tokens to this stake"
        );
        unfreezedGearTokens = unfreezedGearTokens.sub(gearEarnings);
        freezedGearTokens = freezedGearTokens.add(gearEarnings);
        emit TokenFreezed(sender, gearEarnings, currDay);
        // Add stake into stakeList
        StakeInfo memory st = StakeInfo(
            ++stakeIdLast,
            currDay,
            numMonthsStake,
            amount,
            gearEquivalent,
            gearEarnings
        );
        stakeList[sender].push(st);
        emit StakeStart(
            sender,
            amount,
            gearEquivalent,
            gearEarnings,
            numMonthsStake,
            currDay,
            stakeIdLast
        );
    }

    function stakeEnd(uint256 stakeIndex, uint256 stakeId) external onlyWhenOpen
    {
        address sender = _msgSender();
        require(
            stakeIndex >= 0 && stakeIndex < stakeList[sender].length,
            "StakingBitgear: Wrong stakeIndex"
        );
        StakeInfo storage st = stakeList[sender][stakeIndex];
        require(
            st.stakeId == stakeId,
            "StakingBitgear: Wrong stakeId"
        );
        uint256 currDay = _currentDay();
        uint256 servedNumOfMonths = currDay.sub(st.startDay).div(numDaysInMonth);
        if (servedNumOfMonths > st.numMonthsStake)
            servedNumOfMonths = st.numMonthsStake;
        uint256 gearTokensToReturn = _getGearEarnings(st.stakedGear, servedNumOfMonths);
        require(
            st.freezedRewardGearTokens >= gearTokensToReturn,
            "StakingBitgear: Internal error!"
        );

        pair.transfer(sender, st.stakedLP);
        allLpTokensStaked = allLpTokensStaked.sub(st.stakedLP);
        emit LpTokensOutcome(sender, st.stakedLP, currDay);

        uint256 remainingGearTokens = st.freezedRewardGearTokens.sub(gearTokensToReturn);
        unfreezedGearTokens = unfreezedGearTokens.add(remainingGearTokens);
        freezedGearTokens = freezedGearTokens.sub(st.freezedRewardGearTokens);
        emit TokenUnfreezed(sender, st.freezedRewardGearTokens, currDay);
        allGearTokens = allGearTokens.sub(gearTokensToReturn);
        gearAddress.transfer(sender, gearTokensToReturn);
        emit GearTokenOutcome(sender, gearTokensToReturn, currDay);

        emit StakeEnd(
            sender,
            st.stakeId,
            st.stakedLP,
            gearTokensToReturn,
            servedNumOfMonths,
            currDay
        );
        _removeStake(stakeIndex, stakeId);
    }

    function stakeListCount(address who) external view returns(uint256)
    {
        return stakeList[who].length;
    }

    function currentDay() external view onlyWhenOpen returns(uint256)
    {
        return _currentDay();
    }

    function changeMonthsApyPercents(
        uint256 month,
        uint256 numerator,
        uint256 denominator
    )
        external
        onlyOwner
    {
        require(
            month > 0 && month <= maxNumMonths,
            "StakingBitgear: Wrong month"
        );
        MonthsApyPercentsNumerator[month.sub(1)] = numerator;
        MonthsApyPercentsDenominator[month.sub(1)] = denominator;
        _testMonthsApyPercents();
    }

    function _currentDay() private view returns(uint256)
    {
        return now.sub(zeroDayStartTime).div(dayDurationSec);
    }

    function _removeStake(uint256 stakeIndex, uint256 stakeId) private
    {
        address sender = _msgSender();
        uint256 stakeListLength = stakeList[sender].length;
        require(
            stakeIndex >= 0 && stakeIndex < stakeListLength,
            "StakingBitgear: Wrong stakeIndex"
        );
        StakeInfo storage st = stakeList[sender][stakeIndex];
        require(
            st.stakeId == stakeId,
            "StakingBitgear: Wrong stakeId"
        );
        if (stakeIndex < stakeListLength - 1)
            stakeList[sender][stakeIndex] = stakeList[sender][stakeListLength - 1];
        stakeList[sender].pop();
    }

    function _getGearEarnings(
        uint256 gearAmount,
        uint256 numOfMonths
    )
        private
        view
        returns (uint256 reward)
    {
        require(
            numOfMonths > 0 && numOfMonths <= maxNumMonths,
            "StakingBitgear: Wrong numOfMonths"
        );
        for (uint256 month = 1; month <= numOfMonths; ++month)
        {
            reward +=
                gearAmount.add(reward)
                    .mul(MonthsApyPercentsNumerator[month - 1])
                    .div(monthsInYear)
                    .div(MonthsApyPercentsDenominator[month - 1]);
        }
        return reward;
    }

    function _testMonthsApyPercents() private view
    {
        uint256 amount = 100000;
        require(
            maxNumMonths == 3,
            "StakingBitgear: Wrong MonthsApyPercents parameters"
        );
        require(
            amount
                .mul(MonthsApyPercentsNumerator[0])
                .div(MonthsApyPercentsDenominator[0])
                >=
            amount.mul(5).div(100),
            "StakingBitgear: Wrong MonthsApyPercents parameters"
        );
        require(
            amount
                .mul(MonthsApyPercentsNumerator[1])
                .div(MonthsApyPercentsDenominator[1])
                >=
            amount.mul(7).div(100),
            "StakingBitgear: Wrong MonthsApyPercents parameters"
        );
        require(
            amount
                .mul(MonthsApyPercentsNumerator[2])
                .div(MonthsApyPercentsDenominator[2])
                >=
            amount.mul(10).div(100),
            "StakingBitgear: Wrong MonthsApyPercents parameters"
        );
    }
}