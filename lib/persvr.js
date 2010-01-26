/**
* Some backwards compatible functions for Persevere
*/

var Model = require("./model").Model;
Class = function(schema){
	return global[schema.id] = Model(schema.id, schema);
};