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

const TOKEN = artifacts.require('Token');

const DECIMALS = new BN(18);
const NAME = "test"
const SYMBOL = "TST"
const INITIAL_SUPPLY = (new BN(10 ** 6)).mul(new BN((10 ** DECIMALS.toNumber()).toString()));

contract(
    'Token-test',
    ([
        tokenOwner,
        address1
    ]) => {
        let Token;

        beforeEach(async () => {
            // Init contracts

            Token = await TOKEN.new(NAME, SYMBOL, {from: tokenOwner});
        })

        it("#0 Deploy test", async () => {
            expect(await Token.name()).to.be.equals(NAME);
            expect(await Token.symbol()).to.be.equals(SYMBOL);
            expect(await Token.balanceOf(tokenOwner)).to.be.bignumber.that.equals(INITIAL_SUPPLY);
        })
    }
)