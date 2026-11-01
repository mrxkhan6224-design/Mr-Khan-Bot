const fetch = require('node-fetch');

async function surahmenuCommand(sock, chatId, message) {
    try {
        console.log('📚 Loading Surah list...');
        
        let menuText = `📖 *قرآن کریم - سورہ فہرست*

🕌 *پہلی 20 سورتیں:*\n`;
        
        // Surah list manually (کیونکہ API slow ہو سکتی ہے)
        const surahs = [
            { num: 1, arabic: "الفاتحہ", english: "Al-Fatihah", ayahs: 7 },
            { num: 2, arabic: "البقرہ", english: "Al-Baqarah", ayahs: 286 },
            { num: 3, arabic: "آل عمران", english: "Aal-e-Imran", ayahs: 200 },
            { num: 4, arabic: "النساء", english: "An-Nisa", ayahs: 176 },
            { num: 5, arabic: "المائدة", english: "Al-Ma'idah", ayahs: 120 },
            { num: 6, arabic: "الأنعام", english: "Al-An'am", ayahs: 165 },
            { num: 7, arabic: "الأعراف", english: "Al-A'raf", ayahs: 206 },
            { num: 8, arabic: "الأنفال", english: "Al-Anfal", ayahs: 75 },
            { num: 9, arabic: "التوبة", english: "At-Tawbah", ayahs: 129 },
            { num: 10, arabic: "يونس", english: "Yunus", ayahs: 109 },
            { num: 11, arabic: "هود", english: "Hud", ayahs: 123 },
            { num: 12, arabic: "يوسف", english: "Yusuf", ayahs: 111 },
            { num: 13, arabic: "الرعد", english: "Ar-Ra'd", ayahs: 43 },
            { num: 14, arabic: "ابراهيم", english: "Ibrahim", ayahs: 52 },
            { num: 15, arabic: "الحجر", english: "Al-Hijr", ayahs: 99 },
            { num: 16, arabic: "النحل", english: "An-Nahl", ayahs: 128 },
            { num: 17, arabic: "الإسراء", english: "Al-Isra", ayahs: 111 },
            { num: 18, arabic: "الكهف", english: "Al-Kahf", ayahs: 110 },
            { num: 19, arabic: "مريم", english: "Maryam", ayahs: 98 },
            { num: 20, arabic: "طه", english: "Taha", ayahs: 135 }
        ];

        surahs.forEach(surah => {
            menuText += `\n${surah.num}. ${surah.arabic}\n`;
            menuText += `   ${surah.english} (${surah.ayahs} آیات)\n`;
            menuText += `   استعمال: .quran ${surah.num}\n`;
            menuText += `   ───────────────\n`;
        });

        menuText += `\n📚 *اور 94 مزید سورتیں*\n`;
        menuText += `مثال: .quran 36 (سورہ یٰسین)\n`;
        menuText += `مثال: .quran 55 (سورہ الرحمن)\n`;
        menuText += `مثال: .quran 67 (سورہ الملک)\n`;
        menuText += `مثال: .quran 112 (سورہ الإخلاص)\n`;
        
        menuText += `\n❄️ *استعمال کی مثالیں:*\n`;
        menuText += `.quran 1 - سورہ الفاتحہ\n`;
        menuText += `.quran 2 - سورہ البقرہ\n`;
        menuText += `.quran الفاتحہ - نام سے\n`;
        menuText += `.quran 1:5 - آیت نمبر 5\n`;
        
        menuText += `\n🌐 مکمل قرآن: https://quran.com`;

        await sock.sendMessage(chatId, { 
            text: menuText 
        }, { quoted: message });
        
        console.log('✅ Surah menu sent!');
        
    } catch (error) {
        console.error('❌ Surahmenu error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ سورہ فہرست نہیں لوڈ ہو سکی: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = surahmenuCommand;