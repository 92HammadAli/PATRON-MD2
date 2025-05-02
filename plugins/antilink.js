const { cmd } = require("../command");
const { enableLinkDetection, disableLinkDetection, getLinkDetectionMode } = require("../lib/linkDetection");
const { handleLinkDetection } = require("../lib/linkDetectionHandler");
const { getWarnings, addWarning, resetWarnings } = require("../lib/warnings");

module.exports = {
    name: "antilink",
    alias: ["antilink"],
    desc: "Enable/disable link detection in groups",
    category: "group",
    usage: "antilink [mode]",
    react: "🔒",
    start: async (Miku, m, { args, isAdmin, isBotAdmin, isCreator, pushName }) => {
        if (!m.isGroup) return m.reply("This command can only be used in groups!");
        if (!isAdmin && !isCreator) return m.reply("You must be an admin to use this command!");

        const groupJid = m.from;
        const mode = args[0]?.toLowerCase();

        if (!mode) {
            try {
                const { mode: currentMode } = getLinkDetectionMode(groupJid);
                return m.reply(`Current antilink mode: ${currentMode || "disabled"}\n\nAvailable modes:\n- delete: Delete messages with links\n- warn: Warn users (3 warnings = kick)\n- kick: Kick users immediately\n\nUsage: ${prefix}antilink [mode]`);
            } catch (error) {
                return m.reply(`Error getting current mode: ${error.message}`);
            }
        }

        if (mode === "off") {
            try {
                const { message } = disableLinkDetection(groupJid);
                return m.reply(message);
            } catch (error) {
                return m.reply(`Error disabling antilink: ${error.message}`);
            }
        }

        if (["delete", "warn", "kick"].includes(mode)) {
            try {
                const { message } = enableLinkDetection(groupJid, mode);
                return m.reply(message);
            } catch (error) {
                return m.reply(`Error enabling antilink: ${error.message}`);
            }
        }

        return m.reply("Invalid mode! Available modes: delete, warn, kick, off");
    },
    handleMessage: async (Miku, m) => {
        if (!m.isGroup) return;
        try {
            await handleLinkDetection(m, m.from, m.sender, Miku);
        } catch (error) {
            await m.reply(`Error handling link detection: ${error.message}`);
        }
    }
};

// Existing antilink command
cmd({
    pattern: "antilink",
    desc: "Manage anti-link settings in a group.",
    category: "group",
    filename: __filename,
    use: ".antilink [kick/delete/warn/off]"
}, async (conn, mek, m, { from, args, isGroup, isAdmins, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🔒",
            key: m.key
        }
    });
    if (!isGroup) return reply("*{ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ}*\nᴛʜɪs ғᴇᴀᴛᴜʀᴇ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ɢʀᴏᴜᴘ!!");
    if (!isAdmins) return reply("*{ᴀᴄᴄᴇss ᴅᴇɴɪᴇᴅ}*\nᴛʜɪs ғᴇᴀᴛᴜʀᴇ ɪs ғᴏʀ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ᴏɴʟʏ!!");

    const mode = args.length > 0 ? args[0].toLowerCase() : null;
    if (!mode || !["kick", "delete", "warn", "off"].includes(mode)) {
        return reply("*Usage: antilink [kick/delete/warn/off]*");
    }

    try {
        if (mode === "off") {
            const { message } = disableLinkDetection(from);
            return reply(`*${message}*`);
        }

        const { message } = enableLinkDetection(from, mode);
        return reply(`*${message}*`);
    } catch (error) {
        return reply(`*Error: ${error.message}*`);
    }
});

// New command: warn a user by replying to their message
cmd({
    pattern: "warn",
    desc: "Warn a specific user. After 3 warnings, the user will be kicked.",
    category: "group",
    filename: __filename,
    use: ".warn <reply to user>"
}, async (conn, mek, m, { from, isGroup, isAdmins, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🔒",
            key: m.key
        }
    });
    if (!isGroup) return reply("❌ *Access Denied!*\n> This command can only be used in groups.");
    if (!isAdmins) return reply("❌ *Access Denied!*\n> Only *group admins* can issue warnings.");

    if (!m.quoted) return reply("⚠️ *Please reply to a user's message to warn them.*");

    const participant = m.quoted.sender;
    if (!participant) return reply("❌ *Unable to identify the user to warn.*");

    if (participant.split('@')[0] === "2348133729715") {
        return reply("🚫 *Action Blocked!*\n> You cannot warn the bot creator.");
    }

    try {
        // Attempt to delete the warned message
        if (m.quoted.key) {
            await conn.sendMessage(from, { delete: m.quoted.key });
        }
    } catch (error) {
        console.error("Error deleting message:", error);
        await reply(`⚠️ *Failed to delete the message.*\n> ${error.message}`);
    }

    const username = "@" + participant.split("@")[0];
    const count = addWarning(from, participant);

    if (count >= 3) {
        try {
            await conn.groupParticipantsUpdate(from, [participant], "remove");
            resetWarnings(from, participant);
            return reply(`⚠️ *${username} has received 3 warnings and has been removed from the group.*`);
        } catch (err) {
            return reply(`❌ *Failed to remove ${username}.*\n> ${err.message}`);
        }
    }

    return reply(`⚠️ *${username} has been warned.*\n> Total warnings: *${count}/3*`);
});

cmd({
    pattern: "resetwarn",
    desc: "Reset warnings for a specific user.",
    category: "group",
    filename: __filename,
    use: ".resetwarn <reply to user>"
}, async (conn, mek, m, { from, isGroup, isAdmins, reply }) => {
    await conn.sendMessage(m.key.remoteJid, {
        react: {
            text: "🔒",
            key: m.key
        }
    });
    if (!isGroup) return reply("❌ *Access Denied!*\n> This command can only be used in groups.");
    if (!isAdmins) return reply("❌ *Access Denied!*\n> Only *group admins* can reset warnings.");

    if (!m.quoted) return reply("⚠️ *Please reply to the user whose warnings you want to reset.*");

    const participant = m.quoted.sender;
    if (!participant) return reply("❌ *Unable to identify the user to reset.*");

    if (participant.split('@')[0] === "2348133729715") {
        return reply("🚫 *Action Blocked!*\n> You cannot reset warnings for the bot creator.");
    }

    const username = "@" + participant.split("@")[0];
    resetWarnings(from, participant);

    return reply(`✅ *Warnings reset for ${username}.*`);
});
