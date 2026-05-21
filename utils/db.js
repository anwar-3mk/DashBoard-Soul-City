const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');

const defaultData = {
    logChannelId: null,
    adminRoleId: null,
    bans: [],
    kicks: []
};

// تحميل البيانات من ملف JSON
function loadData() {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 4), 'utf8');
            return defaultData;
        }
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error loading database:', error);
        return defaultData;
    }
}

// حفظ البيانات في ملف JSON
function saveData(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

// الحصول على آي دي روم اللوق
function getLogChannelId() {
    const data = loadData();
    return data.logChannelId;
}

// تعيين آي دي روم اللوق
function setLogChannelId(channelId) {
    const data = loadData();
    data.logChannelId = channelId;
    saveData(data);
}

// الحصول على آي دي رتبة المسؤول
function getAdminRoleId() {
    const data = loadData();
    return data.adminRoleId;
}

// تعيين آي دي رتبة المسؤول
function setAdminRoleId(roleId) {
    const data = loadData();
    data.adminRoleId = roleId;
    saveData(data);
}

// الحصول على قائمة الباندات
function getBans() {
    const data = loadData();
    return data.bans || [];
}

// التحقق مما إذا كان اللاعب محظوراً
function isBanned(username) {
    const bans = getBans();
    return bans.find(b => b.username.toLowerCase() === username.toLowerCase()) || null;
}

// إضافة لاعب إلى قائمة الباند
function addBan(username, userId, reason, adminId) {
    const data = loadData();
    // إزالة الباند القديم إن وجد لمنع التكرار
    data.bans = data.bans.filter(b => b.username.toLowerCase() !== username.toLowerCase());
    
    data.bans.push({
        username,
        userId: userId || null,
        reason,
        adminId,
        timestamp: Date.now()
    });
    saveData(data);
}

// فك الباند عن لاعب
function removeBan(username) {
    const data = loadData();
    const isExist = isBanned(username);
    if (!isExist) return false;

    data.bans = data.bans.filter(b => b.username.toLowerCase() !== username.toLowerCase());
    saveData(data);
    return true;
}

// إضافة كيك جديد للسجلات
function addKick(username, reason, adminId) {
    const data = loadData();
    data.kicks.push({
        username,
        reason,
        adminId,
        timestamp: Date.now()
    });
    saveData(data);
}

module.exports = {
    getLogChannelId,
    setLogChannelId,
    getAdminRoleId,
    setAdminRoleId,
    getBans,
    isBanned,
    addBan,
    removeBan,
    addKick
};
