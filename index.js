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

// Stockage des configurations par serveur (Rôle staff à mentionner, etc.)
const serverConfigs = new Map();
// Suivi de l'étape des tickets en cours (pour guider l'utilisateur : problème -> preuves -> staff)
const ticketSteps = new Map();

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt à lutter contre le harcèlement.`);

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
                .setDescription('Je suis un bot dédié à la protection, à l\'écoute et à la lutte contre le harcèlement.')
                .addFields(
                    { name: '/ticketpanel', value: 'Envoyer le panneau de signalement / contact' },
                    { name: '/setstaffrole', value: 'Définir quel rôle de staff mentionner lors des urgences' }
                )
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'setstaffrole') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }
            const role = interaction.options.getRole('role');
            config.staffRoleId = role.id;
            return interaction.reply({ content: `✅ Le rôle staff à mentionner a été défini sur **${role.name}** !`, ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Espace d\'écoute & Signalement - Yodo Protect')
                .setDescription('Victime ou témoin de harcèlement, de toxicité ou d\'un problème sur le serveur ?\n\n*Ne reste pas seul(e), sélectionne une option dans le menu ci-dessous pour ouvrir un espace d\'échange 100% sécurisé et confidentiel avec l\'équipe.*')
                .setColor('#FF6B6B');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Choisis le motif de ton message...')
                .addOptions([
                    { label: 'Harcèlement / Cyberharcèlement', value: 'harcelement', emoji: '🚨', description: 'Insultes, menaces, acharnement...' },
                    { label: 'Problème / Conflit entre membres', value: 'conflit', emoji: '⚠️', description: 'Tensions, disputes sur le serveur' },
                    { label: 'Aide / Question générale', value: 'autre', emoji: '💬', description: 'Besoin d\'un renseignement ou de parler' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Panel de tickets envoyé avec succès !', ephemeral: true });
        }
    }

    // Gestion du menu déroulant (Sélection du motif)
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

            // On enregistre l'état initial du ticket pour ce salon
            ticketSteps.set(ticketChannel.id, { step: 'waiting_problem', userId: interaction.user.id });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('💬 Espace d\'écoute sécurisé')
                .setDescription(`Bonjour ${interaction.user} ! 👋\nJ'ai bien reçu ta demande concernant : **${motif.toUpperCase()}**.\n\nPrends ton temps, dis-nous : **quel problème est-ce que tu rencontres ?**`)
                .setColor('#5865F2');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le salon').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [closeRow] });
            return interaction.editReply({ content: `✅ Ton espace sécurisé a été créé : ${ticketChannel}` });
        } catch (e) {
            return interaction.editReply({ content: `❌ Erreur lors de la création de l'espace.` });
        }
    }

    // Bouton de fermeture de ticket
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 Fermeture de l\'espace et génération du transcript...', ephemeral: true });

        try {
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            let transcript = `--- TRANSCRIPT / RAPPORT D'ÉCOUTE ---\nSalon : ${interaction.channel.name}\nDate : ${new Date().toLocaleString()}\n\n`;
            
            messages.reverse().forEach(m => {
                transcript += `[${new Date(m.createdTimestamp).toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`;
            });

            const buffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

            // Envoi du transcript en Message Privé à l'utilisateur qui ferme/ouvre le ticket si possible, ou dans le salon avant suppression
            try {
                const ownerId = ticketSteps.get(interaction.channel.id)?.userId;
                if (ownerId) {
                    const memberTarget = await interaction.guild.members.fetch(ownerId).catch(() => null);
                    if (memberTarget) {
                        await memberTarget.send({ content: '📄 Voici le compte-rendu de ton échange avec l\'équipe (transcript) :', files: [attachment] });
                    }
                }
            } catch (err) {
                // Si les MP sont fermés, on l'envoie directement dans le salon
                await interaction.channel.send({ content: '📄 Compte-rendu de l\'échange :', files: [attachment] });
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

// Écouteur de messages dans les salons de tickets pour guider l'utilisateur
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Détection basique d'une salutation si quelqu'un écrit "bonjour", "salut", "hey", etc. dans un salon normal
    const contentLower = message.content.toLowerCase();
    if (contentLower.includes('bonjour') || contentLower.includes('salut') || contentLower.includes('hey') || contentLower.includes('coucou')) {
        // Optionnel : tu peux laisser le bot répondre s'il est interpellé, mais concentrons-nous sur les tickets pour l'anti-harcèlement.
    }

    // Si on est dans un salon de ticket géré par le bot
    if (ticketSteps.has(message.channel.id)) {
        const state = ticketSteps.get(message.channel.id);
        const config = serverConfigs.get(message.guild.id) || { staffRoleId: null };

        if (state.step === 'waiting_problem') {
            // Le membre vient d'expliquer son problème, le bot analyse/répond et demande les preuves
            state.step = 'waiting_proofs';
            
            const replyEmbed = new EmbedBuilder()
                .setTitle('🔍 Analyse & Suivi')
                .setDescription('J\'ai bien pris note de ta situation. C\'est courageux de t'exprimer.\n\nPour que l\'équipe puisse agir efficacement, **peux-tu nous fournir des preuves** (captures d\'écran des messages, des profils concernés, des liens ou des détails supplémentaires) ?')
                .setColor('#FFA500');

            return message.reply({ embeds: [replyEmbed] });
        }
        else if (state.step === 'waiting_proofs') {
            // Le membre a envoyé les preuves, le bot valide et contacte le staff en mentionnant le rôle configuré
            state.step = 'staff_notified';

            let staffMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : '**[Rôle Staff non configuré - Utilisez /setstaffrole]**';

            const finalEmbed = new EmbedBuilder()
                .setTitle('🚨 Équipe prévenue')
                .setDescription('Merci, j\'ai bien enregistré les éléments et les preuves transmises.\n\n**Je contacte l\'équipe staff immédiatement !** Un modérateur va arriver dans cet espace pour t'aider en toute sécurité.')
                .setColor('#2ECC71');

            await message.reply({ content: `${staffMention}`, embeds: [finalEmbed] });
        }
    }
});

client.login(process.env.TOKEN);
                                                                         
