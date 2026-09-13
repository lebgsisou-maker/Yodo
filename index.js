const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField } = require('discord.js');
const express = require('express');
const axios = require('axios');

// --- CONFIGURATION EXPRESS & OAUTH2 ---
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://yodoprotect.onrender.com/auth/discord/callback';

// Stockage global des configurations et des données XP par serveur
const serverConfigs = new Map();
const userXpData = new Map(); // Format: Map<guildId_userId, xp>

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- PAGE D'ACCUEIL ---
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Yodo Protect - Bot de Sécurité, Tickets & Niveaux</title>
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
                <h1>Le dashboard ultime pour votre serveur Discord</h1>
                <p class="subtitle">Gérez vos tickets de support, l'anti-raid, les messages de bienvenue personnalisés et un système de niveaux complet en toute simplicité !</p>
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
                    body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', sans-serif; padding: 40px; margin: 0; }
                    .container { max-width: 800px; margin: 0 auto; }
                    h1 { color: #fff; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Sélectionnez un serveur</h1>
                    <p>Choisissez le serveur sur lequel vous souhaitez configurer les modules Yodo Protect.</p>
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

// --- PAGE DE CONFIGURATION DÉTAILLÉE D'UN SERVEUR ---
app.get('/dashboard/configure/:guildId', (req, res) => {
    const guildId = req.params.guildId;
    const guildName = req.query.name || 'Serveur Discord';
    
    // Configuration par défaut ou existante
    let config = serverConfigs.get(guildId) || {
        antiRaid: false,
        welcomeMsg: 'Bienvenue {user} sur {server} ! Amuse-toi bien !',
        welcomeChannel: '',
        welcomeBg: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f',
        ticketChannel: '',
        ticketRole: '',
        levelsEnabled: true
    };

    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Configuration - ${guildName}</title>
            <style>
                body { background-color: #0d1117; color: #c9d1d9; font-family: 'Segoe UI', sans-serif; padding: 30px; margin: 0; }
                .container { max-width: 750px; margin: 0 auto; background: #161b22; padding: 30px; border-radius: 10px; border: 1px solid #30363d; }
                h1 { color: #fff; margin-top: 0; }
                .section { margin: 25px 0; padding: 20px; background: #21262d; border-radius: 8px; border: 1px solid #30363d; }
                h3 { margin-top: 0; color: #5865F2; }
                label { display: block; margin: 10px 0 5px; font-weight: 600; font-size: 14px; }
                input[type="text"], input[type="url"], textarea { width: 100%; padding: 10px; background: #0d1117; border: 1px solid #30363d; color: #fff; border-radius: 6px; box-sizing: border-box; }
                textarea { resize: vertical; height: 80px; }
                .checkbox-row { display: flex; align-items: center; justify-content: space-between; }
                .btn { background: #238636; color: white; padding: 12px 25px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 16px; }
                .btn:hover { background: #2ea043; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚙️ Dashboard : ${guildName}</h1>
                <p>Personnalisez chaque module de Yodo Protect pour votre communauté.</p>
                
                <form action="/dashboard/save/${guildId}" method="POST">
                    
                    <!-- SÉCURITÉ / ANTI-RAID -->
                    <div class="section">
                        <h3>🛡️ Sécurité & Anti-Raid</h3>
                        <div class="checkbox-row">
                            <span>Activer la protection anti-comptes louches / bots</span>
                            <input type="checkbox" name="antiRaid" ${config.antiRaid ? 'checked' : ''} style="transform: scale(1.4);">
                        </div>
                    </div>

                    <!-- BIENVENUE & AU-REVOIR -->
                    <div class="section">
                        <h3>👋 Messages de Bienvenue & Au-revoir</h3>
                        <label>Nom ou ID du salon textuel pour les annonces :</label>
                        <input type="text" name="welcomeChannel" value="${config.welcomeChannel}" placeholder="ex: general ou bienvenue">
                        
                        <label>Message personnalisé (utilisez {user} et {server}) :</label>
                        <textarea name="welcomeMsg">${config.welcomeMsg}</textarea>
                        
                        <label>Lien de l'image de fond (Bannière) :</label>
                        <input type="url" name="welcomeBg" value="${config.welcomeBg}">
                    </div>

                    <!-- TICKETS DE SUPPORT -->
                    <div class="section">
                        <h3>🎫 Système de Tickets</h3>
                        <label>Nom du salon où envoyer le panel de tickets :</label>
                        <input type="text" name="ticketChannel" value="${config.ticketChannel}" placeholder="ex: support ou tickets">
                        
                        <label>ID ou Nom du rôle Staff / Support (qui pourra voir les tickets) :</label>
                        <input type="text" name="ticketRole" value="${config.ticketRole}" placeholder="ex: @Modérateur ou ID du rôle">
                    </div>

                    <!-- SYSTÈME DE NIVEAUX -->
                    <div class="section">
                        <h3>⭐ Système de Niveaux & XP</h3>
                        <div class="checkbox-row">
                            <span>Activer le gain d'XP par message & classement /rank</span>
                            <input type="checkbox" name="levelsEnabled" ${config.levelsEnabled ? 'checked' : ''} style="transform: scale(1.4);">
                        </div>
                    </div>

                    <br>
                    <button type="submit" class="btn">💾 Enregistrer toutes les modifications</button>
                </form>
                <br><br>
                <a href="/auth/discord" style="color: #5865F2; text-decoration: none;">← Retourner à la liste de mes serveurs</a>
            </div>
        </body>
        </html>
    `);
});

// Traitement de la sauvegarde du formulaire dashboard
app.post('/dashboard/save/:guildId', (req, res) => {
    const guildId = req.params.guildId;
    
    serverConfigs.set(guildId, {
        antiRaid: req.body.antiRaid === 'on',
        welcomeMsg: req.body.welcomeMsg,
        welcomeChannel: req.body.welcomeChannel,
        welcomeBg: req.body.welcomeBg,
        ticketChannel: req.body.ticketChannel,
        ticketRole: req.body.ticketRole,
        levelsEnabled: req.body.levelsEnabled === 'on'
    });

    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"><title>Sauvegardé</title></head>
        <body style="background: #0d1117; color: #fff; font-family: sans-serif; text-align: center; padding-top: 100px;">
            <h1>✅ Paramètres mis à jour avec succès !</h1>
            <p>Le bot prend en compte vos nouveaux réglages en temps réel.</p>
            <br><a href="/auth/discord" style="color: #5865F2; text-decoration: none; font-size: 18px;">← Retourner à mes serveurs</a>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[WEB] Dashboard & Serveur Express actif sur le port ${PORT}`);
});


// --- CONFIGURATION DU BOT DISCORD ---
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
            .setDescription('Envoyer le panel de tickets configuré')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .toJSON(),
        new SlashCommandBuilder()
            .setName('rank')
            .setDescription('Afficher votre niveau et votre XP actuelle')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Afficher l\'aide de Yodo Protect')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[COMMANDES] Slash commands enregistrées !');
    } catch (error) {
        console.error('[ERREUR COMMANDES]', error);
    }
});

// --- MODULE BIENVENUE & XP (Messages) ---
client.on('guildMemberAdd', async member => {
    let config = serverConfigs.get(member.guild.id);
    
    // 1. Anti-Raid Vérification
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (config && config.antiRaid && (accountAgeDays < 3 || member.user.bot)) {
        let urgenceChannel = member.guild.channels.cache.find(c => c.name === 'yodoprotect-urgence');
        if (!urgenceChannel) {
            try {
                urgenceChannel = await member.guild.channels.create({
                    name: 'yodoprotect-urgence',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [{ id: member.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }]
                });
            } catch (e) {}
        }
        if (urgenceChannel) {
            const alertEmbed = new EmbedBuilder()
                .setTitle('🚨 Alerte Sécurité - Compte Suspect')
                .setDescription(`Membre : ${member.user.tag} (${member.id})\nCréé il y a ${Math.floor(accountAgeDays)} jours.`)
                .setColor('#E74C3C');
            await urgenceChannel.send({ embeds: [alertEmbed] }).catch(() => {});
        }
    }

    // 2. Message de Bienvenue Personnalisé
    if (config && config.welcomeChannel) {
        const targetChan = member.guild.channels.cache.find(c => c.name === config.welcomeChannel || c.id === config.welcomeChannel);
        if (targetChan) {
            let customText = config.welcomeMsg
                .replace('{user}', `<@${member.id}>`)
                .replace('{server}', member.guild.name);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('✨ Nouveau Membre !')
                .setDescription(customText)
                .setImage(config.welcomeBg)
                .setColor('#5865F2');
            
            await targetChan.send({ embeds: [welcomeEmbed] }).catch(() => {});
        }
    }
});

// --- MODULE SYSTÈME DE NIVEAUX & XP ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    let config = serverConfigs.get(message.guild.id);
    if (config && config.levelsEnabled === false) return;

    const key = `${message.guild.id}_${message.author.id}`;
    let currentXp = userXpData.get(key) || 0;
    
    // Ajout aléatoire entre 15 et 25 XP par message
    const earnedXp = Math.floor(Math.random() * 11) + 15;
    currentXp += earnedXp;
    userXpData.set(key, currentXp);
});

// --- INTERACTIONS (Commandes & Tickets) ---
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Yodo Protect - Centre d\'Aide')
                .setDescription('Commandes disponibles :\n• `/ticketpanel` : Déploie le panneau de support\n• `/rank` : Affiche votre progression XP')
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'rank') {
            const key = `${interaction.guild.id}_${interaction.user.id}`;
            const xp = userXpData.get(key) || 0;
            const level = Math.floor(0.1 * Math.sqrt(xp)) + 1;

            const embed = new EmbedBuilder()
                .setTitle(`⭐ Niveau de ${interaction.user.username}`)
                .setDescription(`• **Niveau :** ${level}\n• **XP Totale :** ${xp} points`)
                .setColor('#F1C40F');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Vous devez gérer le serveur pour utiliser cette commande.', ephemeral: true });
            }

            let config = serverConfigs.get(interaction.guild.id);
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Support & Tickets - Yodo Protect')
                .setDescription('Sélectionnez un motif dans le menu déroulant ci-dessous pour ouvrir un salon de discussion privé avec l\'équipe.')
                .setColor('#5865F2');

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('Choisissez un motif de contact...')
                .addOptions([
                    { label: 'Problème / Conflit', value: 'conflit', emoji: '⚠️' },
                    { label: 'Aide générale / Question', value: 'aide', emoji: '💬' },
                    { label: 'Autre demande', value: 'autre', emoji: '📌' }
                ]);

            const row = new ActionRowBuilder().addComponent
