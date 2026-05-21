require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { getTasks, addTask, updatePlayers, getPlayers } = require('./utils/apiStore');
const { isBanned } = require('./utils/db');

// 1. إعداد بوت الديسكورد
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();
const commandsArray = [];

// تحميل الأوامر
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// تحميل الأحداث (Events)
const eventsPath = path.join(__dirname, 'events');
if (!fs.existsSync(eventsPath)) fs.mkdirSync(eventsPath);

const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// تسجيل الأوامر عند تشغيل البوت
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
        console.log(`Started refreshing ${commandsArray.length} application (/) commands.`);
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsArray },
        );
        console.log(`Successfully reloaded application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
});

client.login(process.env.DISCORD_TOKEN);

// 2. إعداد سيرفر Express للربط مع روبلوكس
const app = express();
app.use(express.json());
app.use(cors());

// مصادقة بسيطة (مهمة لمنع أي شخص غير سيرفر روبلوكس من التلاعب)
const API_KEY = process.env.ROBLOX_API_KEY || 'super_secret_key_123';
const authMiddleware = (req, res, next) => {
    const key = req.headers['authorization'];
    if (key !== API_KEY) return res.status(403).json({ error: 'Unauthorized' });
    next();
};

// استقبال قائمة اللاعبين الأونلاين من روبلوكس
app.post('/api/update-players', authMiddleware, (req, res) => {
    const { players } = req.body;
    if (Array.isArray(players)) {
        updatePlayers(players);
        return res.json({ success: true, message: 'Players updated successfully' });
    }
    return res.status(400).json({ error: 'Invalid data format' });
});

// سحب الأوامر (Tasks) من روبلوكس لتنفيذها
app.get('/api/tasks', authMiddleware, (req, res) => {
    const tasks = getTasks();
    res.json({ tasks });
});

// تأكيد تنفيذ روبلوكس للأمر (اختياري لكن جيد)
app.post('/api/task-completed', authMiddleware, (req, res) => {
    const { taskId } = req.body;
    // يمكن هنا إضافة كود لحذف التاسك أو تسجيله بأنه اكتمل
    res.json({ success: true });
});

// التحقق من حالة حظر (باند) اللاعب عند انضمامه للعبة
app.get('/api/check-ban/:username', authMiddleware, (req, res) => {
    const { username } = req.params;
    const banInfo = isBanned(username);
    if (banInfo) {
        return res.json({ banned: true, reason: banInfo.reason });
    }
    return res.json({ banned: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
