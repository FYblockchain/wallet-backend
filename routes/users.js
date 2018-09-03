/**
 * 配置express、router、config
 * @type {createApplication|e|(() => Express)}
 */
const express = require('express');
const router = express.Router();
const userService = require('../service/users');
const txService = require('../service/transactions');
const fetch = require('node-fetch');
const {network, mainMne, putForwardIv, putForwardKey, sendTransactionKey, sendTransactionIv} = require('../config');
const {putForwardApi} = require('../interface');
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
    if (id == mainAccountIndex || !reg.test(id)) {
        res.fail("--------id无效--------");
        return;
    }

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
    const reg = /^0x[1-9a-fA-F]{40}$/;
    if (!reg.test(address)) {
        res.fail("------------address无效------------");
        return;
    }

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
router.post("/transactions", async (req, res, next) => {

    //解密token
    const token = req.body.token;

    let decData;
    try {
        decData = crypto.decrypt(token, sendTransactionKey, sendTransactionIv);
        decData = JSON.parse(decData);
    } catch (e) {
        res.fail("权限错误");
        return;
    }

    //获取参数
    let transactionHash, address, value;
    transactionHash = decData.transactionHash;
    address = decData.address;
    value = decData.value;

    //交易持久化
    const findUser = await userService.findByAddress(address);
    if (findUser !== null) {
        await txService.createTransaction(findUser.uid, transactionHash, value);
        res.success({status: 0})
    } else {
        res.fail('no user');
    }
});


router.post("/transactions/commit", async (req, res, next) => {

    //解密token
    const token = req.body.token;
    let decData;
    try {
        decData = crypto.decrypt(token, sendTransactionKey, sendTransactionIv);
        decData = JSON.parse(decData);
    } catch (e) {
        res.fail("权限错误");
        return;
    }

    //获取参数
    let transactionHash, address;
    transactionHash = decData.transactionHash;
    address = decData.address;

    //交易完成，持久化status
    const findUser = await userService.findByAddress(address);
    if (findUser !== null) {
        const result = await txService.commitTransaction(findUser.uid, transactionHash);
        if (result) {
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
        res.fail("权限错误");
        return;
    }

    //主账户
    const mainAccount = await userService.mainAccount();

    //检查参数
    let id, value, address;
    id = decData.id;
    value = decData.value;
    address = decData.address;

    if (!id || !value || !address) {
        res.fail("参数错误");
        return;
    }

    //获取用户信息
    const idReg = /^[0-9]+$/;
    const addressReg = /^0x[1-9a-fA-F]{40}$/;

    if (id == mainAccountIndex || !idReg.test(id)) {
        res.fail("-------------id无效-------------");
        return;
    }
    if (!addressReg.test(address)) {
        res.fail("-------------address无效-------------");
        return;
    }

    let findUser;
    findUser = await userService.findById(id);
    if (findUser === null) {
        res.fail("-----------无法找到该用户id------------");
        return;
    }

    //用户提现信息加密
    const timestamp = Date.now() + random.generateRandom();
    const newToken = crypto.encrypt(JSON.stringify({
        timestamp: timestamp,
        address: address,
        value: value
    }), putForwardKey, putForwardIv);
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
        const failToken = crypto.encrypt(JSON.stringify({
            timestamp: timestamp,
            address: address,
            value: value,
            code: 10000
        }), putForwardKey, putForwardIv);
        fetch(putForwardApi, {
            method: 'POST',
            body: JSON.stringify({token: failToken}),
            headers: {'Content-Type': 'application/json'}
        }).then(res => res.json())
            .then(json => console.log(json))
            .catch(err => {
                console.error(err);
            });
        throw Error("---------子账户提现失败---------");
    }

    //主账户提现到用户账户
    try {
        console.log("----------正在从主账户提现到用户账户-------");
        await contract.methods.transfer(address, value).send({from: mainAccount, gas: "1000000"});
        console.log("----------从主账户提现到用户账户成功-------");
        // const customerBalance = await contract.methods.balanceOf(address).call({from: mainAccount});
    } catch (e) {
        const failToken = crypto.encrypt(JSON.stringify({
            timestamp: timestamp,
            address: address,
            value: value,
            code: 10000
        }), putForwardKey, putForwardIv);
        fetch(putForwardApi, {
            method: 'POST',
            body: JSON.stringify({token: failToken}),
            headers: {'Content-Type': 'application/json'}
        }).then(res => res.json())
            .then(json => console.log(json))
            .catch(err => {
                console.error(err);
            });
        throw Error("----------用户账户提现失败--------------");
    }

    const successToken = crypto.encrypt(JSON.stringify({
        timestamp: timestamp,
        address: address,
        value: value,
        code: 200
    }), putForwardKey, putForwardIv);

    fetch(putForwardApi, {
        method: 'POST',
        body: JSON.stringify({token: successToken}),
        headers: {'Content-Type': 'application/json'}
    }).then(res => res.json())
        .then(json => console.log(json))
        .catch(err => {
            console.error(err);
        });

});

module.exports = router;




