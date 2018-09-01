const mongoose = require('mongoose');
const Big = require('big.js');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    uid: {
        type: Number,
        require: true
    },
    transactionHash: {
        type: String,
        unique: true
    },
    value: Object,
    status: Number,
    updateTime: Date
});

const Transactions = mongoose.model("transaction", transactionSchema);
module.exports = Transactions;