/**
 * 基础依赖配置
 * @type {createApplication|e|(() => Express)}
 */
const express = require('express');
const router = express.Router();
const txService = require('../service/transactions');
const userService = require('../service/users')
const fetch = require('node-fetch');
const {rechargeApi} = require('../interface');
const {rechargeIv, rechargeKey} = require('../config');

const crypto = require('../utils/crypto');

/**
 * 将数据库内所有未提交信息提交
 * @type {createApplication|e|(() => Express)}
 */

router.post("/commitAll", async (req, res, next) => {

    const token = req.body.token;
    let decData;
    try {
        decData = crypto.decrypt(token, rechargeKey, rechargeIv);
    } catch (e) {
        throw Error("权限错误");
    }

    const result = await txService.findByStatus(0);

    for (let i = 0; i < result.length; i++) {
        const user = await userService.findById(result[i].uid);
        if (user !== null) {

            let encryptData = crypto.encrypt(JSON.stringify({
                address: user.address,
                value: result[i].value
            }), rechargeKey, rechargeIv)

            setTimeout(function () {
                fetch(rechargeApi, {
                    method: 'POST',
                    body: JSON.stringify({token: encryptData}),
                    headers: {'Content-Type': 'application/json'}
                })
                    .then(res => res.json())
                    .then(json => {
                        console.log(json);
                        if (json.code === 1) {
                            txService.commitTransaction(result[i].transactionHash)
                                .then(res => console.log({msg: "状态提交成功", code: json.code}))
                        }
                    })

            }, i * 1000);

        }

    }

    res.success("操作正在执行");
});

module.exports = router;