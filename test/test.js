const crypto = require('crypto');
const {sendTransactionKey, sendTransactionIv} = require('../config');
function encrypt() {
    const transactionHash = "0x111111111111111111111111111111111111111111";
    const address = "0x4F20A137C4bA0F6cf3B612E011F48Ab794cEd1f8";
    const value = 100;

    const cipheriv = crypto.createCipheriv("aes-128-ecb", sendTransactionKey, sendTransactionIv);
    let encode = cipheriv.update(JSON.stringify({transactionHash, address, value}),"utf-8", "base64");
    encode += cipheriv.final("base64");

    console.log(encode)
}

encrypt();