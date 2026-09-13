const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- CONFIGURATION EXPRESS & OAUTH2 ---
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://yodoprotect.onrender.com/auth/discord/callback';

const serverConfigs = new Map();

// --- PAGE D'ACCUEIL ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Yodo Protect - Bot de Sécurité, Tickets & Modération</title>
            <style>
                body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; }
                header { background: #161b22; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; }
                .logo { font-size: 22px; font-weight: bold; color: #5865F2; }
                .hero { text-align: center; padding: 80px 20px; max-width: 800px; margin: 0 auto; }
                h1 { font-size: 48px; color: #ffffff; margin-bottom: 20px; }
                p.subtitle { font-size: 18px; color: #8b949e; margin-bottom: 40px; line-height: 1.6; }
                .btn-group { display: flex; gap: 15px; justify-content: center; margin-bottom: 60px; }
                .btn { padding: 14px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; transition: transform 0.2s, background 0.2s; }
                .btn-primary { background-color: #5865F2; color: white; }
                .btn-primary:hover { background-color: #4752C4; }
                .btn-secondary { background-color: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
                .btn-secondary:hover { background-color: #30363d; }
                footer { text-align: center; padding: 30px; background: #161b22; color: #8b949e; border-top: 1px solid #30363d; font-size: 14px; }
            </style>
        </head>
        <body>
            <header>
                <div class="logo">🛡️ Yodo Protect</div>
                <div><a href="/auth/discord" class="btn btn-secondary" style="padding: 8px 16px;">Connexion Dashboard</a></div>
            </header>
            <div class="hero">
                <h1>Protégez et gérez votre serveur Discord avec brio</h1>
                <p class="subtitle">Yodo Protect est le bot ultime tout-en-un : Anti-Raid avancé, système de tickets intelligent, modération et bien plus encore !</p>
                <div class="btn-group">
                    <a href="https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands" class="btn btn-primary" target="_blank">Ajouter le Bot</a>
                    <a href="/auth/discord" class="btn btn-secondary">Accéder au Dashboard</a>
                </div>
            </div>
            <footer><p>&copy; 2026 Yodo Protect. Tous droits réservés.</p></footer>
        </body>
        </html>
    `);
});

app.get('/auth/discord', (req, res) => {
    const discordLoginUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordLoginUrl);
});

// --- CALLBACK & LISTE DES SERVEURS ---
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
                        <a href="/dashboard/configure/${guild.id}?name=${encodeURIComponent(guild.name)}" style="background: #238636; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Configurer</a>
                    </div>
                `;
            }
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Yodo Protect - Sélection du serveur</title>
                <style>
                    body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; margin: 0; }
                    .container { max-width: 800px; margin: 0 auto; }
                    h1 { color: #fff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Sélectionnez un serveur</h1>
                    <p>Choisissez le serveur sur lequel vous souhaitez configurer Yodo Protect.</p>
                    <div style="margin-top: 30px;">${guildsHtml || '<p>Aucun serveur administrable trouvé.</p>'}</div>
                    <br><a href="/" style="color: #5865F2; text-decoration: none;">← Retour à l'accueil</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.send('Erreur lors de la connexion avec Discord.');
    }
});

// --- PAGE DE CONFIGURATION D'UN SERVEUR ---
app.get('/dashboard/configure/:guildId', (req, res) => {
    const guildId = req.params.guildId;
    const guildName = req.query.name || 'Serveur Discord';
    let config = serverConfigs.get(guildId) || { antiRaid: false, niveaux: false };

    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Configuration - ${guildName}</title>
            <style>
                body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', sans-serif; padding: 40px; margin: 0; }
                .container { max-width: 600px; margin: 0 auto; background: #161b22; padding: 30px; border-radius: 10px; border: 1px solid #30363d; }
                h1 { color: #fff; margin-top: 0; }
                .option { margin: 20px 0; padding: 15px; background: #21262d; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
                .btn { background: #5865F2; color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-decoration: none; }
                .btn-success { background: #238636; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚙️ Configuration : ${guildName}</h1>
                <p>Gérez les options de sécurité de votre serveur en temps réel.</p>
                <form action="/dashboard/save/${guildId}" method="POST">
                    <div class="option">
                        <span>🛡️ Anti-Raid / Protection Comptes Louches</span>
                        <input type="checkbox" name="antiRaid" ${config.antiRaid ? 'checked' : ''} style="transform: scale(1.5);">
                    </div>
                    <div class="option">
                        <span>⭐ Système de Niveaux & XP</span>
                        <input type="checkbox" name="niveaux" ${config.niveaux ? 'checked' : ''} style="transform: scale(1.5);">
                    </div>
                    <br>
                    <button type="submit" class="btn btn-success">Enregistrer les modifications</button>
                </form>
                <br>
                <a href="/auth/discord" style="color: #5865F2; text-decoration: none;">← Retour à la liste des serveurs</a>
            </div>
        </body>
        </html>
    `);
});

// Permet de lire les données POST du formulaire
app.use(express.urlencoded({ extended: true }));

app.post('/dashboard/save/:guildId', (req, res) => {
    const guildId = req.params.guildId;
    const antiRaid = req.body.antiRaid === 'on';
    const niveaux = req.body.niveaux === 'on';

    serverConfigs.set(guildId, { antiRaid, niveaux });

    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Sauvegardé</title></head>
        <body style="background: #0d1117; color: #fff; font-family: sans-serif; text-align: center; padding-top: 100px;">
            <h1>✅ Configuration enregistrée avec succès !</h1>
            <p>Vos modifications ont bien été prises en compte par Yodo Protect.</p>
            <br><a href="/auth/discord" style="color: #5865F2; text-decoration: none; font-size: 18px;">← Retourner à mes serveurs</a>
        </body>
        </html>
    `);
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

client.once('ready', async () => {
    console.log(`[YODO PROTECT] Connecté en tant que ${client.user.tag} ! Prêt.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Envoyer le panel de tickets')
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

// --- GESTION DE LA SÉCURITÉ (Anti-Raid) ---
client.on('guildMemberAdd', async member => {
    let config = serverConfigs.get(member.guild.id) || { antiRaid: false, niveaux: false };
    
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
            } catch (e) {}
        }

        if (urgenceChannel) {
            const alertEmbed = new EmbedBuilder()
                .setTitle('🚨 Alerte Sécurité - Compte Suspect Détecté')
                .setDescription(`Un compte potentiellement dangereux ou un bot vient de rejoindre !\n\n👤 **Membre :** ${member.user.tag} (${member.id})\n📅 **Création :** Il y a ${Math.floor(accountAgeDays)} jours`)
                .setColor('#E74C3C');
            await urgenceChannel.send({ content: `<@${member.guild.ownerId}>`, embeds: [alertEmbed] }).catch(() => {});
        }
    }
});

// --- INTERACTIONS (Tickets) ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Yodo Protect - Centre d\'Aide')
                .setDescription('Bot de protection et de gestion de tickets.')
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Permission requise.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Espace de Support - Yodo Protect')
                .setDescription('Sélectionne une option pour ouvrir un salon de ticket privé.')
                .setColor('#FF6B6B');
            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Choisis le motif...')
                .addOptions([
                    { label: 'Problème / Conflit', value: 'conflit', emoji: '⚠️' },
                    { label: 'Aide générale', value: 'aide', emoji: '💬' },
                    { label: 'Autre', value: 'autre', emoji: '📌' }
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
                .setDescription(`Bonjour ${interaction.user} !\nVotre demande (**${motif.toUpperCase()}**) a été prise en compte.`)
                .setColor('#5865F2');
            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setEmoji('🔒').ButtonStyle = ButtonStyle.Danger
            );
            await ticketChannel.send({ content: `${interaction.user}`, embeds: [welcomeEmbed], components: [closeRow] });
            return interaction.editReply({ content: `✅ Salon créé : ${ticketChannel}` });
        } catch (e) {
            return interaction.editReply({ content: `❌ Erreur lors de la création.` });
        }
    }
});

client.login(process.env.TOKEN);
                
