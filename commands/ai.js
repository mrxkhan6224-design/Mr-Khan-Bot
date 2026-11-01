const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================
// 🌍 Detect language
// ============================================
function detectQueryLanguage(text) {
    const cleanText = text.trim().toLowerCase();
    if (/[\u0600-\u06FF]/.test(cleanText)) return 'urdu';

    const romanUrduWords = ['kaise','kaisa','kya','kia','hai','hain','hun','ho','mein','main','aap','tum','hum','kar','karo','karna','raha','rahi','yeh','woh','nahi','haan','bhai','acha','theek','bahut','bohat','mujhe','tujhe','assalam','salam','shukriya','kahan','kab','kaun','kyun','kyu','chalo','aao','jao','dekho','suno','bolo','dil','yaar','dost','pyar','khana','pani','ghar','kaam','hal','haal','batao','bata','chahiye'];
    const words = cleanText.split(/\s+/).map(w => w.replace(/[^\w]/g, '')).filter(Boolean);
    let matches = 0;
    for (const word of words) {
        if (romanUrduWords.includes(word)) matches++;
    }
    return (words.length > 0 && (matches / words.length) >= 0.3) ? 'urdu' : 'english';
}

// ============================================
// 🎨 Generate Image (Pollinations)
// ============================================
async function generateImage(prompt) {
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    console.log(`🎨 Generating image: ${prompt}`);

    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        validateStatus: s => s >= 200 && s < 400
    });

    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length < 5000) {
        throw new Error('Image too small / invalid');
    }

    return buffer;
}

// ============================================
// 🔊 Generate Voice (Google TTS)
// ============================================
async function generateVoice(text, lang = 'en') {
    console.log(`🔊 Generating voice (${lang}): ${text.slice(0, 50)}...`);

    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= 180) {
            chunks.push(remaining);
            break;
        }
        let chunk = remaining.substring(0, 180);
        const lastSpace = chunk.lastIndexOf(' ');
        if (lastSpace > 50) chunk = remaining.substring(0, lastSpace);
        chunks.push(chunk);
        remaining = remaining.substring(chunk.length).trim();
    }

    const audioParts = [];
    for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob&ttsspeed=1`;
        const res = await axios({
            method: 'GET',
            url,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://translate.google.com/'
            },
            timeout: 30000
        });
        audioParts.push(res.data);
    }

    return Buffer.concat(audioParts);
}

// ============================================
// 🤖 Get AI Text Response (Pollinations)
// ============================================
async function getAIResponse(query) {
    const lang = detectQueryLanguage(query);
    const systemMessage = lang === 'urdu'
    ? 'You are a helpful assistant. The user is speaking in Urdu. You MUST reply in Urdu language using Urdu script (اردو رسم الخط) ONLY. Do NOT use Roman Urdu (English letters). Write everything in proper Urdu script like: السلام علیکم، میں ٹھیک ہوں، آپ کیسے ہیں؟ Keep your reply natural, friendly, and helpful.'
    : 'You are a helpful assistant. Reply in English.';

    const response = await axios.post('https://text.pollinations.ai/openai', {
        model: 'openai',
        messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: query }
        ],
        temperature: 0.7
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
    });

    let answer = response.data;
    if (typeof answer === 'object' && answer !== null) {
        answer = answer.choices?.[0]?.message?.content || answer.text || answer.result || JSON.stringify(answer);
    }
    return answer;
}

// ============================================
// 🎯 MAIN COMMAND
// ============================================
async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;

        // ✅ Agar bilkul khaali hai
        if (!text) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *AI Commands*\n\n` +
                      `• *.gpt <question>* — Ask AI\n` +
                      `• *.gpt image <prompt>* — Generate image\n` +
                      `• *.gpt voice <text>* — Get voice reply\n\n` +
                      `*Examples:*\n` +
                      `.gpt how are you\n` +
                      `.gpt image a beautiful sunset\n` +
                      `.gpt voice assalamualaikum kaise ho`
            }, { quoted: message });
        }

        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const subCommand = parts[1]?.toLowerCase();

        // ============================================
        // ✅ FIX: Agar sirf ".gpt" ya ".gemini" bheja (koi sawal nahi)
        // ============================================
        if (parts.length === 1) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *AI Commands*\n\n` +
                      `• *.gpt <question>* — Ask AI\n` +
                      `• *.gpt image <prompt>* — Generate image\n` +
                      `• *.gpt voice <text>* — Get voice reply\n\n` +
                      `*Examples:*\n` +
                      `.gpt how are you\n` +
                      `.gpt kia hal hai\n` +
                      `.gpt image a beautiful sunset\n` +
                      `.gpt voice assalamualaikum kaise ho`
            }, { quoted: message });
        }

        // ============================================
        // 🎨 .gpt image <prompt>
        // ============================================
        if (subCommand === 'image') {
            const prompt = parts.slice(2).join(' ').trim();
            if (!prompt) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please provide a prompt.\n\nExample: *.gpt image a cat in space*'
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, { react: { text: '🎨', key: message.key } });
            await sock.sendMessage(chatId, { text: '🎨 Generating image... Please wait (10-30 sec)' }, { quoted: message });

            try {
                const imageBuffer = await generateImage(prompt);

                await sock.sendMessage(chatId, {
                    image: imageBuffer,
                    caption: `🎨 *Generated by AI*\n📝 Prompt: ${prompt}`
                }, { quoted: message });

                console.log(`✅ Image sent (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

            } catch (err) {
                console.error('Image error:', err.message);
                await sock.sendMessage(chatId, {
                    text: `❌ Failed to generate image: ${err.message}`
                }, { quoted: message });
            }
            return;
        }

        // ============================================
        // 🔊 .gpt voice <text>
        // ============================================
        if (subCommand === 'voice') {
    const voiceQuery = parts.slice(2).join(' ').trim();
    if (!voiceQuery) {
        return await sock.sendMessage(chatId, {
            text: '❌ Please provide text.\n\nExample: *.gpt voice assalamualaikum kaise ho*'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '🔊', key: message.key } });
    await sock.sendMessage(chatId, { text: '🧠 AI soch raha hai...' }, { quoted: message });

    try {
        // ✅ Step 1: AI se jawab lo
        const aiAnswer = await getAIResponse(voiceQuery);
        console.log(`🧠 AI answered: ${aiAnswer.slice(0, 80)}...`);

        if (!aiAnswer || typeof aiAnswer !== 'string') {
            throw new Error('AI returned no answer');
        }

        // ✅ Step 2: AI ke jawab ko voice mein convert karo
        const ttsLang = /[\u0600-\u06FF]/.test(aiAnswer) ? 'ur' : 'en';
        const audioBuffer = await generateVoice(aiAnswer, ttsLang);

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('Empty audio');
        }

        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `ai-voice-${Date.now()}.mp3`);
        fs.writeFileSync(filePath, audioBuffer);

        // ✅ Step 3: Pehle text bhejo, phir voice
        await sock.sendMessage(chatId, {
            text: `🤖 *AI:* ${aiAnswer}`
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(filePath),
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `ai-voice-${ttsLang}.mp3`
        }, { quoted: message });

        setTimeout(() => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 60000);

        console.log(`✅ AI + Voice sent (${(audioBuffer.length / 1024).toFixed(1)}KB)`);

    } catch (err) {
        console.error('Voice error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed: ${err.message}`
        }, { quoted: message });
    }
    return;
}

        // ============================================
        // 🤖 Default: .gpt <question>
        // ============================================
        const query = parts.slice(1).join(' ').trim();

        // ✅ Agar khaali hai to help menu
        if (!query) {
            return await sock.sendMessage(chatId, {
                text: `🤖 *AI Commands*\n\n` +
                      `• *.gpt <question>* — Ask AI\n` +
                      `• *.gpt image <prompt>* — Generate image\n` +
                      `• *.gpt voice <text>* — Get voice reply\n\n` +
                      `*Examples:*\n` +
                      `.gpt how are you\n` +
                      `.gpt kia hal hai\n` +
                      `.gpt image a beautiful sunset\n` +
                      `.gpt voice assalamualaikum kaise ho`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

        try {
            const answer = await getAIResponse(query);

            if (answer && typeof answer === 'string') {
                await sock.sendMessage(chatId, { text: answer }, { quoted: message });
            } else {
                throw new Error('Empty response');
            }

        } catch (error) {
            console.error('AI Error:', error.message);
            await sock.sendMessage(chatId, {
                text: `❌ Failed: ${error.message}`
            }, { quoted: message });
        }

    } catch (error) {
        console.error('AI Command Error:', error);
        await sock.sendMessage(chatId, {
            text: "❌ An error occurred. Please try again later."
        }, { quoted: message });
    }
}

module.exports = aiCommand;