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

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Ouvrir le panneau de configuration interactif (Admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('antiraid')
            .setDescription('Activer ou désactiver le mode verrouillage Anti-Raid et Anti-Nuke (Admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Lancer un giveaway avec une durée personnalisée')
            .addStringOption(option => 
                option.setName('lot')
                    .setDescription('Le lot à gagner')
                    .setRequired(true)
            )
            .addIntegerOption(option => 
                option.setName('duree')
                    .setDescription('Durée du giveaway en heures (ex: 24 pour 1 jour)')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher la liste des commandes et l\'aide de Yodo Protect')
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

// 1. EVENT : Bienvenue sur un nouveau serveur
client.on('guildCreate', async (guild) => {
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
    if (!channel) return;

    serverSettings.set(guild.id, { lang: 'fr', antiRaidActive: false, antiNukeActive: true, antiSpamLimit: 5 });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛡️ Bienvenue avec Yodo Protect ! 🛡️')
        .setDescription('Salut ! Je suis **Yodo**, votre bouclier de sécurité.\n\n' +
                          '• **Anti-Nuke, Anti-Spam & Verrouillage** prêts à l\'emploi.\n' +
                          '• Tapez `/config` pour gérer les paramètres ou `/help` pour l\'aide.')
        .setColor('#5865F2')
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

// 2. GESTION DES INTERACTIONS
client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { 
        lang: 'fr', 
        antiRaidActive: false, 
        antiNukeActive: true, 
        antiSpamLimit: 5 
    };
    serverSettings.set(interaction.guildId, settings);

    const isFr = settings.lang === 'fr';

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle(isFr ? '📜 Centre d\'Aide - Yodo Protect' : '📜 Help Center - Yodo Protect')
                .setDescription(isFr ? 'Voici la liste officielle des commandes :' : 'Here is the official command list:')
                .addFields(
                    { name: '/config', value: isFr ? 'Ouvre le panneau de configuration & Anti-Spam.' : 'Opens configuration & Anti-Spam panel.' },
                    { name: '/antiraid', value: isFr ? 'Verrouillage Anti-Raid strict & Anti-Nuke.' : 'Strict Anti-Raid lockdown & Anti-Nuke.' },
                    { name: '/giveaway [lot] [duree]', value: isFr ? 'Lance un giveaway avec durée personnalisée (en heures).' : 'Starts a giveaway with custom duration (in hours).' },
                    { name: '/help', value: isFr ? 'Affiche ce message d\'aide.' : 'Displays this help message.' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Sécurité des permissions
        if (['config', 'antiraid', 'giveaway'].includes(commandName)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ 
                    content: isFr ? '❌ Vous devez avoir la permission **Gérer le serveur**.' : '❌ You need the **Manage Server** permission.', 
                    ephemeral: true 
                });
            }
        }

        if (commandName === 'config') {
            const embed = new EmbedBuilder()
                .setTitle(isFr ? '⚙️ Panneau de Configuration' : '⚙️ Configuration Panel')
                .setDescription(isFr ? 'Gérez la sécurité, l\'anti-spam et les options.' : 'Manage security, anti-spam and options.')
                .addFields(
                    { name: isFr ? '🌐 Langue' : '🌐 Language', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Anti-Raid', value: settings.antiRaidActive ? '🟢 Actif' : '🔴 Inactif', inline: true },
                    { name: '🤖 Anti-Nuke (IA)', value: settings.antiNukeActive ? '🟢 Actif' : '🔴 Inactif', inline: true },
                    { name: isFr ? '💬 Limite Anti-Spam' : '💬 Anti-Spam Limit', value: `${settings.antiSpamLimit} ${isFr ? 'mots' : 'words'}`, inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_menu')
                .setPlaceholder(isFr ? 'Sélectionnez un paramètre à configurer...' : 'Select a setting to configure...')
                .addOptions([
                    { label: 'Changer la Langue (FR / EN)', value: 'menu_lang', emoji: '🌐' },
                    { label: 'Configurer l\'Anti-Spam (Mots max)', value: 'menu_antispam', emoji: '💬' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'antiraid') {
            const embed = new EmbedBuilder()
                .setTitle(isFr ? '🚨 Centre de Sécurité & Verrouillage' : '🚨 Security & Lockdown Center')
                .setDescription(isFr ? 
                    `État actuel :\n\n- **Anti-Raid (Blocage arrivées & rôles) :** ${settings.antiRaidActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n- **Anti-Nuke :** ${settings.antiNukeActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}` :
                    `Current status:\n\n- **Anti-Raid (Join & roles lock):** ${settings.antiRaidActive ? '🟢 ENABLED' : '🔴 DISABLED'}\n- **Anti-Nuke:** ${settings.antiNukeActive ? '🟢 ENABLED' : '🔴 DISABLED'}`)
                .setColor(settings.antiRaidActive ? '#ed4245' : '#57f287');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(settings.antiRaidActive ? 'antiraid_off' : 'antiraid_on')
                    .setLabel(settings.antiRaidActive ? (isFr ? 'Désactiver l\'Anti-Raid' : 'Disable Anti-Raid') : (isFr ? 'Activer l\'Anti-Raid (Lock)' : 'Enable Anti-Raid (Lock)'))
                    .setStyle(settings.antiRaidActive ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(settings.antiNukeActive ? 'antinuke_off' : 'antinuke_on')
                    .setLabel(settings.antiNukeActive ? (isFr ? 'Désactiver l\'Anti-Nuke' : 'Disable Anti-Nuke') : (isFr ? 'Activer l\'Anti-Nuke' : 'Enable Anti-Nuke'))
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'giveaway') {
            const lot = interaction.options.getString('lot');
            const hours = interaction.options.getInteger('duree');
            const durationMs = hours * 60 * 60 * 1000; // Conversion des heures en millisecondes
            const participants = new Set();

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(isFr ? '🎉 GIVEAWAY EN COURS ! 🎉' : '🎉 GIVEAWAY IN PROGRESS! 🎉')
                .setDescription(isFr ? 
                    `Lot à gagner : **${lot}**\n⏱️ Durée : **${hours} heure(s)**\n👥 Participants : **0**\n\nCliquez sur le bouton ci-dessous pour participer !` :
                    `Prize: **${lot}**\n⏱️ Duration: **${hours} hour(s)**\n👥 Entrants: **0**\n\nClick the button below to enter!`)
                .setColor('#fEE75C')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('participate_giveaway').setLabel(isFr ? 'Participer 🎉' : 'Enter 🎉').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_participants').setLabel(isFr ? 'Voir les participants 📋' : 'View entrants 📋').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });

            // Collecteur basé sur la durée choisie par l'admin
            const collector = message.createMessageComponentCollector({ time: durationMs });

            collector.on('collect', async i => {
                if (i.customId === 'participate_giveaway') {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: isFr ? '❌ Vous participez déjà à ce giveaway !' : '❌ You are already entered!', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    
                    giveawayEmbed.setDescription(isFr ? 
                        `Lot à gagner : **${lot}**\n⏱️ Durée : **${hours} heure(s)**\n👥 Participants : **${participants.size}**\n\nCliquez sur le bouton ci-dessous pour participer !` :
                        `Prize: **${lot}**\n⏱️ Duration: **${hours} hour(s)**\n👥 Entrants: **${participants.size}**\n\nClick the button below to enter!`);
                    await i.update({ embeds: [giveawayEmbed] });
                    return i.followUp({ content: isFr ? '✅ Votre participation a bien été enregistrée !' : '✅ Your entry has been recorded!', ephemeral: true });
                }

                if (i.customId === 'view_participants') {
                    if (participants.size === 0) {
                        return i.reply({ content: isFr ? '📋 Aucun participant pour l\'instant.' : '📋 No entrants yet.', ephemeral: true });
                    }
                    const list = Array.from(participants).map(id => `<@${id}>`).join(', ');
                    return i.reply({ content: isFr ? `📋 **Participants (${participants.size}) :** ${list}` : `📋 **Entrants (${participants.size}):** ${list}`, ephemeral: true });
                }
            });

            collector.on('end', async () => {
                const endedEmbed = new EmbedBuilder()
                    .setTitle(isFr ? '🎉 GIVEAWAY TERMINÉ ! 🎉' : '🎉 GIVEAWAY ENDED! 🎉')
                    .setColor('#ed4245')
                    .setTimestamp();

                if (participants.size === 0) {
                    endedEmbed.setDescription(isFr ? `Lot : **${lot}**\n\n❌ Aucun participant, il n'y a pas de gagnant.` : `Prize: **${lot}**\n\n❌ No participants, no winner.`);
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('participate_giveaway').setLabel(isFr ? 'Terminé' : 'Ended').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                    return message.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                }

                const participantsArray = Array.from(participants);
                const winnerId = participantsArray[Math.floor(Math.random() * participantsArray.length)];

                endedEmbed.setDescription(isFr ? 
                    `Lot : **${lot}**\n\n🏆 **Gagnant tiré au sort :** <@${winnerId}> !\nFélicitations à lui ! 🎉` :
                    `Prize: **${lot}**\n\n🏆 **Winner drawn:** <@${winnerId}>!\nCongratulations! 🎉`);

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('participate_giveaway').setLabel(isFr ? 'Terminé' : 'Ended').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );

                await message.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                message.channel.send(isFr ? `🎉 Félicitations à <@${winnerId}> qui remporte le lot : **${lot}** !` : `🎉 Congratulations to <@${winnerId}> for winning: **${lot}**!`);
            });

            return;
        }
    }

    // Gestion du menu déroulant de configuration
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'config_menu') {
            const choice = interaction.values[0];
            if (choice === 'menu_lang') {
                const langRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('set_lang_fr').setLabel('Français 🇫🇷').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('set_lang_en').setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({ content: isFr ? '🌐 Choisissez la langue du bot :' : '🌐 Choose bot language:', components: [langRow], embeds: [] });
            }
            if (choice === 'menu_antispam') {
                const spamRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('spam_3').setLabel('3 ' + (isFr ? 'mots' : 'words')).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('spam_5').setLabel('5 ' + (isFr ? 'mots (Recommandé)' : 'words (Recommended)')).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('spam_10').setLabel('10 ' + (isFr ? 'mots' : 'words')).setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({ content: isFr ? `💬 Choisissez la limite de mots pour l'anti-spam (actuelle : ${settings.antiSpamLimit}) :` : `💬 Choose word limit for anti-spam (current: ${settings.antiSpamLimit}):`, components: [spamRow], embeds: [] });
            }
        }
    }

    // Gestion des boutons
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'set_lang_fr') {
            settings.lang = 'fr';
            return interaction.update({ content: '✅ Langue configurée en **Français** !', components: [] });
        }
        if (id === 'set_lang_en') {
            settings.lang = 'en';
            return interaction.update({ content: '✅ Language successfully set to **English**!', components: [] });
        }
        if (id.startsWith('spam_')) {
            const limit = parseInt(id.split('_')[1]);
            settings.antiSpamLimit = limit;
            return interaction.update({ content: isFr ? `✅ Anti-spam mis à jour : limite fixée à **${limit} mots**.` : `✅ Anti-spam updated: limit set to **${limit} words**.`, components: [] });
        }
        if (id === 'antiraid_on') {
            settings.antiRaidActive = true;
            return interaction.update({ content: isFr ? '🚨 **MODE ANTI-RAID ACTIVÉ !** Les arrivées et les modifications de rôles non autorisées sont verrouillées.' : '🚨 **ANTI-RAID MODE ENABLED!** Joins and unauthorized role changes are locked.', components: [] });
        }
        if (id === 'antiraid_off') {
            settings.antiRaidActive = false;
            return interaction.update({ content: isFr ? '✅ **Mode Anti-Raid désactivé.**' : '✅ **Anti-Raid mode disabled.**', components: [] });
        }
        if (id === 'antinuke_on') {
            settings.antiNukeActive = true;
            return interaction.update({ content: isFr ? '🛡️ **Anti-Nuke activé.**' : '🛡️ **Anti-Nuke enabled.**', components: [] });
        }
        if (id === 'antinuke_off') {
            settings.antiNukeActive = false;
            return interaction.update({ content: isFr ? '⚠️ **Anti-Nuke désactivé.**' : '⚠️ **Anti-Nuke disabled.**', components: [] });
        }
    }
});

// 3. PROTECTION ANTI-RAID (Bloque les arrivées ET les modifications de rôles suspectes)
client.on('guildMemberAdd', async member => {
    const settings = serverSettings.get(member.guild.id);
    if (settings && settings.antiRaidActive) {
        try {
            await member.send("⚠️ Ce serveur est sous protection Anti-Raid stricte. Les adhésions sont suspendues.");
            await member.kick('Anti-Raid actif : Expulsion automatique du nouveau membre.');
        } catch (e) {
            console.error("Erreur anti-raid member add :", e);
        }
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const settings = serverSettings.get(newMember.guild.id);
    if (settings && settings.antiRaidActive) {
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        if (addedRoles.size > 0 && newMember.id !== newMember.guild.ownerId) {
            try {
                await newMember.roles.remove(addedRoles);
                console.log(`[ANTI-RAID] Rôle(s) bloqué(s) et retiré(s) de ${newMember.user.tag} pendant le verrouillage.`);
            } catch (e) {
                console.error("Erreur lors du retrait de rôle anti-raid :", e);
            }
        }
    }
});

// 4. BOUCLIER ANTI-NUKE & ANTI-SPAM INTELLIGENT
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const settings = serverSettings.get(message.guild.id) || { antiSpamLimit: 5, antiNukeActive: true };
    const content = message.content.trim();

    if (settings.antiNukeActive && (content.toLowerCase().startsWith('!nuke') || content.toLowerCase().includes('mass ban') || content.toLowerCase().includes('webhook spam'))) {
        try {
            await message.delete();
            if (message.member && message.guild.members.me.permissions.has('BanMembers')) {
                await message.guild.members.ban(message.author.id, { reason: 'Anti-Nuke IA : Attaque neutralisée.' });
                message.channel.send(`🚨 **ALERTE ANTI-NUKER** : ${message.author.tag} a été banni pour tentative d'attaque.`);
            }
        } catch (e) {
            console.error("Erreur anti-nuke :", e);
        }
        return;
    }

    const words = content.split(/\s+/);
    if (words.length >= settings.antiSpamLimit) {
        const counts = {};
        for (let w of words) {
            counts[w] = (counts[w] || 0) + 1;
            if (counts[w] >= settings.antiSpamLimit) {
                try {
                    await message.delete();
                    message.channel.send(`⚠️ ${message.author}, attention au spam ! Message supprimé.`);
                } catch (e) {
                    console.error("Erreur anti-spam :", e);
                }
                break;
            }
        }
    }
});

client.login(process.env.TOKEN);
                        
