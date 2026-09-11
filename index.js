const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// Initialisation de l'API Gemini (utilise la variable d'environnement GEMINI_API_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

const serverConfigs = new Map();
const ticketSteps = new Map();

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt avec l'IA.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Envoyer le panel de tickets de signalement / aide')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('setstaffrole')
            .setDescription('Définir le rôle du staff à mentionner lors d\'un signalement')
            .addRoleOption(option => option.setName('role').setDescription('Le rôle du staff').setRequired(true))
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

client.on('interactionCreate', async interaction => {
    let config = serverConfigs.get(interaction.guildId) || { staffRoleId: null };
    serverConfigs.set(interaction.guildId, config);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Yodo Protect - Centre d\'Aide')
                .setDescription('Je suis un bot intelligent dédié à la protection et à l\'écoute.')
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'setstaffrole') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }
            const role = interaction.options.getRole('role');
            config.staffRoleId = role.id;
            return interaction.reply({ content: `✅ Le rôle staff a été défini sur **${role.name}** !`, ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Espace d\'écoute & Signalement - Yodo Protect')
                .setDescription('Victime ou témoin de harcèlement ou d\'un problème ?\n\n*Sélectionne une option pour ouvrir un espace sécurisé avec notre assistant virtuel et l\'équipe.*')
                .setColor('#FF6B6B');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Choisis le motif...')
                .addOptions([
                    { label: 'Harcèlement / Cyberharcèlement', value: 'harcelement', emoji: '🚨', description: 'Insultes, menaces, acharnement...' },
                    { label: 'Problème / Conflit entre membres', value: 'conflit', emoji: '⚠️', description: 'Tensions, disputes sur le serveur' },
                    { label: 'Aide / Question générale', value: 'autre', emoji: '💬', description: 'Besoin d\'un renseignement' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Panel envoyé !', ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        await interaction.deferReply({ ephemeral: true });
        const motif = interaction.values[0];

        try {
            const channelName = `secours-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
            });

            // On initialise l'historique de discussion pour l'IA dans ce salon
            ticketSteps.set(ticketChannel.id, { 
                userId: interaction.user.id, 
                motif: motif,
                history: [] 
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('💬 Espace d\'écoute intelligent')
                .setDescription(`Bonjour ${interaction.user} ! 👋\nJ'ai bien reçu ta demande concernant : **${motif.toUpperCase()}**.\n\nDis-moi tout, je t'écoute et je suis là pour t'aider.`)
                .setColor('#5865F2');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le salon').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [closeRow] });
            return interaction.editReply({ content: `✅ Espace créé : ${ticketChannel}` });
        } catch (e) {
            return interaction.editReply({ content: `❌ Erreur lors de la création.` });
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 Fermeture et génération du transcript...', ephemeral: true });

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcript = `--- TRANSCRIPT ---\nSalon : ${interaction.channel.name}\nDate : ${new Date().toLocaleString()}\n\n`;
            messages.reverse().forEach(m => {
                transcript += `[${new Date(m.createdTimestamp).toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`;
            });

            const buffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

            const ownerId = ticketSteps.get(interaction.channel.id)?.userId;
            if (ownerId) {
                const memberTarget = await interaction.guild.members.fetch(ownerId).catch(() => null);
                if (memberTarget) {
                    await memberTarget.send({ content: '📄 Ton compte-rendu :', files: [attachment] }).catch(() => {});
                }
            }

            ticketSteps.delete(interaction.channel.id);
            setTimeout(async () => {
                try { await interaction.channel.delete(); } catch (e) {}
            }, 3000);
        } catch (e) {
            console.error(e);
        }
    }
});

// Gestion des messages avec l'IA Gemini
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (ticketSteps.has(message.channel.id)) {
        const ticketData = ticketSteps.get(message.channel.id);
        const config = serverConfigs.get(message.guild.id) || { staffRoleId: null };

        // Afficher un indicateur de frappe (le bot "écrit...")
        await message.channel.sendTyping();

        try {
            // On prépare le prompt pour Gemini avec le contexte
            const systemInstruction = `Tu es Yodo Protect, un assistant virtuel bienveillant, rassurant et à l'écoute sur Discord, spécialisé dans l'aide aux victimes de harcèlement ou de conflits. 
            Le motif du ticket est : ${ticketData.motif}.
            Ton rôle est de discuter avec l'utilisateur, de le mettre en confiance, de lui poser des questions douces pour comprendre la situation, et de lui demander des preuves (captures d'écran, liens) si nécessaire.
            Sois concis (maximum 2-3 phrases), chaleureux et utilise des émojis.
            IMPORTANT : Si tu estimes que l'utilisateur a suffisamment expliqué son problème ou qu'il y a une urgence, inclus le mot-clé exact [CONTACT_STAFF] à la fin de ta réponse pour que le bot prévienne les modérateurs.`;

            // Appel à l'API Gemini avec le modèle standard flash
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: message.content,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            let replyText = response.text;

            // Vérifie si l'IA a décidé de contacter le staff
            let notifyStaff = false;
            if (replyText.includes('[CONTACT_STAFF]')) {
                notifyStaff = true;
                replyText = replyText.replace('[CONTACT_STAFF]', '').trim();
            }

            await message.reply(replyText);

            // Si l'IA déclenche l'appel au staff
            if (notifyStaff) {
                let staffMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : '**[Rôle Staff non configuré]**';
                const staffEmbed = new EmbedBuilder()
                    .setTitle('🚨 Intervention du Staff demandée par l\'IA')
                    .setDescription('L\'assistant a analysé la situation et estimé qu\'un membre de l\'équipe doit intervenir pour aider cet utilisateur.')
                    .setColor('#2ECC71');

                await message.channel.send({ content: `${staffMention}`, embeds: [staffEmbed] });
            }

        } catch (error) {
            console.error('Erreur Gemini:', error);
            await message.reply('Oups, j\'ai eu un petit problème de connexion neuronale, mais je t\'écoute toujours !');
        }
    }
});

client.login(process.env.TOKEN);
            
