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
const blacklist = new Map(); // Stocke les utilisateurs blacklistés par serveur
const pendingCaptchas = new Map(); // Stocke les captchas en attente pour les nouveaux membres

// Textes traduits pour les 4 langues (FR, EN, ES, IT)
const translations = {
    fr: {
        helpTitle: "📜 Centre d'Aide - Yodo Protect",
        helpDesc: "Voici la liste officielle des commandes :",
        configTitle: "⚙️ Panneau de Configuration",
        antiraidTitle: "🚨 Centre de Sécurité & Verrouillage",
        langSet: "✅ Langue configurée en **Français** !",
        active: "🟢 Actif",
        inactive: "🔴 Inactif"
    },
    en: {
        helpTitle: "📜 Help Center - Yodo Protect",
        helpDesc: "Here is the official command list:",
        configTitle: "⚙️ Configuration Panel",
        antiraidTitle: "🚨 Security & Lockdown Center",
        langSet: "✅ Language successfully set to **English**!",
        active: "🟢 Active",
        inactive: "🔴 Inactive"
    },
    es: {
        helpTitle: "📜 Centro de Ayuda - Yodo Protect",
        helpDesc: "Aquí está la lista oficial de comandos:",
        configTitle: "⚙️ Panel de Configuración",
        antiraidTitle: "🚨 Centro de Seguridad y Bloqueo",
        langSet: "✅ ¡Idioma configurado en **Español**!",
        active: "🟢 Activo",
        inactive: "🔴 Inactivo"
    },
    it: {
        helpTitle: "📜 Centro Assistenza - Yodo Protect",
        helpDesc: "Ecco l'elenco ufficiale dei comandi:",
        configTitle: "⚙️ Pannello di Configurazione",
        antiraidTitle: "🚨 Centro Sicurezza e Blocco",
        langSet: "✅ Lingua impostata con successo in **Italiano**!",
        active: "🟢 Attivo",
        inactive: "🔴 Inattivo"
    }
};

function getT(guildId, key) {
    const settings = serverSettings.get(guildId) || { lang: 'fr' };
    const lang = settings.lang || 'fr';
    return translations[lang][key] || translations['fr'][key];
}

// Convertisseur de durée pour les giveaways (ex: 30m, 2h, 1d)
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

// Générateur de code captcha aléatoire (4 caractères)
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
            .setDescription('Ouvrir le panneau de configuration / Open config panel')
            .setDescriptionLocalizations({ en: 'Open configuration panel', es: 'Abrir panel de configuración', it: 'Apri pannello di configurazione' })
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
                        { name: 'Mute (Exclusion temporaire)', value: 'mute' },
                        { name: 'Kick (Expulsion)', value: 'kick' },
                        { name: 'Ban (Bannissement)', value: 'ban' }
                    )
            )
            .addStringOption(option => option.setName('raison').setDescription('Raison de la sanction').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('mp')
            .setDescription('Envoyer un MP à un utilisateur (Réservé aux Fondateurs)')
            .addUserOption(option => option.setName('utilisateur').setDescription('Utilisateur à contacter').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message à envoyer').setRequired(true))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('captcha')
            .setDescription('Activer ou désactiver le système de Captcha à l\'arrivée')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher l\'aide de Yodo Protect')
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

// Événement : Nouveau serveur
client.on('guildCreate', async (guild) => {
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
    if (!channel) return;

    serverSettings.set(guild.id, { lang: 'fr', antiRaidActive: false, antiNukeActive: true, captchaActive: false });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛡️ Bienvenue avec Yodo Protect ! 🛡️')
        .setDescription('Salut ! Je suis **Yodo**, ton bouclier de sécurité.\n\n• Tape `/config` pour gérer les paramètres (Langue, Captcha, etc.).')
        .setColor('#5865F2')
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

// Gestion des interactions
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
                    { name: '/config', value: 'Panneau de configuration / Configuration panel.' },
                    { name: '/antiraid', value: 'Anti-Raid & Anti-Nuke.' },
                    { name: '/giveaway [lot] [duree]', value: 'Lancer un giveaway avec minuteur.' },
                    { name: '/sanction [membre] [type]', value: 'Sanctionner un membre.' },
                    { name: '/mp [utilisateur] [message]', value: 'Envoyer un MP (Fondateur uniquement).' },
                    { name: '/captcha', value: 'Activer/Désactiver le Captcha.' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Commande /mp (Réservée strictement aux Fondateurs / Propriétaire du serveur)
        if (commandName === 'mp') {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: '❌ Cette commande est strictement réservée au **propriétaire (fondateur)** du serveur.', ephemeral: true });
            }

            const targetUser = interaction.options.getUser('utilisateur');
            const msgContent = interaction.options.getString('message');

            try {
                await targetUser.send(`📬 **Message de la part de la direction de ${interaction.guild.name}** :\n\n${msgContent}`);
                return interaction.reply({ content: `✅ Message privé envoyé avec succès à **${targetUser.tag}** !`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: `❌ Impossible d'envoyer un message privé à cet utilisateur (ses MP sont sûrement fermés).`, ephemeral: true });
            }
        }

        // Commande /sanction
        if (commandName === 'sanction') {
            const targetMember = interaction.options.getMember('membre');
            const type = interaction.options.getString('type');
            const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

            try {
                if (type === 'mute') {
                    await targetMember.timeout(15 * 60 * 1000, reason);
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** a été mis en sourdine (mute) pendant 15 minutes. Raison : *${reason}*`, ephemeral: true });
                } else if (type === 'kick') {
                    await targetMember.kick(reason);
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** a été expulsé (kick). Raison : *${reason}*`, ephemeral: true });
                } else if (type === 'ban') {
                    await targetMember.ban({ reason: reason });
                    return interaction.reply({ content: `✅ **${targetMember.user.tag}** a été banni. Raison : *${reason}*`, ephemeral: true });
                }
            } catch (e) {
                return interaction.reply({ content: `❌ Erreur lors de l'application de la sanction. Vérifie mes permissions.`, ephemeral: true });
            }
        }

        // Commande /captcha (Activer / Désactiver)
        if (commandName === 'captcha') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise : Gérer le serveur.', ephemeral: true });
            }
            settings.captchaActive = !settings.captchaActive;
            return interaction.reply({ 
                content: settings.captchaActive ? '🛡️ **Système de Captcha activé !** Les nouveaux arrivants devront résoudre un captcha en MP.' : '⚠️ **Système de Captcha désactivé.**', 
                ephemeral: true 
            });
        }

        if (commandName === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'configTitle'))
                .setDescription('Gère la langue et les options du bot / Manage bot settings.')
                .addFields(
                    { name: '🌐 Langue / Language', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Captcha', value: settings.captchaActive ? '🟢 Actif' : '🔴 Inactif', inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_lang_menu')
                .setPlaceholder('Choisir la langue / Select language...')
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
                content: settings.antiRaidActive ? '🚨 **Anti-Raid ACTIVÉ !** Arrivées et rôles non autorisés bloqués (Sauf pour toi, le propriétaire).' : '✅ **Anti-Raid DÉSACTIVÉ.**', 
                ephemeral: true 
            });
        }

        // Commande /giveaway avec Minuteur dynamique
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
                .setDescription(`Lot : **${lot}**\n⏱️ Fin dans : **${dureeStr}**\n👥 Participants : **0**\n\nClique sur le bouton ci-dessous pour participer !`)
                .setColor('#fEE75C')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('participate_gw').setLabel('Participer 🎉').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('view_gw').setLabel('Voir les participants 📋').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });

            // Minuteur de mise à jour visuelle (toutes les 15 secondes)
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

                giveawayEmbed.setDescription(`Lot : **${lot}**\n⏱️ Fin dans : **~${timeText}**\n👥 Participants : **${participants.size}**\n\nClique sur le bouton ci-dessous pour participer !`);
                await message.edit({ embeds: [giveawayEmbed] }).catch(() => {});
            }, 15000);

            const collector = message.createMessageComponentCollector({ time: durationMs });

            collector.on('collect', async i => {
                if (i.customId === 'participate_gw') {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: '❌ Tu participes déjà !', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    return i.reply({ content: '✅ Ta participation est enregistrée !', ephemeral: true });
                }
                if (i.customId === 'view_gw') {
                    if (participants.size === 0) return i.reply({ content: '📋 Aucun participant pour l\'instant.', ephemeral: true });
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
                    endedEmbed.setDescription(`Lot : **${lot}**\n\n❌ Aucun participant, pas de gagnant.`);
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

    // Gestion du menu de langue
    if (interaction.isStringSelectMenu() && interaction.customId === 'config_lang_menu') {
        const choice = interaction.values[0];
        if (choice === 'lang_fr') settings.lang = 'fr';
        if (choice === 'lang_en') settings.lang = 'en';
        if (choice === 'lang_es') settings.lang = 'es';
        if (choice === 'lang_it') settings.lang = 'it';

        return interaction.update({ content: getT(interaction.guildId, 'langSet'), components: [], embeds: [] });
    }
});

// Système de Captcha et Anti-Raid à l'arrivée
client.on('guildMemberAdd', async member => {
    const settings = serverSettings.get(member.guild.id) || { antiRaidActive: false, captchaActive: false };

    // Anti-Raid actif
    if (settings.antiRaidActive) {
        try {
            await member.send("⚠️ Serveur en verrouillage Anti-Raid.").catch(() => {});
            await member.kick('Anti-Raid actif.');
        } catch (e) {}
        return;
    }

    // Captcha actif
    if (settings.captchaActive) {
        const captchaCode = generateCaptchaCode();
        pendingCaptchas.set(member.id, captchaCode);

        try {
            await member.send(`🔒 **Vérification de sécurité (Captcha)**\nPour accéder au serveur **${member.g
