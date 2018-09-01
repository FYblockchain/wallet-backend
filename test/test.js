const crypto = require('../utils/crypto');
const {rechargeKey, rechargeIv, putForwardKey, putForwardIv} = require('../config');
function encrypt() {
    const transactionHash = "0x111111111111111111111111111111111111111111";
    const address = "0x4F20A137C4bA0F6cf3B612E011F48Ab794cEd1f8";
    const value = 100;

    const encode = crypto.encrypt(JSON.stringify({uid : 0, transactionHash, address, value}), putForwardKey, putForwardIv);

    console.log(encode)
}

encrypt();