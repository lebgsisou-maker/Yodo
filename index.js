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

// Fonction pour convertir une durée (ex: "1d", "2h", "30m") en millisecondes
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
            .setDescription('Lancer un giveaway avec une durée personnalisée (ex: 1d, 2h, 30m)')
            .addStringOption(option => 
                option.setName('lot')
                    .setDescription('Le lot à gagner')
                    .setRequired(true)
            )
            .addStringOption(option => 
                option.setName('duree')
                    .setDescription('Durée (ex: 30m, 2h, 1d, 1w)')
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

    serverSettings.set(guild.id, { lang: 'fr', antiRaidActive: false, antiNukeActive: true });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛡️ Bienvenue avec Yodo Protect ! 🛡️')
        .setDescription('Salut ! Je suis **Yodo**, votre bouclier de sécurité.\n\n' +
                          '• **Anti-Nuke & Verrouillage Anti-Raid** renforcés.\n' +
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
        antiNukeActive: true 
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
                    { name: '/config', value: isFr ? 'Ouvre le panneau de configuration du bot.' : 'Opens bot configuration panel.' },
                    { name: '/antiraid', value: isFr ? 'Verrouillage Anti-Raid strict & Anti-Nuke.' : 'Strict Anti-Raid lockdown & Anti-Nuke.' },
                    { name: '/giveaway [lot] [duree]', value: isFr ? 'Lance un giveaway (ex: 30m, 2h, 1d).' : 'Starts a giveaway (ex: 30m, 2h, 1d).' },
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
                .setDescription(isFr ? 'Gérez la langue et la sécurité du serveur.' : 'Manage server language and security.')
                .addFields(
                    { name: isFr ? '🌐 Langue' : '🌐 Language', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Anti-Raid', value: settings.antiRaidActive ? '🟢 Actif' : '🔴 Inactif', inline: true },
                    { name: '🤖 Anti-Nuke (IA)', value: settings.antiNukeActive ? '🟢 Actif' : '🔴 Inactif', inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_menu')
                .setPlaceholder(isFr ? 'Sélectionnez un paramètre à configurer...' : 'Select a setting to configure...')
                .addOptions([
                    { label: isFr ? 'Changer la Langue (FR / EN)' : 'Change Language (FR / EN)', value: 'menu_lang', emoji: '🌐' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'antiraid') {
            const embed = new EmbedBuilder()
                .setTitle(isFr ? '🚨 Centre de Sécurité & Verrouillage' : '🚨 Security & Lockdown Center')
                .setDescription(isFr ? 
                    `État actuel :\n\n- **Anti-Raid (Blocage total arrivées & rôles) :** ${settings.antiRaidActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n- **Anti-Nuke :** ${settings.antiNukeActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}` :
                    `Current status:\n\n- **Anti-Raid (Total join & roles lock):** ${settings.antiRaidActive ? '🟢 ENABLED' : '🔴 DISABLED'}\n- **Anti-Nuke:** ${settings.antiNukeActive ? '🟢 ENABLED' : '🔴 DISABLED'}`)
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
            const dureeStr = interaction.options.getString('duree');
            const durationMs = parseDuration(dureeStr);

            if (!durationMs) {
                return interaction.reply({ 
                    content: isFr ? '❌ Format de durée invalide ! Utilise par exemple : `30m` (minutes), `2h` (heures), `1d` (jour), `1w` (semaine).' : '❌ Invalid duration format! Use e.g.: `30m`, `2h`, `1d`, `1w`.', 
                    ephemeral: true 
                });
            }

            const participants = new Set();

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(isFr ? '🎉 GIVEAWAY EN COURS ! 🎉' : '🎉 GIVEAWAY IN PROGRESS! 🎉')
                .setDescription(isFr ? 
                    `Lot à gagner : **${lot}**\n⏱️ Durée : **${dureeStr}**\n👥 Participants : **0**\n\nClique sur le bouton ci-dessous pour participer !` :
                    `Prize: **${lot}**\n⏱️ Duration: **${dureeStr}**\n👥 Entrants: **0**\n\nClick the button below to enter!`)
                .setColor('#fEE75C')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('participate_giveaway').setLabel(isFr ? 'Participer 🎉' : 'Enter 🎉').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_participants').setLabel(isFr ? 'Voir les participants 📋' : 'View entrants 📋').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });

            const collector = message.createMessageComponentCollector({ time: durationMs });

            collector.on('collect', async i => {
                if (i.customId === 'participate_giveaway') {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: isFr ? '❌ Tu participes déjà à ce giveaway !' : '❌ You are already entered!', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    
                    giveawayEmbed.setDescription(isFr ? 
                        `Lot à gagner : **${lot}**\n⏱️ Durée : **${dureeStr}**\n👥 Participants : **${participants.size}**\n\nClique sur le bouton ci-dessous pour participer !` :
                        `Prize: **${lot}**\n⏱️ Duration: **${dureeStr}**\n👥 Entrants: **${participants.size}**\n\nClick the button below to enter!`);
                    await i.update({ embeds: [giveawayEmbed] });
                    return i.followUp({ content: isFr ? '✅ Ta participation a bien été enregistrée !' : '✅ Your entry has been recorded!', ephemeral: true });
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

    // Gestion du menu déroulant
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'config_menu') {
            const choice = interaction.values[0];
            if (choice === 'menu_lang') {
                const langRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('set_lang_fr').setLabel('Français 🇫🇷').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('set_lang_en').setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({ content: isFr ? '🌐 Choisis la langue du bot :' : '🌐 Choose bot language:', components: [langRow], embeds: [] });
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
        if (id === 'antiraid_on') {
            settings.antiRaidActive = true;
            return interaction.update({ content: isFr ? '🚨 **MODE ANTI-RAID ACTIVÉ !** Les arrivées suspectes et l\'ajout de rôles sont totalement bloqués.' : '🚨 **ANTI-RAID MODE ENABLED!** Suspicious joins and role assignments are fully locked.', components: [] });
        }
        if (id === 'antiraid_off') {
            settings.antiRaidActive = false;
            return interaction.update({ content: isFr ? '✅ **Mode Anti-Raid désactivé.**' : '✅ **Anti-Raid mode disabled.**', components: [] });
        }
        if (id === 'antinuke_on') {
            settings.antinukeActive = true;
            return interaction.update({ content: isFr ? '🛡️ **Anti-Nuke activé.**' : '🛡️ **Anti-Nuke enabled.**', components: [] });
        }
        if (id === 'antinuke_off') {
            settings.antinukeActive = false;
            return interaction.update({ content: isFr ? '⚠️ **Anti-Nuke désactivé.**' : '⚠️ **Anti-Nuke disabled.**', components: [] });
        }
    }
});

// 3. PROTECTION ANTI-RAID RENFORCÉE (Bloque net les arrivées et supprime instantanément les attributions de rôles non autorisées)
client.on('guildMemberAdd', async member => {
    const settings = serverSettings.get(member.guild.id);
    if (settings && settings.antiRaidActive) {
        try {
            await member.send("⚠️ Ce serveur est sous verrouillage Anti-Raid strict. Les adhésions sont suspendues.").catch(() => {});
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

// 4. BOUCLIER ANTI-NUKE RENFORCÉ (Sans anti-spam)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const settings = serverSettings.get(message.guild.id) || { antiNukeActive: true };
    const content = message.content.trim().toLowerCase();

    if (settings.antiNukeActive && (content.startsWith('!nuke') || content.includes('mass ban') || content.includes('webhook spam'))) {
        try {
            await message.delete();
            if (message.member && message.guild.members.me.permissions.has('BanMembers')) {
                await message.guild.members.ban(message.author.id, { reason: 'Anti-Nuke IA : Attaque neutralisée.' });
                message.channel.send(`🚨 **ALERTE ANTI-NUKER** : ${message.author.tag} a été banni pour tentative d'attaque.`);
            }
        } catch (e) {
            console.error("Erreur anti-nuke :", e);
        }
    }
});

client.login(process.env.TOKEN);
                            
