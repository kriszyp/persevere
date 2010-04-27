dojo.provide("persevere.persevere");
dojo.require("dojox.rpc.JsonRest");

(function(){
	var jr = dojox.rpc.JsonRest;
	var username = null;
	var plainXhr = dojo.xhr;
	dojo.xhr = function(method,args,hasBody) {
		dfd = plainXhr(method,args,hasBody);
		dfd.addCallback(function(){
			username = dfd.ioArgs.xhr.getResponseHeader("Username");
		});
		return dfd;
	};
	function lazyLoad(value, callback){
		value._loadObject(function(result){
			delete value._loadObject;
			callback(result);
		});
	}
	pjs = {
		commit: function(callback){
			jr.commit({onComplete:callback});
		},
		rollback: jr.revert,
		changing: jr.changing,
		
		get: function(/*Object*/ item, /*String*/property, callback){
			// summary:
			//	Gets the value of an item's 'property'
			//
			//	item: 
			//		The item to get the value from
			//	property: 
			//		property to look up value for	
			//	callback: 
			//		An optional callback to be called when get is finished if it is a lazy value 
			var value = item[property];
			if(callback){
				if(value && value._loadObject){
					lazyLoad(value, callback);
				}else{
					callback(value);
				}
			}
			return value;
		},
		set: function(object, property, value){
			jr.changing(object);
			object[property]=value;
		},
		getId: function(object){
			return object.__id;
		},
		load: function(id,	callback){
			if(id.match(/[^\/\w]|(\/$)/)){
				// clear the cache if it is a query
				delete dojox.rpc.Rest._index[id]; 
			}
			jr.fetch(id).addBoth(function(result){
				callback(result);
				return result;
			});
		},
		remove: function(object){
			jr.deleteObject(object);
		},
		isPersisted: function(object){
			return !!object.__id;
		},
		getUserName: function(){
			return username;
		},
		loadClasses: function(/*String?*/path,/*Function?*/callback, /*Object*/scope){
			// summary:
			//		Loads the a set of classes/tables/schemas from the server
			// path:
			//		 URL of the Persevere server's root, this normally just "/"
			//		 which is the default value if the target is not provided
			// callback:
			//		 Allows the operation to happen asynchronously
			// scope:
			//			An object that the returned classes will be defined in, as a namespace container
			// return:
			//		 A map/object of datastores. The name of each property is a the name of a store,
			//		 and the value is the actual data store object.
			path = (path && (path.match(/\/$/) ? path : (path + '/'))) || '/';
			if(path.match(/^\w*:\/\//)){
				// if it is cross-domain, we will use window.name for communication
				
				dojox.io.xhrWindowNamePlugin(path, dojox.io.xhrPlugins.fullHttpAdapter, true);
			}
			var rootService= dojox.rpc.Rest(path,true);
			var lastSync = dojox.rpc._sync;
			dojox.rpc._sync = !callback;
			var dfd = rootService("root");//dojo.xhrGet({url: target, sync:!callback, handleAs:'json'});
			var results;
			//if no scope (namespace container) is provided, use window
			scope = scope || window;
			dfd.addBoth(function(schemas){
				for(var i in schemas){
					if(typeof schemas[i] == 'object'){
						scope[i] = schemas[i] = dojox.rpc.JsonRest.getConstructor(new dojo._Url(path,i) + '/', schemas[i]);
					}
				}
				return (results = schemas);
			});
			dojox.rpc._sync = lastSync;
			return callback ? dfd.addBoth(callback) : results;
		}		
	};	
})();
