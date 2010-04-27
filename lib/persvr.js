/**
* Some backwards compatible functions for Persevere
*/

var modelModule = require("./model"),
	Model = modelModule.Model;
Class = function(schema){
	return global[schema.id] = Model(schema.id, schema);
};

load = function(id){
	var parts = id.split("/");
	var model = modelModule;
	for(var i = 1; i < parts.length - 1; i++){
		model = model.openObjectStore(parts[i]);
	}
	return model.get(parts[i]);
};

