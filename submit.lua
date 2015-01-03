#!/usr/bin/env wsapi.cgi
require 'ext'
local json = require 'dkjson'
local wsapi_request = require 'wsapi.request'

return {
	run = function(env)
		local headers = { 
			["Content-type"] = "text/javascript",
			["Cache-Control"] = "no-cache",
		}
		local headers = { ["Content-type"] = "text/javascript" }
		local req = wsapi_request.new(env)
		local score = req.GET and req.GET.score
		local name = req.GET and req.GET.name
		local tiles = req.GET and req.GET.tiles

		local text
		if name and tiles then
			name = name:gsub('[\r\n]', '')
			tiles = tiles:gsub('[\r\n]', '')
			local fn = 'userlevels.json'
			local leveldb
			local srcdata = io.readfile(fn)
			if srcdata then
				leveldb = json.decode(srcdata)
			end
			leveldb = leveldb or {levels={}}
			table.insert(leveldb.levels, {name=name, tiles=tiles})
			io.writefile(fn, json.encode(leveldb))
			text = function() coroutine.yield(json.encode{result='win'}) end
		else
			text = function() coroutine.yield(json.encode{result='fail'}) end
		end

		return 200, headers, coroutine.wrap(text)
	end
}

