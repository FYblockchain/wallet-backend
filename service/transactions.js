const Transaction = require('../model/transactions');

createTransaction = async (uid, hash, value) => {
    const transaction = new Transaction({uid: uid, transactionHash: hash, value: value, status: 0, updateTime: Date.now()})
    await transaction.save();
};

commitTransaction = async (hash) => {
    const transaction = await Transaction.findOne({transactionHash: hash});
    if(transaction !== null) {
        transaction.status = 1;
        await transaction.save();
        return true;
    } else {
        return false;
    }
};

findByHash = async (hash) => {
    return await Transaction.findOne({transactionHash: hash});
};

findByStatus = async (status) => {
    return await Transaction.find({status: status});
};

module.exports = {
    createTransaction,
    commitTransaction,
    findByHash,
    findByStatus
};