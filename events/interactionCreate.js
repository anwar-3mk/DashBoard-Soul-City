const { 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { getPlayers, addTask } = require('../utils/apiStore');
const { 
    getLogChannelId, 
    setLogChannelId, 
    getAdminRoleId, 
    setAdminRoleId, 
    isBanned, 
    addBan, 
    removeBan, 
    addKick,
    getBans 
} = require('../utils/db');
const axios = require('axios');

// دالة مساعدة لإرسال السجلات بروم اللوق المحدد
async function sendLog(client, messageContent) {
    const logChannelId = getLogChannelId();
    if (!logChannelId) return;
    try {
        const channel = await client.channels.fetch(logChannelId);
        if (channel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('سجل العمليات')
                .setDescription(messageContent)
                .setColor('#2b2d31')
                .setTimestamp();
            await channel.send({ embeds: [logEmbed] });
        }
    } catch (e) {
        console.error('Error sending log to channel:', e);
    }
}

// دالة مساعدة لإعادة تعيين لوحة التحكم الرئيسية (/لوحة) للحالة الافتراضية
async function resetMainPanel(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('لوحة تحكم روبلوكس')
        .setDescription('اختر الإجراء الذي تريد القيام به من القائمة المنسدلة أدناه.')
        .setColor('#2b2d31')
        .setImage('https://i.ibb.co/nMxxtzrW/image.png');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('panel_action_select')
        .setPlaceholder('اختر الخيار المطلوب للتحكم...')
        .addOptions([
            {
                label: 'إدارة اللاعبين',
                value: 'manage_players',
                description: 'عرض اللاعبين المتواجدين حالياً في اللعبة للتحكم بهم'
            },
            {
                label: 'فك باند عن لاعب',
                value: 'unban_player',
                description: 'إلغاء حظر لاعب محظور من اللعبة'
            }
        ]);

    const resetButton = new ButtonBuilder()
        .setCustomId('reset_panel')
        .setLabel('إعادة تعيين')
        .setStyle(ButtonStyle.Danger);

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
    const rowButton = new ActionRowBuilder().addComponents(resetButton);

    await interaction.update({ embeds: [embed], components: [rowSelect, rowButton], content: null });
}

// دالة مساعدة لإعادة تعيين لوحة الإدارة (/ادارة) للحالة الافتراضية
async function resetAdminPanel(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('إعدادات إدارة البوت')
        .setDescription('اختر الإجراء أو الإعداد الذي ترغب في تعديله من القائمة المنسدلة أدناه.')
        .setColor('#2b2d31')
        .setImage('https://i.ibb.co/nMxxtzrW/image.png');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('admin_settings_select')
        .setPlaceholder('اختر خيار الإعداد المطلوب...')
        .addOptions([
            {
                label: 'إعداد روم اللوق',
                value: 'set_log_channel',
                description: 'تحديد روم لإرسال جميع السجلات والعقوبات'
            },
            {
                label: 'إعداد رتبة المسؤول',
                value: 'set_admin_role',
                description: 'تحديد الرتبة المسموح لها باستخدام أوامر البوت'
            }
        ]);

    const resetButton = new ButtonBuilder()
        .setCustomId('reset_admin_panel')
        .setLabel('إعادة تعيين')
        .setStyle(ButtonStyle.Danger);

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
    const rowButton = new ActionRowBuilder().addComponents(resetButton);

    await interaction.update({ embeds: [embed], components: [rowSelect, rowButton], content: null });
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // --- 1. معالجة الأوامر (Slash Commands) ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'حدث خطأ أثناء تنفيذ الأمر!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'حدث خطأ أثناء تنفيذ الأمر!', ephemeral: true });
                }
            }
            return;
        }

        // قراءة آي دي روم اللوق للتحقق
        const logChannelId = getLogChannelId();
        
        // التحقق الأمني: لا يصح استعمال أي تفاعل باستثناء إعدادات الأدمن ما لم يتم تحديد روم اللوق أولاً
        const isSettingInteraction = 
            interaction.customId === 'admin_settings_select' || 
            interaction.customId === 'reset_admin_panel' ||
            interaction.customId === 'modal_admin_log_channel' ||
            interaction.customId === 'modal_admin_role';

        if (!logChannelId && !isSettingInteraction) {
            return interaction.reply({ 
                content: '❌ لا يمكن استخدام البوت أو لوحة التحكم إلا بعد إعداد روم اللوق أولاً باستخدام أمر `/ادارة`!', 
                ephemeral: true 
            });
        }

        // التحقق من الصلاحيات للتفاعل مع اللوحات (إما أدمنستريتر أو رتبة المسؤول المحددة)
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            // تفاعلات لوحة التحكم تتطلب الصلاحية
            if (!isSettingInteraction) {
                const adminRoleId = getAdminRoleId();
                const hasAdminPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
                const hasAdminRole = adminRoleId ? interaction.member.roles.cache.has(adminRoleId) : false;

                if (!hasAdminPermission && !hasAdminRole) {
                    return interaction.reply({ 
                        content: '❌ ليس لديك الصلاحية للتفاعل مع هذا الأمر! يجب أن تملك صلاحية Administrator أو رتبة المسؤول المحددة.', 
                        ephemeral: true 
                    });
                }
            } else {
                // تفاعلات إعدادات الإدارة (/ادارة) تتطلب صلاحية أدمنستريتر فقط
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ 
                        content: '❌ هذا التفاعل مخصص للإداريين فقط الذين يملكون صلاحية Administrator!', 
                        ephemeral: true 
                    });
                }
            }
        }

        // --- 2. معالجة القوائم المنسدلة (Select Menus) ---
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;

            // أ) معالجة لوحة الإدارة (/ادارة)
            if (customId === 'admin_settings_select') {
                const selected = interaction.values[0];

                if (selected === 'set_log_channel') {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_admin_log_channel')
                        .setTitle('إعداد روم اللوق');

                    const input = new TextInputBuilder()
                        .setCustomId('log_channel_input')
                        .setLabel('اكتب آي دي (ID) روم اللوق الجديد:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                } 
                
                else if (selected === 'set_admin_role') {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_admin_role')
                        .setTitle('إعداد رتبة المسؤول');

                    const input = new TextInputBuilder()
                        .setCustomId('admin_role_input')
                        .setLabel('قم بوضع آي دي (ID) رتبة المسؤول:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                }
            }

            // ب) معالجة لوحة التحكم الرئيسية (/لوحة)
            else if (customId === 'panel_action_select') {
                const selected = interaction.values[0];

                if (selected === 'manage_players') {
                    const players = getPlayers();

                    if (players.length === 0) {
                        return interaction.reply({ content: '❌ لا يوجد لاعبين متواجدين في اللعبة حالياً.', ephemeral: true });
                    }

                    // تجهيز خيارات قائمة اللاعبين مع خيار إعادة التعيين في النهاية
                    const options = players.slice(0, 24).map(p => ({
                        label: p.name,
                        description: `ID: ${p.userId}`,
                        value: p.name
                    }));

                    options.push({
                        label: 'إعادة تعيين',
                        value: 'reset_panel',
                        description: 'العودة للوحة الرئيسية'
                    });

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId('select_player_for_action')
                        .setPlaceholder('اختر لاعباً للتحكم به...')
                        .addOptions(options);

                    const resetButton = new ButtonBuilder()
                        .setCustomId('reset_panel')
                        .setLabel('إعادة تعيين')
                        .setStyle(ButtonStyle.Danger);

                    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
                    const rowButton = new ActionRowBuilder().addComponents(resetButton);

                    await interaction.update({ 
                        content: 'اختر اللاعب الذي تريد إدارة صلاحياته أو اتخاذ إجراء ضده:', 
                        embeds: [], 
                        components: [rowSelect, rowButton] 
                    });
                } 
                
                else if (selected === 'unban_player') {
                    const modal = new ModalBuilder()
                        .setCustomId('modal_unban_username')
                        .setTitle('البحث عن لاعب لفك الباند');

                    const input = new TextInputBuilder()
                        .setCustomId('unban_username_input')
                        .setLabel('اكتب يوزر الشخص المبند في روبلوكس:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                }
            }

            // ج) اختيار لاعب لاتخاذ إجراء ضده
            else if (customId === 'select_player_for_action') {
                const selectedPlayer = interaction.values[0];

                if (selectedPlayer === 'reset_panel') {
                    return resetMainPanel(interaction);
                }

                // عرض قائمة منسدلة بالإجراءات المتوفرة ضد اللاعب
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`player_action_type_${selectedPlayer}`)
                    .setPlaceholder('اختر الإجراء المطلوب...')
                    .addOptions([
                        {
                            label: 'طرد',
                            value: 'kick',
                            description: 'طرد اللاعب فوراً من اللعبة'
                        },
                        {
                            label: 'باند',
                            value: 'ban',
                            description: 'حظر اللاعب حظراً نهائياً'
                        },
                        {
                            label: 'تحذير',
                            value: 'warn',
                            description: 'إرسال تحذير وتنبيه للاعب'
                        },
                        {
                            label: 'سجل العقوبات',
                            value: 'info',
                            description: 'عرض السجل التاريخي لعقوبات اللاعب'
                        },
                        {
                            label: 'إعادة تعيين',
                            value: 'reset_panel',
                            description: 'العودة للوحة الرئيسية'
                        }
                    ]);

                const resetButton = new ButtonBuilder()
                    .setCustomId('reset_panel')
                    .setLabel('إعادة تعيين')
                    .setStyle(ButtonStyle.Danger);

                const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
                const rowButton = new ActionRowBuilder().addComponents(resetButton);

                await interaction.update({ 
                    content: `اختر الإجراء الذي تريد اتخاذه ضد اللاعب **${selectedPlayer}**:`, 
                    components: [rowSelect, rowButton] 
                });
            }

            // د) تنفيذ الإجراء المحدد ضد اللاعب
            else if (customId.startsWith('player_action_type_')) {
                const playerName = customId.replace('player_action_type_', '');
                const actionSelected = interaction.values[0];

                if (actionSelected === 'reset_panel') {
                    return resetMainPanel(interaction);
                }

                if (actionSelected === 'info') {
                    // عرض سجل عقوبات اللاعب الكيك والباند
                    const dbBans = getBans();
                    const banHistory = dbBans.filter(b => b.username.toLowerCase() === playerName.toLowerCase());
                    
                    let historyText = `**الحالة:** ${banHistory.length > 0 ? '🚫 محظور نهائياً' : '✅ سليم'}\n\n`;
                    
                    if (banHistory.length > 0) {
                        banHistory.forEach((b, idx) => {
                            historyText += `**سجل الباند #${idx + 1}:**\n- المسؤول: <@${b.adminId}>\n- السبب: ${b.reason}\n- التاريخ: <t:${Math.floor(b.timestamp / 1000)}:f>\n\n`;
                        });
                    } else {
                        historyText += 'لا توجد سجلات حظر سابقة لهذا اللاعب في قاعدة البيانات.\n';
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`سجل العقوبات للاعب: ${playerName}`)
                        .setDescription(historyText)
                        .setColor('#2b2d31')
                        .setImage('https://i.ibb.co/nMxxtzrW/image.png');

                    const resetButton = new ButtonBuilder()
                        .setCustomId('reset_panel')
                        .setLabel('إعادة تعيين')
                        .setStyle(ButtonStyle.Danger);

                    const rowButton = new ActionRowBuilder().addComponents(resetButton);

                    await interaction.update({ content: null, embeds: [embed], components: [rowButton] });
                    
                    // تسجيل استعلام السجل
                    await sendLog(client, `📜 قام <@${interaction.user.id}> باستعراض سجل عقوبات اللاعب **${playerName}**.`);
                } 
                
                else if (actionSelected === 'kick' || actionSelected === 'ban' || actionSelected === 'warn') {
                    // فتح نافذة لكتابة السبب
                    const modal = new ModalBuilder()
                        .setCustomId(`modal_reason_${actionSelected}_${playerName}`)
                        .setTitle(`سبب الـ ${actionSelected === 'kick' ? 'طرد' : actionSelected === 'ban' ? 'باند' : 'تحذير'}`);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('reason_text')
                        .setLabel('اكتب سبب العقوبة:')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                    await interaction.showModal(modal);
                }
            }
            return;
        }

        // --- 3. معالجة الأزرار (Buttons) ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'reset_panel') {
                await resetMainPanel(interaction);
                await sendLog(client, `🔄 قام <@${interaction.user.id}> بإعادة تعيين لوحة التحكم الرئيسية.`);
            } 
            
            else if (customId === 'reset_admin_panel') {
                await resetAdminPanel(interaction);
                await sendLog(client, `🔄 قام <@${interaction.user.id}> بإعادة تعيين لوحة الإدارة.`);
            } 
            
            else if (customId.startsWith('confirm_unban_')) {
                const playerName = customId.replace('confirm_unban_', '');
                
                // إزالة الباند من قاعدة البيانات وإضافة مهمة البوت في روبلوكس
                const success = removeBan(playerName);
                if (success) {
                    addTask('unban', playerName, 'Unbanned from Discord Panel', interaction.user.id);
                    await interaction.update({ content: `✅ تم فك الباند عن اللاعب **${playerName}** بنجاح وإرسال الأمر للعبة!`, embeds: [], components: [] });
                    await sendLog(client, `🔓 قام <@${interaction.user.id}> بفك الباند عن اللاعب **${playerName}**.`);
                } else {
                    await interaction.reply({ content: '❌ حدث خطأ، لم نجد اللاعب في قائمة المبندين المحدثة.', ephemeral: true });
                }
            } 
            
            else if (customId === 'cancel_unban') {
                await interaction.update({ content: 'تم إلغاء عملية فك الباند.', embeds: [], components: [] });
            }
            return;
        }

        // --- 4. معالجة النوافذ المنبثقة (Modals) ---
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;

            // أ) استقبال إعداد روم اللوق
            if (customId === 'modal_admin_log_channel') {
                const inputId = interaction.fields.getTextInputValue('log_channel_input').trim();
                
                try {
                    const channel = await client.channels.fetch(inputId);
                    if (!channel) {
                        return interaction.reply({ content: '❌ لم نتمكن من العثور على هذا الروم! تأكد من إعطاء البوت صلاحية قراءة الروم وإدخال الآي دي بشكل صحيح.', ephemeral: true });
                    }

                    setLogChannelId(inputId);
                    await interaction.reply({ content: `✅ تم تعيين روم اللوق بنجاح إلى: <#${inputId}>`, ephemeral: true });
                    
                    // إرسال اللوق الأول في الروم الجديد لتأكيد الربط
                    await sendLog(client, `📢 قام <@${interaction.user.id}> بتعيين هذا الروم كـ روم لوق لجميع العمليات والعقوبات الخاصة بالبوت.`);
                } catch (err) {
                    console.error(err);
                    await interaction.reply({ content: '❌ آي دي الروم غير صالح أو أن البوت لا يملك الصلاحيات الكافية للوصول إليه!', ephemeral: true });
                }
            }

            // ب) استقبال إعداد رتبة المسؤول
            else if (customId === 'modal_admin_role') {
                const roleId = interaction.fields.getTextInputValue('admin_role_input').trim();

                try {
                    const role = await interaction.guild.roles.fetch(roleId);
                    if (!role) {
                        return interaction.reply({ content: '❌ لم يتم العثور على هذه الرتبة في السيرفر! تأكد من صحة الآي دي.', ephemeral: true });
                    }

                    setAdminRoleId(roleId);
                    await interaction.reply({ content: `✅ تم تعيين رتبة المسؤول بنجاح إلى: <@&${roleId}>`, ephemeral: true });
                    await sendLog(client, `⚙️ قام <@${interaction.user.id}> بتعيين الرتبة <@&${roleId}> كـ رتبة المسؤول المسموح لها باستخدام لوحة التحكم للبوت.`);
                } catch (err) {
                    console.error(err);
                    await interaction.reply({ content: '❌ آي دي الرتبة غير صالح أو حدث خطأ أثناء التحقق منها!', ephemeral: true });
                }
            }

            // ج) استقبال يوزر فك الباند والبحث عنه
            else if (customId === 'modal_unban_username') {
                const username = interaction.fields.getTextInputValue('unban_username_input').trim();
                await interaction.deferReply({ ephemeral: true });

                try {
                    // الاتصال بـ API روبلوكس للتحقق من وجود اللاعب
                    const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                        usernames: [username],
                        excludeBannedUsers: false
                    });

                    if (userRes.data.data.length === 0) {
                        return interaction.editReply('❌ اسم الحساب خطأ أو غير موجود في روبلوكس!');
                    }

                    const robloxUser = userRes.data.data[0];
                    const robloxName = robloxUser.name;
                    const userId = robloxUser.id;

                    // التحقق مما إذا كان اللاعب محظوراً فعلياً في قاعدة البيانات
                    const banInfo = isBanned(robloxName);
                    if (!banInfo) {
                        return interaction.editReply(`❌ هذا الحساب (**${robloxName}**) غير مبند في قاعدة بيانات البوت!`);
                    }

                    // جلب صورة رأس الأفاتار للاعب
                    let avatarUrl = 'https://simgbb.com/images/favicon.png';
                    try {
                        const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
                        if (avatarRes.data.data && avatarRes.data.data.length > 0) {
                            avatarUrl = avatarRes.data.data[0].imageUrl;
                        }
                    } catch (e) {
                        console.error('Failed to load avatar:', e);
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('تأكيد فك الباند')
                        .setDescription(`هل أنت متأكد من رغبتك في فك حظر اللاعب أدناه؟`)
                        .setThumbnail(avatarUrl)
                        .addFields(
                            { name: 'يوزر روبلوكس', value: robloxName, inline: true },
                            { name: 'آي دي روبلوكس', value: userId.toString(), inline: true },
                            { name: 'سبب الباند السابق', value: banInfo.reason || 'لا يوجد سبب محدد' }
                        )
                        .setColor('Green')
                        .setImage('https://i.ibb.co/nMxxtzrW/image.png');

                    // أزرار بدون أي إيموجي تماماً
                    const rowButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_unban_${robloxName}`)
                            .setLabel('تأكيد فك الباند')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('cancel_unban')
                            .setLabel('إلغاء')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await interaction.editReply({ embeds: [embed], components: [rowButtons] });

                } catch (err) {
                    console.error(err);
                    await interaction.editReply('❌ حدث خطأ أثناء الاتصال بـ API روبلوكس. يرجى المحاولة لاحقاً.');
                }
            }

            // د) استقبال سبب العقوبة وتنفيذها (طرد، باند، تحذير)
            else if (customId.startsWith('modal_reason_')) {
                // customId is like modal_reason_kick_PlayerName
                const parts = customId.split('_');
                const actionType = parts[2];
                const playerName = parts.slice(3).join('_');
                const reason = interaction.fields.getTextInputValue('reason_text');

                // إضافة المهمة للبوت في روبلوكس
                addTask(actionType, playerName, reason, interaction.user.id);

                if (actionType === 'ban') {
                    // محاولة جلب الـ ID الخاص باللاعب لتخزينه بالباند إن أمكن
                    let robloxUserId = null;
                    try {
                        const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                            usernames: [playerName],
                            excludeBannedUsers: false
                        });
                        if (userRes.data.data && userRes.data.data.length > 0) {
                            robloxUserId = userRes.data.data[0].id;
                        }
                    } catch (e) {
                        console.error('Failed to get userId for ban storage:', e);
                    }

                    // إضافة الباند لقاعدة البيانات المحلية
                    addBan(playerName, robloxUserId, reason, interaction.user.id);
                    await interaction.reply({ content: `✅ تم حظر اللاعب **${playerName}** نهائياً بنجاح وإرسال الأمر للعبة.\n**السبب:** ${reason}`, ephemeral: true });
                    await sendLog(client, `🔨 قام <@${interaction.user.id}> بتبنيد اللاعب **${playerName}** نهائياً.\n**السبب:** ${reason}`);
                } 
                
                else if (actionType === 'kick') {
                    // إضافة سجل الكيك
                    addKick(playerName, reason, interaction.user.id);
                    await interaction.reply({ content: `✅ تم طرد اللاعب **${playerName}** بنجاح وإرسال الأمر للعبة.\n**السبب:** ${reason}`, ephemeral: true });
                    await sendLog(client, `⛔ قام <@${interaction.user.id}> بطرد اللاعب **${playerName}**.\n**السبب:** ${reason}`);
                } 
                
                else if (actionType === 'warn') {
                    await interaction.reply({ content: `✅ تم إرسال تحذير للاعب **${playerName}** بنجاح وإرسال الأمر للعبة.\n**السبب:** ${reason}`, ephemeral: true });
                    await sendLog(client, `⚠️ قام <@${interaction.user.id}> بتحذير اللاعب **${playerName}**.\n**السبب:** ${reason}`);
                }
            }
        }
    },
};
