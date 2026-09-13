const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- CONFIGURATION EXPRESS & OAUTH2 ---
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/discord/callback';

// --- PAGE D'ACCUEIL / VITRINE DU BOT ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Yodo Protect - Bot de Sécurité, Tickets & Modération</title>
            <style>
                body {
                    background-color: #0d1117;
                    color: #c9d1d9;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 0;
                }
                header {
                    background: #161b22;
                    padding: 20px 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #30363d;
                }
                .logo {
                    font-size: 22px;
                    font-weight: bold;
                    color: #5865F2;
                }
                .hero {
                    text-align: center;
                    padding: 80px 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    font-size: 48px;
                    color: #ffffff;
                    margin-bottom: 20px;
                }
                p.subtitle {
                    font-size: 18px;
                    color: #8b949e;
                    margin-bottom: 40px;
                    line-height: 1.6;
                }
                .btn-group {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-bottom: 60px;
                }
                .btn {
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-weight: bold;
                    text-decoration: none;
                    transition: transform 0.2s, background 0.2s;
                }
                .btn-primary {
                    background-color: #5865F2;
                    color: white;
                }
                .btn-primary:hover {
                    background-color: #4752C4;
                }
                .btn-secondary {
                    background-color: #21262d;
                    color: #c9d1d9;
                    border: 1px solid #30363d;
                }
                .btn-secondary:hover {
                    background-color: #30363d;
                }
                .features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    padding: 0 40px 80px 40px;
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .card {
                    background-color: #161b22;
                    border: 1px solid #30363d;
                    padding: 25px;
                    border-radius: 10px;
                }
                .card h3 {
                    color: #5865F2;
                    margin-top: 0;
                }
                footer {
                    text-align: center;
                    padding: 30px;
                    background: #161b22;
                    color: #8b949e;
                    border-top: 1px solid #30363d;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <header>
                <div class="logo">🛡️ Yodo Protect</div>
                <div>
                    <a href="/auth/discord" class="btn btn-secondary" style="padding: 8px 16px;">Connexion Dashboard</a>
                </div>
            </header>

            <div class="hero">
                <h1>Protégez et gérez votre serveur Discord avec brio</h1>
                <p class="subtitle">Yodo Protect est le bot ultime tout-en-un : Anti-Raid et Anti-Nuke avancé, système de tickets intelligent avec relance automatique, niveaux personnalisés, modération stricte et bien plus encore !</p>
                
                <div class="btn-group">
                    <a href="https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands" class="btn btn-primary" target="_blank">Ajouter le Bot</a>
                    <a href="/auth/discord" class="btn btn-secondary">Accéder au Dashboard</a>
                </div>
            </div>

            <div class="features">
                <div class="card">
                    <h3>🛡️ Anti-Raid & Anti-Nuke</h3>
                    <p>Protection multi-niveaux pour intercepter les bots, les raids massifs et contrer instantanément toute tentative de nuke.</p>
                </div>
                <div class="card">
                    <h3>🎫 Système de Tickets Pro</h3>
                    <p>Salons sécurisés, transcripts automatiques, rôles staff configurables et assistant de relance si le staff met du temps à répondre.</p>
                </div>
                <div class="card">
                    <h3>⭐ Niveaux & Bienvenue</h3>
                    <p>Messages de bienvenue/au revoir ultra-personnalisables et système d'XP avec bannières de rang.</p>
                </div>
            </div>

            <footer>
                <p>&copy; 2026 Yodo Protect. Tous droits réservés. | Conditions d'utilisation (ToS)</p>
            </footer>
        </body>
        </html>
    `);
});

app.get('/auth/discord', (req, res) => {
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordLoginUrl);
});

// --- PAGE DE GESTION DES SERVEURS (DASHBOARD) ---
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Aucun code reçu de Discord.');

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        });

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const guilds = guildsResponse.data;

        let guildsHtml = '';
        guilds.forEach(guild => {
            const canManage = (guild.permissions & 0x20) === 0x20 || (guild.permissions & 0x8) === 0x8;
            if (canManage) {
                guildsHtml += `
                    <div style="background: #161b22; border: 1px solid #30363d; padding: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="font-size: 24px; font-weight: bold; color: #5865F2; background: #21262d; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">⚙️</div>
                            <div>
                                <h3 style="margin: 0; color: #fff; font-size: 18px;">${guild.name}</h3>
                                <p style="margin: 5px 0 0 0; color: #8b949e; font-size: 13px;">ID: ${guild.id}</p>
                            </div>
                        </div>
                        <a href="#" style="background: #238636; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Configurer</a>
                    </div>
                `;
            }
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Yodo Protect - Sélection du serveur</title>
                <style>
                    body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; margin: 0; }
                    .container { max-width: 800px; margin: 0 auto; }
                    h1 { color: #fff; font-size: 28px; }
                    p { color: #8b949e; }
                    .stats { display: flex; gap: 20px; margin: 30px 0; }
                    .stat-card { background: #161b22; border: 1px solid #30363d; padding: 20px; border-radius: 10px; flex: 1; text-align: center; }
                    .stat-number { font-size: 32px; font-weight: bold; color: #5865F2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Sélectionnez un serveur</h1>
                    <p>Choisissez le serveur sur lequel vous souhaitez configurer Yodo Protect.</p>
                    
                    <div class="stats">
                        <div class="stat-card">
                            <div class="stat-number">${guilds.length}</div>
                            <div>Serveurs totaux</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">⚡ Actif</div>
                            <div>Statut du Dashboard</div>
                        </div>
                    </div>

                    <div style="margin-top: 30px;">
                        ${guildsHtml || '<p>Aucun serveur administrable trouvé.</p>'}
                    </div>
                    <br>
                    <a href="/" style="color: #5865F2; text-decoration: none;">← Retour à l'accueil</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error(error);
        res.send('Erreur lors de la connexion avec Discord.');
    }
});

app.listen(PORT, () => {
    console.log(`[WEB] Dashboard / Serveur Express lancé sur le port ${PORT}`);
});


// --- CONFIGURATION DISCORD BOT ---
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

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Envoyer le panel de tickets')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('setconfig')
            .setDescription('Configurer les modules du serveur (Anti-raid, Niveaux, Bienvenue, etc.)')
            .addBooleanOption(option => option.setName('antiraid').setDescription('Activer l\'anti-raid / détection de bots bizarres').setRequired(false))
            .addBooleanOption(option => option.setName('niveaux').setDescription('Activer le système de niveaux').setRequired(false))
            .addChannelOption(option => option.setName('bienvenue_salon').setDescription('Salon pour les messages de bienvenue').setRequired(false))
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

// --- GESTION DE LA SÉCURITÉ (Anti-Raid / Comptes louches) ---
client.on('guildMemberAdd', async member => {
    let config = serverConfigs.get(member.guild.id) || { antiRaid: false, niveaux: false, bienvenueSalon: null };
    
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (config.antiRaid && (accountAgeDays < 3 || member.user.bot)) {
        let urgenceChannel = member.guild.channels.cache.find(c => c.name === 'yodoprotect-urgence');
        
        if (!urgenceChannel) {
            try {
                urgenceChannel = await member.guild.channels.create({
                    name: 'yodoprotect-urgence',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: member.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });
            } catch (e) { console.error('Impossible de créer le salon d urgence'); }
        }

        if (urgenceChannel) {
            const alertEmbed = new EmbedBuilder()
                .setTitle('🚨 Alerte Sécurité - Compte Suspect Détecté')
                .setDescription(`Un compte potentiellement dangereux ou un bot vient de rejoindre !\n\n👤 **Membre :** ${member.user.tag} (${member.id})\n📅 **Création du compte :** Il y a ${Math.floor(accountAgeDays)} jours`)
                .setColor('#E74C3C');
            await urgenceChannel.send({ content: `<@${member.guild.ownerId}>`, embeds: [alertEmbed] }).catch(() => {});
        }
    }

    if (config.bienvenueSalon) {
        const welcomeChannel = member.guild.channels.cache.get(config.bienvenueSalon);
        if (welcomeChannel) {
            welcomeChannel.send(`Bienvenue sur le serveur, ${member} ! 🎉 Amuse-toi bien ici.`);
        }
    }
});

// --- INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    let config = serverConfigs.get(interaction.guildId) || { antiRaid: false, niveaux: false, bienvenueSalon: null };
    serverConfigs.set(interaction.guildId, config);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Yodo Protect - Centre d\'Aide')
                .setDescription('Bot de protection, de modération et de gestion de tickets.')
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'setconfig') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const antiRaidOpt = interaction.options.getBoolean('antiraid');
            const niveauxOpt = interaction.options.getBoolean('niveaux');
            const bienvenueOpt = interaction.options.getChannel('bienvenue_salon');

            if (antiRaidOpt !== null) config.antiRaid = antiRaidOpt;
            if (niveauxOpt !== null) config.niveaux = niveauxOpt;
            if (bienvenueOpt !== null) config.bienvenueSalon = bienvenueOpt.id;

            const confEmbed = new EmbedBuilder()
                .setTitle('⚙️ Configuration mise à jour')
                .setDescription(`🛡️ **Anti-Raid / Détection :** ${config.antiRaid ? 'Activé ✅' : 'Désactivé ❌'}\n⭐ **Système de Niveaux :** ${config.niveaux ? 'Activé ✅' : 'Désactivé ❌'}\n👋 **Salon Bienvenue :** ${config.bienvenueSalon ? `<#${config.bienvenueSalon}>` : 'Non défini'}`)
                .setColor('#2ECC71');

            return interaction.reply({ embeds: [confEmbed], ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Espace de Support - Yodo Protect')
                .setDescription('Besoin d\'aide ou envie de contacter le staff ?\n\n*Sélectionne une option dans le menu ci-dessous pour ouvrir un salon privé.*')
                .setColor('#FF6B6B');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Choisis le motif du ticket...')
                .addOptions([
                    { label: 'Problème / Conflit', value: 'conflit', emoji: '⚠️', description: 'Tensions ou litige sur le serveur' },
                    { label: 'Aide / Question générale', value: 'aide', emoji: '💬', description: 'Besoin d\'un renseignement' },
                    { label: 'Autre demande', value: 'autre', emoji: '📌', description: 'Autre sujet' }
                ]);

            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Panel de tickets envoyé !', ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        await interaction.deferReply({ ephemeral: true });
        const motif = interaction.values[0];

        try {
            const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
            const ticketChannel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Ouvert')
                .setDescription(`Bonjour ${interaction.user} !\nVotre demande concernant **[${motif.toUpperCase()}]** a bien été prise en compte. L'équipe va vous répondre rapidement.`)
                .setColor('#5865F2');

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [closeRow] });
            return interaction.editReply({ content: `✅ Votre salon de 
