const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) return;

        // URL nikalne ka asaan tareeqa
        const url = text.split(/\s+/).find(v => v.includes('tiktok.com'));
        
        if (!url) {
            return await sock.sendMessage(chatId, { text: "❌ Please provide a valid TikTok link." });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        try {
            // Method 1: Ruhend Scraper (Sabse Pehle)
            const scrap = await ttdl(url);
            if (scrap && scrap.video) {
                return await sock.sendMessage(chatId, {
                    video: { url: scrap.video },
                    mimetype: "video/mp4",
                    caption: "✅ *TikTok Video Downloaded*\n\n𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗠𝗥. 𝗞𝗛𝗔𝗡-𝗕𝗢𝗧 😈☠️"
                }, { quoted: message });
            }

            // Method 2: Alternative API (Agar scraper fail ho jaye)
            const api2 = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
            if (api2.data && api2.data.video) {
                return await sock.sendMessage(chatId, {
                    video: { url: api2.data.video.noWatermark || api2.data.video.url },
                    mimetype: "video/mp4",
                    caption: "✅ *TikTok Downloaded (Mirror API)*"
                }, { quoted: message });
            }

            throw new Error("Methods failed");

        } catch (err) {
            console.error("Download Error:", err.message);
            await sock.sendMessage(chatId, { 
                text: "❌ Video download nahi ho saki. Shayad link galat hai ya server down hai." 
            });
        }

    } catch (e) {
        console.error("Global Error:", e);
    }
}

module.exports = tiktokCommand;