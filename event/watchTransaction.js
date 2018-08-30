/**
 * 设置事件监听
 * @type {string}
 */

const address = require('../contracts/address/address');
const abi = require('../contracts/abi/abi');
const Web3 = require('web3');
const userService = require("../service/users");

const {rechargeKey, rechargeIv, wsnetwork} = require('../config');
const fetch = require('node-fetch');

const crypto = require('crypto');
const cipher = crypto.createCipheriv('aes-128-ecb', rechargeKey, rechargeIv);

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
        let address = event.returnValues.to;
        userService.findByAddress(address).then((user) => {
            // console.log(user);
            if (user !== null) {
                let encryptData = cipher.update(JSON.stringify({
                    address,
                    value: event.returnValues.value
                }), "utf-8", "base64");
                encryptData += cipher.final("base64");

                fetch("http://localhost:8090/users/wallet/recharge/test", {
                    method: 'POST',
                    body: JSON.stringify({token: encryptData}),
                    headers: {'Content-Type': 'application/json'}
                }).then(res => {
                    console.log({code: res.status});
                }).catch(err => {
                    console.error(err);
                });

            }
        }).catch(e => {
            console.error(e);
        });
    }
});

