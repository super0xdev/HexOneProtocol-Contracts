const { ethers, network } = require("hardhat");
const {
    deploy,
    deployProxy,
    getCurrentTimestamp,
    spendTime,
    bigNum,
    smallNum,
    day,
    hour,
    getContract,
    upgradeProxy,
    verify,
    verifyProxy,
} = require("./utils");

const { uniswap_abi } = require("../external_abi/uniswap.abi.json");
const { erc20_abi } = require("../external_abi/erc20.abi.json");
const { hex_abi } = require("../external_abi/hex.abi.json");
const { getDeploymentParam } = require("./param");

async function deployBootstrap() {
    let param = getDeploymentParam();

    let hexOnePriceFeed = await getContract(
        "HexOnePriceFeedTest",
        "HexOnePriceFeedTest",
        network.name
    );

    hexOneToken = await getContract("HexOneToken", "HexOneToken", network.name);
    hexOneProtocol = await getContract(
        "HexOneProtocol",
        "HexOneProtocol",
        network.name
    );

    let HEXIT = await getContract("HEXIT", "HEXIT", network.name);

    let stakingPool = await getContract("HexOneStaking", "HexOneStaking", network.name);

    let sacrificeStartTime =
        BigInt(await getCurrentTimestamp()) + BigInt(param.sacrificeStartTime);

    let airdropStartTime =
        BigInt(sacrificeStartTime) +
        BigInt(day) * BigInt(param.sacrificeDuration) +
        BigInt(param.airdropStartTime);

    let bootstrapParam = {
        hexOnePriceFeed: hexOnePriceFeed.address,
        dexRouter: param.dexRouter,
        hexToken: param.hexToken,
        pairToken: param.usdcAddress,
        hexitToken: HEXIT.address,
        stakingContract: stakingPool.address,
        teamWallet: param.teamWallet,
        sacrificeStartTime: sacrificeStartTime,
        airdropStartTime: airdropStartTime,
        sacrificeDuration: param.sacrificeDuration,
        airdropDuration: param.airdropDuration,
        rateForSacrifice: param.rateForSacrifice,
        rateForAirdrop: param.rateForAirdrop,
        sacrificeDistRate: param.sacrificeDistRate,
        sacrificeLiquidityRate: param.sacrificeLiquidityRate,
        airdropDistRateForHexHolder: param.airdropDistRateForHexHolder,
        airdropDistRateForHEXITHolder: param.airdropDistRateForHEXITHolder,
    };

    let hexOneBootstrap = await deployProxy(
        "HexOneBootstrap",
        "HexOneBootstrap",
        [bootstrapParam]
    );

    let hexOneEscrow = await deployProxy("HexOneEscrow", "HexOneEscrow", [
        hexOneBootstrap.address,
        param.hexToken,
        hexOneToken.address,
        hexOneProtocol.address,
        hexOnePriceFeed.address,
    ]);

    return [hexOneBootstrap, hexOneEscrow];
}

async function deployProtocol() {
    let param = getDeploymentParam();

    let hexOneToken = await deploy(
        "HexOneToken",
        "HexOneToken",
        "HexOne",
        "HEXONE"
    );

    // let hexOneToken = await getContract("HexOneToken", "HexOneToken", network.name);

    let hexOnePriceFeed = await deployProxy(
        "HexOnePriceFeedTest",
        "HexOnePriceFeedTest",
        [param.hexToken, param.usdcAddress, param.dexRouter]
    );
    // let hexOnePriceFeed = await getContract(
    //     "HexOnePriceFeedTest",
    //     "HexOnePriceFeedTest",
    //     network.name
    // );

    let hexOneVault = await deployProxy("HexOneVault", "HexOneVault", [
        param.hexToken,
        hexOnePriceFeed.address,
    ]);

    let hexitToken = await deploy(
        "HEXIT",
        "HEXIT",
        "Hex Incentive Token",
        "HEXIT"
    );
    // let hexitToken = await getContract("HEXIT", "HEXIT", network.name);

    let hexOneStaking = await deployProxy("HexOneStaking", "HexOneStaking", [
        param.hexToken,
        hexitToken.address,
        hexOnePriceFeed.address,
        param.hexitDistRateForStaking,
    ]);

    let hexOneProtocol = await deploy(
        "HexOneProtocol",
        "HexOneProtocol",
        param.hexToken,
        hexOneToken.address,
        [hexOneVault.address],
        hexOneStaking.address,
        param.minStakingDuration,
        param.maxStakingDuration
    );
}

async function getContracts() {
    let hexToken = await getContract("HexMockToken", "HexMockToken", network.name);
    let hexOneToken = await getContract("HexOneToken", "HexOneToken", network.name);
    let hexOnePriceFeed = await getContract(
        "HexOnePriceFeedTest",
        "HexOnePriceFeedTest",
        network.name
    );

    let hexOneVault = await getContract("HexOneVault", "HexOneVault", network.name);
    let stakingPool = await getContract("HexOneStaking", "HexOneStaking", network.name);
    let hexOneProtocol = await getContract(
        "HexOneProtocol",
        "HexOneProtocol",
        network.name
    );

    let HEXIT = await getContract("HEXIT", "HEXIT", network.name);

    let hexOneBootstrap = await getContract(
        "HexOneBootstrap",
        "HexOneBootstrap",
        network.name
    );

    let hexOneEscrow = await getContract("HexOneEscrow", "HexOneEscrow", network.name);

    return [
        hexToken,
        hexOneToken,
        hexOnePriceFeed,
        hexOneVault,
        stakingPool,
        hexOneProtocol,
        HEXIT,
        hexOneBootstrap,
        hexOneEscrow,
    ];
}

async function initialize() {
    let [
        hexToken,
        hexOneToken,
        hexOnePriceFeed,
        hexOneVault,
        stakingPool,
        hexOneProtocol,
        HEXIT,
        hexOneBootstrap,
        hexOneEscrow,
    ] = await getContracts();

    console.log("hexOneToken.setAdmin");
    let tx = await hexOneToken.setAdmin(hexOneProtocol.address);
    await tx.wait();

    console.log("hexOneVault.setHexOneProtocol");
    tx = await hexOneVault.setHexOneProtocol(hexOneProtocol.address);
    await tx.wait();

    console.log("stakingPool.setBaseData");
    tx = await stakingPool.setBaseData(
        hexOneProtocol.address,
        hexOneBootstrap.address
    );
    await tx.wait();

    console.log("hexOneBootstrap.setEscrowContract");
    tx = await hexOneBootstrap.setEscrowContract(hexOneEscrow.address);
    await tx.wait();

    console.log("HEXIT.setBootstrap");
    tx = await HEXIT.setBootstrap(hexOneBootstrap.address);
    await tx.wait();
}

async function addLiquidity() {
    const [deployer] = await ethers.getSigners();
    let param = getDeploymentParam();
    let USDC = await getContract("HexOneMockToken", "MockUSDC", network.name);
    let uniswapRouter = new ethers.Contract(
        param.dexRouter,
        uniswap_abi,
        deployer
    );
    // let hexToken = new ethers.Contract(param.hexToken, erc20_abi, deployer);
    let hexToken = await getContract("HexMockToken", "HexMockToken", network.name);
    let hexAmountForLiquidity = bigNum(1000000, 8);
    let tx = await hexToken.mintTo(deployer.address, BigInt(hexAmountForLiquidity));
    await tx.wait();
    let usdcForLiquidity = bigNum(40000, 18);
    tx = await USDC.mintToken(BigInt(usdcForLiquidity), deployer.address);
    await tx.wait();

    tx = await USDC.approve(uniswapRouter.address, BigInt(usdcForLiquidity));
    await tx.wait();

    tx = await hexToken.approve(
        uniswapRouter.address,
        BigInt(hexAmountForLiquidity)
    );
    await tx.wait();
    tx = await uniswapRouter.addLiquidity(
        USDC.address,
        hexToken.address,
        BigInt(usdcForLiquidity),
        BigInt(hexAmountForLiquidity),
        0,
        0,
        deployer.address,
        BigInt(await getCurrentTimestamp()) + BigInt(100)
    );
    await tx.wait();
}

async function initializeSacrifice() {
    let hexOneBootstrap = await getContract(
        "HexOneBootstrap",
        "HexOneBootstrap",
        network.name
    );

    let hexToken = await getContract("HexMockToken", "HexMockToken", network.name);
    let mockUSDC = await getContract("HexOneMockToken", "MockUSDC", network.name);

    let tx = await hexOneBootstrap.setTokenWeight(
        [hexToken.address, mockUSDC.address],
        [5555, 3000]
    );
    await tx.wait();

    tx = await hexOneBootstrap.setAllowedTokens(
        [hexToken.address, mockUSDC.address],
        true
    );
    await tx.wait();
}

async function updateHexOneBootstrap() {
    let hexOneBootstrap = await getContract(
        "HexOneBootstrap",
        "HexOneBootstrap",
        network.name
    );
    await upgradeProxy("HexOneBootstrap", hexOneBootstrap.address);
    await verifyProxy("HexOneBootstrap", "HexOneBootstrap");
}

async function updateHexOneEscrow() {
    await verifyProxy("HexOneEscrow", "HexOneEscrow");
}

async function updateHexOneStaking() {
    let hexOneStaking = await getContract(
        "HexOneStaking",
        "HexOneStaking",
        network.name
    );

    let hexToken = await hexOneStaking.hexToken();
    let hexitToken = await hexOneStaking.hexitToken();
    let hexOnePriceFeed = await hexOneStaking.hexOnePriceFeed();
    let hexitDistRate = await hexOneStaking.hexitDistRate();

    await verify(hexOneStaking.address, [
        hexToken,
        hexitToken,
        hexOnePriceFeed,
        hexitDistRate,
    ]);
}

async function verifyHexMockToken() {
    let hexMockToken = await getContract("HexMockToken", "HexMockToken", network.name);
    await verify(hexMockToken.address);
}

async function verifyHexOneStaking() {
    await verifyProxy("HexOneStaking", "HexOneStaking");
}

async function upgradeHexOneStaking() {
    let hexOneStaking = await getContract(
        "HexOneStaking",
        "HexOneStaking",
        network.name
    );
    await upgradeProxy("HexOneStaking", "HexOneStaking", hexOneStaking.address);
}

async function verifyHexOneProtocol() {
    let param = getDeploymentParam();
    let hexOneToken = await getContract("HexOneToken", "HexOneToken", network.name);
    let hexOneVault = await getContract("HexOneVault", "HexOneVault", network.name);
    let hexOneStaking = await getContract(
        "HexOneStaking",
        "HexOneStaking",
        network.name
    );
    let hexOneProtocol = await getContract(
        "HexOneProtocol",
        "HexOneProtocol",
        network.name
    );

    await verify(hexOneProtocol.address, [
        param.hexToken,
        hexOneToken.address,
        [hexOneVault.address],
        hexOneStaking.address,
        param.minStakingDuration,
        param.maxStakingDuration,
    ]);
}

async function addAllowedTokensToStaking() {
    let mockUSDC = await getContract("HexOneMockToken", "MockUSDC", network.name);
    let hexToken = await getContract("HexMockToken", "HexMockToken", network.name);
    let staking = await getContract("HexOneStaking", "HexOneStaking", network.name);

    let tx = await staking.addAllowedTokens(
        [mockUSDC.address, hexToken.address],
        [
            {
                hexDistRate: 1500,
                hexitDistRate: 3000,
            },
            {
                hexDistRate: 1000,
                hexitDistRate: 2000,
            },
        ]
    );
    await tx.wait();
}

async function additionalAction() { }

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    console.log("deploy protocol");
    await deployProtocol();

    console.log("deploy Bootstrap");
    await deployBootstrap();

    console.log("initialize contracts");
    await initialize();

    console.log("add liquidity");
    await addLiquidity();

    await initializeSacrifice();

    console.log("Deployed successfully");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
