<?
assert(xpcall(function()
headers['connection'] = 'close'	 -- chrome bug
headers["cache-control"] = 'no-cache'
-- I think the new openresty->wsapi loses GET and POST
local path = require 'ext.path'
local json = require 'dkjson'
local wsapi_request = require 'wsapi.request'
local req = wsapi_request.new(env)
local GET = req.GET or {}
local score = GET.score
local name = GET.name
local tiles = GET.tiles

if not (name and tiles) then
	?><?=json.encode{
		result = 'fail',
		name = not name and 'expected name' or nil,
		tiles = not tiles and 'expected tiles' or nil,
		GET = GET or 'notthere',
	}?><?
	return
end
	
name = name:gsub('[\r\n]', '')
tiles = tiles:gsub('[\r\n]', '')
local fn = 'userlevels.json'
-- TODO lock on this so no two processes overwrite it ....
local srcdata = path(fn):read()

local leveldb
if srcdata then
	leveldb = json.decode(srcdata)
end
leveldb = leveldb or {levels={}}
table.insert(leveldb.levels, {name=name, tiles=tiles})
assert(path(fn):write((assert(json.encode(leveldb, {indent=true})))))
?><?=json.encode{result='win'}?><?
end, function(err)
	?><?=json.encode{error=err}?><?
	return err..'\n'..debug.traceback()
end))
?>
