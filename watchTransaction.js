/**
 * 设置事件监听
 * @type {string}
 */

require('./db');
const address = require('./contracts/address/address');
const abi = require('./contracts/abi/abi');
const Web3 = require('web3');
const userService = require("./service/users");
const txService = require("./service/transactions");

const {rechargeKey, rechargeIv, wsnetwork} = require('./config/index');
const fetch = require('node-fetch');

const crypto = require('crypto');
const Big = require('big.js');

const web3 = new Web3(new Web3.providers.WebsocketProvider(wsnetwork));
const contract = new web3.eth.Contract(abi, address);

/**
 * transfer事件监听
 */

contract.events.Transfer({}, {
    fromBlock: 0,
    toBlock: 'latest',
}, function (error, event) {
    if (error) {
        console.error(error);
    } else {
        const to = event.returnValues.to;
        const value = event.returnValues.value;
        const hash = event.transactionHash;

        let cipher = crypto.createCipheriv('aes-128-ecb', rechargeKey, rechargeIv);
        let encryptData = cipher.update(JSON.stringify({
            address: to,
            value: value
        }), "utf-8", "base64");
        encryptData += cipher.final("base64");

        userService.findByAddress(to)
            .then(user => {
                console.log(user);
                if (user !== null && user.uid !== 0) {
                    txService.createTransaction(user.uid, event.transactionHash, new Big(value));

                    return fetch("http://192.168.31.154/index.php/purse/recharge", {
                        method: 'POST',
                        body: JSON.stringify({token: encryptData}),
                        headers: {'Content-Type': 'application/json'}
                    });
                }
            }).then(res => {

            if (res.status === 200) {
                res.json().then(json =>{
                    console.log(json);
                    if(json.code === 1) {
                        txService.commitTransaction(hash)
                            .then(res => console.log({msg: "状态提交成功", code: json.code}))
                    }
                });
            } else {
                setTimeout(() => {
                    console.log("再次发送请求");
                    fetch("http://192.168.31.154/index.php/purse/recharge", {
                        method: 'POST',
                        body: JSON.stringify({token: encryptData}),
                        headers: {'Content-Type': 'application/json'}
                    }).then(res => {
                        if (res.status === 200) {
                            txService.commitTransaction(hash)
                                .then(res => console.log({msg: "状态提交成功", code: 1}));
                        } else {
                            console.error({code: res.status})
                        }
                    }).catch(err => {
                        console.error(err);
                    });
                }, 20000)
            }
        }).catch(e => {
            console.error(e)
        })

    }
});


