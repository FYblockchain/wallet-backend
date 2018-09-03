/**
 * 连接数据库
 */

require('./db');

/**
 * 设置合约监听
 */
// require('./watchTransaction');

/**
 * catch async errors
 */
require('express-async-errors');


/**
 * 配置express，config
 * @type {createError}
 */
const createError = require('http-errors');
const express = require('express');
const app = express();
const { PORT } = require('./config');

/**
 * 配置日志
 * @type {morgan}
 */
const logger = require('morgan');

/**
 * post请求body解析器
 * @type {Parsers|*}
 */
const bodyParser = require('body-parser');


/**
 * 响应处理中间件
 */
app.use(require("./midware/responseMid"));
app.use(logger('combined'));

/**
 * post请求body parse json
 */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.json());
app.use(express.urlencoded({extended: false}));

/**
 * 静态页面
 */
// app.use(express.static(path.join(__dirname, 'public')));

/**
 * 钱包用户接口
 */
app.use('/users', require('./routes/users'));

app.use('/transactions', require('./routes/transactions'))

/**
 * 捕获404错误
 */
app.use(function (req, res, next) {
    next(createError(404));
});

/**
 * 其他错误处理
 */
app.use((err, req, res) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.fail(err.message);
});

app.listen(PORT);

module.exports = app;
