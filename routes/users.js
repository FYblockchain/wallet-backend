/**
 * 配置express、router、config
 * @type {createApplication|e|(() => Express)}
 */
const express = require('express');
const router = express.Router();
const userService = require('../service/users');
const {network, mainMne, putForwardIv, putForwardKey} = require('../config');

/**
 * 配置解密
 * @type {module:crypto}
 */
const crypto = require('crypto');
const decipher = crypto.createDecipheriv('aes-128-ecb', putForwardKey, putForwardIv);


/**
 * 配置web3和合约信息
 * @type {string}
 */
const address = require('../contracts/address/address');
const abi = require('../contracts/abi/abi');
const Web3 = require('web3');
const HDWalletProvider = require("truffle-hdwallet-provider");
const provider = new HDWalletProvider(mainMne, network);
const web3 = new Web3(provider);


/**
 * 装载主账户
 * @type {number}
 */
const mainAccountIndex = 0;

userService.findById(mainAccountIndex).then((res) => {
    if (!res) {
        web3.eth.getAccounts().then((res) => {
            userService.createUser(mainAccountIndex, res);
        });
    }
});

/**
 * 装载智能合约
 * @type {Contract}
 */
const contract = new web3.eth.Contract(abi, address);


/**
 * 生成和获取地址api
 */
router.get('/address/:id', async (req, res, next) => {
    const id = req.params.id;
    const reg = /^[0-9]+$/;
    if (id == mainAccountIndex || !reg.test(id)) throw Error("--------------id无效--------------");

    let findUser;
    findUser = await userService.findById(id);

    if (findUser !== null) {
        res.success(findUser.address);
    } else {
        web3.setProvider(new HDWalletProvider(mainMne, network, id));
        const account = (await web3.eth.getAccounts())[0];
        await userService.createUser(id, account);
        res.success(account);
    }

});

/**
 * 提现api
 */
router.post('/putforward', async (req, res, next) => {

    //解析token
    const token = req.body.token;
    let decData;
    try {
        decData = decipher.update(token, "base64", "utf-8");
        decData += decipher.final("utf-8");
        decData = JSON.parse(decData);
    } catch (e) {
        throw Error("权限错误")
    }

    //主账户
    const mainAccount = await userService.mainAccount();

    //检查参数
    let id, value, address;
    id = decData.id;
    value = decData.value;
    address = decData.address;

    if (!id || !value || !address) throw Error("参数错误");

    //获取用户信息
    const reg = /^[0-9]+$/;
    if (id == mainAccountIndex || !reg.test(id)) throw Error("--------------id无效--------------");

    let findUser;
    findUser = await userService.findById(id);
    if (findUser === null) throw Error("-----------无法找到该用户id------------");

    res.success("验证成功，开始提现");

    //子账户转账到主账户

    web3.setProvider(new HDWalletProvider(mainMne, network));
    const balance = await contract.methods.balanceOf(findUser.address).call({from: mainAccount});
    console.log(balance);
    try {
        if (balance !== "0") {
            console.log("----------正在将子账户汇入主账户-----------");
            await contract.methods.tokenRetrieve(findUser.address, balance).send({from: mainAccount, gas: "1000000"});
            console.log("----------将子账户汇入主账户成功-----------");
        }
    } catch (e) {
        throw Error("---------子账户提现失败---------");
    }

    //主账户提现到用户账户
    try {
        console.log("----------正在从主账户提现到用户账户-------");
        await contract.methods.transfer(address, value).send({from: mainAccount, gas: "1000000"});
        console.log("----------从主账户提现到用户账户成功-------");
        // const customerBalance = await contract.methods.balanceOf(address).call({from: mainAccount});
    } catch (e) {
        throw Error("----------用户账户提现失败--------------");
    }

});

module.exports = router;


//测试接口
// router.post("/wallet/recharge/test", async (req, res, next) => {
//     console.log(req.body);
//     const token = req.body.token;
//     console.log(token);
//     res.send("ok");
// });

//获取账户余额
// router.get('/balance/:id', async (req, res, next) => {
//     const id = req.params.id;
//     let findUser;
//     try {
//         if(id == mainAccountIndex) throw Error;
//         findUser = await userService.findById(id);
//     } catch (e) {
//         res.fail("-------------id无效-------------");
//         return;
//     }
//
//     if (findUser === null) {
//         res.fail("-----------无法找到该用户id------------");
//         return;
//     }
//     const userBalance = await contract.methods.balanceOf(findUser.address).call({from: findUser.address});
//     res.success(userBalance);
// });

//用户的交易信息
// router.get('/transactions/:id', async (req, res, next) => {
//     const id = req.params.id;
//     let findUser;
//     try {
//         if(id == mainAccountIndex) throw Error;
//         findUser = await userService.findById(id);
//     } catch (e) {
//         res.fail("-------------id无效-------------");
//         return;
//     }
//
//     if (findUser === null) {
//         res.fail("-----------无法找到该用户id------------");
//         return;
//     }
//     res.success(findUser.transactionHash);
// });


