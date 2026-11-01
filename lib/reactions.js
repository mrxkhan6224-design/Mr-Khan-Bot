const fs = require('fs');
const path = require('path');

// WhatsApp default reaction emojis (for regular messages)
const commandEmojis = ['🥹','💔','🥺','🌿','♥️','🥰','😍','😌','😎','🤓','🥳','🤩','🤗','🤭','😈','👿','🤡','👻','💀','☠️','👽','🫶🏻','👀','🫀','🫂','💍','👑','🌱','☘️','🍃','🍂','🥀','🌹','🪷','🪻','🌸','🌝','🌍','🍫','🪀','🎭','🫟','🎀','🎉','❤️','🖤','🤍','❤️‍🔥','❤️‍🩹','💞','💯','🏴‍☠️','💐','🙂','😫','🫣','🍇','🍭','🎯','⛱️','💎','🧿','🔮','🔖','🩷','💝','🌀','🤌🏻','🐼','🪽','🐦‍🔥','🪺','🍁','🌚','💫','🌈','🌟','🔥','🪼','🐬','⛈️','🍬','🍿'];

// Path for storing state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// ============================================
// Load state
// ============================================
function loadState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
            return {
                autoReaction: data.autoReaction === true,
                commandReaction: data.commandReaction !== false // default true
            };
        }
    } catch (error) {
        console.error('Error loading reaction state:', error);
    }
    return { autoReaction: false, commandReaction: true };
}

// ============================================
// Save state
// ============================================
function saveState(state) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA)
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'))
            : { groups: ['☠️'], chatbot: {} };

        data.autoReaction = state.autoReaction;
        data.commandReaction = state.commandReaction;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving reaction state:', error);
    }
}

// Load once
let state = loadState();

// Random emoji
function getRandomEmoji() {
    return commandEmojis[Math.floor(Math.random() * commandEmojis.length)];
}

// ============================================
// Regular messages par random emoji react
// ============================================
async function addAutoReaction(sock, message) {
    try {
        if (!state.autoReaction || !message?.key?.id) return;

        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch (error) {
        console.error('Error adding auto reaction:', error);
    }
}

// ============================================
// Commands ⏳ react
// ============================================
async function addCommandReaction(sock, message) {
    try {
        if (!state.commandReaction || !message?.key?.id) return;

        await sock.sendMessage(message.key.remoteJid, {
            react: { text: '⏳', key: message.key }
        });
    } catch (error) {
        console.error('Error adding command reaction:', error);
    }
}

// ============================================
// Handle .areact command
// ============================================
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() || '';
        const args = rawText.split(/\s+/).slice(1);
        const action = args[0]?.toLowerCase();
        const subAction = args[1]?.toLowerCase();

        // ============================================
        // .areact on — Regular messages ON
        // ============================================
        if (action === 'on' && !subAction) {
            state.autoReaction = true;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ Auto-reactions ENABLED for regular messages.\n${state.commandReaction ? '💡 Command reactions (⏳) are ON.' : '⚠️ Command reactions are OFF. Use: .areact on commands'}`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact off — Regular messages OFF
        // ============================================
        if (action === 'off' && !subAction) {
            state.autoReaction = false;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ Auto-reactions DISABLED for regular messages.\n${state.commandReaction ? '💡 Command reactions (⏳) are still ON.' : '⚠️ Command reactions are also OFF.'}`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact on commands — Only command reactions ON
        // ============================================
        if (action === 'on' && subAction === 'commands') {
            state.commandReaction = true;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ Command reactions (⏳) ENABLED.\n${state.autoReaction ? '💡 Regular message reactions are ON.' : '⚠️ Regular message reactions are OFF.'}`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact off commands — Only command reactions OFF
        // ============================================
        if (action === 'off' && subAction === 'commands') {
            state.commandReaction = false;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ Command reactions (⏳) DISABLED.`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact on all — Everything ON
        // ============================================
        if (action === 'on' && subAction === 'all') {
            state.autoReaction = true;
            state.commandReaction = true;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ ALL reactions ENABLED (regular + commands).`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact off all — Everything OFF
        // ============================================
        if (action === 'off' && subAction === 'all') {
            state.autoReaction = false;
            state.commandReaction = false;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: `✅ ALL reactions DISABLED (regular + commands).`,
                quoted: message
            });
            return;
        }

        // ============================================
        // .areact — Show status
        // ============================================
        await sock.sendMessage(chatId, {
            text: `*📊 Auto-Reaction Status*\n\n` +
                  `• Regular messages: ${state.autoReaction ? '✅ ON' : '❌ OFF'}\n` +
                  `• Command reactions (⏳): ${state.commandReaction ? '✅ ON' : '❌ OFF'}\n\n` +
                  `*Commands:*\n` +
                  `.areact on — Regular messages ON\n` +
                  `.areact off — Regular messages OFF\n` +
                  `.areact on commands — Commands ON only\n` +
                  `.areact off commands — Commands OFF only\n` +
                  `.areact on all — Everything ON\n` +
                  `.areact off all — Everything OFF`,
            quoted: message
        });

    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error controlling auto-reactions',
            quoted: message
        });
    }
}

module.exports = {
    addAutoReaction,
    addCommandReaction,
    handleAreactCommand
};