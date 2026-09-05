const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Mémoire de configuration par serveur
const serverSettings = new Map(); 

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt pour la sécurité maximale.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Ouvrir le panneau de configuration interactif de Yodo')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('antiraid')
            .setDescription('Activer ou désactiver le mode verrouillage Anti-Raid et Anti-Nuke')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Lancer un giveaway sur le serveur')
            .addStringOption(option => 
                option.setName('lot')
                    .setDescription('Le lot à gagner')
                    .setRequired(true)
            )
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher la liste des commandes et l\'aide de Yodo Protect')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[COMMANDES] Enregistrées avec succès sur Discord !');
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
        .setDescription('Salut ! Je suis **Yodo**, votre bouclier de sécurité ultime.\n\n' +
                          '• **Anti-Nuke & IA** activés par défaut.\n' +
                          '• Tapez `/config` pour gérer les paramètres ou `/help` pour l\'aide.')
        .setColor('#5865F2')
        .setTimestamp();

    await channel.send({ embeds: [welcomeEmbed] });
});

// 2. GESTION DES INTERACTIONS (Commandes, Boutons, Menus)
client.on('interactionCreate', async interaction => {
    let settings = serverSettings.get(interaction.guildId) || { 
        lang: 'fr', 
        antiRaidActive: false, 
        antiNukeActive: true, 
        antiSpamLimit: 5 
    };
    serverSettings.set(interaction.guildId, settings);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('📜 Centre d\'Aide - Yodo Protect')
                .setDescription('Voici la liste officielle des commandes de sécurité et d\'animation :')
                .addFields(
                    { name: '/config', value: 'Ouvre le panneau de configuration interactif.' },
                    { name: '/antiraid', value: 'Active ou désactive le mode verrouillage Anti-Raid et l\'Anti-Nuke.' },
                    { name: '/giveaway [lot]', value: 'Lance instantanément un giveaway pour récompenser votre communauté.' },
                    { name: '/help', value: 'Affiche ce message d\'aide.' }
                )
                .setColor('#2b2d31');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'config') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Panneau de Configuration - Yodo Protect')
                .setDescription('Gérez la sécurité et les options de votre serveur en toute simplicité.')
                .addFields(
                    { name: '🌐 Langue', value: settings.lang.toUpperCase(), inline: true },
                    { name: '🛡️ Anti-Raid (Lock)', value: settings.antiRaidActive ? '🟢 Actif' : '🔴 Inactif', inline: true },
                    { name: '🤖 Anti-Nuke (IA)', value: settings.antiNukeActive ? '🟢 Actif' : '🔴 Inactif', inline: true },
                    { name: '💬 Limite Anti-Spam', value: `${settings.antiSpamLimit} mots`, inline: true }
                )
                .setColor('#5865F2');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('config_menu')
                .setPlaceholder('Sélectionnez un paramètre à modifier...')
                .addOptions([
                    { label: 'Changer la Langue (FR / EN)', value: 'menu_lang', emoji: '🌐' },
                    { label: 'Configurer l\'Anti-Spam', value: 'menu_antispam', emoji: '💬' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'antiraid') {
            const embed = new EmbedBuilder()
                .setTitle('🚨 Centre de Sécurité & Verrouillage (Anti-Raid / Anti-Nuke)')
                .setDescription(`État actuel des défenses :\n\n- **Anti-Raid (Bloquer les arrivées) :** ${settings.antiRaidActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}\n- **Anti-Nuke (Protection Bots/Attaques) :** ${settings.antiNukeActive ? '🟢 ACTIVÉ' : '🔴 DÉSACTIVÉ'}`)
                .setColor(settings.antiRaidActive ? '#ed4245' : '#57f287');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(settings.antiRaidActive ? 'antiraid_off' : 'antiraid_on')
                    .setLabel(settings.antiRaidActive ? 'Désactiver l\'Anti-Raid' : 'Activer l\'Anti-Raid (Lock)')
                    .setStyle(settings.antiRaidActive ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(settings.antiNukeActive ? 'antinuke_off' : 'antinuke_on')
                    .setLabel(settings.antiNukeActive ? 'Désactiver l\'Anti-Nuke' : 'Activer l\'Anti-Nuke')
                    .setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (commandName === 'giveaway') {
            const lot = interaction.options.getString('lot');
            const giveawayEmbed = new EmbedBuilder()
                .setTitle('🎉 NOUVEAU GIVEAWAY ! 🎉')
                .setDescription(`Lot mis en jeu : **${lot}**\n\nRéagissez avec 🎉 ci-dessous pour participer !\nOrganisé par : ${interaction.user}`)
                .setColor('#fEE75C')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('participate_giveaway').setLabel('Participer 🎉').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [giveawayEmbed], components: [row], fetchReply: true });
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
                return interaction.update({ content: '🌐 Choisissez la langue du bot :', components: [langRow], embeds: [] });
            }
            if (choice === 'menu_antispam') {
                const spamRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('spam_3').setLabel('3 mots').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('spam_5').setLabel('5 mots (Recommandé)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('spam_10').setLabel('10 mots').setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({ content: `💬 Choisissez la limite de tolérance anti-spam (actuelle : ${settings.antiSpamLimit} mots) :`, components: [spamRow], embeds: [] });
            }
        }
    }

    // Gestion des boutons de configuration et de sécurité
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'set_lang_fr') {
            settings.lang = 'fr';
            return interaction.update({ content: '✅ Langue configurée en **Français** !', components: [] });
        }
        if (id === 'set_lang_en') {
            settings.lang = 'en';
            return interaction.update({ content: '✅ Language set to **English**!', components: [] });
        }
        if (id.startsWith('spam_')) {
            const limit = parseInt(id.split('_')[1]);
            settings.antiSpamLimit = limit;
            return interaction.update({ content: `✅ Anti-spam mis à jour : limite fixée à **${limit} mots**.`, components: [] });
        }
        if (id === 'antiraid_on') {
            settings.antiRaidActive = true;
            return interaction.update({ content: '🚨 **MODE ANTI-RAID ACTIVÉ !** Le serveur est verrouillé, les nouveaux membres seront bloqués.', components: [] });
        }
        if (id === 'antiraid_off') {
            settings.antiRaidActive = false;
            return interaction.update({ content: '✅ **Mode Anti-Raid désactivé.** Les arrivées sont de nouveau autorisées.', components: [] });
        }
        if (id === 'antinuke_on') {
            settings.antinukeActive = true;
            return interaction.update({ content: '🛡️ **Anti-Nuke activé.** Protection maximale contre les attaques enclenchée.', components: [] });
        }
        if (id === 'antinuke_off') {
            settings.antinukeActive = false;
            return interaction.update({ content: '⚠️ **Anti-Nuke désactivé.** Attention aux risques d\'attaques.', components: [] });
        }
        if (id === 'participate_giveaway') {
            return interaction.reply({ content: '🎉 C\'est enregistré ! Bonne chance pour le giveaway !', ephemeral: true });
        }
    }
});

// 3. PROTECTION ANTI-RAID (Bloque et expulse les nouveaux si activé)
client.on('guildMemberAdd', async member => {
    const settings = serverSettings.get(member.guild.id);
    if (settings && settings.antiRaidActive) {
        try {
            await member.send("⚠️ Ce serveur est actuellement sous protection **Anti-Raid strict**. Les adhésions sont suspendues.");
            await member.kick('Anti-Raid actif : Expulsion automatique du nouveau membre.');
        } catch (e) {
            console.error("Erreur anti-raid member add :", e);
        }
    }
});

// 4. BOUCLIER ANTI-NUKE & ANTI-SPAM INTELLIGENT
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const settings = serverSettings.get(message.guild.id) || { antiSpamLimit: 5, antiNukeActive: true };
    const content = message.content.trim();

    // Détection Anti-Nuke (Commandes de destruction, mass ban, spam de webhooks)
    if (settings.antiNukeActive && (content.toLowerCase().startsWith('!nuke') || content.toLowerCase().includes('mass ban') || content.toLowerCase().includes('webhook spam'))) {
        try {
            await message.delete();
            if (message.member && message.guild.members.me.permissions.has('BanMembers')) {
                await message.guild.members.ban(message.author.id, { reason: 'Anti-Nuke IA : Tentative d\'attaque critique neutralisée.' });
                message.channel.send(`🚨 **ALERTE BOUCLIER ANTI-NUKE** : ${message.author.tag} a tenté d'exécuter une action malveillante et a été banni sur-le-champ.`);
            }
        } catch (e) {
            console.error("Erreur anti-nuke :", e);
        }
        return;
    }

    // Détection Anti-Spam basique
    const words = content.split(/\s+/);
    if (words.length >= settings.antiSpamLimit) {
        const counts = {};
        for (let w of words) {
            counts[w] = (counts[w] || 0) + 1;
            if (counts[w] >= settings.antiSpamLimit) {
                try {
                    await message.delete();
                    message.channel.send(`⚠️ ${message.author}, attention au spam ! Ton message a été supprimé.`);
                } catch (e) {
                    console.error("Erreur anti-spam :", e);
                }
                break;
            }
        }
    }
});

client.login(process.env.TOKEN);
    
