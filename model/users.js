const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    uid: {
        type: Number,
        require: true
    },
    address: {
        type: String
    },
});

const Users = mongoose.model("user", userSchema);
module.exports = Users;