//touch screen stuff
//TODO make everything below this point its own thing in its own file
//and include it in this file

var Button = makeClass({
	fontSize : 24,
	init : function(args) {
		var thiz = this;
		this.bbox = args.bbox;
		this.screenBBox = {min:[0,0], max:[0,0]};
		this.cmd = args.cmd;
		this.url = args.url;
		var callback = assertExists(args, 'callback');
		this.dom = $('<div>', {
			css:{
				backgroundColor:'rgb(255,255,255)',
				position:'absolute',
				textAlign:'center',
				fontSize:Math.ceil(this.fontSize*.65)+'pt',
				background:'url('+args.url+') no-repeat',
				backgroundSize:'100%',
				zIndex:1
			}
		}).mousedown(function() {
			callback(thiz.cmd, true);
		}).mouseup(function() {
			callback(thiz.cmd, false);
		}).mouseleave(function() {
			callback(thiz.cmd, false);
		}).bind('touchstart', function() {
			callback(thiz.cmd, true);
		}).bind('touchend', function() {
			callback(thiz.cmd, false);
		}).bind('touchcancel', function() {
			callback(thiz.cmd, false);
		})
			.fadeTo(0, .75)
			.hide()
			.appendTo(document.body).get(0);
		this.dom.cmd = args.cmd;
		//$(this.dom).fadeTo(0, 0);
		$(this.dom).disableSelection();
		this.refresh();
	},
	refresh : function() {
		var width = $(window).width();
		var height = $(window).height();
		//TODO this is good when we are landscape.
		//base portrait on the same spaces, and anchor it to the closest respective corner
		if (width > height) {
			this.screenBBox.min[0] = parseInt(width * this.bbox.min[0]);
			this.screenBBox.min[1] = parseInt(height * this.bbox.min[1]);
			this.screenBBox.max[0] = parseInt(width * this.bbox.max[0]);
			this.screenBBox.max[1] = parseInt(height * this.bbox.max[1]);
		} else {
			this.screenBBox.min[1] = parseInt(width * this.bbox.min[1]);
			this.screenBBox.max[1] = parseInt(width * this.bbox.max[1]);
			this.screenBBox.min[0] = parseInt(height * this.bbox.min[0]);
			this.screenBBox.max[0] = parseInt(height * this.bbox.max[0]);
			if (this.bbox.min[0] < 1 - this.bbox.max[0]) {
				this.screenBBox.min[0] = parseInt(height * this.bbox.min[0]);
			} else {
				this.screenBBox.min[0] = parseInt(width - height * (1 - this.bbox.min[0]));
			}
			this.screenBBox.max[0] = this.screenBBox.min[0] + parseInt(height * (this.bbox.max[0] - this.bbox.min[0]));
			this.screenBBox.min[1] = parseInt(height - width * (1 - this.bbox.min[1]));
			this.screenBBox.max[1] = this.screenBBox.min[1] + parseInt(width * (this.bbox.max[1] - this.bbox.min[1]));
		}
		this.dom.style.left = this.screenBBox.min[0]+'px';
		this.dom.style.top = this.screenBBox.min[1]+'px';
		this.dom.style.width = (this.screenBBox.max[0] - this.screenBBox.min[0]) + 'px';
		this.dom.style.height = (this.screenBBox.max[1] - this.screenBBox.min[1]) + 'px';
	}
});

var buttonSys = new function() {
	/*
	args:
		callback = button event handler : function(string cmd, boolean press);
		buttons = [
			{
				string cmd,
				string url,
				bbox = {min = [x,y], max = [x,y]}
			},
			...
		]
	*/
	this.init = function(args) {
		this.buttons = [];
		for (var i = 0; i < args.buttons.length; i++) {
			var buttonInfo = args.buttons[i];
			buttonInfo.callback = args.callback;
			this.buttons.push(new Button(buttonInfo));
		}
	};

	//var hideFadeDuration = 5000;
	//var fadeButtonsTimeout = undefined;
	this.show = function() {
		for (var i = 0; i < this.buttons.length; i++) {
			var buttonDOM = this.buttons[i].dom;
			//$(buttonDOM).fadeTo(0,0);
			$(buttonDOM).show();
			//$(buttonDOM).fadeTo(0, .75);
		}
		/*if (fadeButtonsTimeout) clearTimeout(fadeButtonsTimeout);
		fadeButtonsTimeout = setTimeout(function() {
			for (var i = 0; i < this.buttons.length; i++) {
				var buttonDOM = this.buttons[i].dom;
				$(buttonDOM).fadeTo(1000, 0);
			}
		}, hideFadeDuration);*/
	};

	this.hide = function() {
		for (var i = 0; i < this.buttons.length; i++) {
			var buttonDOM = this.buttons[i].dom;
			$(buttonDOM).hide();
		}
	};

	this.onresize = function() {
		for (var i = 0; i < this.buttons.length; i++) {
			this.buttons[i].refresh();
		}
	};
};
