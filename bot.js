const discord = require('discord.js');
const aws = require('aws-sdk');
const _ = require("lodash");
const https = require('https');

//Constants
WATCHEDSETCODESDIRECTORY = 'data';
WATCHEDSETCODESFILENAME = 'watchedsetcodes.json';
WATCHEDSETCODESPATH = WATCHEDSETCODESDIRECTORY + '/' + WATCHEDSETCODESFILENAME;
SPOILERWATCHINTERVALTIME = 1000 * 30 * 60;
BUCKETNAME = process.env.AWS_BUCKET_NAME

// Emoji codes for mana symbols
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
    "e":"e_:344491160829558794",
    "g":"g_:344491161169428481",
    "gp":"gp:344491161102319616",
    "gu":"gu:344491161223692300",
    "gw":"gw:344491161139937282",
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

// Colors for discord card embed
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

// Initialize AWS S3 objet
const s3 = new aws.S3({
    accessKeyId: process.env.AWS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY
});

// Initialize discord Bot
Log('Initializing bot...');
var bot = new discord.Client();

// When bot is ready
bot.on('ready', function (evt) {
    Log('Connected!');
    bot.user.setPresence({
        activity: {
            name: 'for MTG spoilers',
            type: 'WATCHING'
        }
    });
    setInterval(readWatchedSets(), SPOILERWATCHINTERVALTIME)
});

// When bot reads message
bot.on('message', async message => {
    if (message.content.substring(0, 1) == '!') {
        try {
            var args = message.content.substring(1).split(' ');
            var cmd = args[0];
            args = args.splice(1);
            let set = args[0];
            switch(cmd.toLowerCase()) {
                case 'getall':
                    getAllCards(set, message.channel, true);
                break;

                case 'watch':
                    startSpoilerWatch(set, message.channel, true)
                break;

                case 'unwatch':
                    stopSpoilerWatch(set, message.channel, true)
                break;

                case 'clear':
                    clearAllCards(set, message.channel, true)
                break;
            }
        } catch(error) {
            Log('UNCAUGHT ERROR: ' + error)
            message.channel.send("Something went wrong.");
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
     
// Generate the description of a card
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

// Replace text of the form {X} with mana symbol emojis
function renderEmojis(text) {
    return text.replace(/{[^}]+?}/ig, match => {
        const code = match.replace(/[^a-z0-9]/ig,'').toLowerCase();
        return manamojis[code] ? '<:' + manamojis[code] + '>' : '';
    });
}

// Get the border colour for card embeds
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

// Generate discord embed from card
function generateEmbed(card, hasEmojiPermission) {
    let title = card.name;
    if (card.mana_cost) {
        title += ' ' + card.mana_cost;
    }
    
    if (card.layout === 'transform' && card.card_faces) {
        if (card.card_faces[0].mana_cost) {
            title += ' ' + card.card_faces[0].mana_cost;
        }
        card.image_uris = card.card_faces[0].image_uris;
    }
    
    let description = generateDescriptionText(card);
    if(hasEmojiPermission) {
        title = _.truncate(renderEmojis(title), {length: 256, separator: '<'});
        description = renderEmojis(description);
    }
    
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
    
// Read a file from AWS
function readFromAWS(filename, func) {
    var params = {
        Bucket: BUCKETNAME, 
        Key: filename
    };
    const result = await s3.getObject(params, function(err, data) {
        if (err && (err.code === 'NotFound' || err.code === 'NoSuchKey')) {
            Log("ERROR: Could not find file " + filename);
            func(false);
        } else if (err) {
            Log("ERROR: Unknown error when trying to find " + filename);
            Log(err);
            func(false);
        } else {
            func(data.Body);
        }
    });
}

function writeToAWS(filename, data) {
    var params = {
        Bucket: BUCKETNAME, 
        Key: filename,
        Body: data
    };
    var options = {partSize: 10 * 1024 * 1024, queueSize: 1};
    s3.upload(params, options, function(err, data) {
        if (err) Log(err);
    });
}

// Finds all new cards in the given set that haven't been posted to the given channel yet and posts them there
async function getAllCards(set, channelID, verbose = false) {
    // Read which cards are already saved
    let fileName = getFilename(set, channelID);
    readFromAWS(fileName, function(ret) {
        let savedCardlist = JSON.parse("[]");
        if (ret == false) {
            Log("Cannot find file " + fileName + ".");
            writeToAWS(fileName, "[]");
        } else {
            try {
                savedCardlist = JSON.parse(Buffer.from(ret).toString());
                Log("Successfully read file " + fileName + ".");
            } catch(error) {
                Log("Something went wrong with parsing data from existing saved file.");
                Log('ERROR: ' + error);
            }
        }
        if (!savedCardList) return;
        
        if (verbose) channelID.send('Trying to get newly spoiled cards from set with code ' + set + '...');
        
        https.get('https://api.scryfall.com/cards/search?order=spoiled&q=e%3A' + set + '&unique=prints', (resp) => {
            let data = '';

            resp.on('data', (chunk) => {
                data += chunk;
            });   
            
            resp.on('end', () => {
                let cardlist;
                try {
                    cardlist = JSON.parse(data);
                } catch(error) {
                   Log("Something went wrong with parsing data from Scryfall.");
                    Log('ERROR:' + error);
                    return;
                }
                var newCardlist = [];
                if (cardlist.object == 'list' && cardlist.total_cards > 0) {
                    cardlist.data.forEach(function(card) {
                        cardId = card.oracle_id;
                        if (!savedCardlist.some(c => c == cardId)) {
                            newCardlist.push(card);
                            savedCardlist.push(cardId);
                        }
                    });

                    if (newCardlist.length <= 0) {
                        Log('No new cards were found with set code ' + set);
                        if (verbose) channelID.send('No new cards were found with set code ' + set + '.');
                    } else {
                        Log(newCardlist.length + ' new cards were found with set code ' + set);
                        var interval = setInterval(function(cards) {
                            if (cards.length <= 0) {
                                Log('Done with sending cards to channel.');
                                clearInterval(interval);
                            } else {
                                let card = cards.pop();
                                var embed = generateEmbed(card, false);
                                Log('Sending ' + card.name + ' to channel.');
                                channelID.send('', {embed});
                            }
                        }, 1000, newCardlist);

                        try {
                            let savedCardlistJSON = JSON.stringify(savedCardlist);
                            writeToAWS(fileName, savedCardlistJSON);
                        } catch(error) {
                            Log("Something went wrong with saving new data.");
                            Log("ERROR: " + error);
                            return;
                        }
                    }
                } else {
                    if (verbose) channelID.send('Did not find any card with set code ' + set + '.');
                }
            });
        }).on("error", (err) => {
            Log("Error: " + err.message);
            channelID.send('Error trying to get cards with set code ' + set + './n' + 'Check the console for more details.');
        });
    });
}

// Returns the data filename for the given set and channelID
function getFilename(set, channelID) {
    return 'data/' + channelID + '-' + set.toUpperCase() + '-data.json';
}

// Reads the array of watched sets and channel IDs from the data file and sends new cards to channels
function readWatchedSets() {
    readFromAWS(WATCHEDSETCODESPATH, function(ret) {
        let watchedSetcodes = [];
        if (ret) {
            watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
            Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        }
        for (var i = 0; i < watchedSetcodes.length; i++) {
            var watchedSet = watchedSetcodes[i];
            Log('Watched set: ' + watchedSet.setCode + ' on channel' + watchedSet.channelID.name);
            Log('Start looking for new cards in set ' + watchedSet.setCode + ' for channel ' + watchedSet.channelID.id);
            getAllCards(watchedSet.setCode, watchedSet.channelID.id);
        }
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });
}

//Start the interval to look for new cards for the given set and channelID
function startSpoilerWatch(set, channelID, verbose = false) {
    Log('Start looking for new cards in set ' + set + ' for channel ' + channelID)
    if (verbose) channelID.send('Starting spoilerwatch for set ' + set + '.');
    getAllCards(set, channelID);
    readFromAWS(WATCHEDSETCODESPATH, function(ret) {
        let watchedSetcodes = [];
        if (ret) {
            watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
            Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        }
        watchedSetcodes.push({"setCode":set, "channelID":message.channel});
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });
}

//Stop the interval to look for new cards for the given set and channelID
function stopSpoilerWatch(set, channelID, verbose = false) {
    readFromAWS(WATCHEDSETCODESPATH, function(ret) {
        let watchedSetcodes = [];
        if (ret) {
            watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
            Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        }
        if (watchedSetcodes && watchedSetcodes.filter(function (watchedset) {
            watchedset.setCode == set && watchedset.channelID == message.channel
        })) {
            Log('Stopping looking for new cards in set ' + set + ' for channel ' + channelID)
            if (verbose) channelID.send('Stopping spoilerwatch for set ' + set + '.');
            watchedSetcodes = watchedSetcodes.filter(function(watchedset) {
                watchedset.setCode != set || watchedset.channelID != message.channel
            });
        } else {
            Log('Could not stop looking for new cards in set ' + set + ' for channel ' + channelID)
            if (verbose) channelID.send('Could not stop spoilerwatch for set ' + set + '.');
        }
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });   
}

function clearAllCards(set, channelID, verbose = false) {
    let fileName = getFilename(set, channelID);
    try {
        writeToAWS(fileName, "[]");
        Log("Successfully cleared file " + fileName + ".");
        if (verbose) channelID.send("Successfully cleared file for set with code " + set + ".");
    } catch(error) {
        if (verbose) channelID.send("Something went wrong with clearing file for set with code " + set + ".");
        Log("Something went wrong with clearing file for set with code " + set + ".");
        Log('ERROR: ' + error);
    }
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
