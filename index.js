const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

// 1. Initialisation du client avec les intents nécessaires
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 2. Définition des Slash Commands
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie si le bot YodoProtect est bien en ligne et affiche la latence.'),
    
    new SlashCommandBuilder()
        .setName('scan')
        .setDescription('Analyse un lien ou un texte pour vérifier s\'il est sécurisé.')
        .addStringOption(option => 
            option.setName('lien')
                .setDescription('Le lien ou le texte à analyser')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre précis de messages dans le salon.')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1 à 100)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un utilisateur du serveur.')
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à bannir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('raison')
                .setDescription('La raison du bannissement')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche les informations de sécurité et les stats du serveur.')
].map(command => command.toJSON());

// 3. Enregistrement automatique des commandes auprès de l'API Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        console.log('[YodoProtect] Actualisation des commandes slash (/) en cours...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('[YodoProtect] Commandes slash (/) enregistrées avec succès !');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes :', error);
    }
}

// 4. Événement : Quand le bot est connecté
client.once('ready', async () => {
    console.log(`[YodoProtect] Connecté en tant que ${client.user.tag} !`);
    client.user.setActivity('YodoProtect Sécurité | /scan', { type: 3 });
    await registerCommands();
});

// 5. Gestion des interactions (Commandes Slash)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- /ping ---
    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        const embed = new EmbedBuilder()
            .setColor('#3b82f6')
            .setTitle('🛡️ YodoProtect - Statut')
            .setDescription(`Le bot fonctionne à 100% sur Render !\nLatence de l'API : \`${Math.round(client.ws.ping)}ms\`\nLatence de réponse : \`${latency}ms\``)
            .setFooter({ text: 'YodoProtect Security System' });

        await interaction.reply({ embeds: [embed] });
    }

    // --- /scan ---
    else if (commandName === 'scan') {
        const targetLink = interaction.options.getString('lien');
        const isSuspicious = targetLink.includes('discord-gift') || targetLink.includes('free-nitro') || targetLink.includes('steam-free');

        const embed = new EmbedBuilder()
            .setColor(isSuspicious ? '#ef4444' : '#10b981')
            .setTitle(isSuspicious ? '🚨 Alerte : Lien Dangereux Détecté !' : '✅ Analyse : Lien Sécurisé')
            .setDescription(`**Cible analysée :** \`${targetLink}\``)
            .addFields(
                { name: 'Statut', value: isSuspicious ? '⚠️ Potentiel Phishing / Scam' : '✨ Aucun danger connu détecté' }
            )
            .setFooter({ text: 'YodoProtect Scanner' });

        await interaction.reply({ embeds: [embed], ephemeral: isSuspicious });
    }

    // --- /clear ---
    else if (commandName === 'clear') {
        const amount = interaction.options.getInteger('nombre');

        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Tu dois choisir un nombre entre 1 et 100.', ephemeral: true });
        }

        try {
            await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `🧹 **${amount}** messages ont été supprimés avec succès !`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Une erreur est survenue lors de la suppression (les messages de plus de 14 jours ne peuvent pas être supprimés en masse).', ephemeral: true });
        }
    }

    // --- /ban ---
    else if (commandName === 'ban') {
        const targetUser = interaction.options.getUser('membre');
        const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        const member = interaction.guild.members.cache.get(targetUser.id);

        if (!member) {
            return interaction.reply({ content: '❌ Impossible de trouver ce membre sur le serveur.', ephemeral: true });
        }

        try {
            await member.ban({ reason: reason });
            const embed = new EmbedBuilder()
                .setColor('#ef4444')
                .setTitle('🔨 Action de Modération : Bannissement')
                .setDescription(`**${targetUser.tag}** a été banni du serveur.`)
                .addFields({ name: 'Raison', value: reason })
                .setFooter({ text: 'YodoProtect Security' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Je n\'ai pas les permissions nécessaires pour bannir ce membre.', ephemeral: true });
        }
    }

    // --- /serverinfo ---
    else if (commandName === 'serverinfo') {
        const guild = interaction.guild;
        const embed = new EmbedBuilder()
            .setColor('#3b82f6')
            .setTitle(`📊 Informations : ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Création du serveur', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: 'YodoProtect Server Info' });

        await interaction.reply({ embeds: [embed] });
    }
});

// 6. Connexion du bot
client.login(process.env.DISCORD_TOKEN);
