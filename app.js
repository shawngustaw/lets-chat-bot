var socketio = require('socket.io-client')
var url = require('url')
var schedule = require('node-schedule')
var JiraApi = require('jira-client');
var YouTube = require('youtube-node');


VALID_COMMANDS = ['/code_review', '/in_qa']


jiraConfig = {
    host: process.env.JIRA_HOST || 'yourinstance.atlassian.net',
    user: process.env.JIRA_USER || 'user@example.com',
    password: process.env.JIRA_PASSWORD || 'hunter2'
}


LCB_PROTOCOL = process.env.LCB_PROTOCOL || 'https'
LCB_HOSTNAME = process.env.LCB_HOSTNAME || 'localhost'
LCB_PORT = process.env.LCB_PORT || 5000
LCB_TOKEN = process.env.LCB_TOKEN || "your lcb token here"
LCB_ROOM = process.env.LCB_ROOM || "LCB room hash"


YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "api key here"


chatURL = url.format({
    protocol: LCB_PROTOCOL,
    hostname: LCB_HOSTNAME,
    port: LCB_PORT,
    query: {
        token: LCB_TOKEN
    },
})


var jira = new JiraApi({
    protocol: 'https',
    host: jiraConfig.host,
    username: jiraConfig.user,
    password: jiraConfig.password,
    apiVersion: '2',
    strictSSL: true
});


var yt = new YouTube();
yt.setKey(YOUTUBE_API_KEY);


io = socketio(chatURL, {autoConnect: false}).connect()


// Commands that can be executed or scheduled
jiraCodeReview = function() {
    console.log("About to query Jira for CodeReview tickets");

    jira.searchJira('Status = "Code Review" AND sprint IN openSprints() AND project = "SD Elements"').then(function(response) {
        itemIds = []

        for (var i = 0; i < response.issues.length; i++) {
            itemIds.push("#" + response.issues[i].key)
        }

        text = "The following tasks are currently in and/or NEED code review. For the greater good of humanity, please review them: " + itemIds

        message = {
            room: LCB_ROOM,
            text: text
        }

        io.emit('messages:create', message);

    }).catch(function(err) {
        console.log(err);
    });
}


jiraInQA = function() {
    console.log("About to query Jira for QA tickets");

    jira.searchJira('Status = "IN QA" AND sprint IN openSprints() AND project = "SD Elements"').then(function(response) {
        itemIds = []

        for (var i = 0; i < response.issues.length; i++) {
            itemIds.push("#" + response.issues[i].key)
        }

        text = "The following tasks are currently in QA. For the greater good of Vey, please QA them: " + itemIds

        message = {
            room: LCB_ROOM,
            text: text
        }

        io.emit('messages:create', message);

    }).catch(function(err) {
        console.log(err);
    });
}

getYoutubeVideo = function(id) {
    if (!YOUTUBE_API_KEY) return;


}


// Mapping from received command to its function
commandMapping = {
    code_review: jiraCodeReview,
    in_qa: jiraInQA
}


// Connect to the room
io.on('connect', function() {
   io.emit('account:whoami', function(profile) {
       console.log("Connected to LCB bot named %s!", profile.displayName)
   })

   io.emit("rooms:join", LCB_ROOM, function(room) {
       console.log("joined room: " + room.name)
   })

})

var youtube_pattern = /http(?:s?):\/\/(?:www\.)?youtu(?:be\.com\/watch\?v=|\.be\/)([\w\-\_]*)(&(amp;)?‌​[\w\?‌​=]*)?/;

// Respond to commands
io.on('messages:new', function(message) {
    split = message.text.split(' ');
    validCommand = (VALID_COMMANDS.indexOf(split[0]) > -1)

    validYoutube = message.match(youtube_pattern)

    if (validYoutube) {
        videoID = validYoutube[1]
        yt.getById(videoID, function(error, result) {
            if (error) {
                console.log(error);
            } else {
                message = {
                    room: LCB_ROOM,
                    text: result 
                }

                io.emit('messages:create', message);
            }
        }

    }

    if (validCommand) {
        command = split[0].split('/')[1]
        command = commandMapping[command]
        command()
    }
})


// Schedule the jobs
var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [new schedule.Range(1, 6)]
rule.hour = [11, 18]
rule.minute = 4
rule.second = 0;

var j = schedule.scheduleJob(rule, function() {
    console.log('Executing the job');
    jiraCodeReview();
});
