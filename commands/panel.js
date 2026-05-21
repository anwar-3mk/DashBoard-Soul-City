const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getLogChannelId, getAdminRoleId } = require('../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('لوحة')
        .setDescription('إظهار لوحة التحكم في اللعبة'),
    async execute(interaction) {
        const logChannelId = getLogChannelId();
        
        // التحقق من تعيين روم اللوق أولاً قبل أي شيء
        if (!logChannelId) {
            return interaction.reply({ 
                content: '❌ يجب عليك تحديد روم اللوق أولاً باستخدام أمر `/ادارة` قبل البدء في استخدام البوت!', 
                ephemeral: true 
            });
        }

        // التحقق من الصلاحيات: Administrator أو رتبة المسؤول المحددة
        const adminRoleId = getAdminRoleId();
        const hasAdminPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const hasAdminRole = adminRoleId ? interaction.member.roles.cache.has(adminRoleId) : false;

        if (!hasAdminPermission && !hasAdminRole) {
            return interaction.reply({ 
                content: '❌ ليس لديك الصلاحية لاستخدام لوحة التحكم! يجب أن تملك صلاحية Administrator أو رتبة المسؤول المحددة.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('لوحة تحكم روبلوكس')
            .setDescription('اختر الإجراء الذي تريد القيام به من القائمة المنسدلة أدناه.')
            .setColor('#2b2d31')
            .setImage('https://i.ibb.co/nMxxtzrW/image.png');

        // قائمة منسدلة رئيسية للخيارات
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

        // زر إعادة التعيين
        const resetButton = new ButtonBuilder()
            .setCustomId('reset_panel')
            .setLabel('إعادة تعيين')
            .setStyle(ButtonStyle.Danger);

        const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
        const rowButton = new ActionRowBuilder().addComponents(resetButton);

        await interaction.reply({ embeds: [embed], components: [rowSelect, rowButton] });
    },
};
