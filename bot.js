const discord = require('discord.js');
const aws = require('aws-sdk');
const _ = require("lodash");
const https = require('https');

//Constants
WATCHEDSETCODESDIRECTORY = 'data';
WATCHEDSETCODESFILENAME = 'watchedsetcodes.json';
WATCHEDSETCODESPATH = WATCHEDSETCODESDIRECTORY + '/' + WATCHEDSETCODESFILENAME;
SPOILERWATCHINTERVALTIME = 1000 * 60 * 20;
BUCKETNAME = process.env.AWS_BUCKET_NAME

// Emoji codes for mana symbols
const manamojis = {
    "0":"0_:719748810649370716",
    "1":"1_:719748810682662954",
    "2":"2_:719748810590650409",
    "3":"3_:719748810372546582",
    "4":"4_:719748810758291476",
    "5":"5_:719748810435461161",
    "6":"6_:719748810846371912",
    "7":"7_:719748811127259156",
    "8":"8_:719748811156750407",
    "9":"9_:719748811148492893",
    "10":"10_:719748811102093403",
    "11":"11_:719748811190304768",
    "12":"12_:719748811261476904",
    "13":"13_:719748811257544784",
    "14":"14_:719748810829594676",
    "15":"15_:719748811316002847",
    "16":"16_:719748811161075712",
    "17":"17_:719748811165270076",
    "18":"18_:719748810766680108",
    "19":"19_:719748811052023860",
    "20":"20_:719748811106287617",
    "w":"w_:719748812834340914",
    "u":"u_:719748812469567579",
    "b":"b_:719748811232116776",
    "r":"r_:719748812620431451",
    "g":"g_:719748811160813650",
    "c":"c_:719748812712706108",
    "wu":"wu_:719748812805242902",
    "wb":"wb_:719748812851118080",
    "ub":"ub_:719748812708642817",
    "ur":"ur_:719748812695929024",
    "br":"br_:719748810934321173",
    "bg":"bg_:719748811198693386",
    "rg":"rg_:719748812486344765",
    "rw":"rw_:719748812746260520",
    "gw":"gw_:719748812372967466",
    "gu":"gu_:719748812687671297",
    "wp":"wp_:719748812779946095",
    "up":"up_:719748812872351744",
    "bp":"bp_:719748811022401567",
    "rp":"rp_:719748812377161831",
    "gp":"gp_:719748811316265020",
    "2w":"2w_:719748810817142804",
    "2u":"2u_:719748810556833804",
    "2b":"2b_:719748810821337149",
    "2r":"2r_:719748810645045249",
    "2g":"2g_:719748810728931338",
    "x":"x_:719748812830277692",
    "t":"t_:719748812695928953",
    "q":"q_:719748812394070118"
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

try {
    bot.login(process.env.DISCORD_TOKEN);
} catch(err) {
    Log(err);
}

// When bot is ready
bot.on('ready', function (evt) {
    Log('Connected!');
    bot.user.setPresence({
        activity: {
            name: 'for MTG spoilers',
            type: 'WATCHING'
        }
    });
    readWatchedSets();
    setInterval(function() {
        readWatchedSets()}, SPOILERWATCHINTERVALTIME);
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
                    if (message.member.hasPermission("MANAGE_MESSAGES")) getAllCards(set, message.channel.id, true);
                    else message.channel.send("You do not have permission to use that command.");
                break;

                case 'watch':
                    if (message.member.hasPermission("MANAGE_MESSAGES")) startSpoilerWatch(set, message.channel.id, true);
                    else message.channel.send("You do not have permission to use that command.");
                break;

                case 'unwatch':
                    if (message.member.hasPermission("MANAGE_MESSAGES")) stopSpoilerWatch(set, message.channel.id, true);
                    else message.channel.send("You do not have permission to use that command.");
                break;

                case 'clear':
                    if (message.member.hasPermission("MANAGE_MESSAGES")) clearAllCards(set, message.channel.id, true);
                    else message.channel.send("You do not have permission to use that command.");
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
    s3.getObject(params, function(err, data) {
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
    const channel = bot.channels.cache.get(channelID);
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
        
        if (verbose) bot.channels.cache.get(channelID).send('Trying to get newly spoiled cards from set with code ' + set + '...');
        
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
                        if (verbose) bot.channels.cache.get(channelID).send('No new cards were found with set code ' + set + '.');
                    } else {
                        Log(newCardlist.length + ' new cards were found with set code ' + set);
                        var interval = setInterval(function(cards) {
                            if (cards.length <= 0) {
                                Log('Done with sending cards to channel.');
                                clearInterval(interval);
                            } else {
                                let card = cards.pop();
                                var embed = generateEmbed(card, true);
                                Log('Sending ' + card.name + ' to channel.');
                                channel.send('', {embed});
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
                    if (verbose) channel.send('Did not find any card with set code ' + set + '.');
                }
            });
        }).on("error", (err) => {
            Log("Error: " + err.message);
            channel.send('Error trying to get cards with set code ' + set + './n' + 'Check the console for more details.');
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
            Log('Watched set: ' + watchedSet.setCode + ' on channel ' + watchedSet.channelID);
            Log('Start looking for new cards in set ' + watchedSet.setCode + ' for channel ' + watchedSet.channelID);
            getAllCards(watchedSet.setCode, watchedSet.channelID);
        }
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });
}

//Start the interval to look for new cards for the given set and channelID
function startSpoilerWatch(set, channelID, verbose = false) {
    const channel = bot.channels.cache.get(channelID);
    Log('Start looking for new cards in set ' + set + ' for channel ' + channelID)
    if (verbose) channel.send('Starting spoilerwatch for set ' + set + '.');
    getAllCards(set, channelID);
    readFromAWS(WATCHEDSETCODESPATH, function(ret) {
        let watchedSetcodes = [];
        if (ret) {
            watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
            Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        }
        watchedSetcodes.push({"setCode":set, "channelID":channelID});
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });
}

//Stop the interval to look for new cards for the given set and channelID
function stopSpoilerWatch(set, channelID, verbose = false) {
    const channel = bot.channels.cache.get(channelID);
    readFromAWS(WATCHEDSETCODESPATH, function(ret) {
        let watchedSetcodes = [];
        if (ret) {
            watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
            Log("Successfully read file " + WATCHEDSETCODESPATH + ".");
        }
        if (watchedSetcodes && watchedSetcodes.filter(function (watchedset) {
            watchedset.setCode == set && watchedset.channelID == channelID
        })) {
            Log('Stopping looking for new cards in set ' + set + ' for channel ' + channelID)
            if (verbose) channel.send('Stopping spoilerwatch for set ' + set + '.');
            watchedSetcodes = watchedSetcodes.filter(function(watchedset) {
                watchedset.setCode != set || watchedset.channelID != channelID
            });
        } else {
            Log('Could not stop looking for new cards in set ' + set + ' for channel ' + channelID)
            if (verbose) channel.send('Could not stop spoilerwatch for set ' + set + '.');
        }
        writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
    });   
}

function clearAllCards(set, channelID, verbose = false) {
    const channel = bot.channels.cache.get(channelID);
    let fileName = getFilename(set, channelID);
    try {
        writeToAWS(fileName, "[]");
        Log("Successfully cleared file " + fileName + ".");
        if (verbose) channel.send("Successfully cleared file for set with code " + set + ".");
    } catch(error) {
        if (verbose) channel.send("Something went wrong with clearing file for set with code " + set + ".");
        Log("Something went wrong with clearing file for set with code " + set + ".");
        Log('ERROR: ' + error);
    }
}

function Log(message) {
    var today = new Date();
    console.log(today.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }) + " - " + message);
}
