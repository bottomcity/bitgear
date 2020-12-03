// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./uniswap/interface/IUniswapV2Pair.sol";
import "./WETH9.sol";

contract Interlayer
{
    IUniswapV2Pair public pair;
    IERC20 public gearToken;
    WETH9 public wethToken;

    bool private isToken0IsGearToken;

    constructor(
        IUniswapV2Pair _pair,
        IERC20 _gearToken,
        WETH9 _wethToken
    )
        public
    {
        pair = _pair;
        gearToken = _gearToken;
        wethToken = _wethToken;
        address token0 = pair.token0();
        address token1 = pair.token1();
        require(
            (token0 == address(gearToken) && token1 == address(wethToken)) ||
            (token1 == address(gearToken) && token0 == address(wethToken)),
            "Interlayer: Wrong pair"
        );
    }

    function getLpTokens(
        uint256 amountGearToken,
        uint256 amountWethToken
    )
        external
    {
        address sender = msg.sender;
        gearToken.transferFrom(sender, address(pair), amountGearToken);
        wethToken.transferFrom(sender, address(pair), amountWethToken);
        pair.mint(sender);
    }
}