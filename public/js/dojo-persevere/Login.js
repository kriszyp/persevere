dojo.provide("persevere.Login");

dojo.require("dijit.form.ValidationTextBox");
dojo.require("dijit.form.Button");
dojo.require("dijit.ProgressBar");
dojo.require("dijit.Dialog");

dojo.declare("persevere.Login", dijit.Dialog,
{
    // summary: A login/register Dialog for a persevere server
    //
    // description: 
    // Displays a dialog for logging into a persevere server and also allows new users
    // to register.  You can provide your own login and register forms via 'loginHref'
    // and 'registerHref'.  'Login' and 'Register' buttons will be automatically added
    // to the login dialog and 'Register' and 'Cancel' buttons will be automatically
    // added to the register dialog.
    //
    // example:
    // |    <div dojoType="dojox.data.persevere.Login" userUrl="/Class/User"></div>
    //
    // example:
    // |    var foo = new dojox.data.persevere.Login({userUrl: "/Class/User"});
	// |	dojo.body().appendChild(foo.domNode);
	// |	foo.startup();
    
    // TODO:  need to try to make this so that you can only have one instance per page.
    //        consider disabling the close (x) button on the dialog.
    
    // currentUser: Object
    //        The last user to be logged in via this widget.
    currentUser: null,
    
    // userUrl: String
    //        The url to the 'User' class.  This url is used to authenticate
    //        and create users.
    userUrl: 'Class/User',
    
    // loginHref: String
    //        The url to be used as the href to the login form.
    loginHref: dojo.moduleUrl("persevere", 'resources/login/login.html'),
    
    // loginMethod: String
    //        The name of the method belonging to the Class at 'userUrl' that authenticates a user
    loginMethod: "authenticate",
    
    // registerHref: String
    //        The url to be used as the href to the form used to register a new user.
    registerHref: dojo.moduleUrl("persevere", 'resources/login/register.html'),
    
    // registerMethod: String
    //        The name of the method belonging to the Class at 'userUrl' that creates a new user
    registerMethod: "createUser",
    
    // userField: String
    //        The name of the username field in the form at 'loginHref'.
    userField: 'username',
    
    // passField: String
    //        The name of the password field in the form at 'loginHref'.
    passField: 'password',
    
    // newUserField: String
    //        The name of the new username field in the form at 'registerHref'.
    newUserField: 'newUsername',
    
    // newPassField: String
    //        The name of the new password field in the form at 'registerHref'.
    newPassField: 'newPassword',
    
    // confirmPassField: String
    //        The name of the confirm password field in the form at 'registerHref'.
    confirmPassField: 'confirmPassword',
    
    _loginTitle: 'Login',
    _registerTitle: 'Add a new User',
    
	// how long the cookie should last, set to null for session-only authentication,
	//	defaults to 10 days
	cookieLength: 864000000,
	    
	constructor: function(options){
        dojo.mixin(this, options);
        // a progress bar to show that we're waiting on a response from the server
        this._busy = new dijit.ProgressBar({style:"display:none", indeterminate:true});
        // a place to put messages such as the error response from the server
        this._message = dojo.doc.createElement("div");
        dojo.query(this._message).style({color:"red", wordWrap:"break-word", width:"220px", margin:"auto"});
        // connect the ENTER key to the _onSubmit
        dojo.connect(this.domNode, "onkeypress", this, function(e){
            if(e.charOrCode == dojo.keys.ENTER){
                this._onSubmit();
            }
        });
    },
    
    startup: function(){
        this._showLogin();
    },
    
    _showLogin: function(){
        // summary: shows the login dialog
        this._message.innerHTML = '';
        var footer = dojo.doc.createElement('div');
        var buttons = dojo.doc.createElement('div');
        // need to find a better way to right-align the buttons - using dir:rtl and tabindex is not ideal
        buttons.setAttribute("dir", "rtl");
        var registerButton = new dijit.form.Button({type: "reset", label: "Register", tabIndex: "-1"}).placeAt(buttons);
        registerButton.onClick = dojo.hitch(this, "_showRegister");
        var loginButton = new dijit.form.Button({type: "submit", label: "Login"}).placeAt(buttons);
        footer.appendChild(buttons);
        footer.appendChild(this._message);
        this._busy.placeAt(footer);
        this.onDownloadEnd = function(){
            this.containerNode.appendChild(footer);
        };
        this.execute = this._login;
        this.attr("href", this.loginHref);
        this.attr("title", this._loginTitle);
        this.show();
    },
    
    _showRegister: function(){
        // summary: shows the register dialog
        this._message.innerHTML = '';
        var footer = dojo.doc.createElement('div');
        var buttons = dojo.doc.createElement('div');
        buttons.setAttribute("dir", "rtl");
        var cancelButton = new dijit.form.Button({type: "reset", label: "Cancel", tabIndex: "-1"}).placeAt(buttons);
        cancelButton.onClick = dojo.hitch(this, "_showLogin");
        var submitButton = new dijit.form.Button({type: "submit", label: "Register"}).placeAt(buttons);
        footer.appendChild(buttons);
        footer.appendChild(this._message);
        this._busy.placeAt(footer);
        this.onDownloadEnd = function(){
            this.containerNode.appendChild(footer);
        };
        this.execute = this._register;
        this.attr("href", this.registerHref);
        this.attr("title", this._registerTitle);
        this.show();
    },

    _login: function(form){
        // summary: this is the login action - it attempts to authenticate the user
        // using the "authenticate" method of the Class at 'userUrl' using the form params
        if (this.validate()){
            this._busy.attr("style", "display:block");
            dojo.xhrPost({
                url: this.userUrl,
                postData: dojo.toJson({method: this.loginMethod, id:"login", params:[form[this.userField], form[this.passField], this.cookieLength && new Date(new Date().getTime() + this.cookieLength).toGMTString()]}),
                handleAs: "json",
                headers: {Accept:"application/javascript, application/json"},
                load: dojo.hitch(this, "_loginLoad"),
                error: dojo.hitch(this, "_loginError")
            });
        } else {
            this._message.innerHTML = 'Input is not valid';
            this.show();    
        }
    },
    
    _loginLoad: function(response, request){
        // summary: handles the response to the authentication attempt
        this._busy.attr("style", "display:none");
        if (response.error != null){
            this._message.innerHTML = response.error;
            this.onLoginFail(response, request);
        } else {
            this.currentUser = response.result;
            this.onLoginSuccess(response, request);
        }
        return response;
    },
    
    _loginError: function(response, request){
        // summary: handles login errors
        this._busy.attr("style", "display:none");
        this.onLoginError(response, request);
        return response;
    },
    
    _register: function(form){
        // summary: this is the register action - it attempts to register a new user
        // using the 'registerMethod' of the Class at the 'userUrl'
        if (this.validate() && (form[this.newPassField] == form[this.confirmPassField])){
            this._busy.attr("style", "display:block");
            dojo.xhrPost({
                url: this.userUrl,
        	    postData: dojo.toJson({method: this.registerMethod,id:"register", params:[form[this.newUserField], form[this.newPassField]]}),
                handleAs: "json",
                load: dojo.hitch(this, "_registerLoad"),
                error: dojo.hitch(this, "_registerError")
            })
        } else {
            this._message.innerHTML = 'Input is not valid';
            this.show();
        }
    },
    
    _registerLoad: function(response, request){
        this._busy.attr("style", "display:none");
        if (response.error != null){
            this._message.innerHTML = response.error;    
            this.onRegisterFail(response, request);
        } else {
            this.onRegisterSuccess(response, request);
        }
        return response;
    },
    
    _registerError: function(response, request){
        this._busy.attr("style", "display:none");
        this.onRegisterError(response, request);
        return response;
    },
    
    login: function(){
        this._showLogin();
    },
    
    logout: function(callBack){
	    if (confirm("Are you sure you want to sign out?")) {
            dojo.xhrPost({
                url: this.userUrl,
                postData: dojo.toJson({
                    method: this.loginMethod,
                    id: "logout",
                    params: [null, null]
                }),
                handleAs: "json",
                handle: function(response, request){
                    this.currentUser = null;
                }
            }).addCallback(callBack);
        }
    },
    
    onLoginSuccess: function(response, request){
    },
    
    onLoginFail: function(response, request){
        this.show();
    },
    
    onLoginError: function(response, request){
		console.error("HTTP status code: ", request.xhr.status);
    }, 

    onRegisterSuccess: function(response, request){
        // change this to authenticate the user and add the rest of the 
        // register params to the new user object
       /* var form = this.attr("value");
        var user = response.result;
        for (var attr in form){
            if (!user[attr] && (attr != this.newUserField) && (attr != this.newPassField) && (attr != this.confirmPassField)){
                user[attr] = form[attr];
            }
        }
        var login = dojo.xhrPost({
            url: this.userUrl,
            postData: dojo.toJson({method: this.loginMethod, id:"login", params:[form[this.newUserField], form[this.newPassField]]}),
            handleAs: "json",
            handle: dojo.hitch(this, "_loginHandle"),
            error: dojo.hitch(this, "_loginError")
        });
        var call = {
            url: this.userUrl + response.result.id
            // pick up from here... - need to add the other fields to the user object.
        }
        login.addCallback(dojo.hitch(this, function(){
            dojo.xhrPut({
                url: this.userUrl + response.result.id
            })
        }));*/
        this._showLogin();
        this._message.innerHTML = 'Registration successful.  Please login.'
    },
    
    onRegisterFail: function(response, request){
        this.show();
    },
    
    onRegisterError: function(response, request){
		console.error("HTTP status code: ", request.xhr.status);
    }
});
