#!/usr/bin/env wsapi.cgi
-- I think the new openresty->wsapi loses GET and POST
require 'ext'
local json = require 'dkjson'
local wsapi_request = require 'wsapi.request'

return {
	run = function(env)
		local headers = { 
			["Content-type"] = "text/javascript",
			["Cache-Control"] = "no-cache",
		}
		local req = wsapi_request.new(env)
		local score = req.GET and req.GET.score or (req.POST and req.POST.score)
		local name = req.GET and req.GET.name or (req.POST and req.POST.name)
		local tiles = req.GET and req.GET.tiles or (req.POST and req.POST.tiles)

		local text
		if name and tiles then
			name = name:gsub('[\r\n]', '')
			tiles = tiles:gsub('[\r\n]', '')
			local fn = 'userlevels.json'
			local leveldb
			local srcdata = file(fn):read()
			if srcdata then
				leveldb = json.decode(srcdata)
			end
			leveldb = leveldb or {levels={}}
			table.insert(leveldb.levels, {name=name, tiles=tiles})
			file(fn):write(json.encode(leveldb, {indent=true}))
			text = function() coroutine.yield(json.encode{result='win'}) end
		else
			text = function() coroutine.yield(json.encode{
				result = 'fail',
				name = not name and 'expected name' or nil,
				tiles = not tiles and 'expected tiles' or nil,
				GET = req.GET or 'notthere',
				POST = req.POST or 'notthere',
				ngx = not not env.ngx,
				ngx_post = env.ngx.req.get_post_args()
			}) end
		end

		return 200, headers, coroutine.wrap(text)
	end
}
