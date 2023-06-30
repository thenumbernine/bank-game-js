import {getIDs, DOM, removeFromParent, arrayClone, hide, show, hidden, toggleHidden, assertExists, preload} from '/js/util.js';
import {box2} from '/js/vec.js';
import {ButtonSys} from './buttons.js';

const ids = getIDs();
window.ids = ids;

const urlparams = new URLSearchParams(window.location.search);

function goodisfinite(x) {
	return typeof(x) == 'number' &&
		!isNaN(x) &&
		x !== Infinity &&
		x !== -Infinity;
}

//TODO just use class=page?
function hideAllPages() {
	document.querySelectorAll('[class="page"]').forEach(page => {
		hide(page);
	});
}

let activePage;
function changePage(id) {
	hideAllPages();
	activePage = ids[id];
	show(ids[id]);
}

let canvas, glutil, gl;

class Rect {
	constructor() {
		this.left = 0;
		this.right = 0;
		this.top = 0;
		this.bottom = 0;
	}
}

const Dir = {
	NONE : -1,
	UP : 0,
	DOWN : 1,
	LEFT : 2,
	RIGHT : 3,
	COUNT : 4,

	vec : [
		[0,-1],
		[0,1],
		[-1,0],
		[1,0]
	]
};

class MapType {
	constructor(bitmapId, flags) {
		this.bitmapId = bitmapId;
		if (this.bitmapId === undefined) this.bitmapId = 0;
		this.flags = flags;
		if (this.flags === undefined) this.flags = 0;
		this.typeIndex = 0;
	}
}
MapType.prototype.CANNOT_PASSTHRU = 1;	//blocks any moving thing
MapType.prototype.DRAW_GROUND_UNDER = 2;	//special for trees and other semi-transparent ones
MapType.prototype.BLOCKS_GUNSHOT = 4;	//blocks shots from guns
MapType.prototype.BLOCKS_EXPLOSIONS = 8;	//explosions stop here.  then they check BOMBABLE and clear the tile if it's bombable
MapType.prototype.BOMBABLE = 16;			//bomb this type of block to return it to empty


class Frame {
	constructor(bitmapId, duration, frameChange, sequenceMarker) {
		this.bitmapId = bitmapId;
		if (this.bitmapId === undefined) this.bitmapId = 0;
		this.duration = duration !== undefined ? duration : 1;	//in frames
		this.frameChange = frameChange !== undefined ? frameChange : 0;
		this.sequenceMarker = sequenceMarker !== undefined ? sequenceMarker : 0;
	}
}

class Animation {
	constructor() {
		for (let i = 0; i < this.framesForSeq.length; i++) {
			this.framesForSeq[i] = -1;
			for (let j = 0; j < this.frames.length; j++) {
				if (this.frames[j].sequenceMarker == i) {
					this.framesForSeq[i] = j;
					break;
				}
			}
		}

		for (let i = 0; i < this.frames.length; i++) {
			let frame = this.frames[i];
			frame.bitmap = DOM('img', {src:'res/drawable/'+frame.bitmapId+'.png'});
		}
	}

	getFrameForSeq(seq) {
		if (seq < 0 || seq >= this.framesForSeq.length) return -1;
		return this.framesForSeq[seq];
	}
}


Animation.prototype.SEQ_PLAYER_STAND_UP = 0;
Animation.prototype.SEQ_PLAYER_STAND_DOWN = 1;
Animation.prototype.SEQ_PLAYER_STAND_LEFT = 2;
Animation.prototype.SEQ_PLAYER_STAND_RIGHT = 3;
Animation.prototype.SEQ_PLAYER_WALK_UP = 4;
Animation.prototype.SEQ_PLAYER_WALK_DOWN = 5;
Animation.prototype.SEQ_PLAYER_WALK_LEFT = 6;
Animation.prototype.SEQ_PLAYER_WALK_RIGHT = 7;
Animation.prototype.SEQ_PLAYER_DEAD = 17;

Animation.prototype.SEQ_MONEY = 8;
Animation.prototype.SEQ_KEY = 9;
Animation.prototype.SEQ_KEY_GREY = 10;
Animation.prototype.SEQ_DOOR = 11;
Animation.prototype.SEQ_SPARK = 13;
Animation.prototype.SEQ_FRAMER = 14;

Animation.prototype.SEQ_BOMB = 12;
Animation.prototype.SEQ_BOMB_LIT = 18;
Animation.prototype.SEQ_BOMB_SUNK = 19;

Animation.prototype.SEQ_GUN = 15;
Animation.prototype.SEQ_GUN_MAD = 16;

Animation.prototype.SEQ_SENTRY = 20;

Animation.prototype.SEQ_GLOVE = 21;

Animation.prototype.SEQ_CLOUD = 22;

Animation.prototype.SEQ_BRICKS = 23;

Animation.prototype.SEQ_COUNT = 24;


//needs other statics to define itself
Animation.prototype.framesForSeq = [];
Animation.prototype.framesForSeq.length = Animation.prototype.SEQ_COUNT;

Animation.prototype.frames = [
	//Frame init : function(bitmapId, duration, frameChange, sequenceMarker)
	//player
		//stand up
	new Frame('teeth_up', 1, 0, Animation.prototype.SEQ_PLAYER_STAND_UP),
		//stand down
	new Frame('teeth_down', 1, 0, Animation.prototype.SEQ_PLAYER_STAND_DOWN),
		//stand left
	new Frame('teeth_left', 1, 0, Animation.prototype.SEQ_PLAYER_STAND_LEFT),
		//stand right
	new Frame('teeth_right', 1, 0, Animation.prototype.SEQ_PLAYER_STAND_RIGHT),

		//walk up
	new Frame('teeth_up', 3, 1, Animation.prototype.SEQ_PLAYER_WALK_UP),
	new Frame('teeth_up_step', 3, -1),
		//walk down
	new Frame('teeth_down', 3, 1, Animation.prototype.SEQ_PLAYER_WALK_DOWN),
	new Frame('teeth_down_step', 3, -1),
		//walk left
	new Frame('teeth_left', 3, 1, Animation.prototype.SEQ_PLAYER_WALK_LEFT),
	new Frame('teeth_left_step', 3, -1),
		//walk right
	new Frame('teeth_right', 3, 1, Animation.prototype.SEQ_PLAYER_WALK_RIGHT),
	new Frame('teeth_right_step', 3, -1),

	new Frame('teeth_dead', 1, 0, Animation.prototype.SEQ_PLAYER_DEAD),

	//money
	new Frame('money', 1, 0, Animation.prototype.SEQ_MONEY),

	//key
	new Frame('key', 1, 0, Animation.prototype.SEQ_KEY),

	//key grey
	new Frame('key_grey', 1, 0, Animation.prototype.SEQ_KEY_GREY),

	//door
	new Frame('door', 1, 0, Animation.prototype.SEQ_DOOR),

	//bomb
	new Frame('bomb', 1, 0, Animation.prototype.SEQ_BOMB),
	new Frame('bomb_lit', 1, 1, Animation.prototype.SEQ_BOMB_LIT),
	new Frame('bomb', 1, -1, Animation.prototype.SEQ_BOMB_LIT),
	new Frame('bomb_sunk', 1, 0, Animation.prototype.SEQ_BOMB_SUNK),

	//spark
	new Frame('flame', 1, 0, Animation.prototype.SEQ_SPARK),

	//framer
	new Frame('framer', 1, 0, Animation.prototype.SEQ_FRAMER),

	//gun
	new Frame('medusa', 1, 0, Animation.prototype.SEQ_GUN),
	new Frame('medusa_pissed', 1, 0, Animation.prototype.SEQ_GUN_MAD),

	//sentry
	new Frame('sentry1', 3, 1, Animation.prototype.SEQ_SENTRY),
	new Frame('sentry2', 3, -1),

	//glove
	new Frame('gloves', 1, 0, Animation.prototype.SEQ_GLOVE),

	new Frame('cloud', 1, 0, Animation.prototype.SEQ_CLOUD),

	new Frame('bricks', 1, 0, Animation.prototype.SEQ_BRICKS)
];

class GameNumbers {
	static staticInit() {
		for (let i = 0; i < 10; i++) {
			GameNumbers.prototype.bitmaps.push(DOM('img', {src:'res/drawable/'+i+'.png'}));
		}
	}
	draw(c, rect, n, x, y) {
		let paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;
		let s = ''+n;
		for (let i = 0; i < s.length; i++) {
			let frame = s.charCodeAt(i) - ('0').charCodeAt(0);
			let bitmap = this.bitmaps[frame];
			if (!bitmap) continue;

			rect.left = (x + i - .25) * game.TILE_WIDTH + paddingX;
			rect.right = rect.left + game.TILE_WIDTH/2;
			rect.top = (y - .25) * game.TILE_HEIGHT;
			rect.bottom = rect.top + game.TILE_HEIGHT/2;

			try {
				c.drawImage(bitmap,
					rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top
				);
			} catch (e) {}
		}
	}
}
GameNumbers.prototype.bitmaps = [];

/*
function GameText() {
	this.span = DOM('span', {
		css:{
			position:'absolute',
			zIndex:1
		}
	}).appendTo(document.body);
	this.span.get(0).style.color = 'white';
	this.span.get(0).style.textShadow = 'black 1px';
}
GameText.prototype = {
	draw : function(c, text, posX, posY) {
		let paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;
		let canvasPos = [game.canvas.offsetLeft, game.canvas.offsetTop];
		this.span.get(0).style.fontSize = parseInt(game.TILE_HEIGHT/2)+'px';
		this.span.get(0).style.left = parseInt(canvasPos.left + ((posX - .25) * game.TILE_WIDTH) + paddingX);
		this.span.get(0).style.top = parseInt(canvasPos.top + ((posY + .25) * game.TILE_HEIGHT) - game.TILE_HEIGHT/2);
		this.span.text(''+text);
	},
	remove : function() { this.span.remove(); }
};
*/

class AnimatedObj {
	constructor() {
		this.scale = [1,1];

		this.frameId = 0;	//index into frametable
		this.frameTime = 0;	//measured in fps intervals, i.e. frames

		this.framerate = 30;	//animation framerate

		this.seq = -1;
	}

	update(dt) {
		if (this.frameId < 0 || this.frameId >= anim.frames.length) return;
		let frame = anim.frames[this.frameId];
		this.frameTime += dt * this.framerate;
		if (this.frameTime < frame.duration) return;
		this.setFrame(this.frameId + frame.frameChange);
	}

	setFrame(frameId) {
		this.frameId = frameId;
		this.frameTime = 0;
	}

	setSeq(seq) {
		if (this.seq == seq) return;

		this.seq = seq;
		this.setFrame( anim.getFrameForSeq(seq) );
	}
}

let cachedAlphaThresholdResolution = 255;
let cachedAlphaThresholdImages = {};

class BaseObj extends AnimatedObj {
	constructor() {
		super();

		this.removeMe = false;

		this.HIT_RESPONSE_STOP = 0;
		this.HIT_RESPONSE_MOVE_THRU = 1;
		this.HIT_RESPONSE_TEST_OBJECT = 2;

		this.posX = 0;
		this.posY = 0;
		this.startPosX = 0;
		this.startPosY = 0;
		this.srcPosX = 0;
		this.srcPosY = 0;
		this.destPosX = 0;
		this.destPosY = 0;

		this.moveCmd = -1;

		this.isBlocking = true;
		this.isBlockingPushers = true;
		this.blocksExplosion = true;

		this.blend = 'source-over';
	}

	//helpful for subclasses.  TODO - move somewhere else
	linfDist(ax, ay, bx, by) {
		let dx = ax - bx;
		let dy = ay - by;
		let adx = dx < 0 ? -dx : dx;
		let ady = dy < 0 ? -dy : dy;
		return adx > ady ? adx : ady;	//maximum of the two
	}

	setPos(x, y) {
		this.srcPosX = this.destPosX = x;
		this.srcPosY = this.destPosY = y;
		//the lua game didnt' do this..
		this.posX = x;
		this.posY = y;
	}

	drawSprite(c, rect) {
		if (this.frameId < 0 || this.frameId >= anim.frames.length) return;

		let paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;

		let w = game.TILE_WIDTH * this.scale[0];
		let h = game.TILE_HEIGHT * this.scale[1];

		rect.left = (this.posX - .5 * this.scale[0]) * game.TILE_WIDTH + paddingX;
		rect.right = rect.left + w;
		rect.top = (this.posY - .5 * this.scale[1]) * game.TILE_HEIGHT;
		rect.bottom = rect.top + h;

		let frame = anim.frames[this.frameId];
		if (!frame) throw 'failed to find frame for id '+this.frameId;

		let bitmap = frame.bitmap;
		if (!bitmap) throw 'failed to find bitmap for frame '+this.frameId;

		if (this.blend == 'alpha-threshold') {
			let alpha = this.color !== undefined ? this.color[3] : 1;

			if (!cachedAlphaThresholdImages[bitmap.src]) {
				cachedAlphaThresholdImages[bitmap.src] = [];
			}
			let tmpcanvas = cachedAlphaThresholdImages[bitmap.src][Math.floor(alpha * cachedAlphaThresholdResolution)];
			if (!tmpcanvas) {
				tmpcanvas = document.createElement('canvas');
				cachedAlphaThresholdImages[bitmap.src][Math.floor(alpha * cachedAlphaThresholdResolution)] = tmpcanvas;
				tmpcanvas.width = bitmap.width;
				tmpcanvas.height = bitmap.height;

				let tmpctx = tmpcanvas.getContext('2d');
				tmpctx.drawImage(bitmap, 0, 0);
				let imagedata = tmpctx.getImageData(0, 0, bitmap.width, bitmap.height);
				let data = imagedata.data;
				for (let i = 0; i < data.length; i += 4) {
					data[i+3] = data[i+3] * alpha < 128 ? 0 : 63;
				}
				tmpctx.putImageData(imagedata, 0, 0);
			}

			c.fillStyle = '#fff';
			c.globalAlpha = 1;
			c.globalCompositeOperation = 'source-over';
			c.drawImage(tmpcanvas, rect.left, rect.top, w, h);
		} else {
			c.globalCompositeOperation = this.blend;

			if (this.color !== undefined) {
				c.globalAlpha = this.color[3];
				c.fillStyle = 'rgb('
					+parseInt(this.color[0]*255)+','
					+parseInt(this.color[1]*255)+','
					+parseInt(this.color[2]*255)+')';
			} else {
				c.globalAlpha = 1;
				c.fillStyle = '#fff';
			}

			try {
				c.drawImage(bitmap, rect.left, rect.top, w, h);
			} catch (e) {}

			c.fillStyle = '#fff';
			c.globalAlpha = 1;
			c.globalCompositeOperation = 'source-over';
		}
	}

	//whether sentry can walk over it
	//i know, i know ... how esoteric are these routines in the base class becoming?
	//currently set to 'isBlocking' except for money, which is always true
	//this means keys and doors don't block
	isBlockingSentry() { return this.isBlocking; }

	hitEdge(whereX, whereY) { return true; }

	cannotPassThru(maptype) {
		let res = (game.mapTypes[maptype].flags & MapType.prototype.CANNOT_PASSTHRU) != 0;
		return res;
	}

	hitWorld(whereX, whereY, typeUL, typeUR, typeLL, typeLR) {
		let res =
			this.cannotPassThru(typeUL) ||
			this.cannotPassThru(typeUR) ||
			this.cannotPassThru(typeLL) ||
			this.cannotPassThru(typeLR);
		return res;
	}

	//called when MovableObj's get a move cmd, try to move, and hit another object
	//this - the object that is moving
	//what - the object that was hit
	hitObject(what, pushDestX, pushDestY, side) {
		return this.HIT_RESPONSE_TEST_OBJECT;
	}

	//called when MovableObj's get a move cmd, try to move, hit another object,
	//	and the MovableObj's hitObject returns HIT_RESPONSE_TEST_OBJECT
	//this - the object being pushed
	//pusher - the MovableObj that is pushing it
	//returns - true if the pusher was blocked by this object
	startPush(pusher, pushDestX, pushDestY, side) {
		return this.isBlocking;
	}

	endPush(who, pushDestX, pushDestY) {}

	onKeyTouch() {}

	onTouchFlames() {}

	onGroundSunk() {
		game.removeObj(this);
	}

	//use game.removeObj to remove an object
	onRemove() {
		this.removeMe = true;
	}
}

class MovableObj extends BaseObj {
	constructor() {
		super();
		this.lastMoveResponse = this.MOVE_RESPONSE_NO_MOVE;
		this.moveCmd = Dir.NONE;
		this.speed = 10;	//tiles covered per second
		this.moveFracMoving = false;
		this.moveFrac = 0;	//fixed precision
	}

	moveIsBlocked_CheckHitWorld(whereX, whereY) {
		let typeUL = game.getMapTypeIndex(whereX - .25, whereY - .25);
		let typeUR = game.getMapTypeIndex(whereX + .25, whereY - .25);
		let typeLL = game.getMapTypeIndex(whereX - .25, whereY + .25);
		let typeLR = game.getMapTypeIndex(whereX + .25, whereY + .25);

		return this.hitWorld(whereX, whereY, typeUL, typeUR, typeLL, typeLR);
	}

	//for movable walking atop floating bombs in water
	hitWorld(whereX, whereY, typeUL, typeUR, typeLL, typeLR) {
		let thiz = this;
		game.objs.forEach(o => {
			if (o.removeMe) return;
			if (o == thiz) return;
			if (o instanceof Bomb && o.state == o.STATE_SINKING) {
				//if any of our corners are really standing on an egg rather than water then treat it like its empty
				if (typeUL == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX - .25, whereY - .25) < (.5)) typeUL = Game.prototype.MAPTYPE_EMPTY;
				if (typeUR == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX + .25, whereY - .25) < (.5)) typeUR = Game.prototype.MAPTYPE_EMPTY;
				if (typeLL == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX - .25, whereY + .25) < (.5)) typeLL = Game.prototype.MAPTYPE_EMPTY;
				if (typeLR == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX + .25, whereY + .25) < (.5)) typeLR = Game.prototype.MAPTYPE_EMPTY;
			}
		});
		return super.hitWorld(whereX, whereY, typeUL, typeUR, typeLL, typeLR);
	}

	moveIsBlocked_CheckEdge(newDestX, newDestY) {
		if (newDestX < .25 ||
			newDestY < .25 ||
			newDestX > game.MAP_WIDTH - .25 ||
			newDestY > game.MAP_HEIGHT - .25)
		{
			return this.hitEdge(newDestX, newDestY);
		}
		return false;
	}

	moveIsBlocked_CheckHitObject(o, cmd, newDestX, newDestY) {
		//if o's bbox at its destpos touches ours at our destpos then
		if (this.linfDist(o.destPosX, o.destPosY, newDestX, newDestY) > .75) return false;

		let response = this.hitObject(o, newDestX, newDestY, cmd);

		if (response == this.HIT_RESPONSE_STOP) {
			return true;
		}

		if (response == this.HIT_RESPONSE_TEST_OBJECT) {
			if (o.startPush(this, newDestX, newDestY, cmd)) {
				return true;
			}
		}

		return false;
	}

	moveIsBlocked_CheckHitObjects(cmd, newDestX, newDestY) {
		//then cycle through all entities ...
		let thiz = this;
		let return_ = false;
		for (let i = 0; i < game.objs.length; ++i) {
			const o = game.objs[i];
			if (o.removeMe) continue;
			if (o == thiz) continue;
			if (thiz.moveIsBlocked_CheckHitObject(o, cmd, newDestX, newDestY)) {
				return_ = true;
				break;
			}
		}
		return return_;
	}

	moveIsBlocked(cmd, newDestX, newDestY) {
		if (this.moveIsBlocked_CheckEdge(newDestX, newDestY)) return true;
		if (this.moveIsBlocked_CheckHitWorld(newDestX, newDestY)) return true;
		if (this.moveIsBlocked_CheckHitObjects(cmd, newDestX, newDestY)) return true;
		return false;
	}

	doMove(cmd) {
		if (cmd == Dir.NONE) return this.MOVE_RESPONSE_NO_MOVE;

		let newDestX = this.posX;
		let newDestY = this.posY;
		if (cmd >= 0 && cmd < Dir.COUNT) {
			newDestX += Dir.vec[cmd][0] * .5;
			newDestY += Dir.vec[cmd][1] * .5;
		} else {
			return this.MOVE_RESPONSE_NO_MOVE;
		}

		if (this.moveIsBlocked(cmd, newDestX, newDestY)) {
			this.moveFracMoving = false;
			return this.MOVE_RESPONSE_WAS_BLOCKED;
		}

		//TODO - get this working? if it's even needed?  seems to be working fine without it ... (though things could drift...)
		this.destPosX = newDestX;	//notice, this will only be floor() for positive values
		this.destPosY = newDestY;	//good thing we never allow any negative ones
		this.moveFrac = 0;
		this.moveFracMoving = true;

		this.srcPosX = this.posX;
		this.srcPosY = this.posY;

		return this.MOVE_RESPONSE_DID_MOVE;
	}

	update(dt) {
		super.update(dt);
		if (this.moveFracMoving) {
			this.moveFrac += dt * this.speed;
			if (this.moveFrac >= 1) {
				this.moveFracMoving = false;
				this.posX = this.destPosX;
				this.posY = this.destPosY;

				let thiz = this;
				game.objs.forEach(o => {
					if (o.removeMe) return;
					if (o == thiz) return;

					//if o's bbox at its destpos touches ours at our destpos then
					if (this.linfDist(o.destPosX, o.destPosY, thiz.destPosX, thiz.destPosY) > .75) return;

					o.endPush(thiz, thiz.destPosX, thiz.destPosY);
				});

			} else {
				let oneMinusMoveFrac = 1 - this.moveFrac;
				this.posX = this.destPosX * this.moveFrac + this.srcPosX * oneMinusMoveFrac;
				this.posY = this.destPosY * this.moveFrac + this.srcPosY * oneMinusMoveFrac;
			}
		}

		if (!this.moveFracMoving) {
			this.lastMoveResponse = this.doMove(this.moveCmd);
		} else {
			this.lastMoveResponse = this.MOVE_RESPONSE_NO_MOVE;
		}
	}
}
MovableObj.prototype.MOVE_RESPONSE_NO_MOVE = 0;
MovableObj.prototype.MOVE_RESPONSE_WAS_BLOCKED = 1;
MovableObj.prototype.MOVE_RESPONSE_DID_MOVE = 2;


class PushableObj extends MovableObj {
	startPush(pusher, pushDestX, pushDestY, side) {
		let superResult = super.startPush(pusher, pushDestX, pushDestY, side);

		//if (pusher instanceof Player)
		{
			if (!this.isBlocking) return false;

			let delta = 0;
			switch (side) {
			case Dir.LEFT:
			case Dir.RIGHT:
				delta = this.destPosY - pusher.destPosY;
				break;
			case Dir.UP:
			case Dir.DOWN:
				delta = this.destPosX - pusher.destPosX;
				break;
			}
			if (delta < 0) delta = -delta;
			let align = delta < .25;

			if (align && !this.moveFracMoving) {
				let moveResponse = this.doMove(side);
				switch (moveResponse) {
				case this.MOVE_RESPONSE_WAS_BLOCKED:
					return true;
				case this.MOVE_RESPONSE_DID_MOVE:
					return true;	//? false? superResult?
				}
			}
		}

		return superResult;
	}

	hitObject(what, pushDestX, pushDestY, side) {
		//this is the only place isBlockingPushers is referenced
		//it happens when a PushableObj moves into another object
		//this - the PushableObj
		//what - the other object it moved into
		//	TODO - clean up isBlocking and isBlockingPushers! at least rename them to something less ambiguous!
		if (what.isBlockingPushers) return this.HIT_RESPONSE_STOP;

		return super.hitObject(what, pushDestX, pushDestY, side);
	}
}

//TODO alpha test, and threshold alpha at .5 or something
class Cloud extends BaseObj {
	constructor(args) {
		super();	
		this.isBlocking = false;
		this.isBlockingPushers = false;
		this.blocksExplosion = false;
		this.blend = 'alpha-threshold';
		this.vel = args.vel;
		this.life = args.life;
		this.scale = [args.scale, args.scale],
		this.setPos(args.pos[0], args.pos[1]);
		this.startTime = game.time;
		this.setSeq(Animation.prototype.SEQ_CLOUD);
		this.color = [1,1,1,1];
	}

	update(dt) {
		super.update(dt);

		this.setPos(this.posX + dt * this.vel[0], this.posY + dt * this.vel[1]);

		let frac = (game.time - this.startTime) / this.life;
		if (frac > 1) frac = 1;
		this.color[3] = (1-frac)*(1-frac);

		if (frac == 1) {
			game.removeObj(this);
			return;
		}
	}
}

class Particle extends BaseObj {
	constructor(args) {
		super();
		this.isBlocking = false;
		this.isBlockingPushers = false;
		this.blocksExplosion = false;
		this.vel = args.vel;
		this.life = args.life;	//in seconds
		this.color = args.color !== undefined ? arrayClone(args.color) : [1,1,1,1];
		this.srccolor = arrayClone(this.color);
		this.scale = [args.radius * 2, args.radius * 2];
		this.setPos(args.pos[0], args.pos[1]);
		this.startTime = game.time;
		if (args.blend !== undefined) this.blend = args.blend;
		this.setSeq(args.seq !== undefined ? args.seq : Animation.prototype.SEQ_SPARK);
	}

	update(dt) {
		super.update(dt);

		this.setPos(this.posX + dt * this.vel[0], this.posY + dt * this.vel[1]);

		let frac = 1 - (game.time - this.startTime) / this.life;
		if (frac < 0) frac = 0;
		this.color[3] = this.srccolor[3] * frac;

		if (frac == 0) {
			game.removeObj(this);
			return;
		}
	}
}

class Bomb extends PushableObj {
	//I wonder if setting 'isBlockingPushers' to 'true' would make it so the player could push multiple blocks?
	//would this be cool?

	constructor(owner) {
		super();
		
		this.owner = undefined;
		this.ownerStandingOn = false;

		this.holder = undefined;

		this.state = this.STATE_IDLE;

		this.owner = owner;
		if (owner !== undefined) this.ownerStandingOn = true;
		this.setSeq(Animation.prototype.SEQ_BOMB);

		this.gameNumbers = new GameNumbers();
	};

	//called via moveIsBlocked when a bomb is placed
	//this will also get called if the bomb pushes something else (which can't happen atm)
	hitObject(whatWasHit, pushDestX, pushDestY, side) {
		//same condition as below
		if (whatWasHit == this.owner && this.owner !== undefined && this.ownerStandingOn) return this.HIT_RESPONSE_MOVE_THRU;
		return super.hitObject(whatWasHit, pushDestX, pushDestY, side);
	}

	//called when a player walks into a bomb to start pushing it
	startPush(pusher, pushDestX, pushDestY, side) {
		//if the owner is still standing on the bomb they dropped
		//then let them walk through it
		//in the update, check owner's dist, and clear this flag if they moved too far

		if (pusher == this.owner &&	//should always be true...
			this.owner !== undefined &&
			this.ownerStandingOn)
		{
			return false;
		}

		//if the bomb is picked up then it won't be pushable / block anything / etc
		if (this.holder !== undefined) {
			return false;
		}
		return super.startPush(pusher, pushDestX, pushDestY, side);
	}

	//only works if we have a holder
	//next it clears the holder (doesn't matter)
	//throws
	//if the bomb would detonate while in air, have it hold off...
	//then it lands ...
	//and continues as normal
	throwMe(dir) {
		if (dir < 0 || dir >= Dir.COUNT) return;
		if (this.holder === undefined) return;

		this.posX = this.srcPosX = this.holder.destPosX;
		this.posY = this.srcPosY = this.holder.destPosY;

		this.destPosX = this.srcPosX + Dir.vec[dir][0] * this.THROW_DIST;
		this.destPosY = this.srcPosY + Dir.vec[dir][1] * this.THROW_DIST;

		this.holder = undefined;	//doesn't matter anymore
		this.throwDone = game.time + this.throwDuration;
	}

	setFuse(fuseTime) {
		if (this.state == this.STATE_EXPLODING ||
			this.state == this.STATE_SINKING)
		{
			return;
		}
		this.setSeq(Animation.prototype.SEQ_BOMB_LIT);
		this.state = this.STATE_LIVE;
		this.boomTime = game.time + fuseTime;
	}

	//bombs can only pass thru empty and water
	cannotPassThru(maptype) {
		//if it doesn't blocks movement then we're good
		const res = super.cannotPassThru(maptype);
		if (!res) return false;

		//if the maptype doesn't float objects then it will block the bomb
		//(do this check for any movable objects that can traverse water)
		//(maybe make that a movement flag or something?)
		return maptype != Game.prototype.MAPTYPE_WATER;
	}

	drawSprite(c, rect) {
		//hack: push & pop position between draw cmd
		//the other way: new method for underlying drawing of sprite that gets passed x,y
		if (this.holder !== undefined) {
			this.posY -= .75;
		}

		super.drawSprite(c, rect);

		if (this.state == this.STATE_IDLE || this.state == this.STATE_LIVE) {
			this.gameNumbers.draw(c, rect, this.blastRadius, this.posX, this.posY);
		}

		if (this.holder !== undefined) {
			this.posY += .75;
		}
	}

	onKeyTouch() {
		game.removeObj(this);
	}

	setHolder(holder) {
		this.holder = holder;
		this.isBlocking = false;
		this.isBlockingPushers = false;
	}

	update(dt) {
		const thiz = this;
		super.update(dt);

		if (this.holder !== undefined) {
			//well we can clear the ownerStandingOn flag ...
			this.ownerStandingOn = false;
			this.posX = this.holder.posX;
			this.posY = this.holder.posY;
			this.destPosX = this.holder.destPosX;
			this.destPosY = this.holder.destPosY;
			return;
		}

		//update the 'ownerStandingOn' flag for newly-dropped bombs
		if (this.owner !== undefined && this.ownerStandingOn) {
			if (this.linfDist(this.destPosX, this.destPosY, this.owner.destPosX, this.owner.destPosY) > .75) {
				this.ownerStandingOn = false;
			}
		}

		if (this.throwDone > 0 &&
			(this.state == this.STATE_IDLE || this.state == this.STATE_LIVE))
		{
			//console.log("Bomb.update throwDone > 0: updating throw");
			let throwDt = game.time - (this.throwDone - this.throwDuration);
			//console.log("Bomb.update throwDt = " + throwDt);
			if (this.throwDt > this.throwDuration) {
			//console.log("Bomb.update throwDt > throwDuration: clearing throwDone");
				this.throwDone = 0;	//done throwing ... you can be a real bomb again now
			} else {
				//console.log("Bomb.update throwDt <= THROW_DURAATION: calculating position");

				let throwFrac = throwDt / this.throwDuration;
				//console.log("Bomb.update throwFrac: " + throwFrac);

				//console.log("Bomb.update moving from " + this.srcPosX + ", " + this.srcPosY +  " to " + this.destPosX + ", " + this.destPosY);
				let oneMinusThrowFrac = 1 - throwFrac;
				this.posX = this.destPosX * throwFrac + this.srcPosX * oneMinusThrowFrac;
				this.posY = this.destPosY * throwFrac + this.srcPosY * oneMinusThrowFrac;

				this.posY -= 2 * throwFrac * oneMinusThrowFrac * this.THROW_HEIGHT;

				//if we're being thrown then return before checking for explosions
				return;
			}
		}

		//test whether what we were pushed into water
		//TODO - rewrite this as startPush?  I think you can do that ...
		if (this.state == this.STATE_IDLE || this.state == this.STATE_LIVE) {
			//TODO - will this get skipped if it gets pushed immediately after it stopped moving across the last tile?
			if (!this.moveFracMoving) {	//not moving at the moment
				const typeUL = game.getMapTypeIndex(this.destPosX - .25, this.destPosY - .25);
				const typeUR = game.getMapTypeIndex(this.destPosX + .25, this.destPosY - .25);
				const typeLL = game.getMapTypeIndex(this.destPosX - .25, this.destPosY + .25);
				const typeLR = game.getMapTypeIndex(this.destPosX + .25, this.destPosY + .25);

				game.objs.forEach(o => {
					if (!o.removeMe &&
						o instanceof Bomb && o.state == o.STATE_SINKING
					) {
						if (typeUL == game.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX - .25, thiz.destPosY - .25) < .5) typeUL = game.MAPTYPE_EMPTY;
						if (typeUR == game.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX + .25, thiz.destPosY - .25) < .5) typeUR = game.MAPTYPE_EMPTY;
						if (typeLL == game.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX - .25, thiz.destPosY + .25) < .5) typeLL = game.MAPTYPE_EMPTY;
						if (typeLR == game.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX + .25, thiz.destPosY + .25) < .5) typeLR = game.MAPTYPE_EMPTY;
					}
				});

				if (typeUL == game.MAPTYPE_WATER &&
					typeUR == game.MAPTYPE_WATER &&
					typeLL == game.MAPTYPE_WATER &&
					typeLR == game.MAPTYPE_WATER)
				{
					this.setSeq(Animation.prototype.SEQ_BOMB_SUNK);
					this.state = this.STATE_SINKING;
					this.isBlocking = false;
					this.isBlockingPushers = false;
					this.sinkDone = game.time + this.sinkDuration;
				}
			}
		}

		//if state is idle...
		if (this.state == this.STATE_LIVE) {
			const t = game.time - this.boomTime;
			const s = Math.cos(2*t*Math.PI)*.2+.9;
			this.scale = [s,s];
			if (t >= 0) {
				this.explode();
			}
		} else if (this.state == this.STATE_EXPLODING) {
			const t = game.time - this.explodingDone;
			if (t >= 0) {
				game.removeObj(this);
			}
		} else if (this.state == this.STATE_SINKING) {
			const t = game.time - this.sinkDone;
			if (t >= 0) {

				//remove first so it doesn't influence the checks for sunk bombs
				game.removeObj(this);

				//then we're sunk
				//check for anything standing on us ... and kill it
				game.objs.forEach(o => {
					if (!o.removeMe && 
						//if this object is .25 tile on the sunk bomb...
						thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX, thiz.destPosY) < .75
					) {
						//now check all the types under this object
						const typeUL = game.getMapTypeIndex(o.destPosX - .25, o.destPosY - .25);
						const typeUR = game.getMapTypeIndex(o.destPosX + .25, o.destPosY - .25);
						const typeLL = game.getMapTypeIndex(o.destPosX - .25, o.destPosY + .25);
						const typeLR = game.getMapTypeIndex(o.destPosX + .25, o.destPosY + .25);

						game.objs.forEach(o2 => {
							if (!o2.removeMe && 
								o2 instanceof Bomb && o2.state == o2.STATE_SINKING
							) {
								if (typeUL == Game.MAPTYPE_WATER && thiz.linfDist(o2.destPosX, o2.destPosY, o.destPosX - .25, o.destPosY - .25) < .5) typeUL = game.MAPTYPE_EMPTY;
								if (typeUR == Game.MAPTYPE_WATER && thiz.linfDist(o2.destPosX, o2.destPosY, o.destPosX + .25, o.destPosY - .25) < .5) typeUR = game.MAPTYPE_EMPTY;
								if (typeLL == Game.MAPTYPE_WATER && thiz.linfDist(o2.destPosX, o2.destPosY, o.destPosX - .25, o.destPosY + .25) < .5) typeLL = game.MAPTYPE_EMPTY;
								if (typeLR == Game.MAPTYPE_WATER && thiz.linfDist(o2.destPosX, o2.destPosY, o.destPosX + .25, o.destPosY + .25) < .5) typeLR = game.MAPTYPE_EMPTY;
							}
						});

						if (typeUL == game.MAPTYPE_WATER &&
							typeUR == game.MAPTYPE_WATER &&
							typeLL == game.MAPTYPE_WATER &&
							typeLR == game.MAPTYPE_WATER)
						{
							//for bombs, onGroundSink will do nothing
							//then on the next update() the bomb will figure out it's on water and sink for itself
							o.onGroundSunk();
						}
					}
				});

				return;
			}
		}
		//else if state is boom ... do something else
	}

	onGroundSunk() {}	//do nothing

	onTouchFlames () {
		this.setFuse(this.chainDuration);
	}

	explode() {
		for (let i = 0; i < 10; ++i) {
			const scale = Math.random() * 2;
			game.addObj(new Cloud({
				pos : [this.posX, this.posY],
				vel : [Math.random()*2-1, Math.random()*2-1],
				scale : scale+1,
				life : 5 - scale
			}))
		}

		//if a bomb is half off in either direction then it can't destroy tiles
		//hmm the half tiles is a lolo issue ...
		//maybe for bomberman's sake we should snap to tiles? or only allow blocks
		//to be whole-tile-pushable?  but that'll make constraining the placement of bombs difficult?
		//or maybe not?

		let cantHitWorld = false;
		let fpartx = this.destPosX - Math.floor(this.destPosX);
		let fparty = this.destPosY - Math.floor(this.destPosY);
		if (fpartx < .25 || fpartx > .75 ||
			fparty < .25 || fparty > .75)
		{
			cantHitWorld = true;
		}

		for (let side = 0; side < Dir.COUNT; side++) {
			let checkPosX = this.destPosX;
			let checkPosY = this.destPosY;
			let len = 0;
			while(true) {
				let hit = false;
				let thiz = this;
				game.objs.forEach(o => {
					if (!o.removeMe &&
						o != thiz
					) {
						const dist = thiz.linfDist(o.destPosX, o.destPosY, checkPosX, checkPosY);
						//if a flame is even half a block off from an obj then it won't be hit
						//...except for the player
						//TODO - class-based let?
						if (o instanceof Player && dist > .75) {
						} else if (dist > .25) {
						} else {
							o.onTouchFlames();
							if (o.blocksExplosion) hit = true;
						}
					}
				});

				//TODO - make spark temp ents
				this.makeSpark(checkPosX, checkPosY);

				if (/*!redbomb && */ hit) break;
				len++;
				if (/*!incinerator && */ len > this.blastRadius) {
					len = this.blastRadius;
					break;
				}

				checkPosX += Dir.vec[side][0];
				checkPosY += Dir.vec[side][1];

				let wallStopped = false;
				for (let ofx = 0; ofx < 2; ofx++) {
					for (let ofy = 0; ofy < 2; ofy++) {
						const cfx = Math.floor(checkPosX + ofx * .5 - .25);
						const cfy = Math.floor(checkPosY + ofy * .5 - .25);
						const mapType = game.getMapType(cfx, cfy);
						if ((mapType.flags & mapType.BLOCKS_EXPLOSIONS) != 0) {
							//if it's half a block off then it can still be stopped
							//but it can't clear a wall
							//this way we don't favor one rounding direction versus another
							if (!cantHitWorld &&
								(mapType.flags & mapType.BOMBABLE) != 0)	//only turn bricks into empty
							{
								//make some particles
								const divs = 1;
								for (let u = 0; u < divs; ++u) {
									for (let v = 0; v < divs; ++v) {
										let speed = 0;
										game.addObj(new Particle({
											vel : [speed*(Math.random()*2-1), speed*(Math.random()*2-1)],
											pos : [cfx + (u+.5)/divs, cfy + (v+.5)/divs],
											life : Math.random() * .5 + .5,
											radius : .5,// * (Math.random() + .5),
											seq : Animation.prototype.SEQ_BRICKS,
											blend : 'lighter'
										}));
									}
								}

								game.setMapTypeIndex(cfx, cfy, game.MAPTYPE_EMPTY);
							}
							wallStopped = true;
						}
					}
				}
				if (wallStopped) break;
			}
		}

		this.state = this.STATE_EXPLODING;
		this.explodingDone = game.time + this.explodingDuration;
	}

	makeSpark(x, y) {
		//for (let i = 0; i < 10; ++i) {
		for (let i = 0; i < 3; ++i) {
			let c = Math.random();
			game.addObj(new Particle({
				vel : [Math.random()*2-1, Math.random()*2-1],
				pos : [x,y],
				life : .5 * (Math.random() * .5 + .5),
				color : [1,c,c*Math.random()*Math.random(),1],
				radius : .25 * (Math.random() + .5),
				blend : 'lighter'
			}));
		}
	}
}
Bomb.prototype.boomTime = 0;
Bomb.prototype.blastRadius = 1;
Bomb.prototype.explodingDone = 0;
Bomb.prototype.sinkDone = 0;
Bomb.prototype.throwDone = 0;

Bomb.prototype.fuseDuration = 5;
Bomb.prototype.chainDuration = .2;
Bomb.prototype.explodingDuration = .2;
Bomb.prototype.sinkDuration = 5;
Bomb.prototype.throwDuration = 1;

Bomb.prototype.STATE_IDLE = 0;
Bomb.prototype.STATE_LIVE = 1;
Bomb.prototype.STATE_EXPLODING = 2;
Bomb.prototype.STATE_SINKING = 3;

Bomb.prototype.THROW_HEIGHT = 2;
Bomb.prototype.THROW_DIST = 3;


class GunShot extends MovableObj {
	constructor(owner) {
		super();
		this.owner = owner;
		this.setPos(owner.posX, owner.posY);
		this.frameId = -1;	//invis
	}
	cannotPassThru(maptype) {
		return (game.mapTypes[maptype].flags & MapType.prototype.BLOCKS_GUNSHOT) != 0;
	}

	hitObject(what, pushDestX, pushDestY, side) {
		if (what == this.owner) return this.HIT_RESPONSE_MOVE_THRU;
		if (what instanceof Player) {
			what.die();
			return this.HIT_RESPONSE_STOP;
		}
		if (what.isBlocking || what instanceof Money) return this.HIT_RESPONSE_STOP;
		return this.HIT_RESPONSE_MOVE_THRU;
	}
}

class Gun extends BaseObj {
	constructor() {
		super();
		this.setSeq(Animation.prototype.SEQ_GUN);
	}

	update(dt) {
		super.update(dt);

		this.setSeq(Animation.prototype.SEQ_GUN);

		if (game.player !== undefined &&
			!game.player.dead)
		{
			let diffX = game.player.posX - this.posX;
			let diffY = game.player.posY - this.posY;
			let absDiffX = diffX < 0 ? -diffX : diffX;
			let absDiffY = diffY < 0 ? -diffY : diffY;
			let dist = absDiffX < absDiffY ? absDiffX : absDiffY;

			if (dist < this.MAD_DIST) {
				this.setSeq(Animation.prototype.SEQ_GUN_MAD);
			}

			if (dist < this.FIRE_DIST) {
				let dir = Dir.NONE;
				if (diffX < diffY) {	//left or down
					if (diffX < -diffY) {
						dir = Dir.LEFT;
					} else {
						dir = Dir.DOWN;
					}
				} else {	//up or right
					if (diffX < -diffY) {
						dir = Dir.UP;
					} else {
						dir = Dir.RIGHT;
					}
				}

				let shot = new GunShot(this);
				let response = -1;
				do {
					response = shot.doMove(dir);
					shot.setPos(shot.destPosX, shot.destPosY);
				} while (response != shot.MOVE_RESPONSE_WAS_BLOCKED);
				//delete ... but it's not attached, so we're safe
			}
		}
	}

	onKeyTouch() {
		//puff
		game.removeObj(this);
	}
}
Gun.prototype.MAD_DIST = .75;
Gun.prototype.FIRE_DIST = .25;

class Sentry extends MovableObj {
	constructor() {
		super();
		this.dir = Dir.LEFT;
		this.setSeq(Animation.prototype.SEQ_SENTRY);
	}

	update(dt) {
		//if the player moved onto us ...
		//TODO - put this inside 'endPush' instead! no need to call it each frame
		if (this.linfDist(this.destPosX, this.destPosY, game.player.destPosX, game.player.destPosY) < .75) {
			game.player.die();
		}

		this.moveCmd = this.dir;

		super.update(dt);

		if (this.lastMoveResponse == this.MOVE_RESPONSE_WAS_BLOCKED) {
			switch (this.dir) {
			case Dir.UP:	this.dir = Dir.LEFT;		break;
			case Dir.LEFT:	this.dir = Dir.DOWN;		break;
			case Dir.DOWN:	this.dir = Dir.RIGHT;	break;
			case Dir.RIGHT:	this.dir = Dir.UP;		break;
			}
		}
	}

	//the sentry tried to move and hit an object...
	hitObject(what, pushDestX, pushDestY, side) {

		if (what instanceof Player) {
			return this.HIT_RESPONSE_MOVE_THRU;	//wait for the update() test to pick up hitting the player
		}
		return what.isBlockingSentry() ? this.HIT_RESPONSE_STOP : this.HIT_RESPONSE_TEST_OBJECT;
		//return super.hitObject(what, pushDestX, pushDestY, side);
	}

	onKeyTouch() {
		//puff
		game.removeObj(this);
	}
}

class Framer extends PushableObj {
	constructor() {
		super();
		this.setSeq(Animation.prototype.SEQ_FRAMER);
	}
}

class Player extends MovableObj {
	constructor(...args) {
		super(...args);
		
		//I could combine these two into one ... like I do with Key's touchTime
		this.dead = false;	//whether we're dead or not
		this.deadTime = 0;		//how long we've been dead

		this.dir = Dir.DOWN;

		this.bombs = 0;
		this.bombBlastRadius = 1;	//how big the bombs placed will be
		this.items = 0;	//item bitflags

		//input-based: whether the user is pressing down on the drop-bomb button
		this.dropBombFlag = false;

		//whether the Player is holding a bomb
		this.bombHeld = undefined;

		this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_DOWN);
		this.setBombs(this.bombs);
	}

	move(dir) {
		if (this.dead) return;
		this.moveCmd = dir;
	}

	beginDropBomb() {
		if (this.dead) return;
		if (this.dropBombFlag) return;
		this.dropBombFlag = true;
		if (this.bombs <= 0) return;

		//make sure nothing's there ...
		//bombs can only be placed on empty, or water if a bomb has already been pushed into that block of water...
		if (this.bombHeld !== undefined) {
			//then throw it
			//THROW THE BOMB!
			this.bombHeld.throwMe(this.dir);
			this.bombHeld = undefined;
			return;
		}

		let bomb = new Bomb(this);
		bomb.setPos(this.destPosX, this.destPosY);
		//bomb placement will only be blocked if...
		//(a) another bomb is under it
		//(b) an invalid maptype is under it (unless it is water AND a sunk bomb is under it...)
		//that means I'm going to call moveIsBlocked's individual pieces...
		//if (bomb.moveIsBlocked(Dir.NONE, destPosX, destPosY)) return;
		if (bomb.moveIsBlocked_CheckEdge(this.destPosX, this.destPosY)) return;
		if (bomb.moveIsBlocked_CheckHitWorld(this.destPosX, this.destPosY)) return;
		//if (moveIsBlocked_CheckHitObjects(cmd, destPosX, destPosY)) return;
		//now for checking objects ... if the player is already standing there
		//then we can assert it's a good tile ...
		//... unless they've dropped a bomb and are standing on it ... (linfDist < .4)
		//and in that case the player's gloves come in handy ...
		let thiz = this;
		let doReturn = undefined;
		for (let i = 0; i < game.objs.length; ++i) {
			const o = game.objs[i];
			if (o.removeMe) continue;
			//don't need to test for our current bomb since it hasn't been added yet (and wouldn't be this frame anyways)
			if (o instanceof Bomb) {
				let otherBomb = o;
				if (otherBomb.owner == thiz &&
					thiz.linfDist(thiz.destPosX, thiz.destPosY, otherBomb.destPosX, otherBomb.destPosY) < .25 &&
					(otherBomb.state == otherBomb.STATE_IDLE || otherBomb.state == otherBomb.STATE_LIVE))
				{
					//by here otherBomb is a blocking bomb that we own that we're standing on
					//we're either going to pick it up or it'll block our newly placed bomb
					//so either way, return at the end of this block

					if ((thiz.items & thiz.ITEM_GLOVES) != 0) {

						//then do the gloves on the otherBomb!
						//gloves can also pick up bombs in front of the player, right?
						//that should be tested (the tile in front of the player)
						//after this has, so that the bomb under the player gets priority
						thiz.bombHeld = otherBomb;
						otherBomb.holder = thiz;
					}

					doReturn = true;
					break;
				}
			}
		}
		if (doReturn) return;

		this.setBombs(this.bombs - 1);
		bomb.blastRadius = this.bombBlastRadius;
		bomb.setFuse(Bomb.prototype.fuseDuration);
		game.addObj(bomb);
	}

	endDropBombs() {
		this.dropBombFlag = false;
	}

	stopMoving() {
		this.moveCmd = Dir.NONE;	//clear for next time through
	}

	update(dt) {

		if (this.moveCmd != Dir.NONE) {
			this.dir = this.moveCmd;
		}

		super.update(dt);

		if (this.dead) {
			//setSeq(Animation.prototype.SEQ_PLAYER_DEAD);
		} else {
			if (this.moveFracMoving) {
				switch (this.dir) {
				case 0:
					this.setSeq(Animation.prototype.SEQ_PLAYER_WALK_UP);
					break;
				case 1:
				default:
					this.setSeq(Animation.prototype.SEQ_PLAYER_WALK_DOWN);
					break;
				case 2:
					this.setSeq(Animation.prototype.SEQ_PLAYER_WALK_LEFT);
					break;
				case 3:
					this.setSeq(Animation.prototype.SEQ_PLAYER_WALK_RIGHT);
					break;
				}
			} else {
				switch (this.dir) {
				case 0:
					this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_UP);
					break;
				case 1:
				default:
					this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_DOWN);
					break;
				case 2:
					this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_LEFT);
					break;
				case 3:
					this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_RIGHT);
					break;
				}
			}
		}
	}

	getMoney(money) {
		this.setBombs(this.bombs + money.bombs);
		this.items |= money.items;
	}

	onTouchFlames() {
		this.die();
	}

	die() {
		if (this.dead) return;
		this.setSeq(Animation.prototype.SEQ_PLAYER_DEAD);
		this.dead = true;
		this.deadTime = game.time + 2;

		this.isBlocking = false;
		this.isBlockingPushers = false;
		this.blocksExplosion = false;

		this.moveCmd = -1;
		this.dropBombFlag = false;
	}

	onGroundSunk() {
		this.die();
	}

	setBombs(bombs) {
		this.bombs = bombs;
		ids.game_hud_bombs.innerText = this.bombs;
	}
}

Player.prototype.ITEM_GLOVES = 1;
//what other items might we want to make?
//portal gun
//incinerator?
//bomb-through-walls?
//walk-through-walls?


class Money extends BaseObj {
	constructor(...args) {
		super(...args);
		
		//Player.ITEM_ ...
		this.items = 0;

		//how many bombs this Money is holding
		//TODO - (a) make this a bitflag? (b) remove the #'s from the drawSprite too? (c) other optional flags on the drawSprite for other items
		this.bombs = 0;

		this.isBlocking = false;
		this.setSeq(Animation.prototype.SEQ_MONEY);
		this.gameNumbers = new GameNumbers();
	}

	//money isBlocking is false, but isBlockingSentry is true
	//this makes money the only special thing for sentries
	//(should keys be the same?)
	isBlockingSentry() { return true; }

	drawSprite(c, rect) {
		super.drawSprite(c, rect);

		if (this.bombs > 0) {
			this.gameNumbers.draw(c, rect, this.bombs, this.posX, this.posY);
		}

		if ((this.items & Player.prototype.ITEM_GLOVES) != 0) {
			let gloveSeq = anim.framesForSeq[ Animation.prototype.SEQ_GLOVE ];
			let gloveFrame = anim.frames[gloveSeq];
			let gloveBitmap = gloveFrame.bitmap;
			rect.left = (rect.left + rect.right) / 2;
			rect.bottom = (rect.top + rect.bottom) / 2;
			try {
				c.drawImage( gloveBitmap, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
			} catch (e) {}
		}
	}

	endPush(who, pushDestX, pushDestY) {
		if (!(who instanceof Player)) return;
		if (this.linfDist(pushDestX, pushDestY, this.destPosX, this.destPosY) >= .5) return;	//too far away

		{
			let player = who;
			player.getMoney(this);
		}

		game.removeObj(this);

		game.objs.forEach(o => {
			if (o instanceof Key) o.checkMoney();
		});
	}
}

class Key extends BaseObj {
	constructor(...args) {
		super(...args);
		
		this.changeLevelTime = 0;
		//wait a frame or so between player touch and end level
		this.touchToEndLevelDuration = 1/50;

		this.inactive = true;

		this.isBlocking = false;
		this.blocksExplosion = false;
		this.setSeq(Animation.prototype.SEQ_KEY_GREY);

		this.doFirstCheck = true;
	}

	show() {
		this.inactive = false;
		this.setSeq(Animation.prototype.SEQ_KEY);
	}

	endPush(who, pushDestX, pushDestY) {
		if (!(who instanceof Player)) return;
		if (this.inactive) return;
		if (this.changeLevelTime > 0) return;	//already been touched / already waiting to change level
		if (this.linfDist(pushDestX, pushDestY, this.destPosX, this.destPosY) >= .5) return;	//too far away

		//let a frame run before changing the level
		this.changeLevelTime = game.time + this.touchToEndLevelDuration;

		this.frameId = -1;	//disappear

		//TODO - delay? then this? that way medusas can get a shot off for sure,
		//if in their last frame the player was shootable

		game.objs.forEach(o => {
			if (o.removeMe) return;//continue;
			o.onKeyTouch();
		});

		//no more bomb dropping
		if (game.player !== undefined) {
			game.player.setBombs(0);
		}
	}

	update(dt) {
		super.update(dt);

		if (this.changeLevelTime > 0 && this.changeLevelTime < game.time) {
			if (!game.player.dead) {
				game.nextLevel();
			}
		}

		//check for levels with no money
		if (this.doFirstCheck) {
			this.doFirstCheck = false;
			this.checkMoney();
		}
	}

	checkMoney() {
		let moneyleft = 0;
		game.objs.forEach(o => {
			if (o.removeMe) return;//continue
			if (o instanceof Money) moneyleft++;
		});
		if (moneyleft == 0) {
			//throw an exception if there's no key
			this.show();
		}
	}
}

let buttonSys;

class Game {
	//call Game.prototype.staticInit() on startup, once
	static staticInit() {
		const thiz = Game.prototype;
		for (let i = 0; i < thiz.tileBitmapIds.length; i++) {
			thiz.mapTypes[i].typeIndex = i;
			thiz.mapTypes[i].bitmap = DOM('img', {src:'res/drawable/'+thiz.mapTypes[i].bitmapId+'.png'});
		}
	}

//I should make a game gui class:

	//static
	restart() {

		//this only works if it's a valid level
		splash.start({
			level : game ? game.level : 0,
			levelData : !game ? undefined : game.level == -1 ? game.levelData : undefined
		});
	}

	//static
	skip() {
		if (!game) return;
		game.nextLevel(true);
	}

	//static
	close() {
		let returnToEditor = game && game.returnToEditor;
		if (returnToEditor) {
			editor.customLevelIndex = -1;
			editor.show();
		} else {
			splash.show();
		}
	}

	//static
	gamepadToggle() {
		if (ids.gamepad_checkbox.checked) {
			buttonSys.show();
		} else {
			buttonSys.hide();
		}
	}

//the real game class:

	constructor(args) {
		this.lastFPSTime = Date.now();
		this.fpsUpdates = 0;

		if (args === undefined) args = {};
		if (goodisfinite(args.level) && args.level !== -1) {
			this.setLevel(args.level);
		} else if (args.levelData !== undefined) {
			this.levelData = args.levelData;
			this.setLevel(-1);
		} else {
			this.setLevel(0);
		}
		this.canvas = args.canvas;
		this.frozen = args.frozen;
		this.returnToEditor = args.returnToEditor;
		if (!args.dontResize) {
			requestAnimationFrame(onresize);	//resize the game's canvas
		}

		//hudPaint.setStyle(Paint.Style.FILL);
		//hudPaint.setColor(android.graphics.Color.WHITE);

		//hudShadow.setStyle(Paint.Style.STROKE);
		//hudShadow.setColor(android.graphics.Color.BLACK);
		//hudShadow.setStrokeWidth(4);

		//blackPaint.setStyle(Paint.Style.FILL);
		//blackPaint.setColor(android.graphics.Color.BLACK);

		this.sysTime = this.lastSysTime = Date.now();

		//TODO - read in tile types from some source
		this.tiles = [];//new MapType[MAP_WIDTH][];
		for (let i = 0; i < this.MAP_WIDTH; i++) {
			this.tiles[i] = [];//new MapType[MAP_HEIGHT];
			for (let j = 0; j < this.MAP_HEIGHT; j++) {
				this.tiles[i][j] = this.mapTypes[this.MAPTYPE_EMPTY];// (int)(Math.random() * mapTypes.length) ];
			}
		}

		this.bitmapButtonBomb = DOM('img', {src:'res/drawable/button_bomb.png'});

		//don't load the level just yet
		//first give the obj we are given to (i.e. the activity?) a chance to change the level or what not
		//(or move that into a let in the ctor)
		//and then call loadLevel in init()

		this.removeAll();	//and inits the objs and addObjs member arrays

		//special-case index for starting a blank level:
		if (this.level != -1 || this.levelData) {
			//Game.init is a function separate of the ctor (which I call Game.init now)
			//and all it had in it was this:
			this.loadLevel();
		}
	}

	nextLevel(dontComplete) {
		if (!dontComplete) localStorage.setItem('completed'+this.level, '1');
		if (this.level != -1) {
			this.setLevel(this.level+1);
		}
		this.loadLevelRequest = true;
	}

	setLevel(level) {
//console.log('setLevel', level);		
		this.level = level;
		if (this.level != -1) {
			localStorage.setItem('level', this.level);
			ids.game_hud_level.innerText = this.level;
		} else {
			ids.game_hud_level.innerText = '?';
		}
	}

	loadLevel() {
		this.removeAll();

	//	try
		{
			let levelData = undefined;
			if (this.level !== -1) {
//console.log('this.level', this.level, levelDB[this.level]);				
				levelData = levelDB[this.level].tiles;
			} else if (this.levelData !== undefined) {
				levelData = this.levelData;
			}
			if (levelData === undefined) throw "failed to find any level data";
this.levelData = levelData;

			if (typeof(levelData) == 'string') {
				let tileIndex = 0;
				for (let y = 0 ; y < this.MAP_HEIGHT; y++) {
					for (let x = 0; x < this.MAP_WIDTH; x++, tileIndex++) {
						let posX = x + .5;
						let posY = y + .5;
						let ch = levelData.charAt(2*tileIndex);
						let ch2 = levelData.charAt(2*tileIndex+1);
						this.tiles[x][y] = this.mapTypes[this.MAPTYPE_EMPTY];
						if (ch == '*') {
							this.tiles[x][y] = this.mapTypes[this.MAPTYPE_BRICK];
						} else if (ch == '#') {
							this.tiles[x][y] = this.mapTypes[this.MAPTYPE_STONE];
						} else if (ch == '=') {
							this.tiles[x][y] = this.mapTypes[this.MAPTYPE_WATER];
						} else if (ch == '&') {
							this.tiles[x][y] = this.mapTypes[this.MAPTYPE_TREE];
						} else if (ch == 'P') {
							this.player = new Player();
							this.player.setPos(posX, posY);
							this.objs.push(this.player);
						} else if (ch == 'M') {
							let money = new Money();
							money.setPos(posX, posY);
							if (ch2 >= '0' && ch2 <= '9') money.bombs = ch2 - '0';
							if (ch2 == 'G') money.items = Player.prototype.ITEM_GLOVES;
							this.objs.push(money);
						} else if (ch == 'K') {
							let key = new Key();
							key.setPos(posX, posY);
							this.objs.push(key);
						} else if (ch == 'B') {
							let bomb = new Bomb();
							bomb.setPos(posX, posY);
							if (ch2 >= '0' && ch2 <= '9') bomb.blastRadius = ch2 - '0';
							this.objs.push(bomb);
						} else if (ch == 'F') {
							let framer = new Framer();
							framer.setPos(posX, posY);
							this.objs.push(framer);
						} else if (ch == 'G') {
							let gun = new Gun();
							gun.setPos(posX, posY);
							this.objs.push(gun);
						} else if (ch == 'S') {
							let sentry = new Sentry();
							sentry.setPos(posX, posY);
							this.objs.push(sentry);
						} else if (ch == '.') {	//empty
						} else {
							console.log('found unknown '+ch);
						}
					}
				}
			} else {
				console.log(levelData);
				throw "got bad level data";
/*					// interpret as a json encoded level
				let tileObj = levelData;
				let tileIndex = 0;
				console.log("reading tiles...");
				for (let y = 0; y < this.MAP_HEIGHT; y++) {
					for (let x = 0; x < this.MAP_WIDTH; x++, tileIndex++) {
						let tileTypeIndex = (tileObj.tileIndex);
						if (tileTypeIndex < 0 || tileTypeIndex >= this.mapTypes.length) {
							throw ("got a bad tile type: " + tileTypeIndex);
						}
						this.tiles[x][y] = this.mapTypes[tileTypeIndex];
					}
				}

				console.log("reading ents...");
				let ents = JSON.stringify("ents");
				console.log("total number of ents: " + ents.length);
				for (let i = 0; i < ents.length(); i++) {
					let ent = ents[i];
					let classname = ent["class"];
					let posX = parseFloat(ent.x);
					let posY = parseFloat(ent.y);

					console.log("reading an ent " + classname + " at " + posX + " " + posY);

					if (classname == "Player") {
						this.player = new Player();
						this.player.setPos(posX,posY);
						this.objs.push(player);
					} else if (classname == "Money") {
						let money = new Money();
						money.setPos(posX,posY);
						if (ent.bombs !== undefined) money.bombs = (ent.bombs);
						this.objs.push(money);
					} else if (classname == "Key") {
						let key = new Key();
						key.setPos(posX,posY);
						this.objs.push(key);
					} else if (classname == "Bomb") {
						let bomb = new Bomb();
						bomb.setPos(posX,posY);
						if (ent.time !== undefined) bomb.setFuse((ent.time));
						if (ent.radius !== undefined) bomb.blastRadius = (ent.radius);
						this.objs.push(bomb);
					} else if (classname == "Framer") {
						let framer = new Framer();
						framer.setPos(posX,posY);
						this.objs.push(framer);
					} else {
						throw ("tried to load an unknown class: " + classname);
					}
				}
*/
			}
	//	} catch (e) {
	//		console.warning("Loading level failed: " + e + " msg:" + e.getMessage());
	//		throw;
		}
	}

	update() {
		//editor freezes games
		if (this.frozen) return;

		this.lastSysTime = this.sysTime;
		this.sysTime = Date.now();
		let deltaTime = this.sysTime - this.lastSysTime;
		this.accruedTime += deltaTime/1000;

		if (this.player) {
			if ((this.cmd & this.CMD_UP) != 0) {
				this.player.move(Dir.UP);
			} else if ((this.cmd & this.CMD_DOWN) != 0) {
				this.player.move(Dir.DOWN);
			} else if ((this.cmd & this.CMD_LEFT) != 0) {
				this.player.move(Dir.LEFT);
			} else if ((this.cmd & this.CMD_RIGHT) != 0) {
				this.player.move(Dir.RIGHT);
			} else {
				this.player.stopMoving();
			}

			//not exclusive to the above
			if ((this.cmd & this.CMD_BOMB) != 0) {
				this.player.beginDropBomb();
			} else {
				this.player.endDropBombs();
			}
		}

		while (this.accruedTime > this.updateDuration) {
			this.accruedTime -= this.updateDuration;
			this.time += this.updateDuration;

			//do game update here

			let thiz = this;
			this.objs.forEach(o => {
				if (o.removeMe) return;//continue
				o.update(thiz.updateDuration);
			});

			// ... only one update at most
			this.accruedTime = 0;
			break;
		}

		if (this.player && this.player.dead && this.player.deadTime < this.time) {
			this.loadLevel();	//set the request
		}

		if (this.removeRequest) {
			for (let i = this.objs.length-1; i >= 0; i--) {
				let o = this.objs[i];
				if (o.removeMe) {
					this.objs.splice(i, 1);
				}
			}
			this.removeRequest = false;
		}

		if (this.addList.length > 0) {
			this.objs = this.objs.concat(this.addList);
			this.addList = [];
		}

		if (this.loadLevelRequest) {
			this.loadLevelRequest = false;

	//		if (level >= Levels.levels.length) {
	//			//then end the game
	//			g.endGame();
	//			//and pop up a screen or whatever
	//			//like elemental does
	//		}

			this.level %= levelDB.length;
			this.loadLevel();
		}
	}

	setFontSize(fontSize) {
		if (fontSize === this.fontSize) return;
		this.fontSize = fontSize;
		ids['game-stats'].style.fontSize=fontSize;
	}

	draw() {
		let c = this.canvas.getContext('2d');

//		long thisFPSTime = System.currentTimeMillis();
//		fpsUpdates++;
//		long deltaFPSTime = thisFPSTime - lastFPSTime;
//		if (deltaFPSTime > 1000) {
//			Log.w(this.getClass().getName(), "fps: " + fpsUpdates * 1000 / deltaFPSTime);
//			lastFPSTime = thisFPSTime;
//			fpsUpdates = 0;
//		}


		this.width = game.canvas.width;//c.getWidth();
		this.height = game.canvas.height;//c.getHeight();
		this.TILE_HEIGHT = this.height / this.MAP_HEIGHT;
		this.TILE_WIDTH = this.TILE_HEIGHT;
		this.setFontSize(this.TILE_HEIGHT);

//portrait
//		rectBomb.set(width*5/8, MAP_HEIGHT * TILE_HEIGHT, width*7/8, height);	//l,t,r,b
//		rectDpad.set(0, MAP_HEIGHT * TILE_HEIGHT, width/2, height);
//landscape
//		rectBomb.set(0, height/8, width - MAP_WIDTH * TILE_WIDTH, height*3/8);	//l,t,r,b
//		rectDpad.set(0, height/2, width - MAP_WIDTH * TILE_WIDTH, height);

		for (let i = 0; i < this.MAP_WIDTH; i++) {
			for (let j = 0; j < this.MAP_HEIGHT; j++) {
				let t = this.tiles[i][j];
				let paddingX = this.width - this.MAP_WIDTH * this.TILE_WIDTH;
				this.rect.left = i * this.TILE_WIDTH + paddingX;
				this.rect.right = this.rect.left + this.TILE_WIDTH;
				this.rect.top = j * this.TILE_HEIGHT;
				this.rect.bottom = this.rect.top + this.TILE_HEIGHT;
				//c.drawBitmap(t.bitmap, i * TILE_WIDTH, j * TILE_HEIGHT, undefined);

				if ((t.flags & MapType.prototype.DRAW_GROUND_UNDER) != 0) {
					try {
						c.drawImage(this.mapTypes[this.MAPTYPE_EMPTY].bitmap,
							this.rect.left, this.rect.top, this.rect.right - this.rect.left, this.rect.bottom - this.rect.top
						);
					} catch (e) {}
				}

				try {
					c.drawImage(t.bitmap,
						this.rect.left, this.rect.top, this.rect.right - this.rect.left, this.rect.bottom - this.rect.top
					);
				} catch (e) {}
			}
		}

		//draw player
		let thiz = this;
		this.objs.forEach(o => {
			o.drawSprite(c, thiz.rect);
		});

		//black
		this.rect.top = 0;
		this.rect.bottom = this.height;
		this.rect.left = 0;
		this.rect.right = this.width - this.MAP_WIDTH * this.TILE_WIDTH;
		c.fillStyle = 'black';	//blackpaint
		c.fillRect(
			this.rect.left, this.rect.top, this.rect.right - this.rect.left, this.rect.bottom - this.rect.top
		);
	}

	getMapType(ix, iy) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return this.mapTypes[this.MAPTYPE_OOB];
		return this.tiles[ix][iy];
	}
	
	getMapTypeIndex(ix, iy) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return this.MAPTYPE_OOB;
		return this.tiles[ix][iy].typeIndex;
	}

	setMapTypeIndex(ix, iy, type) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return false;
		this.tiles[ix][iy] = this.mapTypes[type];
		return true;
	}

	removeAll() {
		//remove objs individually -- so they can detach dom elems and what not
		if (this.objs !== undefined) {
			this.objs.forEach(o => {
				o.onRemove();
			});
		}
		this.objs = [];//new LinkedList<BaseObj>();
		this.addList = [];//new LinkedList<BaseObj>();
	}

	removeObj(o) {
		o.onRemove();
		this.removeRequest = true;
	}

	addObj(o) {
		this.addList.push(o);
	}

	restartLevel() {
		this.player.die();
	}
}

Game.prototype.MAPTYPE_EMPTY = 0;
Game.prototype.MAPTYPE_TREE = 1;
Game.prototype.MAPTYPE_BRICK = 2;
Game.prototype.MAPTYPE_STONE = 3;
Game.prototype.MAPTYPE_WATER = 4;

Game.prototype.MAP_WIDTH = 10;
Game.prototype.MAP_HEIGHT = 10;	//i want this to be 10... how do you hide the titlebar?

Game.prototype.tileBitmapIds = [
	'ground',
	'tree',
	'bricks',
	'stone',
	'water',
];

//TODO - keep this 1-1 with MAPTYPE_***
Game.prototype.mapTypes = [
	new MapType('ground', 0),
	new MapType('tree', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.DRAW_GROUND_UNDER),
	new MapType('bricks', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.BLOCKS_GUNSHOT | MapType.prototype.BLOCKS_EXPLOSIONS | MapType.prototype.BOMBABLE),
	new MapType('stone', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.BLOCKS_GUNSHOT | MapType.prototype.BLOCKS_EXPLOSIONS),
	new MapType('water', MapType.prototype.CANNOT_PASSTHRU),
];

Game.prototype.removeRequest = false;

Game.prototype.rect = new Rect();

//used for fixed-rate updates
Game.prototype.sysTime = 0;
Game.prototype.lastSysTime = 0;
Game.prototype.accruedTime = 0;
Game.prototype.updateDuration = 1/50;
Game.prototype.time = 0;

Game.prototype.loadLevelRequest = false;
Game.prototype.level = 0;

//canvas size
Game.prototype.width = 1;
Game.prototype.height = 1;

Game.prototype.CMD_UP = 1;
Game.prototype.CMD_DOWN = 2;
Game.prototype.CMD_LEFT = 4;
Game.prototype.CMD_RIGHT = 8;
Game.prototype.CMD_BOMB = 16;
Game.prototype.cmd = 0;

//was constant ... because
Game.prototype.TILE_WIDTH = 24;
Game.prototype.TILE_HEIGHT = 24;




//self-referencing initial values.  i could do new (function({})() rather than {} to allow this in-place...
//out of bound tiles are considered...
Game.prototype.MAPTYPE_OOB = Game.prototype.MAPTYPE_STONE;

function refreshLevels(done) {
	fetch('levels.json')
	.then(response => {
		if (!response.ok) return Promise.reject('not ok');
		response.json()
		.then(d => {
			levelDB = d.levels;
			if (done) done();
		});
	})
	.catch(e => {
		alert('failed to load levels!');
	});
}

function refreshUserLevels(done) {
	thisUserLevelDB = localStorage.getItem('thisUserLevelDB') || undefined;
	if (thisUserLevelDB !== undefined) {
		thisUserLevelDB = JSON.parse(thisUserLevelDB);
	} else {
		thisUserLevelDB = [];
	}

	fetch('userlevels.json')
	.then(response => {
		if (!response.ok) return Promise.reject('not ok');
		response.json()
		.then(d => {
			allUsersLevelDB = d.levels;
		});
	}).catch(e =>{
		console.log('failed to load user levels!');
	})
	.finally(() => {
		if (done) done();
	});
}

function saveUserLevels() {
	if (thisUserLevelDB !== undefined && thisUserLevelDB.length > 0) {
		localStorage.setItem('thisUserLevelDB', JSON.stringify(thisUserLevelDB));
	} else {
		localStorage.removeItem('thisUserLevelDB');
	}
}

class Splash {
	show() {
		clearGame();
		buttonSys.hide();
		changePage('splash-page');
	}
	start(args) {
		clearGame();
		if (args === undefined) args = {};
		if (args.level === undefined) {
			args.level = parseInt(localStorage.getItem('level'));
			if (!goodisfinite(args.level)) args.level = undefined;	//stupid javascript says parseint on bad values is NaN ...
		}
		if (args.level === undefined) {
			args.level = 0;
		}
		refreshLevels(() => {
			args.canvas = ids['game-canvas'];
			game = new Game(args);
			hide(ids.dropdown);
			changePage('game-page');
		});
		//refresh gamepad
		Game.prototype.gamepadToggle();
	}
}

class ChooseLevels {
	show() {
		buttonSys.hide();
		changePage('level-page');
		this.refresh();
	}
	refresh(done) {
		let thiz = this;
		ids['level-page-content'].innerHTML = '';
		refreshLevels(() => {
			refreshUserLevels(() => {
				let dbs = [levelDB];	//better be there
				if (thisUserLevelDB !== undefined && thisUserLevelDB.length > 0) dbs.push(thisUserLevelDB);	//might be there
				if (allUsersLevelDB !== undefined && allUsersLevelDB.length > 0) dbs.push(allUsersLevelDB);	//might be there
				dbs.forEach(db => {

					if (db == allUsersLevelDB && db.length > 0) {
						DOM('br', {appendTo:ids['level-page-content']});
						DOM('br', {appendTo:ids['level-page-content']});
						DOM('div', {text:'User Submitted Levels:', appendTo:ids['level-page-content']});
					} else if (db == thisUserLevelDB && db.length > 0) {
						DOM('br', {appendTo:ids['level-page-content']});
						DOM('br', {appendTo:ids['level-page-content']});
						DOM('div', {text:'Your Levels:', appendTo:ids['level-page-content']});
					}

					db.forEach((levelData, i) => {
						let levelNumber = i;
						if (db !== levelDB) levelNumber = -1;
						//set canvas global
						let chooseCanvas = DOM('canvas', {
							css : {
								padding:'10px',
								cursor:'pointer'
							},
							click : e => {
								console.log(levelNumber, levelData.tiles);
								splash.start({
									level:levelNumber,
									levelData:levelData.tiles
								});
							},
							attrs : {
								width : 200,
								height : 200,
							},
							appendTo : ids['level-page-content'],
						});

						if (db == thisUserLevelDB) {
							DOM('img', {
								src : 'images/cross.png',
								css : {
									verticalAlign:'top',
									cursor:'pointer'
								},
								click : e => {
									thisUserLevelDB.splice(i,1);
									saveUserLevels();
									let t = document.body.scrollTop;
									thiz.refresh(function() {
										document.body.scrollTop = t;
									});
								},
								appendTo:ids['level-page-content'],
							});

							DOM('img', {
								src : 'images/pencil.png',
								css : {
									cursor:'pointer',
									paddingRight:'10px'
								},
								click : function() {
									editor.levelData = levelData.tiles;
									editor.customLevelIndex = i;
									editor.show();
								},
								appendTo:ids['level-page-content'],
							});

						}

						//and now do a single draw...
						game = new Game({
							frozen:true,
							levelData:levelData.tiles,
							canvas:chooseCanvas,
							dontResize:true
						});
						game.draw();
						game.removeAll();

						if (db == levelDB && localStorage.getItem('completed'+i) == '1') {
							let c = chooseCanvas.getContext('2d');
							c.globalAlpha = .5;
							c.fillStyle = '#fff';
							c.fillRect(0,0,game.canvas.width,game.canvas.height);
							c.globalAlpha = 1;
						}
					});

				});
				game = undefined;
				if (done) done();
			});
		});
	}
}

function showHelp() {
	buttonSys.hide();
	changePage('help-page');
}

function clearGame() {
	if (!game) return;
	game.removeAll();
	game = undefined;
}

class Editor {
	constructor() {
		let text = Array(Game.prototype.MAP_HEIGHT+1).join(
			Array(2*Game.prototype.MAP_WIDTH+1).join('.')
		);
		//ids['editor-textarea'].value = text;
		this.customLevelIndex = -1;
		this.levelData = text;
	}
	show() {
		this.refresh();
		buttonSys.hide();
		changePage('editor-page');
	}
	refresh() {
		clearGame();
		game = new Game({
			frozen:true,
			levelData:this.levelData,
			canvas:ids['editor-canvas'],
		});
	}
	play() {
		splash.start({
			level:-1,
			levelData:this.levelData,
			returnToEditor:true
		});
	}
	edit() {
		if (game) {
			if (game.level !== -1) this.customLevelIndex = -1;
			this.levelData = game.levelData;
		} else {
			this.init();
		}
		this.show();
	}
	save() {
		//if we have a current entry in the user levels then replace it...
		console.log("saving custom index",this.customLevelIndex);
		if (this.customLevelIndex !== -1) {
			assert(this.customLevelIndex >= 0 && this.customLevelIndex < thisUserLevelDB.length);
			thisUserLevelDB[this.customLevelIndex] = {tiles:this.levelData};
		} else {
			this.customLevelIndex = thisUserLevelDB.length;
			thisUserLevelDB.push({tiles:this.levelData});
		}
		saveUserLevels();
	}
	submit() {
		let name = prompt('whats your name?');
		if (!name) return;
		fetch('submit.lua', {
			data:{
				name:name,
				tiles:this.levelData//ids['editor-textarea'].value,
			},
		});
		/* jquery is always interpreting this as a fail, even if it gets a json win message back
		.done(function() {
			console.log('submit.lua done', arguments);
			//alert('win');
		}).fail(function() {
			alert('something went terribly wrong');
		})*/;
	}
}

//main
let game;
let levelDB = [];
let allUsersLevelDB = [];
let thisUserLevelDB = [];
let anim;
const splash = new Splash();
const chooseLevels = new ChooseLevels();
const editor = new Editor();

function onresize() {
	buttonSys.onresize();
	let width = window.innerWidth;
	let height = window.innerHeight;
	let screenWidth = width - 50;
	let screenHeight = height - 50;	//make room for ad
	//resize by the smallest of the two constraints
	if (screenWidth > screenHeight) {
		screenWidth = screenHeight;
	} else {
		screenHeight = screenWidth;
	}
	if (game) {
		let canvas = game.canvas;
		canvas.width = parseInt(screenWidth);
		canvas.height = parseInt(screenHeight);
		canvas.style.left = (Math.max(0, parseInt(width-screenWidth)/2))+'px';
		canvas.style.top = 50 + 'px';
		game.draw();
	}
}

function update() {
	if (game) {
		game.update();
		game.draw();
	}

	requestAnimationFrame(update);
}


function handleButtonCommand(cmd, press) {
	if (!game) return;
	if (press) {
		switch (cmd) {
		case 'up':
			game.cmd &= ~(game.CMD_DOWN | game.CMD_LEFT | game.CMD_RIGHT);
			game.cmd |= game.CMD_UP;
			break;
		case 'down':
			game.cmd &= ~(game.CMD_UP | game.CMD_LEFT | game.CMD_RIGHT);
			game.cmd |= game.CMD_DOWN;
			break;
		case 'left':
			game.cmd &= ~(game.CMD_UP | game.CMD_DOWN | game.CMD_RIGHT);
			game.cmd |= game.CMD_LEFT;
			break;
		case 'right':
			game.cmd &= ~(game.CMD_UP | game.CMD_DOWN | game.CMD_LEFT);
			game.cmd |= game.CMD_RIGHT;
			break;
		case 'fire':
			game.cmd |= game.CMD_BOMB;
			break;
		case 'die':
			if (game.player) game.player.die();
			break;
		}
	} else {
		switch (cmd) {
		case 'up':
			game.cmd &= ~game.CMD_UP;
			break;
		case 'down':
			game.cmd &= ~game.CMD_DOWN;
			break;
		case 'left':
			game.cmd &= ~game.CMD_LEFT;
			break;
		case 'right':
			game.cmd &= ~game.CMD_RIGHT;
			break;
		case 'fire':
			game.cmd &= ~game.CMD_BOMB;
			break;
		}
	}
}

function onkeydown(event) {
	if (activePage == ids['game-page']) {
		if (!game) return;
		let keyCode = event.keyCode;
		switch (keyCode) {
		case 73:	//'i'
		case 38:	//up
			game.cmd &= ~(game.CMD_DOWN | game.CMD_LEFT | game.CMD_RIGHT);
			game.cmd |= game.CMD_UP;
			break;
		case 77:	//'m'
		case 40:	//down
			game.cmd &= ~(game.CMD_UP | game.CMD_LEFT | game.CMD_RIGHT);
			game.cmd |= game.CMD_DOWN;
			break;
		case 74:	//'j'
		case 37:	//left
			game.cmd &= ~(game.CMD_UP | game.CMD_DOWN | game.CMD_RIGHT);
			game.cmd |= game.CMD_LEFT;
			break;
		case 75:	//'k'
		case 39:	//right
			game.cmd &= ~(game.CMD_UP | game.CMD_DOWN | game.CMD_LEFT);
			game.cmd |= game.CMD_RIGHT;
			break;
		case 13:	//enter
		case 32:	//space
			game.cmd |= game.CMD_BOMB;
			break;
		case 27:	//escape
			if (game.player) game.player.die();
			break;
		default:
			return;	//...and don't prevent default
		}
		event.preventDefault();
	} else if (activePage == ids['editor-page']) {
		let keyCode = event.keyCode;
		let editorKeys = {
			'.' : '..',
			'*' : '**',
			'#' : '##',
			'=' : '=='
		};
		ids['editor-select'].value = editorKeys[String.fromCharCode(keyCode)] || '..';
	}
}

function onkeyup(event) {
	if (activePage != ids['game-page']) return;
	if (!game) return;
	let keyCode = event.keyCode;
	switch (keyCode) {
	case 73:	//'i'
	case 38:	//up
		game.cmd &= ~game.CMD_UP;
		break;
	case 77:	//'m'
	case 40:	//down
		game.cmd &= ~game.CMD_DOWN;
		break;
	case 74:	//'j'
	case 37:	//left
		game.cmd &= ~game.CMD_LEFT;
		break;
	case 75:	//'k'
	case 39:	//right
		game.cmd &= ~game.CMD_RIGHT;
		break;
	case 13:	//enter
	case 32:	//space
		game.cmd &= ~game.CMD_BOMB;
		break;
	default:
		return;	//...and don't prevent default
	}
	event.preventDefault();
}

function onkeypress(event) {
	if (activePage != ids['game-page']) return;
	event.preventDefault();
}

function editorHandleScreenEvent(event, press) {
	if (activePage == ids['editor-page']) {
		if (!press) return;
		let c = ids['editor-canvas'];
		let x = event.pageX - parseInt(c.style.left);
		let y = event.pageY - parseInt(c.style.top);
		x /= game.TILE_WIDTH;
		y /= game.TILE_HEIGHT;
		x = Math.floor(x);
		y = Math.floor(y);
		if (x >= 0 && x < game.MAP_WIDTH && y >= 0 && y < game.MAP_HEIGHT) {
			//change the map!
			//remove newlines
			assertEquals(editor.levelData.length, 200);
			let i = 2 * (x + game.MAP_WIDTH * y);
			let sel = ids['editor-select'].value;
			assertEquals(sel.length, 2);
			editor.levelData = editor.levelData.substring(0, i)
				+ sel
				+ editor.levelData.substring(i+2);
			editor.refresh();
		}
	}
}

let mouseIntervalMethod = 1;
let mouseDownInterval;
let lastMouseEvent;
function editorMouseEventHandler(event) {
	if (activePage != ids['game-page'] &&
		activePage != ids['editor-page']) return;
	//buttonSys.show();
	//event.preventDefault();
	lastMouseEvent = event;
	if (event.type == 'mousedown') {
		if (mouseIntervalMethod == 0) {
			editorHandleScreenEvent(lastMouseEvent, true);
		} else {
			if (mouseDownInterval !== undefined) {
				if (mouseIntervalMethod == 1) {
					clearInterval(mouseDownInterval);
				} else if (mouseIntervalMethod == 2) {
					return;
				}
			}
			editorHandleScreenEvent(lastMouseEvent, true);
			mouseDownInterval = setInterval(function() {
				editorHandleScreenEvent(lastMouseEvent, true);
			}, 50);
		}
	} else if (event.type == 'mouseup') {
		editorHandleScreenEvent(lastMouseEvent, false);
		if (mouseIntervalMethod != 0) {
			if (mouseDownInterval !== undefined) clearInterval(mouseDownInterval);
			mouseDownInterval = undefined;
		}
	}
}

/*
canvas = ids['game-canvas'];
canvas.disableSelection();
glutil = new GLUtil({canvas:canvas.get(0)});
gl = glutil.context;
*/

window.addEventListener('resize', onresize);
Game.staticInit();
GameNumbers.staticInit();

let fontSize = 24;
let buttonBorder = [.02, .04];
let buttonSeparation = [.005, .01];
let buttonSize = [.1, .2];
buttonSys = new ButtonSys({
	fontSize : fontSize,
	callback : handleButtonCommand,
	buttons : [
		{
			cmd:'left',
			url:'icons/left.png',
			bbox:new box2({
				min:{x:buttonBorder[0], y:1-buttonBorder[1]-buttonSize[1]},
				max:{x:buttonBorder[0]+buttonSize[0], y:1-buttonBorder[1]}
			})
		},
		{
			cmd:'down',
			url:'icons/down.png',
			bbox:new box2({
				min:{x:buttonBorder[0]+buttonSize[0]+buttonSeparation[0], y:1-buttonBorder[1]-buttonSize[1]},
				max:{x:buttonBorder[0]+2*buttonSize[0]+buttonSeparation[0], y:1-buttonBorder[1]}
			})
		},
		{
			cmd:'up',
			url:'icons/up.png',
			bbox:new box2({
				min:{x:buttonBorder[0]+buttonSize[0]+buttonSeparation[0], y:1-buttonBorder[1]-buttonSize[1]*2-buttonSeparation[1]},
				max:{x:buttonBorder[0]+2*buttonSize[0]+buttonSeparation[0], y:1-buttonBorder[1]-buttonSize[1]-buttonSeparation[1]}
			})
		},
		{
			cmd:'right',
			url:'icons/right.png',
			bbox:new box2({
				min:{x:buttonBorder[0]+buttonSize[0]*2+buttonSeparation[0]*2, y:1-buttonBorder[1]-buttonSize[1]},
				max:{x:buttonBorder[0]+3*buttonSize[0]+buttonSeparation[0]*2, y:1-buttonBorder[1]}
			})
		},
		{
			cmd:'fire',
			url:'icons/ok.png',
			bbox:new box2({
				min:{x:1-buttonBorder[0]-buttonSize[0], y:1-buttonBorder[1]-buttonSize[1]},
				max:{x:1-buttonBorder[0], y:1-buttonBorder[1]}
			})
		}
	]
});

window.addEventListener('keydown', onkeydown)
window.addEventListener('keyup', onkeyup)
window.addEventListener('keypress', onkeypress)

ids['editor-page'].addEventListener('mousedown', editorMouseEventHandler);
ids['editor-page'].addEventListener('mousemove', editorMouseEventHandler);
ids['editor-page'].addEventListener('mouseup', editorMouseEventHandler);

//init globals
anim = new Animation();

//preload images
let imgs = [];
//tiles
Game.prototype.mapTypes.forEach(mapType => {
	imgs.push(mapType.bitmap.src);
});
//frames
Animation.prototype.frames.forEach(frame => {
	imgs.push(frame.bitmap.src);
});
//numbers
GameNumbers.prototype.bitmaps.forEach(bitmap => {
	imgs.push(bitmap.src);
});
//preload
preload(imgs, () => {
	//now make gl textures for all images
	/*
	imgs.forEach(img => {
		img.tex = new glutil.Texture2D({
			flipY : false,
			dontPremultiplyAlpha : true,
			data : img,
			minFilter : gl.LINEAR,
			magFilter : gl.LINEAR,
			generateMipmap : true
		});
	});
	*/

	//if get params have a level, then just play it
	const level = urlparams.get('level');
	if (goodisfinite(level)) {
		splash.start({level:parseInt(level)});
	} else {
		//otherwise, splash screen
		splash.show();
	}
}, percent => {
	ids.loading.value = parseInt(100*percent);
});

Object.entries({
	startButton : {click : e => { splash.start(); }},
	chooseLevelsButton : {click : e => { chooseLevels.show(); }},
	helpButton : {click : e => { showHelp(); }},
	levelPageMainMenuButton : {click : e => { splash.show(); }},
	helpPageMainMenuButton : {click : e => { Game.prototype.close(); }},
	helpPageMainMenuButton2 : {click : e => { Game.prototype.close(); }},
	editorPageClose : {click : e => { splash.show(); }},
	editorPagePlay : {click : e => { editor.play(); }},
	editorPageSave : {click : e => { editor.save(); }},
	editorPageSubmit : {click : e => { editor.submit(); }},
	gamePageMenu : {click : e => { toggleHidden(ids.dropdown); }},
	gamePageSkip : {click : e => { Game.prototype.skip(); }},
	gamePageRestart : {click : e => { Game.prototype.restart(); }},
	gamepad_checkbox : {change : e => { Game.prototype.gamepadToggle(); }},
	gamePageEdit : {click : e => { editor.edit(); }},
	gamePageClose : {click : e => { Game.prototype.close(); }},
}).forEach(entry => {
	const [id, handlers] = entry;
	const obj = assertExists(ids, id);
	Object.entries(handlers).forEach(entry => {
		const [name, func] = entry;
		obj.addEventListener(name, func);
	});
});

update();
