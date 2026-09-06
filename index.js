const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField } = require('discord.js');

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

// Traductions pour le /help et les messages
const translations = {
    fr: {
        helpTitle: "📜 Centre d'Aide - Yodo Protect",
        helpDesc: "Voici la liste officielle des commandes :",
        configTitle: "⚙️ Panneau de Configuration Yodo",
        langSet: "✅ Langue configurée en **Français** !"
    },
    en: {
        helpTitle: "📜 Help Center - Yodo Protect",
        helpDesc: "Here is the official command list:",
        configTitle: "⚙️ Yodo Configuration Panel",
        langSet: "✅ Language successfully set to **English**!"
    },
    es: {
        helpTitle: "📜 Centro de Ayuda - Yodo Protect",
        helpDesc: "Aquí está la lista oficial de comandos:",
        configTitle: "⚙️ Panel de Configuración Yodo",
        langSet: "✅ ¡Idioma configurado en **Español**!"
    },
    it: {
        helpTitle: "📜 Centro Assistenza - Yodo Protect",
        helpDesc: "Ecco l'elenco ufficiale dei comandi:",
        configTitle: "⚙️ Pannello di Configurazione Yodo",
        langSet: "✅ Lingua impostata con successo in **Italiano**!"
    }
};

function getT(guildId, key) {
    const settings = serverSettings.get(guildId) || { lang: 'fr' };
    const lang = settings.lang || 'fr';
    return translations[lang][key] || translations['fr'][key];
}

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Ouvrir le panneau de configuration du bot')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Envoyer le panel de tickets dans le salon')
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

    serverSettings.set(guild.id, { lang: 'fr', antiRaidActive: false });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛡️ Bienvenue avec Yodo Protect ! 🛡️')
        .setDescription('Salut ! Je suis **Yodo**, ton assistant de sécurité.\n\n• Tape `/config` pour ouvrir le panneau de configuration !\n• Tape `/ticketpanel` pour envoyer le panneau de tickets.')
        .setColor('#5865F2')
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { lang: 'fr', antiRaidActive: false };
    serverSettings.set(interaction.guildId, settings);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'helpTitle'))
                .setDescription(getT(interaction.guildId, 'helpDesc'))
                .addFields(
                    { name: '/config', value: 'Panneau de configuration (Langue, Anti-Raid...)' },
                    { name: '/ticketpanel', value: 'Envoyer le panel de tickets' },
                    { name: '/antiraid', value: 'Activer/Désactiver l\'Anti-Raid' },
                    { name: '/giveaway', value: 'Lancer un giveaway' },
                    { name: '/sanction', value: 'Sanctionner un membre' },
                    { name: '/mp', value: 'Envoyer un MP (Fondateur)' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // --- COMMANDE CONFIG STYLE DRABOT ---
        if (commandName === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'configTitle'))
                .setDescription('Gère les paramètres principaux de ton serveur directement via ce panneau.')
                .addFields(
                    { name: '🌐 Langue actuelle', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Anti-Raid', value: settings.antiRaidActive ? '🟢 Activé' : '🔴 Désactivé', inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_lang_menu')
                .setPlaceholder('🌐 Choisir la langue du bot...')
                .addOptions([
                    { label: 'Français 🇫🇷', value: 'lang_fr' },
                    { label: 'English 🇬🇧', value: 'lang_en' },
                    { label: 'Español 🇪🇸', value: 'lang_es' },
                    { label: 'Italiano 🇮🇹', value: 'lang_it' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎫 Support & Tickets - Yodo Protect')
                .setDescription('Besoin d\'aide, d\'un partenariat ou de signaler un bug ?\n\nClique sur le bouton correspondant ci-dessous pour ouvrir un salon de ticket privé avec le staff.')
                .setColor('#5865F2')
                .setFooter({ text: 'Système de tickets intelligent' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_staff').setLabel('Contacter le staff').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_bug').setLabel('Bug / Technique').setEmoji('🐛').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_collab').setLabel('Partenariat & Collab').setEmoji('🤝').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_question').setLabel('Question générale').setEmoji('❓').setStyle(ButtonStyle.Secondary)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Le panel de tickets a été envoyé avec succès !', ephemeral: true });
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
    }

    // Gestion du choix de la langue dans le /config
    if (interaction.isStringSelectMenu() && interaction.customId === 'config_lang_menu') {
        const choice = interaction.values[0];
        if (choice === 'lang_fr') settings.lang = 'fr';
        if (choice === 'lang_en') settings.lang = 'en';
        if (choice === 'lang_es') settings.lang = 'es';
        if (choice === 'lang_it') settings.lang = 'it';

        return interaction.update({ content: getT(interaction.guildId, 'langSet'), components: [], embeds: [] });
    }

    // --- GESTION DES TICKETS & RELANCE STYLE NEXORA ---
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
        let ticketType = 'ticket';
        if (interaction.customId === 'ticket_staff') ticketType = 'staff';
        if (interaction.customId === 'ticket_bug') ticketType = 'bug';
        if (interaction.customId === 'ticket_collab') ticketType = 'collab';
        if (interaction.customId === 'ticket_question') ticketType = 'question';

        await interaction.deferReply({ ephemeral: true });

        try {
            const channelName = `ticket-${ticketType}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    }
                ],
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Ticket : ${ticketType.toUpperCase()}`)
                .setDescription(`Bonjour ${interaction.user},\nJe suis l'assistance **Yodo**. Merci d'avoir ouvert un ticket. Un membre du staff va te répondre très bientôt.\n\nPour fermer ce salon, clique sur le bouton ci-dessous.`)
                .setColor('#5865F2');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });

            // Système de relance automatique (style Nexora) : si personne ne répond au bout de 2 minutes
            setTimeout(async () => {
                try {
                    // On récupère le salon pour vérifier s'il existe toujours et combien de messages ont été envoyés
                    const fetchedChannel = await interaction.guild.channels.fetch(ticketChannel.id);
                    if (!fetchedChannel) return;

                    const messages = await fetchedChannel.messages.fetch({ limit: 10 });
                    // Si le staff a déjà répondu (messages postés par un autre utilisateur que le bot ou l'auteur du ticket), on ne relance pas
                    const staffReplied = messages.some(m => m.author.id !== client.user.id && m.author.id !== interaction.user.id);

                    if (!staffReplied) {
                        // On cherche le rôle "Staff" ou "Modérateur" sur le serveur pour le pinguer
                        const staffRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'moderateur' || r.name.toLowerCase() === 'modérateur');
                        const pingTarget = staffRole ? `<@&${staffRole.id}>` : '@here';

                        await fetchedChannel.send(`⚠️ **Rappel d'assistance Yodo** : Ce ticket est toujours en attente d'une réponse de la part de l'équipe ! ${pingTarget}`);
                    }
                } catch (err) {
                    // Le salon a peut-être été supprimé entretemps, on ignore l'erreur
                }
            }, 2 * 60 * 1000); // 2 minutes (tu peux changer le temps ici si tu veux, ex: 5 * 60 * 1000 pour 5 minutes)

            return interaction.editReply({ content: `✅ Ton ticket a été créé avec succès : ${ticketChannel} !` });
        } catch (e) {
            console.error(e);
            return interaction.editReply({ content: `❌ Une erreur est survenue lors de la création du salon de ticket.` });
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 Fermeture du ticket dans 3 secondes...', ephemeral: true });
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (e) {}
        }, 3000);
    }
});

client.login(process.env.TOKEN);
                
