import {DOM, assertExists, hide, show} from '/js/util.js';
import {box2} from '/js/vec.js';

//touch screen stuff

class Button {
	constructor(args) {
		let thiz = this;
		this.bbox = args.bbox;
		this.screenBBox = new box2({min:{x:0,y:0}, max:{x:0,y:0}});
		this.cmd = args.cmd;
		this.url = args.url;
		let fontSize = args.fontSize || 24;
		let callback = assertExists(args, 'callback');
		this.dom = DOM('div', {
			css:{
				backgroundColor:'rgb(255,255,255)',
				position:'absolute',
				textAlign:'center',
				fontSize:Math.ceil(fontSize*.65)+'pt',
				background:'url('+args.url+') no-repeat',
				backgroundSize:'100%',
				zIndex:1,
				userSelect:'none',
			},
			appendTo : document.body,
		}, {
			mousedown : e => { callback(thiz.cmd, true, e); },
			mouseup : e => { callback(thiz.cmd, false, e); },
			mouseleave : e => { callback(thiz.cmd, false, e); },
			touchstart : e => { callback(thiz.cmd, true, e); },
			touchend : e => { callback(thiz.cmd, false, e); },
			touchcancel : e => { callback(thiz.cmd, false, e); },
		});
		hide(this.dom);
		this.dom.cmd = args.cmd;
		//.fadeTo(0, .75)
		//this.dom.fadeTo(0, 0);
		this.refresh();
	}
	refresh() {
		let width = window.innerWidth;
		let height = window.innerHeight;
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
}

class ButtonSys {
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
	constructor(args) {
		this.buttons = [];
		for (let i = 0; i < args.buttons.length; i++) {
			let buttonInfo = args.buttons[i];
			buttonInfo.fontSize = args.fontSize;
			buttonInfo.callback = args.callback;
			this.buttons.push(new Button(buttonInfo));
		}
	}

	//let hideFadeDuration = 5000;
	//let fadeButtonsTimeout = undefined;
	show() {
		for (let i = 0; i < this.buttons.length; i++) {
			let buttonDOM = this.buttons[i].dom;
			//buttonDOM.fadeTo(0,0);
			show(buttonDOM);
			//buttonDOM.fadeTo(0, .75);
		}
		/*if (fadeButtonsTimeout) clearTimeout(fadeButtonsTimeout);
		fadeButtonsTimeout = setTimeout(function() {
			for (let i = 0; i < this.buttons.length; i++) {
				let buttonDOM = this.buttons[i].dom;
				buttonDOM.fadeTo(1000, 0);
			}
		}, hideFadeDuration);*/
	}

	hide() {
		for (let i = 0; i < this.buttons.length; i++) {
			let buttonDOM = this.buttons[i].dom;
			hide(buttonDOM);
		}
	}

	onresize() {
		for (let i = 0; i < this.buttons.length; i++) {
			this.buttons[i].refresh();
		}
	}
}

export {ButtonSys};
