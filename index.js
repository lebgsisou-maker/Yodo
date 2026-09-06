const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

const serverSettings = new Map(); 
const pendingCaptchas = new Map();

const translations = {
    fr: {
        helpTitle: "📜 Centre d'Aide - Yodo Protect",
        helpDesc: "Voici la liste officielle des commandes :",
        configTitle: "⚙️ Panneau de Configuration",
        langSet: "✅ Langue configurée en **Français** !"
    },
    en: {
        helpTitle: "📜 Help Center - Yodo Protect",
        helpDesc: "Here is the official command list:",
        configTitle: "⚙️ Configuration Panel",
        langSet: "✅ Language successfully set to **English**!"
    },
    es: {
        helpTitle: "📜 Centro de Ayuda - Yodo Protect",
        helpDesc: "Aquí está la lista oficial de comandos:",
        configTitle: "⚙️ Panel de Configuración",
        langSet: "✅ ¡Idioma configurado en **Español**!"
    },
    it: {
        helpTitle: "📜 Centro Assistenza - Yodo Protect",
        helpDesc: "Ecco l'elenco ufficiale dei comandi:",
        configTitle: "⚙️ Pannello di Configurazione",
        langSet: "✅ Lingua impostata con successo in **Italiano**!"
    }
};

function getT(guildId, key) {
    const settings = serverSettings.get(guildId) || { lang: 'fr' };
    const lang = settings.lang || 'fr';
    return translations[lang][key] || translations['fr'][key];
}

function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([dhmsw])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'w': return value * 7 * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function generateCaptchaCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Ouvrir le panneau de configuration')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('antiraid')
            .setDescription('Activer ou désactiver l\'Anti-Raid et l\'Anti-Nuke')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Lancer un giveaway (ex: 30m, 2h, 1d)')
            .addStringOption(option => option.setName('lot').setDescription('Le lot à gagner').setRequired(true))
            .addStringOption(option => option.setName('duree').setDescription('Durée (ex: 30m, 2h, 1d)').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('sanction')
            .setDescription('Sanctionner un membre (mute, kick, ban)')
            .addUserOption(option => option.setName('membre').setDescription('Membre à sanctionner').setRequired(true))
            .addStringOption(option => 
                option.setName('type')
                    .setDescription('Type de sanction')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Mute', value: 'mute' },
                        { name: 'Kick', value: 'kick' },
                        { name: 'Ban', value: 'ban' }
                    )
            )
            .addStringOption(option => option.setName('raison').setDescription('Raison').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('mp')
            .setDescription('Envoyer un MP à un utilisateur (Réservé aux Fondateurs)')
            .addUserOption(option => option.setName('utilisateur').setDescription('Utilisateur').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message').setRequired(true))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('captcha')
            .setDescription('Activer ou désactiver le Captcha')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher l\'aide')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[COMMANDES] Enregistrées avec succès !');
    } catch (error) {
        console.error('[ERREUR COMMANDES]', error);
    }
});

client.on('guildCreate', async (guild) => {
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
    if (!channel) return;

    serverSettings.set(guild.id, { lang: 'fr', antiRaidActive: false, antiNukeActive: true, captchaActive: false });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛡️ Bienvenue avec Yodo Protect ! 🛡️')
        .setDescription('Salut ! Je suis **Yodo**, ton bouclier de sécurité.\n\n• Tape `/config` pour gérer les paramètres.')
        .setColor('#5865F2')
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { 
        lang: 'fr', 
        antiRaidActive: false, 
        antiNukeActive: true, 
        captchaActive: false 
    };
    serverSettings.set(interaction.guildId, settings);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'helpTitle'))
                .setDescription(getT(interaction.guildId, 'helpDesc'))
                .addFields(
                    { name: '/config', value: 'Panneau de configuration' },
                    { name: '/antiraid', value: 'Anti-Raid & Anti-Nuke' },
                    { name: '/giveaway', value: 'Lancer un giveaway' },
                    { name: '/sanction', value: 'Sanctionner un membre' },
                    { name: '/mp', value: 'Envoyer un MP (Fondateur)' },
                    { name: '/captcha', value: 'Activer/Désactiver le Captcha' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'mp') {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: '❌ Réservé au propriétaire (fondateur) du serveur.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('utilisateur');
            const msgContent = interaction.options.getString('message');

            try {
                await targetUser.send(`📬 **Message de la direction de ${interaction.guild.name}** :\n\n${msgContent}`);
                return interaction.reply({ content: `✅ Message privé envoyé à **${targetUser.tag}** !`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: `❌ Impossible d'envoyer le MP (ses messages privés sont fermés).`, ephemeral: true });
            }
        }

        if (commandName === 'sanction') {
            const targetMember = interaction.options.getMember('membre');
            const type = interaction.options.getString('type');
            const reason = interaction.options.getString('raison') || 'Aucune raison';

            try {
                if (type === 'mute') {
                    await targetMember.timeout(15 * 60 * 1000, reason);
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** muté 15 minutes. Raison : *${reason}*`, ephemeral: true });
                } else if (type === 'kick') {
                    await targetMember.kick(reason);
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** expulsé. Raison : *${reason}*`, ephemeral: true });
                } else if (type === 'ban') {
                    await targetMember.ban({ reason: reason });
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** banni. Raison : *${reason}*`, ephemeral: true });
                }
            } catch (e) {
                return interaction.reply({ content: `❌ Erreur de permissions pour appliquer la sanction.`, ephemeral: true });
            }
        }

        if (commandName === 'captcha') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }
            settings.captchaActive = !settings.captchaActive;
            return interaction.reply({ 
                content: settings.captchaActive ? '🛡️ **Captcha activé !**' : '⚠️ **Captcha désactivé.**', 
                ephemeral: true 
            });
        }

        if (commandName === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'configTitle'))
                .setDescription('Paramètres du bot')
                .addFields(
                    { name: '🌐 Langue', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Captcha', value: settings.captchaActive ? '🟢 Actif' : '🔴 Inactif', inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_lang_menu')
                .setPlaceholder('Choisir la langue...')
                .addOptions([
                    { label: 'Français 🇫🇷', value: 'lang_fr' },
                    { label: 'English 🇬🇧', value: 'lang_en' },
                    { label: 'Español 🇪🇸', value: 'lang_es' },
                    { label: 'Italiano 🇮🇹', value: 'lang_it' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'antiraid') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            settings.antiRaidActive = !settings.antiRaidActive;
            return interaction.reply({ 
                content: settings.antiRaidActive ? '🚨 **Anti-Raid ACTIVÉ !**' : '✅ **Anti-Raid DÉSACTIVÉ.**', 
                ephemeral: true 
            });
        }

        if (commandName === 'giveaway') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const lot = interaction.options.getString('lot');
            const dureeStr = interaction.options.getString('duree');
            const durationMs = parseDuration(dureeStr);

            if (!durationMs) {
                return interaction.reply({ content: '❌ Format invalide ! Exemples : `30m`, `2h`, `1d`, `1w`.', ephemeral: true });
            }

            const participants = new Set();
            const endTime = Date.now() + durationMs;

            const giveawayEmbed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY EN COURS ! 🎉')
                .setDescription(`Lot : **${lot}**\n⏱️ Fin dans : **${dureeStr}**\n👥 Participants : **0**\n\nClique pour participer !`)
                .setColor('#fEE75C')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('participate_gw').setLabel('Participer 🎉').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_gw').setLabel('Participants 📋').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });

            const interval = setInterval(async () => {
                const timeLeft = endTime - Date.now();
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    return;
                }
                const minutesLeft = Math.ceil(timeLeft / (60 * 1000));
                let timeText = `${minutesLeft} minutes`;
                if (minutesLeft >= 60) {
                    const hoursLeft = (minutesLeft / 60).toFixed(1);
                    timeText = `${hoursLeft} heures`;
                }

                giveawayEmbed.setDescription(`Lot : **${lot}**\n⏱️ Fin dans : **~${timeText}**\n👥 Participants : **${participants.size}**\n\nClique pour participer !`);
                await message.edit({ embeds: [giveawayEmbed] }).catch(() => {});
            }, 15000);

            const collector = message.createMessageComponentCollector({ time: durationMs });

            collector.on('collect', async i => {
                if (i.customId === 'participate_gw') {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: '❌ Tu participes déjà !', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    return i.reply({ content: '✅ Participation enregistrée !', ephemeral: true });
                }
                if (i.customId === 'view_gw') {
                    if (participants.size === 0) return i.reply({ content: '📋 Aucun participant.', ephemeral: true });
                    const list = Array.from(participants).map(id => `<@${id}>`).join(', ');
                    return i.reply({ content: `📋 **Participants (${participants.size}) :** ${list}`, ephemeral: true });
                }
            });

            collector.on('end', async () => {
                clearInterval(interval);
                const endedEmbed = new EmbedBuilder()
                    .setTitle('🎉 GIVEAWAY TERMINÉ ! 🎉')
                    .setColor('#ed4245')
                    .setTimestamp();

                if (participants.size === 0) {
                    endedEmbed.setDescription(`Lot : **${lot}**\n\n❌ Aucun participant.`);
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('end').setLabel('Terminé').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                    return message.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                }

                const arr = Array.from(participants);
                const winnerId = arr[Math.floor(Math.random() * arr.length)];

                endedEmbed.setDescription(`Lot : **${lot}**\n\n🏆 **Gagnant :** <@${winnerId}> !\nFélicitations ! 🎉`);
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('end').setLabel('Terminé').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );

                await message.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                message.channel.send(`🎉 Félicitations à <@${winnerId}> qui remporte le lot : **${lot}** !`);
            });
            return;
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'config_lang_menu') {
        const choice = interaction.values[0];
        if (choice === 'lang_fr') settings.lang = 'fr';
        if (choice === 'lang_en') settings.lang = 'en';
        if (choice === 'lang_es') settings.lang = 'es';
        if (choice === 'lang_it') settings.lang = 'it';

        return interaction.update({ content: getT(interaction.guildId, 'langSet'), components: [], embeds: [] });
    }
});

client.on('guildMemberAdd', async member => {
    const settings = serverSettings.get(member.guild.id) || { antiRaidActive: false, captchaActive: false };

    if (settings.antiRaidActive) {
        try {
            await member.send("⚠️ Serveur en verrouillage Anti-Raid.").catch(() => {});
            await member.kick('Anti-Raid actif.');
        } catch (e) {}
        return;
    }

    if (settings.captchaActive) {
        const captchaCode = generateCaptchaCode();
        pendingCaptchas.set(member.id, { code: captchaCode, guildId: member.guild.id });

        try {
            await member.send(`🔒 **Vérification de sécurité (Captcha)**\nPour accéder au serveur **${member.guild.name}**, écris ce code exact : **${captchaCode}**`);
        } catch (e) {
            console.error("Impossible d'envoyer le captcha en MP :", e);
        }
    }
});

client.on('messageCreate', async message => {
    if (message.guild || message.author.bot) return;

    for (const [userId, data] of pendingCaptchas.entries()) {
        if (message.author.id === userId) {
            if (message.content.trim().toUpperCase() === data.code) {
                pendingCaptchas.delete(userId);

                try {
                    const guild = await client.guilds.fetch(data.guildId);
                    const member = await guild.members.fetch(userId);
                    const roleMembre = guild.roles.cache.find(r => r.name.toLowerCase() === 'membre');

                    if (roleMembre) {
                        await member.roles.add(roleMembre);
                    }
                } catch (err) {
                    console.error("Erreur attribution rôle après captcha :", err);
                }

                return message.reply('✅ **Merci !** Captcha validé avec succès. Tu as maintenant accès à tous les salons du serveur ! 🎉');
            } else {
                return message.reply('❌ Code incorrect, réessaie.');
            }
        }
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const settings = serverSettings.get(newMember.guild.id);
    if (settings && settings.antiRaidActive) {
        if (newMember.id === newMember.guild.ownerId) return;

        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0) {
            try {
                await newMember.roles.remove(addedRoles);
            } catch (e) {}
        }
    }
});

client.login(process.env.TOKEN);
                             
