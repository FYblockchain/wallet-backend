const express = require('express');
const router = express.Router();
const txService = require('../service/transactions');

router.post("/commitAll", async (req, res, next) => {
    const result = await txService.findByStatus(0);
    result.forEach(async (tx) => {
        await txService.commitTransaction(tx.transactionHash);
    });

    res.success("成功");

});

module.exports = router;