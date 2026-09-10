const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits, REST, Routes, ChannelType, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildModeration] });
const serverSettings = new Map(); 

const translations = {
    fr: { helpTitle: "📜 Centre d'Aide - Yodo", helpDesc: "Liste des commandes :", configTitle: "⚙️ Configuration", langSet: "✅ Langue configurée en **Français** !", regTitle: "📜 RÈGLEMENT OFFICIEL", regDesc: "Bienvenue sur notre communauté orientée", sec1: "📌 1. Règlement Serveur & Sanctions", sec1Text: "• Respect, pas d'insultes ni de harcèlement.\n• Pas de spam ou liens non autorisés.\n• Sanctions en cas de manquement (mute/kick/ban).", sec2: "🤝 2. Règlement Éthique & Discord", sec2Text: "• Bienveillance et entraide.\n• Respect des TOS Discord.\n• Partenariats via le support.", footer: "Yodo Protect • Système de modération" },
    en: { helpTitle: "📜 Help Center - Yodo", helpDesc: "Command list:", configTitle: "⚙️ Configuration", langSet: "✅ Language set to **English**!", regTitle: "📜 OFFICIAL RULES", regDesc: "Welcome to our community focused on", sec1: "📌 1. Server Rules & Sanctions", sec1Text: "• Respect, no insults or harassment.\n• No spam or unauthorized links.\n• Violations result in sanctions.", sec2: "🤝 2. Ethics & Discord Rules", sec2Text: "• Kindness and mutual aid.\n• Compliance with Discord TOS.\n• Partnerships via support.", footer: "Yodo Protect • Smart Moderation" },
    es: { helpTitle: "📜 Centro de Ayuda - Yodo", helpDesc: "Lista de comandos:", configTitle: "⚙️ Configuración", langSet: "✅ ¡Idioma configurado en **Español**!", regTitle: "📜 REGLAMENTO OFICIAL", regDesc: "Bienvenido a nuestra comunidad enfocada en", sec1: "📌 1. Normas y Sanciones", sec1Text: "• Respeto, sin insultos ni acoso.\n• No spam ni enlaces no autorizados.\n• Infracciones acarrearán sanciones.", sec2: "🤝 2. Ética y Normas de Discord", sec2Text: "• Amabilidad y ayuda mutua.\n• Cumplimiento de TOS Discord.\n• Colaboraciones vía soporte.", footer: "Yodo Protect • Sistema de moderación" },
    it: { helpTitle: "📜 Centro Assistenza - Yodo", helpDesc: "Elenco comandi:", configTitle: "⚙️ Configurazione", langSet: "✅ Lingua impostata in **Italiano**!", regTitle: "📜 REGOLAMENTO UFFICIALE", regDesc: "Benvenuto nella community incentrata su", sec1: "📌 1. Regole e Sanzioni", sec1Text: "• Rispetto, niente insulti o molestie.\n• Niente spam o link non autorizzati.\n• Violazioni comportano sanzioni.", sec2: "🤝 2. Etica e Regole di Discord", sec2Text: "• Gentilezza e mutuo soccorso.\n• Rispetto TOS Discord.\n• Partnership tramite supporto.", footer: "Yodo Protect • Sistema di moderazione" }
};

function getT(id, key) {
    const s = serverSettings.get(id) || { lang: 'fr' };
    return translations[s.lang || 'fr'][key] || translations['fr'][key];
}

client.once('ready', async () => {
    console.log(`[YODO] Connecté : ${client.user.tag}`);
    const cmds = [
        new SlashCommandBuilder().setName('config').setDescription('Configuration').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('ticketpanel').setDescription('Panel tickets').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('reglement').setDescription('Générer le règlement').addStringOption(o => o.setName('theme').setDescription('Thème').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('antiraid').setDescription('Anti-Raid').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('giveaway').setDescription('Giveaway').addStringOption(o => o.setName('lot').setDescription('Lot').setRequired(true)).addStringOption(o => o.setName('duree').setDescription('Durée').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).toJSON(),
        new SlashCommandBuilder().setName('sanction').setDescription('Sanction').addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)).addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices({ name: 'Mute', value: 'mute' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })).addStringOption(o => o.setName('raison').setDescription('Raison')).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).toJSON(),
        new SlashCommandBuilder().setName('mp').setDescription('MP').addUserOption(o => o.setName('utilisateur').setDescription('User').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Msg').setRequired(true)).toJSON(),
        new SlashCommandBuilder().setName('help').setDescription('Aide').toJSON()
    ];
    await new REST({ version: '10' }).setToken(process.env.TOKEN).put(Routes.applicationCommands(client.user.id), { body: cmds });
});

client.on('guildCreate', async (g) => {
    const ch = g.systemChannel || g.channels.cache.find(c => c.isTextBased() && c.permissionsFor(g.members.me).has('SendMessages'));
    if (!ch) return;
    serverSettings.set(g.id, { lang: 'fr', antiRaidActive: false });
    const emb = new EmbedBuilder().setTitle('🛡️ Bienvenue avec Yodo Protect !').setDescription('Choisis la langue principale du bot :').setColor('#5865F2');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setlang_fr').setLabel('Français 🇫🇷').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('setlang_en').setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setlang_es').setLabel('Español 🇪🇸').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setlang_it').setLabel('Italiano 🇮🇹').setStyle(ButtonStyle.Secondary)
    );
    await ch.send({ embeds: [emb], components: [row] });
});

client.on('interactionCreate', async i => {
    let s = serverSettings.get(i.guildId) || { lang: 'fr', antiRaidActive: false };
    serverSettings.set(i.guildId, s);

    if (i.isButton() && i.customId.startsWith('setlang_')) {
        s.lang = i.customId.split('_')[1];
        return i.update({ content: `✅ Langue configurée en **${s.lang.toUpperCase()}** !`, embeds: [], components: [] });
    }

    if (i.isChatInputCommand()) {
        const { commandName: c } = i;
        if (c === 'help') {
            const emb = new EmbedBuilder().setTitle(getT(i.guildId, 'helpTitle')).setDescription(getT(i.guildId, 'helpDesc')).addFields({ name: '/config', value: 'Config' }, { name: '/reglement', value: 'Règlement' }, { name: '/ticketpanel', value: 'Tickets' }).setColor('#2b2d31');
            return i.reply({ embeds: [emb], ephemeral: true });
        }
        if (c === 'reglement') {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Non autorisé.', ephemeral: true });
            const th = i.options.getString('theme');
            const emb = new EmbedBuilder().setTitle(`${getT(i.guildId, 'regTitle')} - ${i.guild.name}`).setDescription(`${getT(i.guildId, 'regDesc')} **${th}** :\n`).addFields({ name: getT(i.guildId, 'sec1'), value: getT(i.guildId, 'sec1Text') }, { name: getT(i.guildId, 'sec2'), value: getT(i.guildId, 'sec2Text') }).setColor('#5865F2').setFooter({ text: getT(i.guildId, 'footer'), iconURL: client.user.displayAvatarURL() }).setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tr_fr_${th}`).setLabel('Français 🇫🇷').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_en_${th}`).setLabel('English 🇬🇧').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_es_${th}`).setLabel('Español 🇪🇸').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tr_it_${th}`).setLabel('Italiano 🇮🇹').setStyle(ButtonStyle.Secondary)
            );
            await i.channel.send({ embeds: [emb], components: [row] });
            return i.reply({ content: '✅ Règlement généré !', ephemeral: true });
        }
        if (c === 'config') {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Non autorisé.', ephemeral: true });
            const emb = new EmbedBuilder().setTitle(getT(i.guildId, 'configTitle')).addFields({ name: '🌐 Langue', value: s.lang.toUpperCase(), inline: true }, { name: '🛡️ Anti-Raid', value: s.antiRaidActive ? '🟢' : '🔴', inline: true }).setColor('#5865F2');
            const menu = new StringSelectMenuBuilder().setCustomId('config_lang_menu').setPlaceholder('Langue...').addOptions({ label: 'Français 🇫🇷', value: 'lang_fr' }, { label: 'English 🇬🇧', value: 'lang_en' }, { label: 'Español 🇪🇸', value: 'lang_es' }, { label: 'Italiano 🇮🇹', value: 'lang_it' });
            return i.reply({ embeds: [emb], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
        }
        if (c === 'ticketpanel') {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Non autorisé.', ephemeral: true });
            const emb = new EmbedBuilder().setTitle('🎫 Support').setDescription('Clique pour ouvrir un ticket.').setColor('#5865F2');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_staff').setLabel('Staff').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('ticket_bug').setLabel('Bug').setStyle(ButtonStyle.Danger));
            await i.channel.send({ embeds: [emb], components: [row] });
            return i.reply({ content: '✅ Panel envoyé !', ephemeral: true });
        }
        if (c === 'mp') {
            if (i.user.id !== i.guild.ownerId) return i.reply({ content: '❌ Réservé au propriétaire.', ephemeral: true });
            try { await i.options.getUser('utilisateur').send(`📬 ${i.options.getString('message')}`); return i.reply({ content: '✅ MP envoyé !', ephemeral: true }); } catch (e) { return i.reply({ content: '❌ Erreur MP.', ephemeral: true }); }
        }
        if (c === 'sanction') {
            const m = i.options.getMember('membre'), t = i.options.getString('type'), r = i.options.getString('raison') || 'Aucune';
            try { if (t === 'mute') await m.timeout(900000, r); if (t === 'kick') await m.kick(r); if (t === 'ban') await m.ban({ reason: r }); return i.reply({ content: '✅ Sanction appliquée.', ephemeral: true }); } catch (e) { return i.reply({ content: '❌ Erreur.', ephemeral: true }); }
        }
        if (c === 'antiraid') {
            if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: '❌ Non autorisé.', ephemeral: true });
            s.antiRaidActive = !s.antiRaidActive;
            return i.reply({ content: s.antiRaidActive ? '🚨 Anti-Raid Actif' : '✅ Anti-Raid Inactif', ephemeral: true });
        }
    }

    if (i.isButton() && i.customId.startsWith('tr_')) {
        const p = i.customId.split('_'), lang = p[1], th = p.slice(2).join('_'), t = translations[lang] || translations['fr'];
        const emb = new EmbedBuilder().setTitle(`${t.regTitle} - ${i.guild.name}`).setDescription(`${t.regDesc} **${th}** :\n`).addFields({ name: t.sec1, value: t.sec1Text }, { name: t.sec2, value: t.sec2Text }).setColor('#5865F2').setFooter({ text: t.footer, iconURL: client.user.displayAvatarURL() }).setTimestamp();
        return i.update({ embeds: [emb] });
    }

    if (i.isStringSelectMenu() && i.customId === 'config_lang_menu') {
        s.lang = i.values[0].split('_')[1];
        return i.update({ content: getT(i.guildId, 'langSet'), components: [], embeds: [] });
    }

    if (i.isButton() && i.customId.startsWith('ticket_')) {
        await i.deferReply({ ephemeral: true });
        try {
            const ch = await i.guild.channels.create({ name: `ticket-${i.user.username}`.toLowerCase(), type: ChannelType.GuildText, permissionOverwrites: [{ id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer').setStyle(ButtonStyle.Danger));
            await ch.send({ content: `${i.user}`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription('Un staff va vous répondre.').setColor('#5865F2')], components: [row] });
            return i.editReply({ content: `✅ Ticket créé : ${ch}` });
        } catch (e) { return i.editReply({ content: '❌ Erreur création ticket.' }); }
    }

    if (i.isButton() && i.customId === 'close_ticket') {
        await i.reply({ content: '🔒 Fermeture...', ephemeral: true });
        setTimeout(() => i.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.TOKEN);
                
