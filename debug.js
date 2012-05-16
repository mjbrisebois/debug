// Debug Library
// - log
//   debug.log(message, logging-level)
//
// - warn
//   debug.warn(message, logging-level)
//
// - error
//   debug.error(message, logging-level)
//
// - start time
//   debug.startTime(group)
// - get time
//   debug.getTime(group)
// - stop time
//   debug.stopTime(group)
//
// - grouping
//   debug.group("name-of-group", function() {
//       this.time()
//       this.log("started group...")
//       try(blarg) {
//           this.log("blarg is set to "+blarg)
//       } catch(err) {
//           this.error(err)
//       }
//   })

// TODO:
//   - write unit tests
//   - write documentation
//   - have groups in groups
//   - localize timer's into their own groups
//   - cross browser support for web sockets
//   - error/failure handling for web sockets

(function(window) {
    var debugGroup = function(group, collapsed) {
        if( ! (this instanceof debugGroup)) {
            return new debugGroup(group);
        }
        this.setGroup(group);
    }
    var noGroupName = "no-group-name";
    debug = {
        level:		0,
        serverLevel:	10,
        logUrl:		null,
        logSocket:	null,
        messageQueue:	[],
        counts:		{},
        clocks:		{},
        groups:		{},
        groupName:	noGroupName,
        currentGroup:	null,
        warn: function(msg, level) {
            this.log(msg, level, "warn")
        },
        debug: function(msg, level) {
            this.log(msg, level, "debug")
        },
        error: function(msg, level) {
            this.log(msg, level, "error")
        },
        socketLog: function(msg, level, type) {
            // if everything is set up for server logging then
            // send log message every time
            if(this.logUrl
               && this.logSocket.readyState==1
               && level <= this.serverLevel
              ) {
                this.logSocket.send('{ "type": "'+type+'","message": "'+msg+'", "level": '+level+' }');
            } else {
/*
                console.log(this.logSocket.readyState)
                console.log(level+" <= "+this.serverLevel)
                console.log(msg)
                console.log("did not send message \""+msg+"\" to the server.")
*/
                if(this.messageQueue.length < 9999) {
                    this.messageQueue.push({
                        "msg":	msg,
                        "level":	level,
                        "type":	type
                    })
                }
            }
        },
        log: function (msg, level, type) {
            type	= type ? type : "log"
            group	= this.getGroup();
            level	= level ? level : 0

            this.socketLog(msg, level, type)

            // if message priority is is lower than log level
            if(level <= this.level) {
                // if this message group is not the current console
                // group then close current group
                if(group != debug.currentGroup) {
                    console.groupEnd();
                    debug.currentGroup = group;

                    // if current group is not unnamed start the named
                    // group
                    if(group != noGroupName) {
                        // start group in console
                        console.group(group);
                    }
                }

                // switch console log type and default to regular log
                switch(type) {
                    case "log":
                    console.log(msg);
                    break;
                    case "debug":
                    console.log("DEBUG: "+msg);
                    break;
                    case "warn":
                    console.warn(msg);
                    break;
                    case "error":
                    console.error(msg);
                    break;
                }
            } else {
                // increase unlogged counter for this group
                this.doCount("unlogged")
            }
        },
        setCount: function (count, num) {
            group = this.getGroup();
            this.counts[group][count] = num;
            return true;
        },
        doCount: function (count) {
            group = this.getGroup();
            counter = this.counts[group]
            return this.counts[group][count] = counter["unlogged"]
                ? counter["unlogged"] += 1
                : 1;
        },
        getCount: function (count) {
            // add noGroupName to counts list if not already added
            this.counts[noGroupName] = this.counts[noGroupName]
                ? this.counts[noGroupName]
                : {};
            // return count for counts.group[count] if is set else
            // return 0
            group = this.getGroup();
            return count
                ? this.counts[group][count]
                    ? this.counts[group][count]
                    : 0
                : this.counts[group];
        },
        setLevel: function (level) {
            this.level = level;
            return true;
        },
        getLevel: function (level) {
            return this.level;
        },
        sendQueue: function() {
            while(this.messageQueue.length > 0) {
                obj = this.messageQueue.shift()
                this.socketLog(obj.msg, obj.level, obj.type)
            }
        },
        setLogUrl: function (url) {
            var $this = this
            this.startTime("websocket")
            this.logUrl = url;
            this.logSocket = new WebSocket(url);
            this.logSocket.onopen = function() {
                $this.sendQueue()
            }
            this.logSocket.onclose = function(e) {
                $this.warn("websocket closed after "+$this.stopTime("websocket"), 1)
                $this.setLogUrl($this.logUrl);
            }
        },
        setGroup: function (group) {
            this.groupName = group;
            this.counts[group] = {};
        },
        getGroup: function (group) {
            return group
                ? group
                : this.groupName
                    ? this.groupName
                    : noGroupName;
        },
        group: function (group, callback, collapsed) {
            group	= this.getGroup(group);
            groupObj	= new debugGroup(group, collapsed);
            if(callback) {
                callback.call(groupObj);
            }
            return groupObj;
        },
        startTime: function (group) {
            group = this.getGroup(group);
            start = this.clocks[group]
                ? this.clocks[group]
                : this.clocks[group] = new Date().getTime();
        },
        getTime: function (group) {
            group = this.getGroup(group);
            start = this.clocks[group]
                ? this.clocks[group]
                : false;
            return start
                ? new Date().getTime() - start
                : false;
        },
        stopTime: function (group) {
            group = this.getGroup(group);
            start = this.clocks[group]
                ? this.clocks[group]
                : false;
            if(start) {
                delete(this.clocks[group])
                return new Date().getTime() - start;
            } else {
                return false;
            }
        }
    }
    debugGroup.prototype	= debug;
    window.debug		= debug;
})(window);

// Unit testing suite
(function (window) {
    var runTests = function () {
        // set url for server logging
        debug.setLogUrl("ws://localhost:8600/log")

        // make loader group
        loader = debug.group("loader", function() {
            this.warn("load the things NOW!!")
        })
        // make ajax group
        ajax = debug.group("ajax")
        ajax.startTime()
        jQuery.ajax({
            url: "http://google.ca",
            dataType: "html",
            error: function(error, msg) {
                ajax.error(ajax.getTime()+" - ajax error message: "+msg)
                ajax.warn("not cool")
                loader.log("809348 did you do that load yet?")
                ajax.log("no more things to do")
            }
        })
    }
    window.runTests = runTests
})(window);
