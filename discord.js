const Discord = require('discord.js');
const { token, prefix, ticketCategory, autoroleId } = require('./config.json');
const logChannelId = 'LOG_CHANNEL_ID';
const welcomeChannelId = `Welcome_Channel_ID`;
const { permissions } = require(`discord.js`);


const client = new Discord.Client({ 
    intents: [
        Discord.Intents.FLAGS.GUILDS, 
        Discord.Intents.FLAGS.GUILD_MESSAGES, 
        Discord.Intents.FLAGS.GUILD_MEMBERS 
    ] 
});
const cooldowns = new Map();
const activeTickets = new Map();


client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('guildBanAdd', (guild, user) => {
    logAction('ban', client.user, user, 'No reason provided', logChannelId);
});

client.on('guildMemberRemove', member => {
    logAction('kick', client.user, member.user, 'No reason provided', logChannelId);
});

client.on('guildMemberAdd', async member => {
    console.log(`New member joined: ${member.user.tag}`);

    try {
        const autoroleIds = require('./config.json').autoroleIds;
        for (const autoroleId of autoroleIds) {
            const role = await member.guild.roles.fetch(autoroleId);
            if (!role) {
                console.error(`Role with ID ${autoroleId} not found.`);
                continue;
            }

            await member.roles.add(role);
            console.log(`Assigned role ${role.name} to ${member.user.tag}`);
        }
    } catch (error) {
        console.error('Error assigning autoroles:', error);
        if (error.message.includes('Missing Permissions')) {
            console.error('The bot does not have permission to manage roles. Please ensure the bot has the MANAGE_ROLES permission.');
        }
        if (error.message.includes('Hierarchy')) {
            console.error('Role hierarchy issue: the bot\'s role must be higher than the roles it is trying to assign.');
        }
    }
});

client.on('messageCreate', message => {
    if (!message.guild || message.author.bot) return;

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'crayon') {
        message.reply(`${message.author.tag} likes crayons`);
    } else if (command === 'cache') {
        if (!message.member.permissions.has('MUTE_MEMBERS')) {
            return message.reply('You do not have permission to use this command.');
        }
        message.channel.send('> 1 . Navigate to your FiveM Application Data Folder \n **(WIN + R %localappdata% and press enter)**');
        message.channel.send('> Navigate to the folder named FiveM and open the "FiveM Application Data" folder\n');
        message.channel.send('> Navigate to "Data" and delete "Server-cache" and "server-cache-priv"\n');
        message.channel.send('https://imgur.com/znRSOx9');
    } else if (command === 'crazy4guts') {
        if (!message.member.permissions.has('ADMINISTRATOR')) return;
        message.channel.send('Crazy4Guts is a hater. Laugh at this guy! <@687852791099949107>');
    } else if (command === 'kick') {
        if (!message.member.permissions.has('KICK_MEMBERS')) {
            return message.reply('You do not have permission to kick members.');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Please mention a valid member of this server.');
        }

        if (!member.kickable) {
            return message.reply('I cannot kick this user! Do they have a higher role? Do I have kick permissions?');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        member.kick(reason)
            .then(() => {
                message.reply(`${member.user.tag} has been kicked by ${message.author.tag} because: ${reason}`);
                logAction('kick', message.author, member.user, reason, logChannelId);
            })
            .catch(error => {
                console.error(error);
                message.reply('There was an error trying to kick this member!');
            });
            
        } else if (command === 'purge') {

            if (!message.member.permissions.has('MANAGE_MESSAGES')) {
                return message.reply('You do not have permission to delete messages.');
            }
        

            const amount = parseInt(args[0]);

            if (isNaN(amount)) {
                return message.reply('Please provide a valid number of messages to delete.');
            }
            
            if (amount < 1 || amount > 50) {
                return message.reply('You can only delete between 1 and 50 messages at a time.');
            }
        

            message.channel.bulkDelete(amount + 1)
                .then(() => {
                    message.channel.send(`Successfully deleted ${amount} messages.`)
                        .then(msg => {

                            setTimeout(() => msg.delete(), 5000);
                        });
                })
                .catch(error => {
                    console.error('Error purging messages:', error);
                    message.reply('There was an error deleting the messages.');
                });
    } else if (command === 'warn') {
        if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.reply('You do not have permission to warn members.');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Please mention a valid member of this server.');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        message.channel.send(`${member.user.tag} has been warned by ${message.author.tag} because: ${reason}`);
        logAction('warn', message.author, member.user, reason, logChannelId);
    } else if (command === 'ban') {
        if (!message.member.permissions.has('BAN_MEMBERS')) {
            return message.reply('You do not have permission to ban members.');
        }

        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('Please mention a valid member of this server.');
        }

        if (!member.bannable) {
            return message.reply('You cannot ban this user!');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        member.ban({ reason })
            .then(() => {
                message.reply(`${member.user.tag} has been banned by ${message.author.tag} because: ${reason}`);
                logAction('ban', message.author, member.user, reason, logChannelId);
            })
            .catch(error => {
                console.error(error);
                message.reply('There was an error trying to ban this member!');
            });
    } else if (command === 'ticket') {
        if (cooldowns.has(message.author.id)) {
            if (activeTickets.has(message.author.id))   {
                message.reply(`You Already Have An Active Ticket.`);
                return;
            }
            const expirationTime = cooldowns.get(message.author.id);
            if (Date.now() < expirationTime) {
                message.reply('Please wait before creating another ticket.');
                return;
            }
        }

        cooldowns.set(message.author.id, Date.now() + 60000);

        let category = message.guild.channels.cache.find(c => c.type === 'GUILD_CATEGORY' && c.name === ticketCategory);
        if (!category) {
            if (!ticketCategory) {
                return message.reply('Ticket category name is not provided in the config.');
            }
            message.guild.channels.create(ticketCategory, { type: 'GUILD_CATEGORY' })
                .then(createdCategory => {
                    category = createdCategory;
                    createTicket(message, category);
                })
                .catch(error => {
                    console.error('Error creating ticket category:', error);
                    message.reply('There was an error creating the ticket category. Please try again later.');
                });
        } else {
            createTicket(message, category);
        }
    } else if (command === 'close') {
        if (!activeTickets.has(message.author.id)) {
            return message.reply('You do not have an active ticket to close.');
        }

        const ticketChannelId = activeTickets.get(message.author.id);
        if (message.channel.id !== ticketChannelId) {
            return message.reply('You can only close your active ticket.');
        }

        message.channel.delete()
            .then(() => {
                activeTickets.delete(message.author.id);
            })
            .catch(error => {
                console.error('Error deleting ticket channel:', error);
                message.reply('There was an error closing the ticket. Please try again later.');
            });
    }
});

function logAction(action, moderator, user, reason, logChannelId) {
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) {
        console.error('Log channel not found. Make sure the logChannelId in config.json is correct.');
        return;
    }

    const timestamp = new Date().toLocaleString();
    const logString = `> **------------------------------**\n`
                    + `> **${action.toUpperCase()}** - ${timestamp}\n`
                    + `> **User**: ${user.tag} (${user.id})\n`
                    + `> **Moderator**: ${moderator.tag} (${moderator.id})\n`
                    + `> **Reason**: ${reason}`;

    logChannel.send(logString)
        .catch(error => console.error('Error sending log message:', error));
}

function createTicket(message, category) {
    const channelName = `ticket-${message.author.username}`;
    message.guild.channels.create(channelName, {
        type: 'GUILD_TEXT',
        parent: category,
        permissionOverwrites: [
            {
                id: message.author.id,
                allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'ATTACH_FILES']
            },
            {
                id: message.guild.roles.everyone.id,
                deny: ['VIEW_CHANNEL']
            }
        ]
    })
    .then(channel => {
        channel.send(`Ticket created by ${message.author}`);
        activeTickets.set(message.author.id, channel.id);
        client.on('channelDelete', deletedChannel => {
            if (deletedChannel.id === channel.id) {
                activeTickets.delete(message.author.id);
            }
        });
    })
    .catch(error => {
        console.error('Error creating ticket channel:', error);
        message.reply('There was an error creating the ticket channel. Please try again later.');
    });
}

client.login(token);
