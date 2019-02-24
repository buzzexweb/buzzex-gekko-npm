var Buzzex = require('buzzex-npm');
var moment = require('moment');

var buzzex = new Buzzex(
    "API KEY",
    "API Secret",
    {timeout: +moment.duration(60, 'seconds')}
  );

/*const reqData = {
    pair: "BTC_ADZ",
    type: 'buy',
    rate: 0.00000162,
    amount: 12063.19
  };

buzzex.api('trade', reqData, console.log);*/