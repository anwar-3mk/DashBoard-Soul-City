const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ادارة')
        .setDescription('إعدادات البوت والتحكم (للمسؤولين فقط)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // جعل الأمر افتراضياً للمديرين فقط
    async execute(interaction) {
        // التحقق الإضافي للتأكيد
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط الذين يملكون صلاحية Administrator!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('إعدادات إدارة البوت')
            .setDescription('اختر الإجراء أو الإعداد الذي ترغب في تعديله من القائمة المنسدلة أدناه.')
            .setColor('#2b2d31')
            .setImage('https://i.ibb.co/nMxxtzrW/image.png');

        // قائمة منسدلة للإعدادات
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

        // زر إعادة التعيين لتحديث الواجهة وإعادتها لحالتها الافتراضية
        const resetButton = new ButtonBuilder()
            .setCustomId('reset_admin_panel')
            .setLabel('إعادة تعيين')
            .setStyle(ButtonStyle.Danger);

        const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
        const rowButton = new ActionRowBuilder().addComponents(resetButton);

        await interaction.reply({ embeds: [embed], components: [rowSelect, rowButton] });
    },
};
