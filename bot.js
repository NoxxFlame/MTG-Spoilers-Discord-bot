const discord = require('discord.js');
const aws = require('aws-sdk');
const fs = require("fs");
const _ = require("lodash");

//Constants
WATCHEDSETCODESDIRECTORY = __dirname + '/data';
WATCHEDSETCODESFILENAME = 'watchedsetcodes.json';
WATCHEDSETCODESPATH = WATCHEDSETCODESDIRECTORY + '/' + WATCHEDSETCODESFILENAME;
SPOILERWATCHINTERVALTIME = 1000 * 30 * 60;

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

const bucketname = process.env.AWS_BUCKET_NAME

const manamojis = {
    "0":"0_:344491158384410625",
    "1":"1_:344491158723887107",
    "10":"10:344491160280104984",
    "11":"11:344491159965401088",
    "12":"12:344491160435163137",
    "13":"13:344491160674238464",
    "14":"14:344491160619712513",
    "15":"15:344491160586289154",
    "16":"16:344491160808587264",
    "17":"17:344491160468979714",
    "18":"18:344491160720506880",
    "19":"19:344491160498208771",
    "2":"2_:344491158371696641",
    "20":"20:344491161257246720",
    "2b":"2b:344491158665429012",
    "2g":"2g:344491159189585921",
    "2r":"2r:344491159265083392",
    "2u":"2u:344491159160225792",
    "2w":"2w:344491159692771328",
    "3":"3_:344491159210688522",
    "4":"4_:344491159172677632",
    "5":"5_:344491158883532801",
    "6":"6_:344491159185260554",
    "7":"7_:344491159021813761",
    "8":"8_:344491159424466945",
    "9":"9_:344491159273472020",
    "b":"b_:608749298682822692",
    "bg":"bg:344491161286737921",
    "bp":"bp:608749299135807508",
    "br":"br:344491161362366465",
    "c":"c_:344491160636489739",
    "chaos":"chaos:344491160267653130",
    "e":"e_:344491160829558794",
    "g":"g_:344491161169428481",
    "gp":"gp:344491161102319616",
    "gu":"gu:344491161223692300",
    "gw":"gw:344491161139937282",
    "half":"half:344491161164972032",
    "hr":"hr:344491160787615748",
    "hw":"hw:344491161181749268",
    "infinity":"infinity:344491160619843593",
    "q":"q_:344491161060245504",
    "r":"r_:344491161274023938",
    "rg":"rg:344491161295257600",
    "rp":"rp:344491161076891648",
    "rw":"rw:344491161316098049",
    "s":"s_:343519207608025090",
    "t":"t_:344491161089736704",
    "u":"u_:344491161362235394",
    "ub":"ub:344491161248858113",
    "up":"up:344491161395789824",
    "ur":"ur:608749298896863297",
    "w":"w_:608749298896863266",
    "wb":"wb:344491161374818304",
    "wp":"wp:608749298544410641",
    "wu":"wu:608749299135807512",
    "x":"x_:344491161345327126",
    "y":"y_:344491161374818305",
    "z":"z_:344491161035210755"
};

const colors = {
    "W": 0xF8F6D8,
    "U": 0xC1D7E9,
    "B": 0x0D0F0F,
    "R": 0xE49977,
    "G": 0xA3C095,
    "GOLD": 0xE0C96C,
    "ARTIFACT": 0x90ADBB,
    "LAND": 0xAA8F84,
    "NONE": 0xDAD9DE
};

// Initialize discord Bot
Log('Initializing bot...');
var bot = new discord.Client();

//When bot is ready
bot.on('ready', function (evt) {
    Log('Connected!');
    Log('Logged in as: ' + bot.username + ' - (' + bot.id + ')');
    bot.user.setPresence({
        activity: {
            name: 'for MTG spoilers',
            type: 'WATCHING'
        }
    });

    // Read watched sets and start spoiler watches
    watchedSetcodes = readWatchedSets();
    intervals = [];
});

//When bot reads message
bot.on('message', async message => {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.content.substring(0, 1) == '!') {
        try {
            var args = message.content.substring(1).split(' ');
            var cmd = args[0];
        
            args = args.splice(1);
            let set = args[0];
            switch(cmd.toLowerCase()) {
                //Get all cards from the given set and send them in the current channel
                case 'getallCards':
                case 'getallcards':
                case 'getall':
                    getAllCards(set, message.channel, true);
                break;
                //Start spoilerwatch for the given set ID in the current channel
                case 'watch':
                case 'startwatch':
                    //Add the combination to the watched sets and save this
                    watchedSetcodes.push({"setCode":set, "channelID":message.channel});
                    saveWatchedSets()
                    Log('Starting spoilerwatch for set ' + set + '.');
                    message.channel.send('Starting spoilerwatch for set ' + set + '.');
                    //Immediately look for new cards
                    Log('Start looking for new cards on ' + Date.now());
                    getAllCards(set, message.channel);
                    //Start the interval to look for new cards
                    startSpoilerWatch(set, message.channel);
                break;
                //Stop spoilerwatch for the given set ID in the current channel
                case 'unwatch':
                case 'stopwatch':
                    Log('checking spoilerwatch for set ' + set + '.');
                    Log('Checking if set matches with ' + set + ' and channel matches with ' + message.channel);
                    // Check if set is watched in the current channel
                    if (watchedSetcodes && watchedSetcodes.filter(function (watchedset) {
                        watchedset.setCode == set && watchedset.channelID == message.channel
                    })) 
                    {
                        Log('Stopping spoilerwatch for set ' + set + '.');
                        message.channel.send('Stopping spoilerwatch for set ' + set + '.');
                        // Find the timeout for this set and channel
                        intervals.find((o, i) => {
                            if (o.setcode == set && o.channel == message.channel) {
                                // Stop the interval that checks for spoilers
                                clearInterval(o.interval);
                                intervals.splice(i, 1);
                                return true;
                            }
                        });
                        // Remove the set and channel combination from the watchedSetcodes and save it
                        watchedSetcodes = watchedSetcodes.filter(function(watchedset) {
                            watchedset.setCode != set || watchedset.channelID != message.channel
                        });
                        saveWatchedSets()
                    }
                break;
                // Clears the saved data for the given set in the current channel
                case 'clear':
                    let fileName = getFilename(set, message.channel);
                    try {
                        writeToAWS(fileName, "[]");
                        Log("Successfully cleared file " + fileName + ".");
                        message.channel.send("Successfully cleared file for set with code " + set + ".");
                    }
                    catch(error) {
                        message.channel.send("Something went wrong with clearing file for set with code " + set + ".");
                        Log("Something went wrong with clearing file for set with code " + set + ".");
                        Log('ERROR: ' + error);
                    }
                break;
            }
        }
        catch (error) {
            Log('UNCAUGHT ERROR: ' + error)
            message.channel.send("Something went really wrong. Please tell Lars he's an idiot.");
        }
     }
});

// Reconnect if the bot is disconnected
bot.on('disconnect', function(errMsg, code) { 
    Log('ERROR code ' + code +': ' + errMsg);
    if (code === 1000) {
        bot.connect();
    }
});
     
function generateDescriptionText(card) {
    const ptToString = (card) =>
        '**'+card.power.replace(/\*/g, '\\*') + "/" + card.toughness.replace(/\*/g, '\\*')+'**';

    const description = [];
    if (card.type_line) { // bold type line
        let type = `**${card.printed_type_line || card.type_line}** `;
        type += `(${card.set.toUpperCase()} ${_.capitalize(card.rarity)}`;
        type += `${card.lang && card.lang !== 'en' ? ' :flag_' + card.lang + ':':''})`;
        description.push(type);
    }
    if (card.oracle_text) { // reminder text in italics
        const text = card.printed_text || card.oracle_text;
        description.push(text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
    }
    if (card.flavor_text) { // flavor text in italics
        description.push('*' + card.flavor_text+'*');
    }
    if (card.loyalty) { // bold loyalty
        description.push('**Loyalty: ' + card.loyalty+'**');
    }
    if (card.power) { // bold P/T
        description.push(ptToString(card));
    }
    if (card.card_faces) {
        // split cards are special
        card.card_faces.forEach(face => {
            description.push('**'+face.type_line+'**');
            if (face.oracle_text) {
                description.push(face.oracle_text.replace(/[()]/g, m => m === '(' ? '*(':')*'));
            }
            if (face.power) {
                description.push(ptToString(face));
            }
            description.push('');
        });
    }
    return description.join('\n');
}

function renderEmojis(text) {
    return text.replace(/{[^}]+?}/ig, match => {
        const code = match.replace(/[^a-z0-9]/ig,'').toLowerCase();
        return manamojis[code] ? '<:' + manamojis[code] + '>' : '';
    });
}

function getBorderColor(card) {
    let color;
    if (!card.colors || card.colors.length === 0) {
        color = colors.NONE;
        if (card.type_line && card.type_line.match(/artifact/i)) color = colors.ARTIFACT;
        if (card.type_line && card.type_line.match(/land/i)) color = colors.LAND;
    } else if (card.colors.length > 1) {
        color = colors.GOLD;
    } else {
        color = colors[card.colors[0]];
    }
    return color;
}

function generateEmbed(card, hasEmojiPermission) {
    // generate embed title and description text
    // use printed name (=translated) over English name, if available
    let title = card.name;

    if (card.mana_cost) {
        title += ' ' + card.mana_cost;
    }

    // DFC use card_faces array for each face
    if (card.layout === 'transform' && card.card_faces) {
        if (card.card_faces[0].mana_cost) {
            title += ' ' + card.card_faces[0].mana_cost;
        }
        card.image_uris = card.card_faces[0].image_uris;
    }

    let description = generateDescriptionText(card);

    // are we allowed to use custom emojis? cool, then do so, but make sure the title still fits
    if(hasEmojiPermission) {
        title = _.truncate(renderEmojis(title), {length: 256, separator: '<'});
        description = renderEmojis(description);
    }

    // instantiate embed object
    const embed = new discord.MessageEmbed({
        title,
        description,
        url: card.scryfall_uri,
        color: getBorderColor(card.layout === 'transform' ? card.card_faces[0]:card),
        thumbnail: card.image_uris ? {url: card.image_uris.small} : null,
        image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
    });
    return embed;
}
      
function readFromAWS(filename) {
    var params = {
        Bucket: bucketname, 
        Key: filename
    };
    s3.getObject(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            return false;
        } else {
            return data;
        }
    });
}

function writeToAWS(filename, data) {
    var params = {
        Bucket: bucketname, 
        Key: filename,
        Body: data
    };
    var options = {partSize: 10 * 1024 * 1024, queueSize: 1};
    return s3.upload(params, options, function(err, data) {
        console.log(err, data);
    });
}

// Finds all new cards in the given set that haven't been posted to the given channel yet and posts them there
function getAllCards(set, channelID, verbose = false) {
    // Read which cards are already saved
    let fileName = getFilename(set, channelID);
    let savedCardlist = JSON.parse("[]");
    if (!readFromAWS(fileName)) {
        // If data file doesn't exist yet, make an empty one
        writeToAWS(fileName, "[]");
    } else {
        try {
            var body = readFromAWS(fileName).Body
            console.log(body)
            savedCardlist = JSON.parse(body);
            Log("Successfully read file " + fileName + ".");
        }
        catch(error) {
            Log("Something went wrong with parsing data from existing saved file.");
            Log('ERROR: ' + error);
            return;
        }
    }

    if (verbose) {
        channelID.send('Trying to get newly spoiled cards from set with code ' + set + '...');
    }

    // Make a request to the Scryfall api
    const https = require('https');
    https.get('https://api.scryfall.com/cards/search?order=spoiled&q=e%3A' + set + '&unique=prints', (resp) => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received.
    resp.on('end', () => {
        try {
            // Parse the data in the response
            cardlist = JSON.parse(data);
        }
        catch(error) {
            Log("Something went wrong with parsing data from Scryfall.");
            Log('ERROR:' + error);
            return;
        }
        var newCardlist = [];
        if (cardlist.object == 'list' && cardlist.total_cards > 0) {
            // For every card: check if it's already save, otherwise at it to the new list
            cardlist.data.forEach(function(card) {
                cardId = card.oracle_id;

                if (!savedCardlist.some(c => c == cardId)) {
                    newCardlist.push(card);
                    savedCardlist.push(cardId);
                }
            });

            // If new list is empty, no new cards were found
            if (newCardlist.length <= 0) {
                Log('No new cards were found with set code ' + set);
                if (verbose) {
                    channelID.send('No new cards were found with set code ' + set + '.');
                }
            }
            else {
                // If new list wasn't empty, send one of the new cards to the channel every second
                Log(newCardlist.length + ' new cards were found with set code ' + set);
                var interval = setInterval(function(cards) {
                    if (cards.length <= 0) {
                        Log('Done with sending cards to channel.');
                        clearInterval(interval);
                    }
                    else {
                        // Get all relevant data from the card
                        let card = cards.pop();
                        var embed = generateEmbed(card, false);
                        Log('Sending ' + card.name + ' to channel.');

                        intervals.push({interval: interval, setcode: set, channel: channelID});

                        channelID.send('', {embed});
                    }
                }, 1000, newCardlist);

                try {
                    // Save the updated list of saved cards to the datafile
                    let savedCardlistJSON = JSON.stringify(savedCardlist);
                    writeToAWS(fileName, savedCardlistJSON);
                }
                catch(error) {
                    Log("Something went wrong with saving new data.");
                    Log("ERROR: " + error);
                    return;
                }
            }
        }
        else {
            if (verbose) {
                channelID.send('Did not find any card with set code ' + set + '.');
            }
        }
    });

    }).on("error", (err) => {
        Log("Error: " + err.message);
        channelID.send('Error trying to get cards with set code ' + set + './n' + 'Check the console for more details.');
    });
}

// Returns the data filename for the given set and channelID
function getFilename(set, channelID) {
    return __dirname + '/data/' + channelID + '-' + set + '-data.json';
}

// Saves the array of watched sets and channel IDs to the data file
function saveWatchedSets() {
    writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
}

// Reads the array of watched sets and channel IDs from the data file
function readWatchedSets() {
    if (!readFromAWS(WATCHEDSETCODESPATH)) {
        Log("Could not read file " + WATCHEDSETCODESPATH + ".");
    } else {
        var body = readFromAWS(WATCHEDSETCODESPATH).Body;
        watchedSetcodes = JSON.parse(body);
        Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        startSpoilerWatches()
    }
    return;
}

// Start the spoiler watch intervals for all combinations in the saved file
function startSpoilerWatches() {
    Log('Watched sets: ' + JSON.stringify(watchedSetcodes));
    for (var i = 0; i < watchedSetcodes.length; i++) {
        var watchedSet = watchedSetcodes[i];
        Log('Watched set: ' + JSON.stringify(watchedSet));
        Log('Start looking for new cards in set ' + watchedSet.setCode + ' for channel ' + watchedSet.channelID);
        startSpoilerWatch(watchedSet.setCode, watchedSet.channelID);
        getAllCards(watchedSet.setCode, watchedSet.channelID);
    }
    return;
}

//Start the interval to look for new cards for the given set and channelID
function startSpoilerWatch(set, channelID) {
    setInterval(function(set) {
        Log('Start looking for new cards in set ' + set + ' for channel ' + channelID);
        getAllCards(set, channelID);
    }, SPOILERWATCHINTERVALTIME, set);
    return;
}

// Returns the current date in a readable format
function getDate() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var h = today.getHours();
    var m = today.getMinutes();

    var yyyy = today.getFullYear();
    if (dd < 10) {
    dd = '0' + dd;
    } 
    if (mm < 10) {
    mm = '0' + mm;
    } 
    if (h < 10) {
    h = '0' + h;
    } 
    if (m < 10) {
    m = '0' + m;
    } 
    var today = '[' + dd + '/' + mm + '/' + yyyy + ' ' + h + ':' + m + '] - ';
    return today;
}

function Log(message) {
    console.log(getDate() + " - " + message);
}

try {
    bot.login(process.env.DISCORD_TOKEN);
} catch(err) {
    Log(err);
}
