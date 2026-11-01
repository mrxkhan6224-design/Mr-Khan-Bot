const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ============================================
// 🎵 Audio Effects (ffmpeg filters)
// ============================================
const EFFECTS = {
    bass:      { desc: 'Bass boost',        filter: 'bass=g=20,dynaudnorm=f=200' },
    deep:      { desc: 'Deep voice',        filter: 'asetrate=44100*0.8,aresample=44100,atempo=1.0' },
    robot:     { desc: 'Robot voice',       filter: 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75' },
    nightcore: { desc: 'Nightcore',         filter: 'asetrate=44100*1.25,aresample=44100' },
    slowed:    { desc: 'Slowed + reverb',   filter: 'atempo=0.8,aecho=0.8:0.9:1000:0.3' },
    fast:      { desc: 'Fast speed',        filter: 'atempo=1.5' },
    reverse:   { desc: 'Reverse audio',     filter: 'areverse' },
    chipmunk:  { desc: 'Chipmunk voice',    filter: 'asetrate=44100*1.4,aresample=44100' },
    earrape:   { desc: 'Earrape',           filter: 'volume=10,bass=g=15,treble=g=15' },
    '8d':      { desc: '8D audio',          filter: 'apulsator=hz=0.09' },
    vaporwave: { desc: 'Vaporwave',         filter: 'asetrate=44100*0.85,aresample=44100,atempo=0.95' },
    smooth:    { desc: 'Smooth audio',      filter: 'dynaudnorm=f=200:g=15' }
};

// ============================================
// Get audio from message or quoted
// ============================================
async function downloadAudio(message) {
    let audioMessage = message.message?.audioMessage;
    let isQuoted = false;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.audioMessage) {
        audioMessage = quoted.audioMessage;
        isQuoted = true;
    }

    if (!audioMessage) return null;

    const stream = await downloadContentFromMessage(audioMessage, 'audio');
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return { buffer: Buffer.concat(chunks), isQuoted };
}

// ============================================
// Apply ffmpeg filter
// ============================================
function applyFilter(inputPath, outputPath, filter) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFilters(filter)
            .audioCodec('libmp3lame')
            .audioBitrate(128)
            .format('mp3')
            .save(outputPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}

// ============================================
// MAIN COMMAND
// ============================================
async function audiofxCommand(sock, chatId, message, effectName) {
    let inputPath = null;
    let outputPath = null;

    try {
        // Check if effect exists
        if (!EFFECTS[effectName]) {
            await sock.sendMessage(chatId, {
                text: `❌ Unknown effect: ${effectName}`
            }, { quoted: message });
            return;
        }

        // Get audio
        const audioData = await downloadAudio(message);
        if (!audioData) {
            await sock.sendMessage(chatId, {
                text: `🎵 *${effectName}* — Reply to an audio/voice message with *.${effectName}*`
            }, { quoted: message });
            return;
        }

        // Temp paths
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        inputPath = path.join(tempDir, `in_${Date.now()}.mp3`);
        outputPath = path.join(tempDir, `out_${Date.now()}.mp3`);

        fs.writeFileSync(inputPath, audioData.buffer);

        console.log(`🎵 Applying ${effectName}...`);

        // Apply filter
        await applyFilter(inputPath, outputPath, EFFECTS[effectName].filter);

        const outputBuffer = fs.readFileSync(outputPath);
        const sizeMB = outputBuffer.length / (1024 * 1024);

        if (sizeMB > 64) {
            await sock.sendMessage(chatId, {
                text: `❌ File too large (${sizeMB.toFixed(1)}MB). WhatsApp limit ~64MB.`
            }, { quoted: message });
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            return;
        }

        // Send as audio
        await sock.sendMessage(chatId, {
            audio: outputBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${effectName}.mp3`,
            ptt: false
        }, { quoted: message });

        console.log(`✅ ${effectName} sent (${sizeMB.toFixed(2)}MB)`);

        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (err) {
        console.error(`❌ audiofx (${effectName}) error:`, err.message);

        if (inputPath && fs.existsSync(inputPath)) try { fs.unlinkSync(inputPath); } catch (e) {}
        if (outputPath && fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch (e) {}

        await sock.sendMessage(chatId, {
            text: `❌ Failed to apply *${effectName}*: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = audiofxCommand;