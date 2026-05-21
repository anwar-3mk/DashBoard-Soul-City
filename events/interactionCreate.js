const { 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder 
} = require('discord.js');
const { getPlayers, addTask } = require('../utils/apiStore');
const axios = require('axios');

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

        // --- 2. معالجة الأزرار (Buttons) ---
        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (customId === 'manage_players') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('action_kick').setLabel('طرد').setEmoji('⛔').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('action_ban').setLabel('باند').setEmoji('🔨').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('action_warn').setLabel('تحذير').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('action_info').setLabel('سجل').setEmoji('📜').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('action_unban').setLabel('فك باند').setEmoji('🔓').setStyle(ButtonStyle.Success)
                );
                await interaction.reply({ content: 'اختر الإجراء المطلوب:', components: [row], ephemeral: true });
            }

            else if (customId === 'action_kick' || customId === 'action_ban') {
                const actionType = customId === 'action_kick' ? 'kick' : 'ban';
                const players = getPlayers(); // الحصول على قائمة اللاعبين من الذاكرة

                if (players.length === 0) {
                    return interaction.reply({ content: 'لا يوجد لاعبين في السيرفر حالياً.', ephemeral: true });
                }

                // إنشاء خيارات القائمة المنسدلة (بحد أقصى 23 كبداية كما طلبت)
                const options = players.slice(0, 23).map(p => ({
                    label: p.name,
                    description: `ID: ${p.userId}`,
                    value: `${actionType}_${p.name}`
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`select_${actionType}`)
                    .setPlaceholder('اختر لاعباً...')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.update({ content: `اختر اللاعب الذي تريد إعطائه ${actionType === 'kick' ? 'طرد' : 'باند'}:`, components: [row] });
            }

            else if (customId === 'action_unban') {
                // فتح Modal لكتابة يوزر روبلوكس لفك الباند
                const modal = new ModalBuilder()
                    .setCustomId('modal_unban_search')
                    .setTitle('البحث عن لاعب لفك الباند');

                const usernameInput = new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('اكتب يوزر الشخص المبند في روبلوكس:')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(usernameInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }

            else if (customId.startsWith('confirm_')) {
                // customId is like confirm_kick_PlayerName
                const [, actionType, playerName] = customId.split('_');

                const modal = new ModalBuilder()
                    .setCustomId(`modal_reason_${actionType}_${playerName}`)
                    .setTitle(`سبب الـ ${actionType === 'kick' ? 'طرد' : actionType === 'ban' ? 'باند' : 'فك الباند'}`);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason_text')
                    .setLabel('اكتب السبب:')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }

            else if (customId.startsWith('cancel_')) {
                await interaction.update({ content: 'تم إلغاء العملية.', components: [] });
            }
            
            else if (customId === 'action_warn' || customId === 'action_info') {
                await interaction.reply({ content: 'هذه الميزة سيتم شرحها وإضافتها لاحقاً!', ephemeral: true });
            }
            return;
        }

        // --- 3. معالجة القوائم المنسدلة (Select Menus) ---
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_kick' || interaction.customId === 'select_ban') {
                // value is like kick_PlayerName
                const [actionType, playerName] = interaction.values[0].split('_');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_${actionType}_${playerName}`).setLabel('تأكيد').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`cancel_${actionType}`).setLabel('إلغاء').setStyle(ButtonStyle.Danger)
                );

                await interaction.update({ content: `هل أنت متأكد أنك تريد ${actionType === 'kick' ? 'طرد' : 'إعطاء باند لـ'} **${playerName}**؟`, components: [row] });
            }
            return;
        }

        // --- 4. معالجة النوافذ المنبثقة (Modals) ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('modal_reason_')) {
                // customId: modal_reason_kick_PlayerName
                const [, , actionType, playerName] = interaction.customId.split('_');
                const reason = interaction.fields.getTextInputValue('reason_text');

                // إضافة الأمر لقائمة الانتظار (API Store) لترسله لروبلوكس
                addTask(actionType, playerName, reason, interaction.user.id);

                await interaction.reply({ content: `✅ تم إرسال أمر الـ ${actionType} للاعب **${playerName}** بنجاح.\nالسبب: ${reason}`, ephemeral: true });

                // يمكن هنا إرسال لوق (Log) إلى قناة مخصصة
                // const logChannel = client.channels.cache.get('LOG_CHANNEL_ID');
                // if (logChannel) logChannel.send(`...`);
            }

            else if (interaction.customId === 'modal_unban_search') {
                const username = interaction.fields.getTextInputValue('roblox_username');
                
                await interaction.deferReply({ ephemeral: true });

                try {
                    // سحب معلومات اللاعب من روبلوكس API لنجلب الـ userId والأفاتار
                    const userRes = await axios.post('https://users.roblox.com/v1/usernames/users', {
                        usernames: [username],
                        excludeBannedUsers: false
                    });

                    if (userRes.data.data.length === 0) {
                        return interaction.editReply('❌ لم يتم العثور على هذا الحساب في روبلوكس.');
                    }

                    const robloxUser = userRes.data.data[0];
                    const userId = robloxUser.id;

                    // سحب صورة الأفاتار
                    const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
                    const avatarUrl = avatarRes.data.data[0].imageUrl;

                    // في نسخة حقيقية، هنا يجب أن تتحقق من قاعدة بياناتك (أو تسأل روبلوكس) لمعرفة ما إذا كان مبند وما هو سبب الباند
                    // كنسخة تجريبية، سنفترض أنه متبند (لأننا لم نربط قاعدة البيانات الفعلية بعد)
                    const isBanned = true; 
                    const oldBanReason = "مخالفة القوانين (مثال تجريبي)";

                    if (!isBanned) {
                        return interaction.editReply('✅ هذا اللاعب غير متبند من الأساس.');
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(`معلومات الباند: ${robloxUser.name}`)
                        .setThumbnail(avatarUrl)
                        .addFields(
                            { name: 'يوزر روبلوكس', value: robloxUser.name, inline: true },
                            { name: 'آي دي روبلوكس', value: userId.toString(), inline: true },
                            { name: 'سبب الباند', value: oldBanReason }
                        )
                        .setColor('Red');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`confirm_unban_${robloxUser.name}`).setLabel('فك باند').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel_unban').setLabel('إلغاء').setStyle(ButtonStyle.Danger)
                    );

                    await interaction.editReply({ embeds: [embed], components: [row] });

                } catch (err) {
                    console.error(err);
                    await interaction.editReply('❌ حدث خطأ أثناء الاتصال بـ API روبلوكس.');
                }
            }
        }
    },
};
