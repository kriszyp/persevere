/**
 * This module provides querying functionality, with a JSONQuery implementation
 * and a helper class for parsing JSONQueries 
 */
 
// The main function for executing JSONQueries
exports.jsonQuery = jsonQuery;

// its easier to write (and read) these as regular expressions (since that is how they are used)
var $prop = /(?:@?\.?([a-zA-Z_$][\w_$]*))/.source;
var $value = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/[\w_$]+\/[\w]+|\-?[0-9]+(?:\.[0-9]+)?(?:[eE]\-?[0-9]+)?|true(?![\w])|false(?![\w])|null(?![\w]))/.source;
var $comparator = /(===|!==|==|!=|>=|<=|=|<|>)/.source;
var $operator = /([\+\-\*\/\&\|\?\:])/.source;
var $logic = /([\&\|])/.source;
var $expression = /((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\]])*\]|[^\]])*)/.source;
var $filter = "(?:\\[?\\?" + $expression + "\\]?)";
var $sort = "(?:\\[[\\\\\\/]" + $expression + "\\])";
exports.QueryRegExp = QueryRegExp; 
function QueryRegExp(regexp){
	return new RegExp((regexp.source || regexp).replace(/\$[a-z]+/g, function(t){
		switch(t){
			case "$prop" : return $prop; 
			case "$value" : return $value; 
			case "$comparator" : return $comparator; 
			case "$operator" : return $operator; 
			case "$logic" : return $logic;
			case "$expression" : return $expression;
			case "$filter" : return $filter;
			case "$sort" : return $sort;
		}
		return t;
	}), (regexp.global ? "g" : "") + (regexp.ignoreCase ? "m" : ""));
}
function throwMaxIterations(){
	throw new Error("Query has taken too much computation, and the user is not allowed to execute resource-intense queries. Increase maxIterations in your config file to allow longer running non-indexed queries to be processed.");
}
exports.maxIterations = 10000;
function stringToValue(string){
	switch(string){
		case "true": return true;
		case "false": return false;
		case "null": return null;
		default:
			var number = parseFloat(string, 10);
			if(isNaN(number)){
				if(exports.compatible){
					if(string.charAt(0) == "'" && string.charAt(string.length-1) == "'"){
						return JSON.parse('"' + string.substring(1,string.length-1) + '"');
					}
				}
				return string;
			}
			return number;
	}
	
};
function convertComparator(comparator){
	switch(comparator){
		case "-+" : return "<";
		case "+-" : return ">";
		case "+=-" : return "=>";
		case "-=+" : return "=<";
	}
	return comparator;
}
exports.compatible = true;
exports.parseQuery = function(/*String*/query){
	if(exports.compatible){
		query = query.replace(/%3C=/g,"-=+").replace(/%3E=/g,"+=-").replace(/%3C/g,"-+").replace(/%3E/g,"+-");
	}
	var ast = {children:[], type:"group"};
	var originalAst = ast;
	query.replace(/(([\w%\._]+)([\-=\+!]+)([\+\-\w%\._]+))|([&\|,\)])|(([\+\-\w%\._]*)(\(?))/g, 
		function(t, expression, name, comparator, value, token, callOrGroup, methodOrValue, openParan){
			if(expression){
				comparison = {
					type:"comparison", 
					comparator: convertComparator(comparator), 
					name: decodeURIComponent(name),
					value: stringToValue(decodeURIComponent(value))
				};
				ast.children.push(comparison);
			}
			else if(callOrGroup){
				if(openParan){
					var newAst = {type:"group", children:[]};
					ast.children.push(newAst);
					newAst.parent = ast;
					ast = newAst;
					if(methodOrValue){
						ast.type = "call";
						ast.method = methodOrValue;
					}
				}
				else{
					ast.children.push(stringToValue(methodOrValue));
				}
			}
			else if(token){
				switch(token){
					case ')' : 
						ast = ast.parent;
						break;
					case '&' : case '|':
						if(!ast.logic){
							ast.logic = token;
						}
						else if(ast.logic != token){
							var newAst = {type:"group", children:[]};
							newAst.children.push(ast);
							if(ast.parent){
								ast.parent.children[ast.parent.length-1] = newAst;
							}
							// set the parent to that because a real paran should go up to the real parent
							newAst.parent = ast.parent;
							ast = newAst;
							ast.logic = token;
						}
				} 
			}
		});
	ast.logic = ast.logic || "&";
	return ast;
	/*
	var TOKEN = /\(|[\w%\._]+/g;
var OPERATOR = /[-=+!]+|\(/g;
var NEXT = /[&\|\)]/g;
	
	TOKEN.lastIndex = 0;
	function group(){
		var ast = [];
		var match = TOKEN.exec(query);
		if(match === '('){ 
			ast.push(group());
		}
		else{
			OPERATOR.lastIndex = TOKEN.lastIndex;
			var operator = OPERATOR.exec(query);
			var comparison = {};
			ast.push(comparison);
			if(operator == '('){
				comparison.type = "call";
				comparison.parameters = 
			}
			comparison.type = operator;
			
		}
		return ast;
	}
	return group();*/
}
function executeQuery(query, options, target){
	if(typeof query === "string"){
		query = parseQuery(query);
	}
	var methods = options.methods || {};
	if(!methods.sort){
		methods.sort = function(sortAttribute){
			var firstChar = sortAttribute.charAt(0);
			var ascending = true;
			if(firstChar == "-" || firstChar == "+"){
				if(firstChar == "-"){
					ascending = false;
				}
				sortAttribute = sortAttribute.substring(1);
			}
			this.sort(function(a, b){
				return ascending == a[sortAttribute] > b[sortAttribute] ? 1 : -1; 
			});
			return this;
		}
	}
	var first = true;
	var js = "";
	query.children.forEach(function(child){
		if(child.type == "comparison"){
			if(!options){
				throw new Error("Values must be set as parameters on the options argument, which was not provided");
			}
			if(first){
				js += "target = target.filter(function(item){return ";
				first = false;
			}
			else{
				js += query.logic + query.logic;
			}
			var index = (options.parameters = options.parameters || []).push(child.value);
			if(child.comparator == "="){
				child.comparator = "==";
			}
			js += "item." + child.name + child.comparator + "options.parameters[" + (index -1) + "]";
			
		}
		if(!first){
			js += "});";
		}
		else if(child.type == "call"){
			if(methods[child.method]){
				var index = (options.parameters = options.parameters || []).push(child.children);
				js += "target = methods." + child.method + ".apply(target,options.parameters[" + (index -1) + "]);";
			}
			else{
				throw new URIError("Invalid JSON Query syntax, " + child.method + " not implemented");
			}
		}
		else{
			throw new URIError("Invalid JSON Query syntax, unknown type");
		}
	});
	return eval(js + "target;"); 
	
}

function jsonQuery(/*String*/query, obj, args){
	// summary:
	// 		Performs a JSONQuery on the provided object and returns the results. 
	// 		If no object is provided (just a query), it returns a function that evaluates objects
	// 		according to the provided query.
	// query:
	// 		Query string
	// 	obj:
	// 		Target of the JSONQuery
	// 	description:
	// 	|	dojox.json.query("foo",{foo:"bar"}) - > "bar"
	// |	evaluator = dojox.json.query("?foo='bar'&rating>3");
	query = query.toString();
	var iterations = 0;
	// setup JSONQuery library
	function slice(obj,start,end,step){
		var i, results = [];
		if(step < 5){
			// do an iterator friendly
			i = 0;
			obj.forEach(function(item){
				if(i >= end){
					return results;
				}
				if(i >= start && i % step == 0){
					results.push(item);
				}
				i++;
				if(i > exports.maxIterations){
					throwMaxIterations();
				}
			});
			return results;
		}
		var len=obj.length;
		end = end || len;
		
		start = (start < 0) ? Math.max(0,start+len) : Math.min(len,start);
		end = (end < 0) ? Math.max(0,end+len) : Math.min(len,end);
		iterations += end - start;
		if(iterations > exports.maxIterations){
			throwMaxIterations();
		}
	  	for(i=start; i<end; i+=step){
	  		results.push(obj[i]);
	  	}
		return results;
	}
	function expand(obj,name){
		// name can be a property to search for, undefined for full recursive, or an array for picking by index
		var results = [];
		function walk(obj){
			if(name){
				if(name===true && !(obj instanceof Array)){
					//recursive object search
					results.push(obj);
				}else if(obj[name]){
					// found the name, add to our results
					results.push(obj[name]);
				}
			}
			obj.forEach(function(val){
				if(iterations++ > exports.maxIterations){
					throwMaxIterations();
				}
				if(!name){
					// if we don't have a name we are just getting all the properties values (.* or [*])
					results.push(val);
				}else if(val && typeof val == 'object'){
					walk(val);
				}
			});
		}
		if(name instanceof Array){
			// this is called when multiple items are in the brackets: [3,4,5]
			if(name.length==1){
				// this can happen as a result of the parser becoming confused about commas 
				// in the brackets like [@.func(4,2)]. Fixing the parser would require recursive 
				// analsys, very expensive, but this fixes the problem nicely. 
				return obj[name[0]];
			}
			for(var i = 0; i < name.length; i++){
				if(iterations++ > exports.maxIterations){
					throwMaxIterations();
				}
				results.push(obj[name[i]]);
			}
		}else{
			// otherwise we expanding
			walk(obj);
		}
		return results;
	}
		
	var _this = this; // persevere edit
	// persevere edit
	function filter(array,func){
		if(array.filter){
			return array.filter(func)
		}
		throw new Error("Can only filter on arrays, not objects");
	}
	// TODO: need some way to mark this as a date-string for comparison at the DB level
	function date(dateValue){
		return (arguments.length ? new Date(dateValue) : new Date()).getTime();
	}
	function map(array,func){
		return array.map(func);
	}
	var depth = 0;	
	var str = [];
	var __ids__={};
	var idNum = 0;
	query = query.replace(/\/([\w_$]+\/[\w]+)/,function(t,a){
			// TODO: load the object first and then store it so it doesn't need to be loaded on each iteration
			// handle object id literals
			if(pjs.absolutePathPrefix && ('/' + a).substring(pjs.absolutePathPrefix)){
				a = a.substring(pjs.absolutePathPrefix.length - 1);
			}
			__ids__['a' + idNum] = load(a);
			return "('" + a + "'&&__ids__.a" + (idNum++) + ')'; 
		}).
		replace(/"(\\.|[^"\\])*"|'(\\.|[^'\\])*'|[\[\]]/g,function(t){
		depth += t == '[' ? 1 : t == ']' ? -1 : 0; // keep track of bracket depth
		return (t == ']' && depth > 0) ? '`]' : // we mark all the inner brackets as skippable
				(t.charAt(0) == '"' || t.charAt(0) == "'") ? "`" + (str.push(t) - 1) :// and replace all the strings
					t;     
	});
	var prefix = '';
	function call(name){
		// creates a function call and puts the expression so far in a parameter for a call 
		prefix = name + "(" + prefix;
	}
	function makeRegex(t,a,b,c,d,e,f,g){
		// creates a regular expression matcher for when wildcards and ignore case is used 
		return str[g].match(/[\*\?]/) || f == '~' ?
				"/^" + str[g].substring(1,str[g].length-1).replace(/\\([btnfr\\"'])|([^\w\*\?])/g,"\\$1$2").replace(/([\*\?])/g,".$1") + (f == '~' ? '$/i' : '$/') + ".test(" + a + ")" :
				t;
	}
	query.replace(/(\]|\)|push|pop|shift|splice|sort|reverse)\s*\(/,function(){
		throw new Error("Unsafe function call");
	});
	
	query = query.replace(/([^=<>]=)([^=])/g,"$1=$2"). // change the equals to comparisons
		replace(/@|(\.\s*)?[a-zA-Z\$_]+(\s*:)?/g,function(t){
			return t.charAt(0) == '.' ? t : // leave .prop alone 
				t == '@' ? "$obj" :// the reference to the current object 
				//Persevere edit
				(t.match(/:|^(\$|Math|args|true|false|null|instanceof|date|__ids__)$/) ? "" : "$obj.") + t; // plain names should be properties of root... unless they are a label in object initializer
		}).
		replace(/\.?\.?\[(`\]|[^\]])*\]|[\(\,]?\?.*|\.\.([\w\$_]+)|\.\*/g,function(t,a,b){
			var oper = t.match(/^\.?\.?(\[\s*\?|\?|\[\s*==)(.*?)\]?$/); // [?expr] and ?expr and [=expr and =expr
			if(oper){
				var prefix = '';
				if(t.match(/^\./)){
					// recursive object search
					call("expand");
					prefix = ",true)";
				}
				call(oper[1].match(/\=/) ? "map" : "filter");//persevere edit
				return prefix + ",function($obj){try{return " + oper[2] + "}catch(e){}})"; 
			}
			oper = t.match(/^\[\s*([\/\\].*)\]/); // [/sortexpr,\sortexpr]
			if(oper){
				// make a copy of the array and then sort it using the sorting expression
				var first = true;
				return ".sort(" + oper[1].replace(/\s*,?\s*([\/\\])\s*([^,\\\/]+)/g,function(t,a,b){
					return (first ? (first=false) || '': ',') + "function($obj){return " + b + "}," + (a== "/");
				}) + ")";
			}
			oper = t.match(/^\[(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)\]/); // slice [0:3]
			if(oper){
				call("slice");
				return "," + (oper[1] || 0) + "," + (oper[2] || 0) + "," + (oper[3] || 1) + ")"; 
			}
			if(t.match(/^\.\.|\.\*|\[\s*\*\s*\]|,/)){ // ..prop and [*]
				call("expand");
				return (t.charAt(1) == '.' ? 
						",'" + b + "'" : // ..prop 
							t.match(/,/) ? 
								"," + t : // [prop1,prop2]
								"") + ")"; // [*]
			}
			return t;
		}).
		replace(/([\(\,])\?(((\([^\)]*\))|[^\),])*)([\),])/,function(t,a,b,c,d,e){
			// handle func(?expr)
			return a + "function($obj){try{return " + b + "}catch(e){}}" + e; 
		}).
		replace(/\.(class|this|null|function|extends|instanceof|var)(\W)/,function(t,a,b){
			// fix reserved words
			return '["' + a + '"]' + b;
		}).
		replace(/(\$obj\s*((\.\s*[\w_$]+\s*)|(\[\s*`([0-9]+)\s*`\]))*)(==|~)\s*`([0-9]+)/g,makeRegex). // create regex matching
		replace(/`([0-9]+)\s*(==|~)\s*(\$obj\s*((\.\s*[\w_$]+)|(\[\s*`([0-9]+)\s*`\]))*)/g,function(t,a,b,c,d,e,f,g){ // and do it for reverse =
			return makeRegex(t,c,d,e,f,g,b,a);
		});
	query = prefix + (query.charAt(0) == '$' ? "" : "$") + query.replace(/`([0-9]+|\])/g,function(t,a){
		//restore the strings
		return a == ']' ? ']' : str[a];
	});
	// create a function within this scope (so it can use expand and slice)
	
	var executor = eval("1&&function($,$1,$2,$3,$4,$5,$6,$7,$8,$9){var $obj=$;return " + query + "}");
	
	for(var i = 0;i<arguments.length-1;i++){
		arguments[i] = arguments[i+1];
	}
	return obj ? executor.apply(this,arguments) : executor;
	
};