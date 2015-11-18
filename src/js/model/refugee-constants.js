
var moment = require('moment');

// note that month indices are zero-based

module.exports.DATA_START_YEAR = 2011;
module.exports.DATA_START_MONTH = 0;

module.exports.DATA_END_YEAR = 2015;
module.exports.DATA_END_MONTH = 9;

module.exports.DATA_END_MOMENT = moment([
	module.exports.DATA_END_YEAR,
	module.exports.DATA_END_MONTH, 30]);

module.exports.disableLabels = [];

module.exports.labelShowBreakPoint = 600;
