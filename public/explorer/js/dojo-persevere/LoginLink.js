dojo.provide("persevere.LoginLink");

dojo.require("persevere.Login");

dojo.declare("persevere.LoginLink", [dijit._Widget, dijit._Templated], {
	templateString: '<a href="#" dojoAttachEvent="onclick: onClick" dojoAttachPoint="link">Sign in</a>',
	mustLogin: false,
	constructor: function(){
		var plainXhr = dojo.xhr;
		var self = this;
		dojo.xhr = function(method,args,hasBody) {
			var dfd = plainXhr(method,args,hasBody);
			dfd.addBoth(function(){
				persevere.username = dfd.ioArgs.xhr.getResponseHeader("Username");
				dojo.addOnLoad(function(){
					self.link.innerHTML = persevere.username ? "Sign out" : "Sign in";
					if(!persevere.username && self.mustLogin && !self.showingLogin){
						self.showLogin();
					}
				});
			});
			return dfd;
		}
	},	 
	onClick: function(){
		if(persevere.username){
			if(confirm("Are you sure you want to sign out?")){
			    dojo.xhrPost({
					url: "Class/User",
					postData: dojo.toJson({method: "authenticate", id:"login", params:[null,null]}),
					handleAs: "json"
			    }).addCallback(function(){
			    	location.reload();
			    });
			}
		}else{
			this.showLogin();
		}
	},
	showLogin: function(){
		this.showingLogin = true;
	    var login = new persevere.Login({onLoginSuccess: function(){
	    	location.reload();
	    }});
	    dojo.body().appendChild(login.domNode);
	    login.startup();
	}
});
