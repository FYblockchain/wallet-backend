/**
 * 配置express、router、config
 * @type {createApplication|e|(() => Express)}
 */
const express = require('express');
const router = express.Router();
const userService = require('../service/users');
const txService = require('../service/transactions');
const fetch = require('node-fetch');
const { network, mainMne, putForwardIv, putForwardKey, sendTransactionKey, sendTransactionIv } = require('../config');
const { putForwardApi } = require('../interface');

/**
 * 配置加解密
 * @type {module:crypto}
 */
const crypto = require('../utils/crypto');
const random = require('../utils/randomUtil');
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
 * 检查address是否存在
 */

router.get('/checkAddress/:address', async (req, res, next) => {
    const address = req.params.address;
    const reg = /^0x.{40}$/;
    if (!reg.test(address)) throw Error("--------------address无效--------------");

    let findUser;
    findUser = await userService.findByAddress(address);

    if (findUser !== null) {
        res.success({address});
    } else {
        res.success({address: null});
    }

});

/**
 * 添加交易信息
 */
router.post("/transactions", async (req, res, next) =>{

    //解密token
    const token = req.body.token;

    let decData;
    try {
        decData = crypto.decrypt(token, sendTransactionKey, sendTransactionIv);
        decData = JSON.parse(decData);
    } catch (e) {
        throw Error("权限错误")
    }

    //获取参数
    let transactionHash, address, value;
    transactionHash = decData.transactionHash;
    address = decData.address;
    value = decData.value;

    //交易持久化
    const findUser = await userService.findByAddress(address);
    if(findUser !== null) {
        await txService.createTransaction(findUser.uid, transactionHash, value);
        res.success({status: 0})
    } else {
        res.fail('no user');
    }
});


router.post("/transactions/commit", async (req, res, next) =>{

    //解密token
    const token = req.body.token;
    let decData;
    try {
        decData = crypto.decrypt(token, sendTransactionKey, sendTransactionIv);
        decData = JSON.parse(decData);
    } catch (e) {
        throw Error("权限错误")
    }

    //获取参数
    let transactionHash, address;
    transactionHash = decData.transactionHash;
    address = decData.address;

    //交易完成，持久化status
    const findUser = await userService.findByAddress(address);
    if(findUser !== null) {
        const result = await txService.commitTransaction(findUser.uid, transactionHash);
        if(result) {
            res.success("提交成功");
        } else {
            res.fail("no transaction")
        }

    } else {
        res.fail('no user');
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
        decData = crypto.decrypt(token, putForwardKey, putForwardIv);
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

    //用户提现信息加密
    const newToken = crypto.encrypt(JSON.stringify({timestamp: (Date.now() + random.generateRandom()), address: address, value: value}), putForwardKey, putForwardIv);
    res.success({token: newToken});


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

    fetch(putForwardApi, {
        method: 'POST',
        body: JSON.stringify({token: newToken}),
        headers: {'Content-Type': 'application/json'}
    }).then(res => res.json())
        .then(json => console.log(json))
        .catch(err => {
            console.error(err);
        });

});

module.exports = router;




