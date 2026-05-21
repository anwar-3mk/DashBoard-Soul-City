const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('لوحة')
        .setDescription('إظهار لوحة التحكم في اللعبة'),
    async execute(interaction) {
        // التحقق من صلاحيات العضو (مثلاً فقط الإداريين يمكنهم استخدامه)
        // if (!interaction.member.permissions.has('Administrator')) return;

        const embed = new EmbedBuilder()
            .setTitle('لوحة تحكم روبلوكس')
            .setDescription('اختر الإجراء الذي تريد القيام به من الأزرار أدناه.')
            .setColor('#2b2d31')
            .setImage('https://i.imgur.com/your_image_url_here.png'); // سيتم استبدال هذا الرابط بصورة لاحقاً

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('manage_players')
                    .setLabel('إدارة اللاعبين')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
