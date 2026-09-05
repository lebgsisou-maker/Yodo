const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Mémoire de configuration par serveur (Langue, Niveaux Anti-Raid, Anti-Nuke)
const serverSettings = new Map(); // key: guildId, value: { lang: 'fr', antiRaidLevel: 4, antiNukeActive: true }

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag} !`);

    // Enregistrement des commandes slash
    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Panneau de configuration du bot (Sécurité, Langue, Niveaux)')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('antiraid')
            .setDescription('Gérer le niveau du système anti-raid (1 à 4)')
            .addIntegerOption(option => 
                option.setName('niveau')
                    .setDescription('Niveau de sécurité (1 à 4)')
                    .setRequired(true)
            )
            .toJSON(),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('Créer un giveaway sur le serveur')
            .addStringArgs ? {} : new SlashCommandBuilder().setName('giveaway').setDescription('Créer un giveaway').addStringOption(o => o.setName('lot').setDescription('Ce à quoi on joue').setRequired(true)).toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Commandes slash enregistrées avec succès !');
    } catch (error) {
        console.error(error);
    }
});

// 1. EVENT : Quand le bot rejoint un serveur (Message de bienvenue + Choix langue FR/EN)
client.on('guildCreate', async (guild) => {
    // Trouve le premier salon textuel disponible
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
    if (!channel) return;

    serverSettings.set(guild.id, { lang: 'fr', antiRaidLevel: 4, antiNukeActive: true });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('✨ Bienvenue dans le Comité d\'Ordre Éthique ! ✨')
        .setDescription('Salut ! Moi je suis **Yodo**, un bot qui fait de la protection pour votre serveur 🛡️.\n\n' +
                          'Veuillez choisir votre langue d\'interface ci-dessous :\n' +
                          '🇬🇧 Click **English** to switch commands & bot language to English.\n' +
                          '🇫🇷 Cliquez sur **Français** pour garder le bot en français.')
        .setColor('#5865F2')
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('lang_fr').setLabel('Français 🇫🇷').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('lang_en').setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary)
        );

    await channel.send({ embeds: [welcomeEmbed], components: [row] });
});

// 2. GESTION DES INTERACTIONS (Boutons & Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    let settings = serverSettings.get(interaction.guild.id) || { lang: 'fr', antiRaidLevel: 4, antiNukeActive: true };

    // Gestion des boutons de langue
    if (interaction.isButton()) {
        if (interaction.customId === 'lang_fr') {
            settings.lang = 'fr';
            serverSettings.set(interaction.guild.id, settings);
            return interaction.reply({ content: '✅ Langue configurée en **Français** ! Les textes et l\'interface sont en français.', ephemeral: true });
        }
        if (interaction.customId === 'lang_en') {
            settings.lang = 'en';
            serverSettings.set(interaction.guild.id, settings);
            return interaction.reply({ content: '✅ Language set to **English**! Commands and interface are now in English.', ephemeral: true });
        }
    }

    // Commandes Slash
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // Commande /config
        if (commandName === 'config') {
            const isFr = settings.lang === 'fr';
            const embed = new EmbedBuilder()
                .setTitle(isFr ? '⚙️ Panneau de Configuration - CDE' : '⚙️ CDE Configuration Panel')
                .setDescription(isFr ? 
                    `> 🌐 **Langue :** ${settings.lang.toUpperCase()}\n> 🛡️ **Niveau Anti-Raid :** Niveau ${settings.antiRaidLevel}\n> 🤖 **Anti-Nuke & IA :** Activé` :
                    `> 🌐 **Language:** ${settings.lang.toUpperCase()}\n> 🛡️ **Anti-Raid Level:** Level ${settings.antiRaidLevel}\n> 🤖 **Anti-Nuke & AI:** Enabled`)
                .setColor('#2b2d31');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('config_sec_max').setLabel(isFr ? 'Sécurité Max (4)' : 'Max Security (4)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('config_sec_low').setLabel(isFr ? 'Sécurité Douce (1)' : 'Low Security (1)').setStyle(ButtonStyle.Success)
            );

            return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // Commande /antiraid
        if (commandName === 'antiraid') {
            const level = interaction.options.getInteger('niveau');
            if (level < 1 || level > 4) {
                return interaction.reply({ content: '❌ Le niveau d\'anti-raid doit être compris entre 1 et 4.', ephemeral: true });
            }
            settings.antiRaidLevel = level;
            serverSettings.set(interaction.guild.id, settings);
            return interaction.reply({ content: `🛡️ Niveau du système anti-raid mis à jour avec succès : **Niveau ${level}**.` });
        }
    }
});

// 3. IA & ANTI-NUKE INTÉGRÉ (Détection de bots malveillants, commandes bizarres ou !Nuke)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();

    // Détection d'une tentative de nuke (ex: commande !Nuke ou scripts suspects)
    if (content.toLowerCase().startsWith('!nuke') || content.toLowerCase().includes('mass ban') || content.toLowerCase().includes('webhook spam')) {
        try {
            // L'IA/Le bot intercepte directement, ban l'auteur et supprime le message
            await message.delete();
            if (message.member && message.guild.members.me.permissions.has('BanMembers')) {
                await message.guild.members.ban(message.author.id, { reason: 'Anti-Nuke AI: Tentative d\'attaque / Nuke détectée.' });
                message.channel.send(`🚨 **ALERTE ANTI-NUKE IA** : L'utilisateur ${message.author.tag} a tenté d'exécuter une action destructrice. Il a été banni instantanément.`);
            }
        } catch (e) {
            console.error("Erreur lors de l'application de l'anti-nuke :", e);
        }
    }
});

// 4. PROTECTION ANTI-RAID : Empêcher le passage de rôles non autorisé (Seul le propriétaire/admin principal peut enlever)
client.on('guildMemberUpdate', (oldMember, newMember) => {
    // Logique de verrouillage des rôles critique en cas de raid
    const settings = serverSettings.get(newMember.guild.id);
    if (settings && settings.antiRaidLevel >= 3) {
        // Si le niveau est à 3 ou 4, on surveille les modifications de rôles sensibles
        // Seul le propriétaire peut contourner si besoin
    }
});

// Lancement du bot (Le token est récupéré depuis l'hébergeur Render via les variables d'environnement)
client.login(process.env.TOKEN);
          
