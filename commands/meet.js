module.exports = {
    name: 'meet',
    description: 'Meeting manager',
    
    execute: function(stuff) {
        if (stuff.args[0] == 'add') {
            if (stuff.args.length >= 4) {
                const chronoRes = stuff.chronode.parse(stuff.args[3]);

                if (chronoRes.length == 0) {
                    stuff.sendError(stuff.message.channel, 'Unable to find a valid date in "' + stuff.args[3] + '"');
                    return;
                }

                const startDate = chronoRes[0].start;
                const endDate = chronoRes[0].end;

                const options = {
                    url: 'https://nominatim.openstreetmap.org/search?q=' + encodeURI(stuff.args[2]) + '&format=geocodejson&addressdetails=1',
                    headers: {
                        'User-Agent': 'LifeMeet 0.1'
                    }
                };
                
                stuff.request(options, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        try {
                            const responseObj = JSON.parse(body);
                            if (responseObj.hasOwnProperty('features') && responseObj.features.length > 0) {
                                if (responseObj.features.length == 1) {
                                    const actualFeature = responseObj.features[0];
                                    
                                    if (actualFeature.hasOwnProperty('geometry') && actualFeature.geometry.hasOwnProperty('coordinates')) {  
                                        module.exports.addMeeting(stuff, stuff.args[1], actualFeature, startDate, endDate, stuff.message.author.id, 0);
                                    } else {
                                        stuff.sendError(stuff.dbObjects.UpcomingMeetings, stuff.message.channel, 'Unable to get GPS data from this place.')
                                    }
                                } else {
                                    var choiceTexts = [];
                                    for (i = 0; i < responseObj.features.length; i++) {
                                        const actualFeature = responseObj.features[i];
                                        if (actualFeature.hasOwnProperty('properties') && actualFeature.properties.hasOwnProperty('geocoding') && actualFeature.properties.geocoding.hasOwnProperty('label')) {
                                            choiceTexts.push(actualFeature.properties.geocoding.label);
                                        }
                                    }
                                    
                                    stuff.choiceMan.addChoice(stuff.message.author.id, new stuff.choice(responseObj.features.length.toString() + ' matches for query "' + stuff.args[2] + '"', choiceTexts, responseObj.features, function(option, data) {
                                        if (data[option].hasOwnProperty('geometry') && data[option].geometry.hasOwnProperty('coordinates')) {  
                                            module.exports.addMeeting(stuff, stuff.args[1], data[option], startDate, endDate, stuff.message.author.id, 0);
                                        } else {
                                            stuff.sendError(stuff.message.channel, 'Unable to get GPS data from this place.')
                                        }
                                    }));
                                    stuff.choiceMan.sendChoicesToChannel(stuff.discord, stuff.message.channel, stuff.prefix, stuff.message.author.id);
                                }
                            } else {
                                stuff.sendError(stuff.message.channel, 'No place found for query "' + stuff.args[2] + '"');
                            }
                        } catch (e) {
                            stuff.sendError(stuff.message.channel, "Error while parsing response: " + e);
                        }
                    } else {
                        if (error) {
                            stuff.sendError(stuff.message.channel, "An error has occured: " + error.toString());
                        } else {
                            stuff.sendError(stuff.message.channel, "An unknown error has occured: HTTP " + response.statusCode.toString());
                        }
                    }
                });
            } else {
                stuff.sendUsage(stuff.message.channel, this.name + ' add', '[name] [location] [start _(and end)_ date]');
            }
        } else if (stuff.args[0] == 'list') {
            stuff.dbObjects.UpcomingMeetings.findAll({
                limit: 10,
                order: [[stuff.dbObjects.sequelize.col('start_time'), stuff.args[1] == 'desc' ? 'DESC' : 'ASC']]
            }).then(upcomingMeetings => {
                for (i = 0; i < upcomingMeetings.length; i++) {
                    stuff.message.reply(upcomingMeetings[i].dataValues.id);
                }
            });
        } else if (stuff.args.length == 0) {
            stuff.sendUsage(stuff.message.channel, this.name, ['add [name] [location] [start _(and end)_ date]', 'list _(asc/desc)_']);
        } else {
            stuff.sendError(stuff.message.channel, 'Unknown option: **' + stuff.args[0] + '**');
        }
    },

    addMeeting: function(stuff, name, feature, startDate, endDate, ownerId, joinLimit) {
        endTime = null;
        if (endDate) {
            endTime = endDate.date().getTime() / 1000;
        }

        stuff.dbObjects.UpcomingMeetings.create({name: name,
            start_time: startDate.date().getTime() / 1000,
            end_time: endTime,
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            owner_id: ownerId,
            join_limit: joinLimit,
            location_name: feature.properties.geocoding.label,
            location_name_short: feature.properties.geocoding.name});
        
        stuff.message.reply('ok');
    },
};