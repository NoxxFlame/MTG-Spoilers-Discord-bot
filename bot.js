const discord = require('discord.js');
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
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
    "0":"mana0:960695917407776808",
    "1":"mana1:960695917441335296",
    "2":"mana2:960695917453910026",
    "3":"mana3:960695917449715772",
    "4":"mana4:960695917844000768",
    "5":"mana5:960695917088997427",
    "6":"mana6:960695917508431902",
    "7":"mana7:960695917470703626",
    "8":"mana8:960695917462298644",
    "9":"mana9:960695917592342558",
    "10":"mana10:960695917462315098",
    "11":"mana11:960695917500067890",
    "12":"mana12:960695917663637594",
    "13":"mana13:960695917260988467",
    "14":"mana14:960695917495844985",
    "15":"mana15:960695917588140102",
    "16":"mana16:960695917546176562",
    "17":"mana17:960695917562974348",
    "18":"mana18:960695917646868521",
    "19":"mana19:960695917579751435",
    "20":"mana20:960695917630066758",
    "w":"manaw:960695990061522975",
    "u":"manau:960695990149595196",
    "b":"manab:960695990078308433",
    "r":"manar:960695990132822077",
    "g":"manag:960695990250242088",
    "c":"manac:960696003990806578",
    "wu":"manawu:960696078003499019",
    "wb":"manawb:960696078141886514",
    "ub":"manaub:960696077449842709",
    "ur":"manaur:960696077890252810",
    "br":"manabr:960696077667958834",
    "bg":"manabg:960696077605036082",
    "rg":"manarg:960696077999296522",
    "rw":"manarw:960696078410326096",
    "gw":"managw:960696077806350347",
    "gu":"managu:960696077655363624",
    "wp":"manawp:960695357719855124",
    "up":"manaup:960695357917003776",
    "bp":"manabp:960695357824704552",
    "rp":"manarp:960695357698883634",
    "gp":"managp:960695357833117767",
    "wup":"manawup:960695394013155388",
    "wbp":"manawbp:960695393933475931",
    "ubp":"manaubp:960695393929269308",
    "urp":"manaurp:960695393912512562",
    "brp":"manabrp:960695393853788160",
    "bgp":"manabgp:960695393845391370",
    "rgp":"manargp:960695394315157514",
    "rwp":"manarwp:960695394243866644",
    "gwp":"managwp:960695393912496158",
    "gup":"managup:960695393866366986",
    "2w":"mana2w:960696126309294130",
    "2u":"mana2u:960696126464458872",
    "2b":"mana2b:960696126103769130",
    "2r":"mana2r:960696126271537192",
    "2g":"mana2g:960696126200242226",
    "x":"manax:960696172387917824",
    "y":"manay:960696172257878076",
    "z":"manaz:960696172425670666",
    "t":"manat:960696204361084988",
    "q":"manaq:960696204331728926",
    "s":"manas:960696236355248168",
    "e":"manae:960689226922463232",
    "a":"manaa:960692260486381649",
    "chaos":"manachaos:960689226830184488"
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
    
    if (card.card_faces && (card.layout === 'transform' || card.layout === 'modal_dfc')) {
        if (card.card_faces[0].mana_cost) {
            title += ' ' + card.card_faces[0].mana_cost;
        }
        
        if (card.layout === 'modal_dfc' && card.card_faces[1].mana_cost) {
            title += ' // ' + card.card_faces[1].mana_cost;
        }
        card.image_uris = card.card_faces[0].image_uris;
    }
    
    let description = generateDescriptionText(card);
    if(hasEmojiPermission) {
        title = _.truncate(renderEmojis(title), {length: 256, separator: '<'});
        description = renderEmojis(description);
    }
    
    const embed = {
        title,
        description,
        url: card.scryfall_uri,
        color: getBorderColor(card.layout === 'transform' || card.layout === 'modal_dfc' ? card.card_faces[0]:card),
        thumbnail: card.image_uris ? {url: card.image_uris.small} : null,
        image: card.zoom && card.image_uris ? {url: card.image_uris.normal} : null
    };

    if (card.prices.usd) {
        embed.addField('Prices', '$' + card.prices.usd);
    } else {
        embed.addField('Prices', 'No prices found');
    }
    
    return embed;
}
    
function Log(message) {
    var today = new Date();
    console.log(today.toLocaleString("en-GB", {timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'})
                + ' ' + today.toLocaleString("en-US", {timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit'})
                + " - " + message);
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
            Log("ERROR: " + err);
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
        if (err) Log("ERROR: " + err);
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
            Log("Creating file " + fileName);
            writeToAWS(fileName, "[]");
        } else {
            try {
                savedCardlist = JSON.parse(Buffer.from(ret).toString());
                Log("Successfully read file " + fileName);
            } catch(error) {
                Log("ERROR: Something went wrong with parsing data from existing saved file");
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
                    Log("ERROR: Something went wrong with parsing data from Scryfall");
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
                                Log('Done with sending cards to channel');
                                clearInterval(interval);
                            } else {
                                let card = cards.pop();
                                var embed = generateEmbed(card, true);
                                Log('Sending ' + card.name + ' to channel');
                                channel.send({embeds: [embed]});
                            }
                        }, 1000, newCardlist);

                        try {
                            let savedCardlistJSON = JSON.stringify(savedCardlist);
                            writeToAWS(fileName, savedCardlistJSON);
                        } catch(error) {
                            Log("ERROR: Something went wrong with saving new data");
                            Log("ERROR: " + error);
                            return;
                        }
                    }
                } else {
                    Log('Did not find any cards with set code ' + set);
                    if (verbose) channel.send('Did not find any cards with set code ' + set + '.');
                }
            });
        }).on("error", (err) => {
            Log("Error: " + err.message);
            channel.send('Error trying to get cards with set code ' + set + './n' + 'Check the console for more details.');
        });
    });
}

function getAllCardsWrapper(set, message, verbose) {
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
        getAllCards(set, message.channel.id, verbose);
    } else {
        message.channel.send("You do not have permission to use that command.");
    }
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
            Log("Successfully read file " + WATCHEDSETCODESPATH);
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
function startSpoilerWatch(set, message, verbose = false) {
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
        const channelID = message.channel.id;
        const channel = bot.channels.cache.get(channelID);
        Log('Start looking for new cards in set ' + set + ' for channel ' + channelID)
        if (verbose) channel.send('Starting spoilerwatch for set ' + set + '.');
        getAllCards(set, channelID);
        readFromAWS(WATCHEDSETCODESPATH, function(ret) {
            let watchedSetcodes = [];
            if (ret) {
                watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
                Log("Successfully read file " + WATCHEDSETCODESPATH);
            }
            watchedSetcodes.push({"setCode":set, "channelID":channelID});
            writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
        });
    } else {
        message.channel.send("You do not have permission to use that command.");
    }
}

//Stop the interval to look for new cards for the given set and channelID
function stopSpoilerWatch(set, message, verbose = false) {
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
        const channelID = message.channel.id;
        const channel = bot.channels.cache.get(channelID);
        readFromAWS(WATCHEDSETCODESPATH, function(ret) {
            let watchedSetcodes = [];
            if (ret) {
                watchedSetcodes = JSON.parse(Buffer.from(ret).toString());
                Log("Successfully read file " + WATCHEDSETCODESPATH);
            }
            let found = -1;
            watchedSetcodes.forEach(function(watchedset) {
                if (watchedset.setCode == set && watchedset.channelID == channelID) {
                    found = watchedSetcodes.indexOf(watchedset);
                }
            });
            if (found > -1) {
                Log('Stopping looking for new cards in set ' + set + ' for channel ' + channelID)
                if (verbose) channel.send('Stopping spoilerwatch for set ' + set + '.');
                watchedSetcodes.splice(found, 1);
            } else {
                Log('Could not stop looking for new cards in set ' + set + ' for channel ' + channelID)
                if (verbose) channel.send('Could not stop spoilerwatch for set ' + set + '.');
            }
            writeToAWS(WATCHEDSETCODESPATH, JSON.stringify(watchedSetcodes));
        });   
    } else {
        message.channel.send("You do not have permission to use that command.");
    }
}

function clearAllCards(set, message, verbose = false) {
    if (message.member.permissions.has("MANAGE_MESSAGES")) {
        const channelID = message.channel.id;
        const channel = bot.channels.cache.get(channelID);
        let fileName = getFilename(set, channelID);
        try {
            writeToAWS(fileName, "[]");
            Log("Successfully cleared file " + fileName);
            if (verbose) channel.send("Successfully cleared file for set with code " + set + ".");
        } catch(error) {
            if (verbose) channel.send("Something went wrong with clearing file for set with code " + set + ".");
            Log("ERROR: Something went wrong with clearing file for set with code " + set);
            Log('ERROR: ' + error);
        }
    } else {
        message.channel.send("You do not have permission to use that command.");
    }
}

function getBestCard(oracleID, channel) {
    https.get('https://api.scryfall.com/cards/search?order=spoiled&q=' + encodeURIComponent(query + " oracle_id=" + oracleID + ' include:extras') + '&unique=prints', (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
            data += chunk;
        });   
        
        resp.on('end', () => {
            let cardlist;
            try {
                cardlist = JSON.parse(data);
            } catch(error) {
                Log("ERROR: Something went wrong with parsing data from Scryfall");mber
                Log('ERROR:' + error);
                return;
            }

            if (cardlist.object == 'list' && cardlist.total_cards > 0) {
                Log(cardlist.total_cards + ' cards were found with oracle ID ' + oracleID);
                for (let card in cardlist) { // First look for cards with prices matching restrictions
                    if (cardlist[card].object != "card") continue;
                    if (!cardlist[card].prices.usd) continue; // Ignore cards without prices
                    if (cardlist[card].frame == "1997" && parseInt(cardlist[card].released_at.substring(0,4),10) > 2010) continue; // Ignore old showcase frames
                    if (cardlist[card].set == "sld") continue; // Ignore secret lairs
                    if (cardlist[card].frame_effects) { // Ignore other showcase frames
                        if (cardlist[card].frame_effects.includes("showcase")) continue;
                        if (cardlist[card].frame_effects.includes("extendedart")) continue;
                        if (cardlist[card].frame_effects.includes("etched")) continue;
                    }
                    if (cardlist[card].security_stamp) { // Ignore universes beyond
                        if (cardlist[card].security_stamp == "triangle") continue;
                    }
                    var embed = generateEmbed(cardlist[card], true);
                    channel.send({embeds: [embed]});
                    return;
                }

                for (let card in cardlist) { // Next look for cards with prices ignoring restrictions
                    if (cardlist[card].object != "card") continue;
                    if (!cardlist[card].prices.usd) continue; // Ignore cards without prices
                    var embed = generateEmbed(cardlist[card], true);
                    channel.send({embeds: [embed]});
                    return;
                }

                for (let card in cardlist) { // Finally find cards without prices
                    if (cardlist[card].object != "card") continue;
                    var embed = generateEmbed(cardlist[card], true);
                    channel.send({embeds: [embed]});
                    return;
                }
            } else {
                Log('Did not find any cards with oracle ID ' + oracleID);
            }
        });
    }).on("error", (err) => {
        Log("Error: " + err.message);
        channel.send('Error trying to get cards with oracle ID ' + oracleID + './n' + 'Check the console for more details.');
    });
}

function getCard(query, message, verbose = false) {
    if (!query) return;
    const channelID = message.channel.id;
    const channel = bot.channels.cache.get(channelID);
    const cardQuery = query.toLowerCase();
    https.get('https://api.scryfall.com/cards/search?order=spoiled&q=' + encodeURIComponent(query + ' include:extras') + '&unique=prints', (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
            data += chunk;
        });   
        
        resp.on('end', () => {
            let cardlist;
            try {
                cardlist = JSON.parse(data);
            } catch(error) {
                Log("ERROR: Something went wrong with parsing data from Scryfall");
                Log('ERROR:' + error);
                return;
            }

            if (cardlist.object == 'list' && cardlist.total_cards > 0) {
                Log(cardlist.total_cards + ' cards were found that matched the query ' + query);
                let oracleIDs = [];
                let options = [];
                for (let card in cardlist) {
                    if (cardlist[card].object != "card") continue;
                    if (oracleIDs.includes(cardlist[card].oracle_id)) continue;
                    oracleIDs.push(cardlist[card].oracle_id);
                    options.push({"label":cardlist[card].name,"value":cardlist[card].oracle_id});
                }
                console.log(options);

                if (oracleIDs.length == 1) {
                    getBestCard(query, options[0], channel)
                } else if (oracleIDs.length > 1) {
                    let row = new MessageActionRow()
                        .addComponents(
                            new MessageSelectMenu()
                                .setCustomId('cardSelect')
                                .setPlaceholder('Select a card')
                                .addOptions(options)
                        );
                    channel.send({"content":"Multiple cards found. Please select a card that matches the query: "+query,"components":[row]})
                }
            } else {
                Log('Did not find any cards that matched the query ' + query);
                if (verbose) channel.send('Did not find any cards that matched the query "' + query + '".');
            }
        });
    }).on("error", (err) => {
        Log("Error: " + err.message);
        channel.send('Error trying to get cards that matched the query ' + query + './n' + 'Check the console for more details.');
    });
}


// Initialize discord Bot
Log('Initializing bot...');
var bot = new discord.Client({ intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES]});

try {
    bot.login(process.env.DISCORD_TOKEN);
} catch(err) {
    Log(err);
}

// When bot is ready
bot.on('ready', function (evt) {
    Log('Connected!');
    readWatchedSets();
    setInterval(function() {
        readWatchedSets()}, SPOILERWATCHINTERVALTIME);
});

// Commands
const commands = {
    card: {
        inline: true,
        handler: getCard
    },
    //rulings: {
    //    inline: true,
    //    handler: getRulings
    //},
    //art: {
    //    inline: true,
    //    handler: getArt
    //},
    getall: {
        inline: false,
        handler: getAllCardsWrapper
    },
    watch: {
        inline: false,
        handler: startSpoilerWatch
    },
    unwatch: {
        inline: false,
        handler: stopSpoilerWatch
    },
    clear: {
        inline: false,
        handler: clearAllCards
    },
}

const commandChar = process.env.COMMAND_CHAR || "!";
const charPattern = _.escapeRegExp(commandChar);
const commandPattern = '(^|\\s)' + charPattern + '(' +
    Object.keys(commands).filter(cmd => commands[cmd].inline).map(_.escapeRegExp).join('|')
    + ')|^' + charPattern + '(' +
    Object.keys(commands).filter(cmd => !commands[cmd].inline).map(_.escapeRegExp).join('|')
    + ')';
const regExpPattern = `(${commandPattern})( .*?)?(${charPattern}[^a-z0-9]|$)`;
const regExpObject = new RegExp(regExpPattern, 'ig');

// When bot reads message
bot.on('messageCreate', async message => {
    const queries = message.content.match(regExpObject);

    if (queries && !message.author.bot) {
        queries.forEach(query => {
            const command = query.trim().split(" ")[0].substr(commandChar.length).toLowerCase();
            const parameter = query.trim().split(" ").slice(1).join(" ").replace(new RegExp(charPattern + '[^a-z0-9]?$', 'i'), '');
            const ret = commands[command].handler(parameter, message, true);
            Promise.resolve(ret).catch(e => Log('ERROR: An error occured while handling', message.content, ":", e.message));
        });
    }
});

// When a dropdown menu is used
bot.on('interactionCreate', async interaction => {
	if (!interaction.isSelectMenu()) return;

	if (interaction.customId === 'cardSelect') {
		getBestCard(interaction.message.content.substring(67), interaction.values, interaction.channel)
	}
});

// Reconnect if the bot is disconnected
bot.on('disconnect', function(errMsg, code) { 
    Log('ERROR: ' + code +': ' + errMsg);
    if (code === 1000) {
        bot.connect();
    }
});