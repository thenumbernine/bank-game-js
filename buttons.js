//touch screen stuff

var Button = makeClass({
	init : function(args) {
		var thiz = this;
		this.bbox = args.bbox;
		this.screenBBox = new box2({min:{x:0,y:0}, max:{x:0,y:0}});
		this.cmd = args.cmd;
		this.url = args.url;
		var fontSize = args.fontSize || 24;
		var callback = assertExists(args, 'callback');
		this.dom = $('<div>', {
			css:{
				backgroundColor:'rgb(255,255,255)',
				position:'absolute',
				textAlign:'center',
				fontSize:Math.ceil(fontSize*.65)+'pt',
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
			this.screenBBox.min.x = parseInt(width * this.bbox.min.x);
			this.screenBBox.min.y = parseInt(height * this.bbox.min.y);
			this.screenBBox.max.x = parseInt(width * this.bbox.max.x);
			this.screenBBox.max.y = parseInt(height * this.bbox.max.y);
		} else {
			this.screenBBox.min.y = parseInt(width * this.bbox.min.y);
			this.screenBBox.max.y = parseInt(width * this.bbox.max.y);
			this.screenBBox.min.x = parseInt(height * this.bbox.min.x);
			this.screenBBox.max.x = parseInt(height * this.bbox.max.x);
			if (this.bbox.min.x < 1 - this.bbox.max.x) {
				this.screenBBox.min.x = parseInt(height * this.bbox.min.x);
			} else {
				this.screenBBox.min.x = parseInt(width - height * (1 - this.bbox.min.x));
			}
			this.screenBBox.max.x = this.screenBBox.min.x + parseInt(height * (this.bbox.max.x - this.bbox.min.x));
			this.screenBBox.min.y = parseInt(height - width * (1 - this.bbox.min.y));
			this.screenBBox.max.y = this.screenBBox.min.y + parseInt(width * (this.bbox.max.y - this.bbox.min.y));
		}
		this.dom.style.left = this.screenBBox.min.x+'px';
		this.dom.style.top = this.screenBBox.min.y+'px';
		this.dom.style.width = (this.screenBBox.max.x - this.screenBBox.min.x) + 'px';
		this.dom.style.height = (this.screenBBox.max.y - this.screenBBox.min.y) + 'px';
	}
});

var buttonSys = new function() {
	/*
	args:
		fontSize
		callback = button event handler : function(string cmd, boolean press);
		buttons = [
			{
				string cmd,
				string url,
				box2 bbox (see /js/vec.js for box2)
			},
			...
		]
	*/
	this.init = function(args) {
		this.buttons = [];
		for (var i = 0; i < args.buttons.length; i++) {
			var buttonInfo = args.buttons[i];
			buttonInfo.fontSize = args.fontSize;
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
