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

const translations = {
    fr: {
        helpTitle: "📜 Centre d'Aide - Yodo Protect",
        helpDesc: "Voici la liste officielle des commandes :",
        configTitle: "⚙️ Panneau de Configuration Yodo",
        langSet: "✅ Langue configurée en **Français** !",
        regTitle: "📜 RÈGLEMENT OFFICIEL",
        regDesc: "Bienvenue sur notre communauté orientée",
        sec1: "📌 1. Règlement Serveur & Sanctions",
        sec1Text: "• Respectez chaque membre, pas d'insultes ni de harcèlement.\n• Pas de spam, de publicité ou de liens non autorisés.\n• Tout manquement entraînera des sanctions (mute, kick ou ban).",
        sec2: "🤝 2. Règlement Éthique & Discord",
        sec2Text: "• Bienveillance et entraide obligatoires au sein du serveur.\n• Respect des conditions générales d'utilisation (TOS) de Discord.\n• Les partenariats se font via les salons dédiés ou le support.",
        footer: "Yodo Protect • Système de modération intelligent"
    },
    en: {
        helpTitle: "📜 Help Center - Yodo Protect",
        helpDesc: "Here is the official command list:",
        configTitle: "⚙️ Yodo Configuration Panel",
        langSet: "✅ Language successfully set to **English**!",
        regTitle: "📜 OFFICIAL RULES",
        regDesc: "Welcome to our community focused on",
        sec1: "📌 1. Server Rules & Sanctions",
        sec1Text: "• Respect every member, no insults or harassment.\n• No spam, advertising, or unauthorized links.\n• Any violation will result in sanctions (mute, kick, or ban).",
        sec2: "🤝 2. Ethics & Discord Rules",
        sec2Text: "• Kindness and mutual aid are mandatory within the server.\n• Compliance with Discord's Terms of Service (TOS).\n• Partnerships are handled via dedicated channels or support.",
        footer: "Yodo Protect • Smart Moderation System"
    },
    es: {
        helpTitle: "📜 Centro de Ayuda - Yodo Protect",
        helpDesc: "Aquí está la lista oficial de comandos:",
        configTitle: "⚙️ Panel de Configuración Yodo",
        langSet: "✅ ¡Idioma configurado en **Español**!",
        regTitle: "📜 REGLAMENTO OFICIAL",
        regDesc: "¡Bienvenido a nuestra comunidad enfocada en",
        sec1: "📌 1. Normas del Servidor y Sanciones",
        sec1Text: "• Respeta a todos los miembros, sin insultos ni acoso.\n• No spam, publicidad ni enlaces no autorizados.\n• Cualquier infracción acarreará sanciones (mute, kick o ban).",
        sec2: "🤝 2. Ética y Normas de Discord",
        sec2Text: "• La amabilidad y la ayuda mutua son obligatorias.\n• Cumplimiento de las Condiciones de Servicio (TOS) de Discord.\n• Las colaboraciones se gestionan a través de los canales o soporte.",
        footer: "Yodo Protect • Sistema de moderación inteligente"
    },
    it: {
        helpTitle: "📜 Centro Assistenza - Yodo Protect",
        helpDesc: "Ecco l'elenco ufficiale dei comandi:",
        configTitle: "⚙️ Pannello di Configurazione Yodo",
        langSet: "✅ Lingua impostata con successo in **Italiano**!",
        regTitle: "📜 REGOLAMENTO UFFICIALE",
        regDesc: "Benvenuto nella nostra community incentrata su",
        sec1: "📌 1. Regole del Server e Sanzioni",
        sec1Text: "• Rispetta ogni membro, niente insulti o molestie.\n• Niente spam, pubblicità o link non autorizzati.\n• Qualsiasi violazione comporterà sanzioni (mute, kick o ban).",
        sec2: "🤝 2. Etica e Regole di Discord",
        sec2Text: "• Gentilezza e mutuo soccorso obbligatori nel server.\n• Rispetto dei Termini di Servizio (TOS) di Discord.\n• Le partnership vengono gestite tramite i canali dedicati o il supporto.",
        footer: "Yodo Protect • Sistema di moderazione inteligente"
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
        new SlashCommandBuilder().setName('config').setDescription('Ouvrir le panneau de configuration').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('ticketpanel').setDescription('Envoyer le panel de tickets').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder()
            .setName('reglement')
            .setDescription('Générer le règlement personnalisé du serveur')
            .addStringOption(option => option.setName('theme').setDescription('Le thème du serveur (ex: SCP Fondation, Gaming...)').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder().setName('antiraid').setDescription('Activer ou désactiver l\'Anti-Raid').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Lancer un giveaway')
            .addStringOption(option => option.setName('lot').setDescription('Lot').setRequired(true))
            .addStringOption(option => option.setName('duree').setDescription('Durée').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('sanction')
            .setDescription('Sanctionner un membre')
            .addUserOption(option => option.setName('membre').setDescription('Membre').setRequired(true))
            .addStringOption(option => option.setName('type').setDescription('Type').setRequired(true).addChoices(
                { name: 'Mute', value: 'mute' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }
            ))
            .addStringOption(option => option.setName('raison').setDescription('Raison').setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('mp')
            .setDescription('Envoyer un MP (Fondateur)')
            .addUserOption(option => option.setName('utilisateur').setDescription('Utilisateur').setRequired(true))
            .addStringOption(option => option.setName('message').setDescription('Message').setRequired(true))
            .toJSON(),
        new SlashCommandBuilder().setName('help').setDescription('Afficher l\'aide').toJSON()
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
        .setDescription('Merci de m\'avoir ajouté ! Veuillez choisir la langue principale du bot pour votre serveur :')
        .setColor('#5865F2');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setlang_fr').setLabel('Français 🇫🇷').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('setlang_en').setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setlang_es').setLabel('Español 🇪🇸').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setlang_it').setLabel('Italiano 🇮🇹').setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [welcomeEmbed], components: [row] });
});

client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { lang: 'fr', antiRaidActive: false };
    serverSettings.set(interaction.guildId, settings);

    if (interaction.isButton() && interaction.customId.startsWith('setlang_')) {
        const langCode = interaction.customId.split('_')[1];
        settings.lang = langCode;
        return interaction.update({ content: `✅ Langue configurée avec succès en **${langCode.toUpperCase()}** pour tout le bot !`, embeds: [], components: [] });
    }

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'helpTitle'))
                .setDescription(getT(interaction.guildId, 'helpDesc'))
                .addFields(
                    { name: '/config', value: 'Panneau de configuration' },
                    { name: '/ticketpanel', value: 'Envoyer le panel de tickets' },
                    { name: '/reglement', value: 'Générer le règlement personnalisé' },
                    { name: '/antiraid', value: 'Activer/Désactiver l\'Anti-Raid' },
                    { name: '/giveaway', value: 'Lancer un giveaway' },
                    { name: '/sanction', value: 'Sanctionner un membre' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'reglement') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const theme = interaction.options.getString('theme');
            const reglementEmbed = new EmbedBuilder()
                .setTitle(`${getT(interaction.guildId, 'regTitle')} - ${interaction.guild.name}`)
                .setDescription(`${getT(interaction.guildId, 'regDesc')} **${theme}** :\n`)
                .addFields(
                    { name: getT(interaction.guildId, 'sec1'), value: getT(interaction.guildId, 'sec1Text') },
                    { name: getT(interaction.guildId, 'sec2'), value: getT(interaction.guildId, 'sec2Text') }
                )
                .setColor('#5865F2')
                .setFooter({ text: getT(interaction.guildId, 'footer'), iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const translateRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tr_fr_${theme}`).setLabel('Français 🇫🇷').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_en_${theme}`).setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_es_${theme}`).setLabel('Español 🇪🇸').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_it_${theme}`).setLabel('Italiano 🇮🇹').setStyle(ButtonStyle.Secondary)
            );

            await interaction.channel.send({ embeds: [reglementEmbed], components: [translateRow] });
            return interaction.reply({ content: '✅ Le règlement a été généré avec succès !', ephemeral: true });
        }

        if (commandName === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'configTitle'))
                .setDescription('Gère les paramètres du serveur.')
                .addFields(
                    { name: '🌐 Langue', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Anti-Raid', value: settings.antiRaidActive ? '🟢 Actif' : '🔴 Inactif', inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_lang_menu')
                .setPlaceholder('Changer la langue...')
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
                .setTitle('🎫 Support & Tickets')
                .setDescription('Besoin d\'aide ? Clique sur le bouton ci-dessous pour ouvrir un ticket.')
                .setColor('#5865F2');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_staff').setLabel('Contacter le staff').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_bug').setLabel('Bug / Technique').setEmoji('🐛').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('ticket_collab').setLabel('Partenariat & Collab').setEmoji('🤝').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ticket_question').setLabel('Question générale').setEmoji('❓').setStyle(ButtonStyle.Secondary)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Panel de tickets envoyé !', ephemeral: true });
        }

        if (commandName === 'mp') {
            if (interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: '❌ Réservé au fondateur.', ephemeral: true });
            }
            const targetUser = interaction.options.getUser('utilisateur');
            const msgContent = interaction.options.getString('message');
            try {
                await targetUser.send(`📬 **Message de ${interaction.guild.name}** :\n\n${msgContent}`);
                return interaction.reply({ content: `✅ MP envoyé à **${targetUser.tag}** !`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: `❌ Impossible d'envoyer le MP.`, ephemeral: true });
            }
        }

        if (commandName === 'sanction') {
            const targetMember = interaction.options.getMember('membre');
            const type = interaction.options.getString('type');
            const reason = interaction.options.getString('raison') || 'Aucune raison';
            try {
                if (type === 'mute') await targetMember.timeout(15 * 60 * 1000, reason);
                if (type === 'kick') await targetMember.kick(reason);
                if (type === 'ban') await targetMember.ban({ reason: reason });
                return interaction.reply({ content: `✅ Sanction appliquée à **${targetMember.user.tag}**.`, ephemeral: true });
            } catch (e) {
                return interaction.reply({ content: `❌ Erreur de permissions.`, ephemeral: true });
            }
        }

        if (commandName === 'antiraid') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }
            settings.antiRaidActive = !settings.antiRaidActive;
            return interaction.reply({ content: settings.antiRaidActive ? '🚨 **Anti-Raid ACTIVÉ !**' : '✅ **Anti-Raid DÉSACTIVÉ.**', ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('tr_')) {
        const parts = interaction.customId.split('_');
        const targetLang = parts[1];
        const theme = parts.slice(2).join('_');
        const t = translations[targetLang] || translations['fr'];

        const translatedEmbed = new EmbedBuilder()
            .setTitle(`${t.regTitle} - ${interaction.guild.name}`)
            .setDescription(`${t.regDesc} **${theme}** :\n`)
            .addFields(
                { name: t.sec1, value: t.sec1Text },
                { name: t.sec2, value: t.sec2Text }
            )
            .setColor('#5865F2')
            .setFooter({ text: t.footer, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        return interaction.update({ embeds: [translatedEmbed] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'config_lang_menu') {
        const choice = interaction.values[0];
        if (choice === 'lang_fr') settings.lang = 'fr';
        if (choice === 'lang_en') settings.lang = 'en';
        if (choice === 'lang_es') settings.lang = 'es';
        if (choice === 'lang_it') settings.lang = 'it';

        return interaction.update({ content: getT(interaction.guildId, 'langSet'), components: [], embeds: [] });
    }

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
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
            });

            const embed = new EmbedBuilder()
                .setTitle(`🎫 Ticket : ${ticketType.toUpperCase()}`)
                .setDescription(`Bonjour ${interaction.user},\nJe suis l'assistance **Yodo**. Un membre du staff va te répondre très bientôt.`)
                .setColor('#5865F2');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [closeRow] });
            return interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel} !` });
        } catch (e) {
            return interaction.editReply({ content: `❌ Erreur lors
