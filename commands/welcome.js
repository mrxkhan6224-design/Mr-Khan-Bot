const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { channelInfo } = require('../lib/messageConfig');

async function welcomeCommand(sock, chatId, message, match) {
    // Check if it's a group
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }

    // Extract match from message
    const text = message.message?.conversation || 
                message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');

    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    // Check if welcome is enabled for this group
    const isWelcomeEnabled = await isWelcomeOn(id);
    if (!isWelcomeEnabled) return;

    // Get custom welcome message
    const customMessage = await getWelcome(id);

    // Get group metadata
    const groupMetadata = await sock.groupMetadata(id);
    const groupName = groupMetadata.subject;
    const groupDesc = groupMetadata.desc || 'No description available';

    // Send welcome message for each new participant
    for (const participant of participants) {
        try {
            // Get participant JID (full WhatsApp ID)
            const participantJid = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNumber = participantJid.split('@')[0];
            
            // Get user's display name (optional)
            let displayName = userNumber;
            try {
                const groupParticipants = groupMetadata.participants;
                const userParticipant = groupParticipants.find(p => p.id === participantJid);
                if (userParticipant && userParticipant.name) {
                    displayName = userParticipant.name;
                }
            } catch (nameError) {
                console.log('Could not fetch display name, using phone number');
            }
            
            // Process custom message with variables
            let finalMessage;
            if (customMessage) {
                // Replace {user} with @mention format
                finalMessage = customMessage
                    .replace(/{user}/g, `@${userNumber}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                // Default message if no custom message is set
                const now = new Date();
                const timeString = now.toLocaleString('en-US', {
                    month: '2-digit',
                    day: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });
                
                finalMessage = `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮
┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @${userNumber} 👋
┃Member count: #${groupMetadata.participants.length}
┃𝚃𝙸𝙼𝙴: ${timeString}⏰
╰━━━━━━━━━━━━━━━╯

@${userNumber} Welcome to *${groupName}*! 🎉
*Group Description*
${groupDesc}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝗠𝗥. 𝗞𝗛𝗔𝗡-𝗕𝗢𝗧 😈☠️*`;
            }
            
            // Send welcome message with proper mention using mentions array
            await sock.sendMessage(id, {
                text: finalMessage,
                mentions: [participantJid], // This ensures proper tagging
                ...channelInfo
            });
            
            console.log(`✅ Welcome message sent to @${userNumber} in ${groupName}`);
            
        } catch (error) {
            console.error('Error sending welcome message:', error);
            
            // Fallback to simple message
            const participantJid = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            const userNumber = participantJid.split('@')[0];
            
            let fallbackMessage;
            if (customMessage) {
                fallbackMessage = customMessage
                    .replace(/{user}/g, `@${userNumber}`)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                fallbackMessage = `Welcome @${userNumber} to ${groupName}! 🎉`;
            }
            
            await sock.sendMessage(id, {
                text: fallbackMessage,
                mentions: [participantJid],
                ...channelInfo
            });
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };