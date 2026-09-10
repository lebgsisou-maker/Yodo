const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Stockage en mémoire des configurations par serveur (Langue, Anti-Raid IA, Rôles autorisés)
const serverSettings = new Map();
// Suivi anti-raid (comptage des messages pour détecter l'anomalie de spam)
const raidTracker = new Map();

// Traductions dynamiques et gestion des textes / descriptions
const translations = {
    fr_FR: {
        helpTitle: "📜 Centre d'Aide Avancé - Bot Modulaire",
        helpDesc: "Voici la liste officielle des commandes disponibles :",
        configTitle: "⚙️ Panneau de Configuration Global",
        langSet: "✅ Langue du bot mise à jour en **Français (fr_FR)** !",
        ticketTitle: "🎫 Support & Billetterie",
        ticketDesc: "Besoin d'assistance ? Sélectionnez une catégorie ci-dessous pour ouvrir un ticket sécurisé.",
        ticketCreated: "✅ Votre ticket a été ouvert avec succès :",
        transcriptHeader: "--- TRANSCRIPT DU TICKET ---",
        antiRaidAlert: "🚨 **Alerte Anti-Raid IA** : Anomalie détectée ! Des mesures de protection automatiques ont été activées.",
        footer: "Système modulaire de sécurité et de gestion"
    },
    en_US: {
        helpTitle: "📜 Advanced Help Center - Modular Bot",
        helpDesc: "Here is the official list of available commands:",
        configTitle: "⚙️ Global Configuration Panel",
        langSet: "✅ Bot language updated to **English (en_US)**!",
        ticketTitle: "🎫 Support & Ticketing",
        ticketDesc: "Need assistance? Select a category below to open a secure ticket.",
        ticketCreated: "✅ Your ticket has been successfully opened:",
        transcriptHeader: "--- TICKET TRANSCRIPT ---",
        antiRaidAlert: "🚨 **AI Anti-Raid Alert**: Anomaly detected! Automatic protection measures have been triggered.",
        footer: "Modular security and management system"
    },
    es_ES: {
        helpTitle: "📜 Centro de Ayuda Avanzado - Bot Modular",
        helpDesc: "Aquí está la lista oficial de comandos disponibles:",
        configTitle: "⚙️ Panel de Configuración Global",
        langSet: "✅ ¡Idioma actualizado a **Español (es_ES)**!",
        ticketTitle: "🎫 Soporte y Tickets",
        ticketDesc: "¿Necesitas ayuda? Selecciona una categoría abajo para abrir un ticket seguro.",
        ticketCreated: "✅ Tu ticket se ha abierto con éxito:",
        transcriptHeader: "--- TRANSCRIPT DEL TICKET ---",
        antiRaidAlert: "🚨 **Alerta Anti-Raid IA**: ¡Anomalía detectada! Se han activado medidas automáticas.",
        footer: "Sistema modular de seguridad y gestión"
    },
    it_IT: {
        helpTitle: "📜 Centro Assistenza Avanzato - Bot Modulare",
        helpDesc: "Ecco l'elenco ufficiale dei comandi disponibili:",
        configTitle: "⚙️ Pannello di Configurazione Globale",
        langSet: "✅ Lingua aggiornata in **Italiano (it_IT)**!",
        ticketTitle: "🎫 Supporto e Ticket",
        ticketDesc: "Hai bisogno di assistenza? Seleziona una categoria qui sotto per aprire un ticket.",
        ticketCreated: "✅ Il tuo ticket è stato aperto con successo:",
        transcriptHeader: "--- TRANSCRIPT DEL TICKET ---",
        antiRaidAlert: "🚨 **Allerta Anti-Raid IA**: Anomalia rilevata! Misure di protezione attivate.",
        footer: "Sistema modulare di sicurezza e gestione"
    }
};

function getT(guildId, key) {
    const settings = serverSettings.get(guildId) || { lang: 'fr_FR' };
    const lang = settings.lang || 'fr_FR';
    return translations[lang][key] || translations['fr_FR'][key];
}

client.once('ready', async () => {
    console.log(`[MODULE BOT] Connecté en tant que ${client.user.tag}`);

    // Commandes Slash avec migration propre
    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Gérer la configuration globale et les langues du bot')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Déploie le panneau de tickets interactif')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('antiraid-ia')
            .setDescription('Active ou configure l\'Anti-Raid intelligent par IA')
            .addBooleanOption(opt => opt.setName('etat').setDescription('Activer ou désactiver l\'IA').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Affiche le centre d\'aide dynamique')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[REST] Commandes globales enregistrées avec succès.');
    } catch (error) {
        console.error('[REST ERROR]', error);
    }
});

// Événement d'arrivée sur un serveur pour initialiser les paramètres par défaut
client.on('guildCreate', async (guild) => {
    serverSettings.set(guild.id, { lang: 'fr_FR', antiRaidAI: true, transcriptChannel: null });
});

// Détection Anti-Raid IA (Analyse comportementale en temps réel)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    let settings = serverSettings.get(message.guild.id) || { lang: 'fr_FR', antiRaidAI: true };
    if (!settings.antiRaidAI) return;

    const userId = message.author.id;
    const now = Date.now();
    if (!raidTracker.has(userId)) raidTracker.set(userId, []);
    
    let timestamps = raidTracker.get(userId);
    timestamps.push(now);
    
    // Garde uniquement les messages des 5 dernières secondes
    timestamps = timestamps.filter(time => now - time < 5000);
    raidTracker.set(userId, timestamps);

    // Simulation d'une analyse IA d'anomalie (Seuil critique > 6 messages en 5 secondes)
    if (timestamps.length > 6) {
        try {
            await message.member.timeout(10 * 60 * 1000, "Anti-Raid IA : Spam massif / Anomalie détectée");
            const alertChannel = message.guild.systemChannel || message.channel;
            await alertChannel.send({ content: `${message.author} 🚨 ${getT(message.guild.id, 'antiRaidAlert')}` });
            raidTracker.set(userId, []); // Reset
        } catch (e) {
            console.error("Erreur action Anti-Raid IA :", e);
        }
    }
});

client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { lang: 'fr_FR', antiRaidAI: true };
    serverSettings.set(interaction.guildId, settings);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'helpTitle'))
                .setDescription(getT(interaction.guildId, 'helpDesc'))
                .addFields(
                    { name: '/config', value: 'Paramètres du serveur et choix de langue dynamique' },
                    { name: '/ticketpanel', value: 'Création du panneau de tickets modulaire' },
                    { name: '/antiraid-ia', value: 'Gestion de la sécurité comportementale IA' }
                )
                .setColor('#3498DB')
                .setFooter({ text: getT(interaction.guildId, 'footer') });
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'config') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'configTitle'))
                .setDescription('Modifiez la langue de votre serveur. Les commandes et menus s\'adapteront instantanément.')
                .addFields(
                    { name: '🌐 Langue Actuelle', value: settings.lang, inline: true },
                    { name: '🛡️ Anti-Raid IA', value: settings.antiRaidAI ? '🟢 Actif' : '🔴 Inactif', inline: true }
                )
                .setColor('#2ECC71');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('global_lang_select')
                .setPlaceholder('Sélectionner la langue...')
                .addOptions([
                    { label: 'Français', value: 'fr_FR', emoji: '🇫🇷' },
                    { label: 'English', value: 'en_US', emoji: '🇬🇧' },
                    { label: 'Español', value: 'es_ES', emoji: '🇪🇸' },
                    { label: 'Italiano', value: 'it_IT', emoji: '🇮🇹' }
                ]);

            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            const embed = new EmbedBuilder()
                .setTitle(getT(interaction.guildId, 'ticketTitle'))
                .setDescription(getT(interaction.guildId, 'ticketDesc'))
                .setColor('#9B59B6');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_create_support').setLabel('Support & Aide').setEmoji('🎫').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('ticket_create_bug').setLabel('Signaler un Bug').setEmoji('🐛').setStyle(ButtonStyle.Danger)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Panneau de tickets déployé avec succès !', ephemeral: true });
        }

        if (commandName === 'antiraid-ia') {
            const etat = interaction.options.getBoolean('etat');
            settings.antiRaidAI = etat;
            return interaction.reply({ content: `✅ L'Anti-Raid IA est désormais ${etat ? '**activé** (surveillance active)' : '**désactivé**'}.`, ephemeral: true });
        }
    }

    // Gestion du menu déroulant de changement de langue dynamique
    if (interaction.isStringSelectMenu() && interaction.customId === 'global_lang_select') {
        settings.lang = interaction.values[0];
        return interaction.update({ content: getT(interaction.guildId, 'langSet'), embeds: [], components: [] });
    }

    // Création dynamique d'un ticket modulaire
    if (interaction.isButton() && interaction.customId.startsWith('ticket_create_')) {
        await interaction.deferReply({ ephemeral: true });
        const type = interaction.customId.split('_')[2];

        try {
            const channelName = `ticket-${type}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Ticket : ${type.toUpperCase()}`)
                .setDescription(`Bonjour ${interaction.user}, un membre de l'équipe va vous prendre en charge.\nFermeture sécurisée disponible ci-dessous (réservée aux rôles autorisés).`)
                .setColor('#3498DB');

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_close_secure').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [ticketEmbed], components: [controlRow] });
            return interaction.editReply({ content: `${getT(interaction.guildId, 'ticketCreated')} ${ticketChannel}` });
        } catch (e) {
            return interaction.editReply({ content: '❌ Erreur lors de la création du salon de ticket.' });
        }
    }

    // Fermeture contrôlée par rôles, génération de transcript et traçabilité
    if (interaction.isButton() && interaction.customId === 'ticket_close_secure') {
        // Vérification des permissions (Gérer le salon ou rôle Administrateur/Modérateur requis)
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ Vous n\'avez pas les rôles requis pour fermer ce ticket.', ephemeral: true });
        }

        await interaction.reply({ content: '🔒 Génération du transcript et fermeture imminente...', ephemeral: true });

        try {
            // Récupération de l'historique des messages pour le transcript
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcript = `${getT(interaction.guildId, 'transcriptHeader')}\nSalon : ${interaction.channel.name}\nDate : ${new Date().toISOString()}\nFermé par : ${interaction.user.tag}\n\n`;
            
            messages.reverse().forEach(m => {
                transcript += `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}\n`;
            });

            const buffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

            // Envoi du transcript dans les logs ou le salon actuel avant suppression
            await interaction.channel.send({ content: '📄 Voici le compte-rendu (transcript) de ce ticket :', files: [attachment] });

            setTimeout(async () => {
                try { await interaction.channel.delete(); } catch (err) {}
            }, 4000);
        } catch (err) {
            console.error('Erreur lors de la fermeture du ticket :', err);
        }
    }
});

client.login(process.env.TOKEN);
    
