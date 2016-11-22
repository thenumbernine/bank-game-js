var canvas, glutil, gl;

function Rect() {
	this.left = 0;
	this.right = 0;
	this.top = 0;
	this.bottom = 0;
}

var Dir = {
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

var MapType = makeClass({
	CANNOT_PASSTHRU : 1,	//blocks any moving thing
	DRAW_GROUND_UNDER : 2,	//special for trees and other semi-transparent ones
	BLOCKS_GUNSHOT : 4,	//blocks shots from guns
	BLOCKS_EXPLOSIONS : 8,	//explosions stop here.  then they check BOMBABLE and clear the tile if it's bombable
	BOMBABLE : 16,			//bomb this type of block to return it to empty

	bitmapId : 0,
	typeIndex : 0,
	flags : 0,
	
	init : function(bitmapId, flags) {
		this.bitmapId = bitmapId;
		this.flags = flags;
	}
});

var Frame = makeClass({
	bitmapId : 0,
	duration : 1,	//in frames
	frameChange : 0,
	sequenceMarker : -1,

	init : function(bitmapId, duration, frameChange, sequenceMarker) {
		this.bitmapId = bitmapId;
		this.duration = duration !== undefined ? duration : 1;
		this.frameChange = frameChange !== undefined ? frameChange : 0;
		this.sequenceMarker = sequenceMarker !== undefined ? sequenceMarker : 0;
	}
});
	
var Animation = makeClass({

	SEQ_PLAYER_STAND_UP : 0,
	SEQ_PLAYER_STAND_DOWN : 1,
	SEQ_PLAYER_STAND_LEFT : 2,
	SEQ_PLAYER_STAND_RIGHT : 3,
	SEQ_PLAYER_WALK_UP : 4,
	SEQ_PLAYER_WALK_DOWN : 5,
	SEQ_PLAYER_WALK_LEFT : 6,
	SEQ_PLAYER_WALK_RIGHT : 7,
	SEQ_PLAYER_DEAD : 17,
	
	SEQ_MONEY : 8,
	SEQ_KEY : 9,
	SEQ_KEY_GREY : 10,
	SEQ_DOOR : 11,
	SEQ_SPARK : 13,
	SEQ_FRAMER : 14,
		
	SEQ_BOMB : 12,
	SEQ_BOMB_LIT : 18,
	SEQ_BOMB_SUNK : 19,

	SEQ_GUN : 15,
	SEQ_GUN_MAD : 16,
	
	SEQ_SENTRY : 20,
	
	SEQ_GLOVE : 21,
	
	SEQ_CLOUD: 22,
	
	SEQ_BRICKS : 23,
	
	SEQ_COUNT : 24, 	

	init : function() {
		for (var i = 0; i < this.framesForSeq.length; i++) {
			this.framesForSeq[i] = -1;
			for (var j = 0; j < this.frames.length; j++) {
				if (this.frames[j].sequenceMarker == i) {
					this.framesForSeq[i] = j;	
					break;
				}
			}
		}
		
		for (var i = 0; i < this.frames.length; i++) {
			var frame = this.frames[i];
			frame.bitmap = $('<img>', {src:'res/drawable/'+frame.bitmapId+'.png'}).get(0);
		}
	},
	
	getFrameForSeq : function(seq) {
		if (seq < 0 || seq >= this.framesForSeq.length) return -1;
		return this.framesForSeq[seq];
	}
});
//needs other statics to define itself
Animation.prototype.framesForSeq = [];
Animation.prototype.framesForSeq.length = Animation.prototype.SEQ_COUNT;
	
Animation.prototype.frames = [
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

var GameNumbers = makeClass(new (function(){
	this.bitmaps = [];
	this.staticInit = function() {
		for (var i = 0; i < 10; i++) {
			GameNumbers.prototype.bitmaps.push($('<img>', {src:'res/drawable/'+i+'.png'}).get(0));
		}
	};
	this.draw = function(c, rect, n, x, y) {
		var paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;
		var s = ''+n;
		for (var i = 0; i < s.length; i++) {
			var frame = s.charCodeAt(i) - ('0').charCodeAt(0);
			var bitmap = this.bitmaps[frame];
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
	};
})());

/*
function GameText() {
	this.span = $('<span>', {
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
		var paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;
		var canvasPos = $(game.canvas).position();
		this.span.get(0).style.fontSize = parseInt(game.TILE_HEIGHT/2)+'px';
		this.span.get(0).style.left = parseInt(canvasPos.left + ((posX - .25) * game.TILE_WIDTH) + paddingX);
		this.span.get(0).style.top = parseInt(canvasPos.top + ((posY + .25) * game.TILE_HEIGHT) - game.TILE_HEIGHT/2);
		this.span.text(''+text);
	},
	remove : function() { this.span.remove(); }
};
*/

var AnimatedObj = makeClass(new (function(){

	this.scale = [1,1];

	this.frameId = 0;	//index into frametable
	this.frameTime = 0;	//measured in fps intervals, i.e. frames

	this.framerate = 30;	//animation framerate

	this.seq = -1;
	
	this.update = function(dt) {
		if (this.frameId < 0 || this.frameId >= anim.frames.length) return;
		var frame = anim.frames[this.frameId];
		this.frameTime += dt * this.framerate;
		if (this.frameTime < frame.duration) return;
		this.setFrame(this.frameId + frame.frameChange);
	};
	
	this.setFrame = function(frameId) {
		this.frameId = frameId;
		this.frameTime = 0;
	};
	
	this.setSeq = function(seq) {
		if (this.seq == seq) return;
		
		this.seq = seq;
		this.setFrame( anim.getFrameForSeq(seq) );
	};
})());

var BaseObj = makeClass(new (function(){
	this.super = AnimatedObj;

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

	//helpful for subclasses.  TODO - move somewhere else
	this.linfDist = function(ax, ay, bx, by) {
		var dx = ax - bx;
		var dy = ay - by;
		var adx = dx < 0 ? -dx : dx;
		var ady = dy < 0 ? -dy : dy;
		return adx > ady ? adx : ady;	//maximum of the two
	};
	
	this.setPos = function(x, y) {
		this.srcPosX = this.destPosX = x;
		this.srcPosY = this.destPosY = y;
		//the lua game didnt' do this..
		this.posX = x;
		this.posY = y;
	};
	
	this.drawSprite = function(c, rect) {
		if (this.frameId < 0 || this.frameId >= anim.frames.length) return;
		
		var paddingX = game.canvas.width - game.MAP_WIDTH * game.TILE_WIDTH;
	
		var w = game.TILE_WIDTH * this.scale[0];
		var h = game.TILE_HEIGHT * this.scale[1];

		rect.left = (this.posX - .5 * this.scale[0]) * game.TILE_WIDTH + paddingX;
		rect.right = rect.left + w;
		rect.top = (this.posY - .5 * this.scale[1]) * game.TILE_HEIGHT;
		rect.bottom = rect.top + h;
		
		var frame = anim.frames[this.frameId];
		if (!frame) throw 'failed to find frame for id '+this.frameId;
		
		var bitmap = frame.bitmap;
		if (!bitmap) throw 'failed to find bitmap for frame '+this.frameId;
		
		if (this.blend == 'alpha-threshold') {	
			var tmpcanvas = document.createElement('canvas');
			tmpcanvas.width = bitmap.width;
			tmpcanvas.height = bitmap.height;
			
			var tmpctx = tmpcanvas.getContext('2d');
			tmpctx.drawImage(bitmap, 0, 0);
			var imagedata = tmpctx.getImageData(0, 0, bitmap.width, bitmap.height);
			var data = imagedata.data;
			var alpha = this.color !== undefined ? this.color[3] : 1;
			for (var i = 0; i < data.length; i += 4) {
				data[i+3] = data[i+3] * alpha < 128 ? 0 : 255;
			}
			tmpctx.putImageData(imagedata, 0, 0);
			
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
	};
	
	//whether sentry can walk over it
	//i know, i know ... how esoteric are these routines in the base class becoming?
	//currently set to 'isBlocking' except for money, which is always true
	//this means keys and doors don't block
	this.isBlockingSentry = function() { return this.isBlocking; };
	
	this.hitEdge = function(whereX, whereY) { return true; };
	
	this.cannotPassThru = function(maptype) {
		var res = (game.mapTypes[maptype].flags & MapType.prototype.CANNOT_PASSTHRU) != 0;
		return res;
	};
	
	this.hitWorld = function(whereX, whereY, typeUL, typeUR, typeLL, typeLR) {
		var res =
			this.cannotPassThru(typeUL) ||
			this.cannotPassThru(typeUR) ||
			this.cannotPassThru(typeLL) ||
			this.cannotPassThru(typeLR);
		return res;
	};
	
	//called when MovableObj's get a move cmd, try to move, and hit another object
	//this - the object that is moving
	//what - the object that was hit
	this.hitObject = function(what, pushDestX, pushDestY, side) {
		return this.HIT_RESPONSE_TEST_OBJECT;
	};
	
	//called when MovableObj's get a move cmd, try to move, hit another object,
	//	and the MovableObj's hitObject returns HIT_RESPONSE_TEST_OBJECT
	//this - the object being pushed
	//pusher - the MovableObj that is pushing it
	//returns - true if the pusher was blocked by this object
	this.startPush = function(pusher, pushDestX, pushDestY, side) {
		return this.isBlocking;
	};
	
	this.endPush = function(who, pushDestX, pushDestY) {};
	
	this.onKeyTouch = function() {};
	
	this.onTouchFlames = function() {};
	
	this.onGroundSunk = function() {
		game.removeObj(this);
	};

	//use game.removeObj to remove an object
	this.onRemove = function() {
		this.removeMe = true;
	};
})());

var MovableObj = makeClass(new (function(){
	this.super = BaseObj;
	this.MOVE_RESPONSE_NO_MOVE = 0;
	this.MOVE_RESPONSE_WAS_BLOCKED = 1;
	this.MOVE_RESPONSE_DID_MOVE = 2;
	
	this.lastMoveResponse = this.MOVE_RESPONSE_NO_MOVE;
	this.moveCmd = Dir.NONE;
	this.speed = 10;	//tiles covered per second
	this.moveFracMoving = false;
	this.moveFrac = 0;	//fixed precision
	
	this.moveIsBlocked_CheckHitWorld = function(whereX, whereY) {
		var typeUL = game.getMapTypeIndex(whereX - .25, whereY - .25);
		var typeUR = game.getMapTypeIndex(whereX + .25, whereY - .25);
		var typeLL = game.getMapTypeIndex(whereX - .25, whereY + .25);
		var typeLR = game.getMapTypeIndex(whereX + .25, whereY + .25);
		
		return this.hitWorld(whereX, whereY, typeUL, typeUR, typeLL, typeLR);
	};

	//for movable walking atop floating bombs in water
	this.hitWorld = function(whereX, whereY, typeUL, typeUR, typeLL, typeLR) {
		var thiz = this;
		$.each(game.objs, function(_o,o) {
			if (o.removeMe) return true;	//continue
			if (o == thiz) return true;	//continue;
			if (o.isa(Bomb) && o.state == o.STATE_SINKING) {
				//if any of our corners are really standing on an egg rather than water then treat it like its empty
				if (typeUL == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX - .25, whereY - .25) < (.5)) typeUL = Game.prototype.MAPTYPE_EMPTY;
				if (typeUR == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX + .25, whereY - .25) < (.5)) typeUR = Game.prototype.MAPTYPE_EMPTY;
				if (typeLL == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX - .25, whereY + .25) < (.5)) typeLL = Game.prototype.MAPTYPE_EMPTY;
				if (typeLR == Game.prototype.MAPTYPE_WATER && thiz.linfDist(o.destPosX, o.destPosY, whereX + .25, whereY + .25) < (.5)) typeLR = Game.prototype.MAPTYPE_EMPTY;
			}
		});
		return MovableObj.superProto.hitWorld.call(this, whereX, whereY, typeUL, typeUR, typeLL, typeLR);
	};
	
	this.moveIsBlocked_CheckEdge = function(newDestX, newDestY) {
		if (newDestX < .25 ||
			newDestY < .25 ||
			newDestX > game.MAP_WIDTH - .25 ||
			newDestY > game.MAP_HEIGHT - .25)
		{
			return this.hitEdge(newDestX, newDestY);
		}
		return false;
	};
	
	this.moveIsBlocked_CheckHitObject = function(o, cmd, newDestX, newDestY) {
		//if o's bbox at its destpos touches ours at our destpos then
		if (this.linfDist(o.destPosX, o.destPosY, newDestX, newDestY) > .75) return false;
		
		var response = this.hitObject(o, newDestX, newDestY, cmd);
		
		if (response == this.HIT_RESPONSE_STOP) {
			return true;
		}
		
		if (response == this.HIT_RESPONSE_TEST_OBJECT) {
			if (o.startPush(this, newDestX, newDestY, cmd)) {
				return true;
			}
		}
		
		return false;
	};
	
	this.moveIsBlocked_CheckHitObjects = function(cmd, newDestX, newDestY) {
		//then cycle through all entities ...
		var thiz = this;
		var return_ = false;
		$.each(game.objs, function(_o,o) {
			if (o.removeMe) return true;//continue;
			if (o == thiz) return true;//continue;
			if (thiz.moveIsBlocked_CheckHitObject(o, cmd, newDestX, newDestY)) {
				return_ = true;
				return false;//break;
			}
		});
		return return_;
	};
	
	this.moveIsBlocked = function(cmd, newDestX, newDestY) {
		if (this.moveIsBlocked_CheckEdge(newDestX, newDestY)) return true;
		if (this.moveIsBlocked_CheckHitWorld(newDestX, newDestY)) return true;
		if (this.moveIsBlocked_CheckHitObjects(cmd, newDestX, newDestY)) return true;		
		return false;
	};
	
	this.doMove = function(cmd) {
		if (cmd == Dir.NONE) return this.MOVE_RESPONSE_NO_MOVE;

		var newDestX = this.posX;
		var newDestY = this.posY;
		if (cmd >= 0 && cmd < Dir.COUNT) {
			newDestX += Dir.vec[cmd][0] * .5;
			newDestY += Dir.vec[cmd][1] * .5;
		} else {
			return this.MOVE_RESPONSE_NO_MOVE;
		}
		
		if (this.moveIsBlocked(cmd, newDestX, newDestY)) {
			moveFracMoving = false;
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
	};
	
	this.update = function(dt) {
		MovableObj.superProto.update.call(this, dt);
		if (this.moveFracMoving) {
			this.moveFrac += dt * this.speed;
			if (this.moveFrac >= 1) {
				this.moveFracMoving = false;
				this.posX = this.destPosX;
				this.posY = this.destPosY;
		
				var thiz = this;
				$.each(game.objs, function(_o,o) {
					if (o.removeMe) return true;//continue;
					if (o == thiz) return true;//continue;
					
					//if o's bbox at its destpos touches ours at our destpos then
					if (this.linfDist(o.destPosX, o.destPosY, thiz.destPosX, thiz.destPosY) > .75) return true;//continue;
					
					o.endPush(thiz, thiz.destPosX, thiz.destPosY);
				});

			} else {
				var oneMinusMoveFrac = 1 - this.moveFrac;
				this.posX = this.destPosX * this.moveFrac + this.srcPosX * oneMinusMoveFrac;
				this.posY = this.destPosY * this.moveFrac + this.srcPosY * oneMinusMoveFrac;
			}
		}
		
		if (!this.moveFracMoving) {
			this.lastMoveResponse = this.doMove(this.moveCmd);
		} else {
			this.lastMoveResponse = this.MOVE_RESPONSE_NO_MOVE;
		}
	};
})());

var PushableObj = makeClass(new (function(){
	this.super = MovableObj;
	
	this.startPush = function(pusher, pushDestX, pushDestY, side) {
		var superResult = PushableObj.superProto.startPush.call(this, pusher, pushDestX, pushDestY, side);
		
		//if (pusher instanceof Player)
		{
			if (!this.isBlocking) return false;
			
			var delta = 0;
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
			var align = delta < .25;
			
			if (align && !this.moveFracMoving) {
				var moveResponse = this.doMove(side);
				switch (moveResponse) {
				case this.MOVE_RESPONSE_WAS_BLOCKED:
					return true;
				case this.MOVE_RESPONSE_DID_MOVE:
					return true;	//? false? superResult?
				}
			}
		}
		
		return superResult;
	};

	this.hitObject = function(what, pushDestX, pushDestY, side) {
		//this is the only place isBlockingPushers is referenced
		//it happens when a PushableObj moves into another object 
		//this - the PushableObj
		//what - the other object it moved into
		//	TODO - clean up isBlocking and isBlockingPushers! at least rename them to something less ambiguous!
		if (what.isBlockingPushers) return this.HIT_RESPONSE_STOP;
		
		return PushableObj.superProto.hitObject.call(this, what, pushDestX, pushDestY, side);
	};
})());

//TODO alpha test, and threshold alpha at .5 or something
var Cloud = makeClass(new (function(){
	this.super = BaseObj;
	this.isBlocking = false;
	this.isBlockingPushers = false;
	this.blocksExplosion = false;
	this.blend = 'alpha-threshold';

	this.init = function(args) {
		Cloud.super.call(this);
		this.vel = args.vel;
		this.life = args.life;
		this.scale = [args.scale, args.scale],
		this.setPos(args.pos[0], args.pos[1]);
		this.startTime = game.time;
		this.setSeq(Animation.prototype.SEQ_CLOUD);
		this.color = [1,1,1,1];
	};

	this.update = function(dt) {
		Cloud.superProto.update.call(this, dt);

		this.setPos(this.posX + dt * this.vel[0], this.posY + dt * this.vel[1]);

		var frac = (game.time - this.startTime) / this.life;
		if (frac > 1) frac = 1;
		this.color[3] = (1-frac)*(1-frac);

		if (frac == 1) {
			game.removeObj(this);
			return;
		}
	};
})());

var Particle = makeClass(new (function(){
	this.super = BaseObj;
	this.isBlocking = false;
	this.isBlockingPushers = false;
	this.blocksExplosion = false;
	this.seq = Animation.prototype.SEQ_SPARK;

	this.init = function(args) {
		Particle.super.call(this);
		this.vel = args.vel;
		this.life = args.life;	//in seconds
		this.color = args.color !== undefined ? args.color.clone() : [1,1,1,1];
		this.srccolor = this.color.clone();
		this.scale = [args.radius * 2, args.radius * 2];
		this.setPos(args.pos[0], args.pos[1]);
		this.startTime = game.time;
		if (args.blend !== undefined) this.blend = args.blend;
		this.setSeq(args.seq !== undefined ? args.seq : this.seq);
	};
	
	this.update = function(dt) {
		Particle.superProto.update.call(this, dt);

		this.setPos(this.posX + dt * this.vel[0], this.posY + dt * this.vel[1]);

		var frac = 1 - (game.time - this.startTime) / this.life;
		if (frac < 0) frac = 0;
		this.color[3] = this.srccolor[3] * frac;

		if (frac == 0) {
			game.removeObj(this);
			return;
		}
	};
})());

var Bomb = makeClass(new (function(){
	this.super = PushableObj;
	this.boomTime = 0;
	this.blastRadius = 1;
	this.explodingDone = 0;
	this.sinkDone = 0;
	this.throwDone = 0;
	
	this.owner = undefined;
	this.ownerStandingOn = false;
	
	this.holder = undefined;
	
	this.STATE_IDLE = 0;
	this.STATE_LIVE = 1;
	this.STATE_EXPLODING = 2;
	this.STATE_SINKING = 3;
	
	this.state = this.STATE_IDLE;
	
	this.fuseDuration = 5;
	this.chainDuration = .2;
	this.explodingDuration = .2;
	this.sinkDuration = 5;
	this.throwDuration = 1;
	
	this.THROW_HEIGHT = 2;
	this.THROW_DIST = 3;
	
	//I wonder if setting 'isBlockingPushers' to 'true' would make it so the player could push multiple blocks?
	//would this be cool?
	
	this.init = function(owner) {
		Bomb.super.call(this);
		this.owner = owner;
		if (owner !== undefined) this.ownerStandingOn = true;
		this.setSeq(Animation.prototype.SEQ_BOMB);
		
		this.gameNumbers = new GameNumbers();
	};
	
	//called via moveIsBlocked when a bomb is placed
	//this will also get called if the bomb pushes something else (which can't happen atm)
	this.hitObject = function(whatWasHit, pushDestX, pushDestY, side) {
		//same condition as below
		if (whatWasHit == this.owner && this.owner !== undefined && this.ownerStandingOn) return this.HIT_RESPONSE_MOVE_THRU;
		return Bomb.superProto.hitObject.call(this, whatWasHit, pushDestX, pushDestY, side);
	};

	//called when a player walks into a bomb to start pushing it
	this.startPush = function(pusher, pushDestX, pushDestY, side) {
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
		return Bomb.superProto.startPush.call(this, pusher, pushDestX, pushDestY, side);
	};
	
	//only works if we have a holder
	//next it clears the holder (doesn't matter)
	//throws
	//if the bomb would detonate while in air, have it hold off...
	//then it lands ...
	//and continues as normal
	this.throwMe = function(dir) {
		if (dir < 0 || dir >= Dir.COUNT) return;
		if (this.holder === undefined) return;
		
		this.posX = this.srcPosX = this.holder.destPosX;
		this.posY = this.srcPosY = this.holder.destPosY;
		
		this.destPosX = this.srcPosX + Dir.vec[dir][0] * this.THROW_DIST;
		this.destPosY = this.srcPosY + Dir.vec[dir][1] * this.THROW_DIST;
		
		this.holder = undefined;	//doesn't matter anymore
		this.throwDone = game.time + this.throwDuration;
	};
	
	this.setFuse = function(fuseTime) {
		if (this.state == this.STATE_EXPLODING ||
			this.state == this.STATE_SINKING)
		{
			return;
		}
		this.setSeq(Animation.prototype.SEQ_BOMB_LIT);
		this.state = this.STATE_LIVE;
		this.boomTime = game.time + fuseTime;
	};
	
	//bombs can only pass thru empty and water
	this.cannotPassThru = function(maptype) {
		//if it doesn't blocks movement then we're good
		var res = Bomb.superProto.cannotPassThru.call(this, maptype);
		if (!res) return false;
		
		//if the maptype doesn't float objects then it will block the bomb
		//(do this check for any movable objects that can traverse water)
		//(maybe make that a movement flag or something?)
		return maptype != Game.prototype.MAPTYPE_WATER;
	};
	
	this.drawSprite = function(c, rect) {
		var x = this.posX;
		var y = this.posY;
		
		//hack: push & pop position between draw cmd
		//the other way: new method for underlying drawing of sprite that gets passed x,y
		if (this.holder !== undefined) {
			this.posY -= .75;
		}

		Bomb.superProto.drawSprite.call(this, c, rect);

		if (this.state == this.STATE_IDLE || this.state == this.STATE_LIVE) {
			this.gameNumbers.draw(c, rect, this.blastRadius, this.posX, this.posY);
		}

		if (this.holder !== undefined) {
			this.posY += .75;
		}
	};

	this.onKeyTouch = function() {
		game.removeObj(this);
	};
	
	this.setHolder = function(holder) {
		this.holder = holder;
		this.isBlocking = false;
		this.isBlockingPushers = false;
	};
	
	this.update = function(dt) {
		Bomb.superProto.update.call(this, dt);

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
			var throwDt = game.time - (this.throwDone - this.throwDuration);
			//console.log("Bomb.update throwDt = " + throwDt);
			if (this.throwDt > this.throwDuration) {
			//console.log("Bomb.update throwDt > throwDuration: clearing throwDone");
				this.throwDone = 0;	//done throwing ... you can be a real bomb again now
			} else {
				//console.log("Bomb.update throwDt <= THROW_DURAATION: calculating position");

				var throwFrac = throwDt / this.throwDuration;
				//console.log("Bomb.update throwFrac: " + throwFrac);
				
				//console.log("Bomb.update moving from " + this.srcPosX + ", " + this.srcPosY +  " to " + this.destPosX + ", " + this.destPosY);
				var oneMinusThrowFrac = 1 - throwFrac;
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
				var typeUL = game.getMapTypeIndex(this.destPosX - .25, this.destPosY - .25);
				var typeUR = game.getMapTypeIndex(this.destPosX + .25, this.destPosY - .25);
				var typeLL = game.getMapTypeIndex(this.destPosX - .25, this.destPosY + .25);
				var typeLR = game.getMapTypeIndex(this.destPosX + .25, this.destPosY + .25);

				var thiz = this;
				$.each(game.objs, function(_o,o) {
					if (o.removeMe) return true;//continue;
					if (o.isa(Bomb) && o.state == o.STATE_SINKING) {
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
			var t = game.time - this.boomTime;
			var s = Math.cos(2*t*Math.PI)*.2+.9;
			this.scale = [s,s];
			if (t >= 0) {
				this.explode();
			}
		} else if (this.state == this.STATE_EXPLODING) {
			var t = game.time - this.explodingDone;
			if (t >= 0) {
				game.removeObj(this);
			}
		} else if (this.state == this.STATE_SINKING) {
			var t = game.time - this.sinkDone;
			if (t >= 0) {

				//remove first so it doesn't influence the checks for sunk bombs
				game.removeObj(this);
				
				//then we're sunk
				//check for anything standing on us ... and kill it
				var thiz = this;
				$.each(game.objs, function(_o,o) {
					if (o.removeMe) return true;//continue;
					//if this object is .25 tile on the sunk bomb...
					if (thiz.linfDist(o.destPosX, o.destPosY, thiz.destPosX, thiz.destPosY) < .75) {
						
						//now check all the types under this object
						var typeUL = game.getMapTypeIndex(o.destPosX - .25, o.destPosY - .25);
						var typeUR = game.getMapTypeIndex(o.destPosX + .25, o.destPosY - .25);
						var typeLL = game.getMapTypeIndex(o.destPosX - .25, o.destPosY + .25);
						var typeLR = game.getMapTypeIndex(o.destPosX + .25, o.destPosY + .25);
					
						$.each(game.objs, function(_o2,o2) {
							if (o2.removeMe) return true;//continue;
							if (o2.isa(Bomb) && o2.state == o2.STATE_SINKING) {
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
	};
	
	this.onGroundSunk = function() {};	//do nothing
	
	this.onTouchFlames = function() {
		this.setFuse(this.chainDuration);
	};
	
	this.explode = function() {

		for (var i = 0; i < 10; ++i) {
			var scale = Math.random() * 2;
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
		
		var cantHitWorld = false;
		var fpartx = this.destPosX - Math.floor(this.destPosX);
		var fparty = this.destPosY - Math.floor(this.destPosY);
		if (fpartx < .25 || fpartx > .75 ||
			fparty < .25 || fparty > .75)
		{
			cantHitWorld = true;
		}
	
		for (var side = 0; side < Dir.COUNT; side++) {
			var checkPosX = this.destPosX;
			var checkPosY = this.destPosY;
			var len = 0;
			while(true) {
				var hit = false;
				var thiz = this;
				$.each(game.objs, function(_o,o) {
					if (o.removeMe) return true;//continue;
					if (o == thiz) return true;//continue;
					
					var dist = thiz.linfDist(o.destPosX, o.destPosY, checkPosX, checkPosY);

					//if a flame is even half a block off from an obj then it won't be hit
					//...except for the player
					//TODO - class-based var?
					if (o.isa(Player)) {
						if (dist > .75) return true;//continue;
					} else {
						if (dist > .25) return true;//continue;
					}
					
					o.onTouchFlames();
					if (o.blocksExplosion) hit = true;					
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
				
				var wallStopped = false;
				for (var ofx = 0; ofx < 2; ofx++) {
					for (var ofy = 0; ofy < 2; ofy++) {
						var cfx = Math.floor(checkPosX + ofx * .5 - .25);
						var cfy = Math.floor(checkPosY + ofy * .5 - .25);
						var mapType = game.getMapType(cfx, cfy);
						if ((mapType.flags & mapType.BLOCKS_EXPLOSIONS) != 0) {
							//if it's half a block off then it can still be stopped
							//but it can't clear a wall
							//this way we don't favor one rounding direction versus another
							if (!cantHitWorld &&
								(mapType.flags & mapType.BOMBABLE) != 0)	//only turn bricks into empty
							{
								//make some particles
								var divs = 3;
								for (var u = 0; u < divs; ++u) {
									for (var v = 0; v < divs; ++v) {
										var speed = 3;
										game.addObj(new Particle({
											vel : [speed*(Math.random()*2-1), speed*(Math.random()*2-1)],
											pos : [cfx + (u+.5)/divs, cfy + (v+.5)/divs],
											life : Math.random() * .5 + .5,
											radius : .25,// * (Math.random() + .5),
											seq : Animation.prototype.SEQ_BRICKS
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
	};
	
	this.makeSpark = function(x, y) {
		//for (var i = 0; i < 10; ++i) {
		for (var i = 0; i < 3; ++i) {
			var c = Math.random();
			game.addObj(new Particle({
				vel : [Math.random()*2-1, Math.random()*2-1],
				pos : [x,y],
				life : .5 * (Math.random() * .5 + .5),
				color : [1,c,c*Math.random()*Math.random(),1],
				radius : .25 * (Math.random() + .5),
				blend : 'lighter'
			}));
		}
	};
})());

var GunShot = makeClass(new (function(){
	this.super = MovableObj;
	
	this.owner = undefined;
	
	this.init = function(owner) {
		GunShot.super.call(this);
		this.owner = owner;
		this.setPos(owner.posX, owner.posY);
		this.frameId = -1;	//invis
	};
	this.cannotPassThru = function(maptype) {
		return (game.mapTypes[maptype].flags & MapType.prototype.BLOCKS_GUNSHOT) != 0;
	};
	
	this.hitObject = function(what, pushDestX, pushDestY, side) {
		if (what == this.owner) return this.HIT_RESPONSE_MOVE_THRU;
		if (what.isa(Player)) {
			what.die();
			return this.HIT_RESPONSE_STOP;
		}
		if (what.isBlocking || what.isa(Money)) return this.HIT_RESPONSE_STOP;
		return this.HIT_RESPONSE_MOVE_THRU;
	};
})());

var Gun = makeClass(new (function(){
	this.super = BaseObj;

	this.MAD_DIST = .75;
	this.FIRE_DIST = .25;

	this.init = function() {
		Gun.super.call(this);
		this.setSeq(Animation.prototype.SEQ_GUN);
	};
	
	this.update = function(dt) {
		Gun.superProto.update.call(this, dt);
		
		this.setSeq(Animation.prototype.SEQ_GUN);
		
		if (game.player !== undefined &&
			!game.player.dead)
		{
			var diffX = game.player.posX - this.posX;
			var diffY = game.player.posY - this.posY;
			var absDiffX = diffX < 0 ? -diffX : diffX;
			var absDiffY = diffY < 0 ? -diffY : diffY;
			var dist = absDiffX < absDiffY ? absDiffX : absDiffY;
			
			if (dist < this.MAD_DIST) {
				this.setSeq(Animation.prototype.SEQ_GUN_MAD);
			}
			
			if (dist < this.FIRE_DIST) {
				var dir = Dir.NONE;
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
				
				var shot = new GunShot(this);
				var response = -1;
				do {
					response = shot.doMove(dir);
					shot.setPos(shot.destPosX, shot.destPosY);
				} while (response != shot.MOVE_RESPONSE_WAS_BLOCKED);
				//delete ... but it's not attached, so we're safe
			}
		}
	};
	
	this.onKeyTouch = function() {
		//puff
		game.removeObj(this);
	};
})());

var Sentry = makeClass(new (function(){
	this.super = MovableObj;
	
	this.dir = Dir.LEFT;
	
	this.init = function() {
		Sentry.super.call(this);
		this.setSeq(Animation.prototype.SEQ_SENTRY);
	};
	
	this.update = function(dt) {
		//if the player moved onto us ...
		//TODO - put this inside 'endPush' instead! no need to call it each frame
		if (this.linfDist(this.destPosX, this.destPosY, game.player.destPosX, game.player.destPosY) < .75) {
			game.player.die();
		}
	
		this.moveCmd = this.dir;
		
		Sentry.superProto.update.call(this, dt);
		
		if (this.lastMoveResponse == this.MOVE_RESPONSE_WAS_BLOCKED) {
			switch (this.dir) {
			case Dir.UP:	this.dir = Dir.LEFT;		break;
			case Dir.LEFT:	this.dir = Dir.DOWN;		break;
			case Dir.DOWN:	this.dir = Dir.RIGHT;	break;
			case Dir.RIGHT:	this.dir = Dir.UP;		break;
			}
		}
	};
	
	//the sentry tried to move and hit an object...
	this.hitObject = function(what, pushDestX, pushDestY, side) {
		
		if (what.isa(Player)) {
			return this.HIT_RESPONSE_MOVE_THRU;	//wait for the update() test to pick up hitting the player
		}
		return what.isBlockingSentry() ? this.HIT_RESPONSE_STOP : this.HIT_RESPONSE_TEST_OBJECT;	
		//return super.hitObject(what, pushDestX, pushDestY, side);
	};

	this.onKeyTouch = function() {
		//puff
		game.removeObj(this);
	};
})());

var Framer = makeClass(new (function(){
	this.super = PushableObj;
	this.init = function() {
		Framer.super.call(this);
		this.setSeq(Animation.prototype.SEQ_FRAMER);
	};
})());

var Player = makeClass(new (function(){
	this.super = MovableObj;

	this.ITEM_GLOVES = 1;
	//what other items might we want to make?
	//portal gun
	//incinerator?
	//bomb-through-walls?
	//walk-through-walls?

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
	
	this.init = function() {
		Player.super.apply(this, arguments);
		this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_DOWN);
		this.setBombs(this.bombs);
	};
	
	this.move = function(dir) {
		if (this.dead) return;
		this.moveCmd = dir;
	};
	
	this.beginDropBomb = function() {
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
		
		var bomb = new Bomb(this);
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
		var thiz = this;
		var doReturn = undefined;
		$.each(game.objs, function(_o,o) {
			if (o.removeMe) return true;//continue;
			//don't need to test for our current bomb since it hasn't been added yet (and wouldn't be this frame anyways)
			if (o.isa(Bomb)) {
				var otherBomb = o;
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
					return false;//break;
				}
			}
		});
		if (doReturn) return;
		
		this.setBombs(this.bombs - 1);
		bomb.blastRadius = this.bombBlastRadius;
		bomb.setFuse(Bomb.prototype.fuseDuration);
		game.addObj(bomb);
	};
	
	this.endDropBombs = function() {
		this.dropBombFlag = false;
	};

	this.stopMoving = function() {
		this.moveCmd = Dir.NONE;	//clear for next time through
	};
	
	this.update = function(dt) {

		if (this.moveCmd != Dir.NONE) {
			this.dir = this.moveCmd;
		}
		
		Player.superProto.update.call(this, dt);
		
		if (this.dead) {
			//setSeq(Animation.prototype.SEQ_PLAYER_DEAD);
		} else if (this.moveFracMoving) {
			this.setSeq(Animation.prototype.SEQ_PLAYER_WALK_UP + this.dir);
		} else {
			this.setSeq(Animation.prototype.SEQ_PLAYER_STAND_UP + this.dir);
		}
	};
	
	this.getMoney = function(money) {
		this.setBombs(this.bombs + money.bombs);
		this.items |= money.items;
	};
	
	this.onTouchFlames = function() {
		this.die();
	};
	
	this.die = function() {
		if (this.dead) return;
		this.setSeq(Animation.prototype.SEQ_PLAYER_DEAD);
		this.dead = true;
		this.deadTime = game.time + 2;

		this.isBlocking = false;
		this.isBlockingPushers = false;
		this.blocksExplosion = false;

		this.moveCmd = -1;
		this.dropBombFlag = false;
	};

	this.onGroundSunk = function() {
		this.die();
	};
	
	this.setBombs = function(bombs) {
		this.bombs = bombs;
		$('#game-hud-bombs').text(this.bombs);
	};
})());

var Money = makeClass(new (function(){
	this.super = BaseObj;

	//Player.ITEM_ ...
	this.items = 0;
	
	//how many bombs this Money is holding
	//TODO - (a) make this a bitflag? (b) remove the #'s from the drawSprite too? (c) other optional flags on the drawSprite for other items
	this.bombs = 0;

	this.init = function() {
		Money.super.apply(this, arguments);
		this.isBlocking = false;
		this.setSeq(Animation.prototype.SEQ_MONEY);
		this.gameNumbers = new GameNumbers();
	};
	
	//money isBlocking is false, but isBlockingSentry is true
	//this makes money the only special thing for sentries
	//(should keys be the same?)
	this.isBlockingSentry = function() { return true; };

	this.drawSprite = function(c, rect) {
		Money.superProto.drawSprite.call(this, c, rect);

		if (this.bombs > 0) {		
			this.gameNumbers.draw(c, rect, this.bombs, this.posX, this.posY);
		}
	
		if ((this.items & Player.prototype.ITEM_GLOVES) != 0) {
			var gloveSeq = anim.framesForSeq[ Animation.prototype.SEQ_GLOVE ];
			var gloveFrame = anim.frames[gloveSeq];
			var gloveBitmap = gloveFrame.bitmap;
			rect.left = (rect.left + rect.right) / 2;
			rect.bottom = (rect.top + rect.bottom) / 2;
			try {
				c.drawImage( gloveBitmap, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
			} catch (e) {}
		}
	};

	this.endPush = function(who, pushDestX, pushDestY) {
		if (!who.isa(Player)) return;
		if (this.linfDist(pushDestX, pushDestY, this.destPosX, this.destPosY) >= .5) return;	//too far away

		{
			var player = who;
			player.getMoney(this);
		}
		
		game.removeObj(this);
		
		var key = undefined;
		var moneyleft = 0;
		$.each(game.objs, function(_o,o) {
			if (o.removeMe) return true;	//continue
			if (o.isa(Money)) {
				moneyleft++;
			} else if (o.isa(Key)) {
				key = o;
			}
		});
		if (moneyleft == 0) {
			//throw an exception if there's no key
			if (key) key.show();
		}
	};
})());

var Key = makeClass(new (function(){
	this.super = BaseObj;

	this.changeLevelTime = 0;
	//wait a frame or so between player touch and end level
	this.touchToEndLevelDuration = 1/50;

	this.inactive = true;

	this.init = function() {
		Key.super.apply(this, arguments);
		this.isBlocking = false;
		this.blocksExplosion = false;
		this.setSeq(Animation.prototype.SEQ_KEY_GREY);
	};
	
	this.show = function() {
		this.inactive = false;
		this.setSeq(Animation.prototype.SEQ_KEY);
	};
	
	this.endPush = function(who, pushDestX, pushDestY) {
		if (!who.isa(Player)) return;
		if (this.inactive) return;
		if (this.changeLevelTime > 0) return;	//already been touched / already waiting to change level
		if (this.linfDist(pushDestX, pushDestY, this.destPosX, this.destPosY) >= .5) return;	//too far away

		//let a frame run before changing the level
		this.changeLevelTime = game.time + this.touchToEndLevelDuration;

		this.frameId = -1;	//disappear
		
		//TODO - delay? then this? that way medusas can get a shot off for sure,
		//if in their last frame the player was shootable
	
		$.each(game.objs, function(_o,o) {
			if (o.removeMe) return true;//continue;
			o.onKeyTouch();
		});
		
		//no more bomb dropping
		if (game.player !== undefined) {
			game.player.setBombs(0);
		}
	};
	
	this.update = function(dt) {
		Key.superProto.update.call(this, dt);
		if (this.changeLevelTime > 0 && this.changeLevelTime < game.time) {
			if (!game.player.dead) {
				game.nextLevel();
			}
		}
	}
})());

var Game = makeClass({

	MAPTYPE_EMPTY : 0,
	MAPTYPE_TREE : 1,
	MAPTYPE_BRICK : 2,
	MAPTYPE_STONE : 3,
	MAPTYPE_WATER : 4,
	
	MAP_WIDTH : 10,
	MAP_HEIGHT : 10,	//i want this to be 10... how do you hide the titlebar?
	
	tileBitmapIds : [
		'ground',
		'tree',
		'bricks',
		'stone',
		'water',
	],
	
	//TODO - keep this 1-1 with MAPTYPE_***
	mapTypes : [
		new MapType('ground', 0),
		new MapType('tree', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.BLOCKS_EXPLOSIONS | MapType.prototype.DRAW_GROUND_UNDER),
		new MapType('bricks', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.BLOCKS_GUNSHOT | MapType.prototype.BOMBABLE | MapType.prototype.BLOCKS_EXPLOSIONS),
		new MapType('stone', MapType.prototype.CANNOT_PASSTHRU | MapType.prototype.BLOCKS_GUNSHOT | MapType.prototype.BLOCKS_EXPLOSIONS),
		new MapType('water', MapType.prototype.CANNOT_PASSTHRU),
	],
	
	removeRequest : false,
	
	rect : new Rect(),

	//used for fixed-rate updates
	sysTime : 0,
	lastSysTime : 0,
	accruedTime : 0,
	updateDuration : 1/50,
	time : 0,

	loadLevelRequest : false,
	level : 0,
	
	//canvas size
	width : 1,
	height : 1,

	CMD_UP : 1,
	CMD_DOWN : 2,
	CMD_LEFT : 4,
	CMD_RIGHT : 8,
	CMD_BOMB : 16,
	cmd : 0,

	//call Game.prototype.staticInit() on startup, once
	staticInit : function() {
		for (var i = 0; i < this.tileBitmapIds.length; i++) {
			this.mapTypes[i].typeIndex = i;
			this.mapTypes[i].bitmap = $('<img>', {src:'res/drawable/'+this.mapTypes[i].bitmapId+'.png'}).get(0);
		}
	},

//I should make a game gui class:

	//static
	restart : function() {
		
		//this only works if it's a valid level
		splash.start({
			level : game ? game.level : 0,
			levelData : !game ? undefined : game.level == -1 ? game.levelData : undefined
		});
	},

	//static
	skip : function() {	
		if (!game) return;
		game.nextLevel(true);
	},

	//static
	close : function() {
		var returnToEditor = game && game.returnToEditor;
		if (returnToEditor) {
			editor.customLevelIndex = -1;
			editor.show();
		} else {
			splash.show();
		}
	},

	//static
	gamepadToggle : function() {
		if ($('#gamepad-checkbox').is(':checked')) {
			showButtons();
		} else {
			hideButtons();
		}
	},

//the real game class:

	init : function(args) {
		if (args === undefined) args = {};
		if (args.level !== undefined && args.level !== -1) {
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
			requestAnimFrame(onresize);	//resize the game's canvas
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
		for (var i = 0; i < this.MAP_WIDTH; i++) {
			this.tiles[i] = [];//new MapType[MAP_HEIGHT];
			for (var j = 0; j < this.MAP_HEIGHT; j++) {
				this.tiles[i][j] = this.mapTypes[this.MAPTYPE_EMPTY];// (int)(Math.random() * mapTypes.length) ];
			}
		}
		
		this.bitmapButtonBomb = $('<img>', {src:'res/drawable/button_bomb.png'}).get(0);
		
		//don't load the level just yet
		//first give the obj we are given to (i.e. the activity?) a chance to change the level or what not
		//(or move that into a var in the ctor)
		//and then call loadLevel in init()

		this.removeAll();	//and inits the objs and addObjs member arrays

		//special-case index for starting a blank level:
		if (this.level != -1 || this.levelData) {
			//Game.init is a function separate of the ctor (which I call Game.init now)
			//and all it had in it was this:
			this.loadLevel();
		}
	},

	nextLevel : function(dontComplete) {
		if (!dontComplete) setCookie('completed'+this.level, '1', 9999);
		if (this.level != -1) {
			this.setLevel(this.level+1);
		}
		this.loadLevelRequest = true;
	},

	setLevel : function(level) {
		this.level = level;
		if (this.level != -1) {
			setCookie('level', this.level, 9999);
			$('#game-hud-level').text(this.level);
		} else {
			$('#game-hud-level').text('?');
		}
	},
	
	loadLevel : function() {
		this.removeAll();
		
	//	try 
		{
			var levelData = undefined;
			if (this.level !== -1) {
				levelData = levelDB[this.level].tiles;
			} else if (this.levelData !== undefined) {
				levelData = this.levelData;
			}
			if (levelData === undefined) throw "failed to find any level data";
this.levelData = levelData;
		
			if (typeof(levelData) == 'string') {
				var tileIndex = 0;
				for (var y = 0 ; y < this.MAP_HEIGHT; y++) {
					for (var x = 0; x < this.MAP_WIDTH; x++, tileIndex++) {
						var posX = x + .5;
						var posY = y + .5;
						var ch = levelData.charAt(2*tileIndex);
						var ch2 = levelData.charAt(2*tileIndex+1);
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
							var money = new Money();
							money.setPos(posX, posY);
							if (ch2 >= '0' && ch2 <= '9') money.bombs = ch2 - '0';
							if (ch2 == 'G') money.items = Player.prototype.ITEM_GLOVES;
							this.objs.push(money);
						} else if (ch == 'K') {
							var key = new Key();
							key.setPos(posX, posY);
							this.objs.push(key);
						} else if (ch == 'B') {
							var bomb = new Bomb();
							bomb.setPos(posX, posY);
							if (ch2 >= '0' && ch2 <= '9') bomb.blastRadius = ch2 - '0';
							this.objs.push(bomb);
						} else if (ch == 'F') {
							var framer = new Framer();
							framer.setPos(posX, posY);
							this.objs.push(framer);
						} else if (ch == 'G') {
							var gun = new Gun();
							gun.setPos(posX, posY);
							this.objs.push(gun);
						} else if (ch == 'S') {
							var sentry = new Sentry();
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
				var tileObj = levelData;
				var tileIndex = 0;
				console.log("reading tiles...");
				for (var y = 0; y < this.MAP_HEIGHT; y++) {
					for (var x = 0; x < this.MAP_WIDTH; x++, tileIndex++) {
						var tileTypeIndex = (tileObj.tileIndex);
						if (tileTypeIndex < 0 || tileTypeIndex >= this.mapTypes.length) {
							throw ("got a bad tile type: " + tileTypeIndex);
						}
						this.tiles[x][y] = this.mapTypes[tileTypeIndex];
					}
				}
				
				console.log("reading ents...");
				var ents = JSON.stringify("ents");
				console.log("total number of ents: " + ents.length);
				for (var i = 0; i < ents.length(); i++) {
					var ent = ents[i];
					var classname = ent["class"];
					var posX = parseFloat(ent.x);
					var posY = parseFloat(ent.y);
					
					console.log("reading an ent " + classname + " at " + posX + " " + posY);
					
					if (classname == "Player") {
						this.player = new Player();
						this.player.setPos(posX,posY);
						this.objs.push(player);
					} else if (classname == "Money") {
						var money = new Money();
						money.setPos(posX,posY);
						if (ent.bombs !== undefined) money.bombs = (ent.bombs);
						this.objs.push(money);
					} else if (classname == "Key") {
						var key = new Key();
						key.setPos(posX,posY);
						this.objs.push(key);
					} else if (classname == "Bomb") {
						var bomb = new Bomb();
						bomb.setPos(posX,posY);
						if (ent.time !== undefined) bomb.setFuse((ent.time));
						if (ent.radius !== undefined) bomb.blastRadius = (ent.radius);
						this.objs.push(bomb);
					} else if (classname == "Framer") {
						var framer = new Framer();
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
	},
	
	update : function() {
		//editor freezes games
		if (this.frozen) return;
		
		this.lastSysTime = this.sysTime;
		this.sysTime = Date.now();
		var deltaTime = this.sysTime - this.lastSysTime;
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

			var thiz = this;
			$.each(this.objs, function(_o,o) {
				if (o.removeMe) return true;	//continue
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
			for (var i = this.objs.length-1; i >= 0; i--) {
				var o = this.objs[i];
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
	},

	setFontSize : function(fontSize) {
		if (fontSize === this.fontSize) return;
		this.fontSize = fontSize;
		$('#game-stats').css({fontSize:fontSize});
	},

	lastFPSTime : Date.now(),
	fpsUpdates : 0,
	
	//was constant ... because
	TILE_WIDTH : 24,
	TILE_HEIGHT : 24,

	draw : function() {
		var c = this.canvas.getContext('2d');

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

		for (var i = 0; i < this.MAP_WIDTH; i++) {
			for (var j = 0; j < this.MAP_HEIGHT; j++) {
				var t = this.tiles[i][j];
				var paddingX = this.width - this.MAP_WIDTH * this.TILE_WIDTH;
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
		var thiz = this;
		$.each(this.objs, function(_o,o) {
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
	},

	getMapType : function(ix, iy) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return this.mapTypes[this.MAPTYPE_OOB];
		return this.tiles[ix][iy];
	},
	
	getMapTypeIndex : function(ix, iy) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return this.MAPTYPE_OOB;
		return this.tiles[ix][iy].typeIndex;
	},
	
	setMapTypeIndex : function(ix, iy, type) {
		ix = parseInt(ix);
		iy = parseInt(iy);
		if (ix < 0 || iy < 0 || ix >= this.MAP_WIDTH || iy >= this.MAP_HEIGHT) return false;
		this.tiles[ix][iy] = this.mapTypes[type];
		return true;
	},

	removeAll : function() {
		//remove objs individually -- so they can detach dom elems and what not
		if (this.objs !== undefined) {
			$.each(this.objs, function(_o,o) {
				o.onRemove();
			});
		}
		this.objs = [];//new LinkedList<BaseObj>();
		this.addList = [];//new LinkedList<BaseObj>();
	},

	removeObj : function(o) {
		o.onRemove();
		this.removeRequest = true;
	},
	
	addObj : function(o) {
		this.addList.push(o);
	},
	
	restartLevel : function() {
		this.player.die();
	}
});
//self-referencing initial values.  i could do new (function({})() rather than {} to allow this in-place...
//out of bound tiles are considered...
Game.prototype.MAPTYPE_OOB = Game.prototype.MAPTYPE_STONE;

function refreshLevels(done) {
	$.ajax({
		url:'levels.json',
		dataType:'json'
	}).fail(function(){
		alert('failed to load levels!');
	}).done(function(d){
		levelDB = d.levels;
		if (done) done();
	});
}

function refreshUserLevels(done) {
	thisUserLevelDB = getCookie('thisUserLevelDB') || undefined;
	if (thisUserLevelDB !== undefined) {
		thisUserLevelDB = $.parseJSON(thisUserLevelDB);
	} else {
		thisUserLevelDB = [];
	}

	$.ajax({
		url:'userlevels.json',
		dataType:'json'
	}).fail(function(){
		console.log('failed to load user levels!');
	}).done(function(d){
		allUsersLevelDB = d.levels;
	}).always(function(){
		if (done) done();
	});
}

function saveUserLevels() {
	if (thisUserLevelDB !== undefined && thisUserLevelDB.length > 0) {
		setCookie('thisUserLevelDB', JSON.stringify(thisUserLevelDB), 9999);
	} else {
		clearCookie('thisUserLevelDB');
	}
}

var Splash = makeClass({
	show : function() {
		clearGame();
		hideButtons();
		$.mobile.changePage('#splash-page');
	},
	start : function(args) {
		clearGame();
		if (args === undefined) args = {};
		if (args.level === undefined) {
			args.level = parseInt(getCookie('level'));
			if (args.level != args.level) args.level = undefined;	//stupid javascript says parseint on bad values is NaN ...
		}
		if (args.level === undefined) {
			args.level = 0;
		}
		refreshLevels(function(){
			args.canvas = $('#game-canvas').get(0);
			game = new Game(args);
			$('#dropdown').hide();
			$.mobile.changePage('#game-page');
		});
		//refresh gamepad
		Game.prototype.gamepadToggle();
	}
});

var ChooseLevels = makeClass({
	show : function() {
		hideButtons();
		$.mobile.changePage('#level-page');
		this.refresh();
	},
	refresh : function(done) {
		var thiz = this;
		$('#level-page-content').empty();
		refreshLevels(function() {
			refreshUserLevels(function() {
				var dbs = [levelDB];	//better be there
				if (thisUserLevelDB !== undefined && thisUserLevelDB.length > 0) dbs.push(thisUserLevelDB);	//might be there
				if (allUsersLevelDB !== undefined && allUsersLevelDB.length > 0) dbs.push(allUsersLevelDB);	//might be there
				$.each(dbs, function(_db,db) { 
					
					if (db == allUsersLevelDB && db.length > 0) {
						$('<br>').appendTo($('#level-page-content'));
						$('<br>').appendTo($('#level-page-content'));
						$('<div>', {text:'User Submitted Levels:'}).appendTo($('#level-page-content'));
					} else if (db == thisUserLevelDB && db.length > 0) {
						$('<br>').appendTo($('#level-page-content'));
						$('<br>').appendTo($('#level-page-content'));
						$('<div>', {text:'Your Levels:'}).appendTo($('#level-page-content'));
					}
				
					$.each(db, function(i, levelData) {
						var levelNumber = i;
						if (db !== levelDB) levelNumber = -1;
						//set canvas global
						var chooseCanvas = $('<canvas>', {
							css : {
								padding:'10px',
								cursor:'pointer'
							},
							click : function() {
								console.log(levelNumber, levelData.tiles);
								splash.start({
									level:levelNumber,
									levelData:levelData.tiles
								});
							}
						}).attr('width', '200')
							.attr('height', '200')
							.appendTo($('#level-page-content'))
							.get(0);
						
						if (db == thisUserLevelDB) {
							$('<img>', {
								src : 'images/cross.png',
								css : {
									verticalAlign:'top',
									cursor:'pointer'
								},
								click : function() {
									thisUserLevelDB.splice(i,1);
									saveUserLevels();
									var t = document.body.scrollTop;
									thiz.refresh(function() {
										document.body.scrollTop = t;
									});
								}
							}).appendTo($('#level-page-content'));

							$('<img>', {
								src : 'images/pencil.png',
								css : {
									cursor:'pointer',
									paddingRight:'10px'
								},
								click : function() {
									editor.levelData = levelData.tiles;
									editor.customLevelIndex = i;
									editor.show();
								}
							}).appendTo($('#level-page-content'));
						
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
					
						if (db == levelDB && getCookie('completed'+i) == '1') {
							var c = chooseCanvas.getContext('2d');
							c.globalAlpha = .75;
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
});

function clearGame() {
	if (!game) return;
	game.removeAll();
	game = undefined;
}

var Editor = makeClass(new (function(){
	this.init = function() {
		var text = Array(Game.prototype.MAP_HEIGHT+1).join(
			Array(2*Game.prototype.MAP_WIDTH+1).join('.')
		);
		//$('#editor-textarea').val(text);
		this.customLevelIndex = -1;
		this.levelData = text;
	};
	this.show = function() {
		this.refresh();
		hideButtons();
		$.mobile.changePage('#editor-page');
	};
	this.refresh = function() {
		clearGame();
		game = new Game({
			frozen:true,
			levelData:this.levelData,
			canvas:$('#editor-canvas').get(0)
		});
	};
	this.play = function() {
		splash.start({
			level:-1,
			levelData:this.levelData,
			returnToEditor:true
		});
	};
	this.edit = function() {
		if (game) {
			if (game.level !== -1) this.customLevelIndex = -1;
			this.levelData = game.levelData;
		} else {
			this.init();
		}
		this.show();
	};
	this.save = function() {
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
	};
	this.submit = function() {
		var name = prompt('whats your name?');
		if (!name) return;
		$.ajax({
			url:'submit.lua',
			data:{
				name:name,
				tiles:this.levelData//$('#editor-textarea').val()
			}
		})
		/* jquery is always interpreting this as a fail, even if it gets a json win message back
		.done(function() {
			alert('win');
		}).fail(function() {
			alert('something went terribly wrong');
		})*/;
	};
})());

//main
var game;
var levelDB = [];
var allUsersLevelDB = [];
var thisUserLevelDB = [];
var anim;
var splash = new Splash();
var chooseLevels = new ChooseLevels();
var editor = new Editor();

function onresize() {
	resizeButtons();
	var width = $(window).width();
	var height = $(window).height();
	var screenWidth = width - 50;
	var screenHeight = height - 50;	//make room for ad 
	//resize by the smallest of the two constraints
	if (screenWidth > screenHeight) {
		screenWidth = screenHeight;
	} else {
		screenHeight = screenWidth;
	}
	if (game) {
		var canvas = game.canvas;
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
	
	requestAnimFrame(update);
}


function handleCommand(cmd, press) {
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
	if ($.mobile.activePage.get(0).id == 'game-page') { 
		if (!game) return;
		var keyCode = event.keyCode;
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
	} else if ($.mobile.activePage.get(0).id == 'editor-page') {
		var keyCode = event.keyCode;
		var editorKeys = {
			'.' : '..',
			'*' : '**',
			'#' : '##',
			'=' : '=='
		};
		$('#editor-select').val(editorKeys[String.fromCharCode(keyCode)] || '..');
	}
}

function onkeyup(event) {
	if ($.mobile.activePage.get(0).id != 'game-page') return;
	if (!game) return;
	var keyCode = event.keyCode;
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
	if ($.mobile.activePage.get(0).id != 'game-page') return;
	event.preventDefault();
}

$(document).ready(function(){

	/*
	canvas = $('#game-canvas');
	canvas.disableSelection();
	glutil = new GLUtil({canvas:canvas.get(0)});
	gl = glutil.context;
	*/

	$(window).resize(onresize);
	Game.prototype.staticInit();
	GameNumbers.prototype.staticInit();
	initButtons();	
	
	$(window)
		.keydown(onkeydown)
		.keyup(onkeyup)
		.keypress(onkeypress)
		.disableSelection();

	$('#editor-page').mousedown(editorMouseEventHandler);
	$('#editor-page').mouseup(editorMouseEventHandler);

	//init globals
	anim = new Animation();
	
	//preload images
	var imgs = [];
	//tiles
	$.each(Game.prototype.mapTypes, function(i,mapType) {
		imgs.push(mapType.bitmap.src);
	});
	//frames
	$.each(Animation.prototype.frames, function(i,frame) {
		imgs.push(frame.bitmap.src);
	});
	//numbers
	$.each(GameNumbers.prototype.bitmaps, function(i,bitmap) {
		imgs.push(bitmap.src);
	});
	//preload
	$(imgs).preload(function(){	
		//now make gl textures for all images
		/*
		$.each(imgs, function(i,img) {
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
		var level = $.url().param('level');
		if (level !== undefined) {
			splash.start({level:parseInt(level)});
		} else {
			//otherwise, splash screen
			splash.show();
		}
	}, function(percent) {
		$('#loading').attr('value', parseInt(100*percent));
	});
	
	update();
});


//touch screen stuff
//TODO make everything below this point its own thing in its own file
//and include it in this file

var buttons = [];

var buttonBorder = [.02, .04];
var buttonSeparation = [.005, .01];
var buttonSize = [.1, .2];

//these measurements are great... for landscape mode
var buttonInfos = [
	{cmd:'left', url:'icons/left.png', bbox:{min:[buttonBorder[0], 1-buttonBorder[1]-buttonSize[1]], max:[buttonBorder[0]+buttonSize[0], 1-buttonBorder[1]]}},
	{cmd:'down', url:'icons/down.png', bbox:{min:[buttonBorder[0]+buttonSize[0]+buttonSeparation[0], 1-buttonBorder[1]-buttonSize[1]], max:[buttonBorder[0]+2*buttonSize[0]+buttonSeparation[0], 1-buttonBorder[1]]}},
	{cmd:'up', url:'icons/up.png', bbox:{min:[buttonBorder[0]+buttonSize[0]+buttonSeparation[0], 1-buttonBorder[1]-buttonSize[1]*2-buttonSeparation[1]], max:[buttonBorder[0]+2*buttonSize[0]+buttonSeparation[0], 1-buttonBorder[1]-buttonSize[1]-buttonSeparation[1]]}},
	{cmd:'right', url:'icons/right.png', bbox:{min:[buttonBorder[0]+buttonSize[0]*2+buttonSeparation[0]*2, 1-buttonBorder[1]-buttonSize[1]], max:[buttonBorder[0]+3*buttonSize[0]+buttonSeparation[0]*2, 1-buttonBorder[1]]}},
	{cmd:'fire', url:'icons/ok.png', bbox:{min:[1-buttonBorder[0]-buttonSize[0], 1-buttonBorder[1]-buttonSize[1]], max:[1-buttonBorder[0], 1-buttonBorder[1]]}}
];

function editorHandleScreenEvent(event, press) {
	if ($.mobile.activePage.get(0).id == 'editor-page') {
		if (!press) return;
		var c = $('#editor-canvas').get(0);
		var x = event.pageX - parseInt(c.style.left);
		var y = event.pageY - parseInt(c.style.top);
		x /= game.TILE_WIDTH;
		y /= game.TILE_HEIGHT;
		x = Math.floor(x);
		y = Math.floor(y);
		if (x >= 0 && x < game.MAP_WIDTH && y >= 0 && y < game.MAP_HEIGHT) {
			//change the map!
			//remove newlines
			assertEquals(editor.levelData.length, 200);
			var i = 2 * (x + game.MAP_WIDTH * y);
			var sel = $('#editor-select').val();
			assertEquals(sel.length, 2);
			editor.levelData = editor.levelData.substring(0, i)
				+ sel
				+ editor.levelData.substring(i+2);
			editor.refresh();
		}
	}
}

var mouseIntervalMethod = 0;
var mouseDownInterval;
var lastMouseEvent;
function editorMouseEventHandler(event) {
	if ($.mobile.activePage.get(0).id != 'game-page' &&
		$.mobile.activePage.get(0).id != 'editor-page') return;
	//showButtons();
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
			}, 300);
		}
	} else if (event.type == 'mouseup') {
		editorHandleScreenEvent(lastMouseEvent, false);
		if (mouseIntervalMethod != 0) {
			if (mouseDownInterval !== undefined) clearInterval(mouseDownInterval);
			mouseDownInterval = undefined;
		}
	}
}

var fontSize = 24;
var Button = makeClass({
	init : function(args) {
		var thiz = this;
		this.bbox = args.bbox;
		this.screenBBox = {min:[0,0], max:[0,0]};
		this.cmd = args.cmd;
		this.url = args.url;
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
			handleCommand(thiz.cmd, true);
		}).mouseup(function() {
			handleCommand(thiz.cmd, false);
		}).mouseleave(function() {
			handleCommand(thiz.cmd, false);
		}).bind('touchstart', function() {
			handleCommand(thiz.cmd, true);
		}).bind('touchend', function() {
			handleCommand(thiz.cmd, false);
		}).bind('touchcancel', function() {
			handleCommand(thiz.cmd, false);
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

//var hideFadeDuration = 5000;
//var fadeButtonsTimeout = undefined;
function showButtons() {
	for (var i = 0; i < buttons.length; i++) {
		var buttonDOM = buttons[i].dom;
		//$(buttonDOM).fadeTo(0,0);
		$(buttonDOM).show();
		//$(buttonDOM).fadeTo(0, .75);
	}
	/*if (fadeButtonsTimeout) clearTimeout(fadeButtonsTimeout);
	fadeButtonsTimeout = setTimeout(function() {
		for (var i = 0; i < buttons.length; i++) {
			var buttonDOM = buttons[i].dom;
			$(buttonDOM).fadeTo(1000, 0);
		}
	}, hideFadeDuration);*/
}

function hideButtons() {
	for (var i = 0; i < buttons.length; i++) {
		var buttonDOM = buttons[i].dom;
		$(buttonDOM).hide();
	}
}

function initButtons() {
	for (var i = 0; i < buttonInfos.length; i++) {
		var buttonInfo = buttonInfos[i];
		buttons.push(new Button(buttonInfo));
	}
}

function resizeButtons() {
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].refresh();
	}
}
