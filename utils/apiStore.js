// متغيرات في الذاكرة لتخزين قائمة اللاعبين والمهام (الأوامر المرسلة من البوت لروبلوكس)
let onlinePlayers = [];
let pendingTasks = [];

// تحديث قائمة اللاعبين القادمين من روبلوكس
function updatePlayers(players) {
    onlinePlayers = players;
}

// الحصول على القائمة
function getPlayers() {
    return onlinePlayers;
}

// إضافة أمر جديد (طرد، باند، فك باند، تحذير)
function addTask(action, targetPlayer, reason, adminId) {
    const taskId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
    const task = {
        id: taskId,
        action, // 'kick', 'ban', 'unban', 'warn'
        targetPlayer, // Username in Roblox
        reason,
        adminId, // Discord Admin ID
        timestamp: Date.now()
    };
    pendingTasks.push(task);
    return taskId;
}

// سحب المهام وحذفها من القائمة بعد سحبها (أو يمكنك إبقاؤها ومسحها بـ endpoint آخر)
function getTasks() {
    // للحصول على المهام ونقوم بتفريغ القائمة بمجرد سحبها (لكي لا تتكرر الأوامر)
    const tasksToSend = [...pendingTasks];
    pendingTasks = [];
    return tasksToSend;
}

module.exports = {
    updatePlayers,
    getPlayers,
    addTask,
    getTasks
};
