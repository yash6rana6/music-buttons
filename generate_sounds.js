const fs = require('fs');
const path = require('path');

// Helper to write PCM WAV file
function createWavBuffer(sampleRate, durationSec, generateSample) {
    const numSamples = Math.floor(sampleRate * durationSec);
    const blockAlign = 2; // 1 channel, 16-bit
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const val = generateSample(t, durationSec, i);
        const sample16 = Math.max(-32768, Math.min(32767, Math.floor(val * 32767)));
        buffer.writeInt16LE(sample16, 44 + i * 2);
    }

    return buffer;
}

const sampleRate = 22050;

// Sound generators mapping for categories and 30 memes
const soundGenerators = {
    // Classics
    'sounds/happy/happy1.wav': (t, dur) => Math.exp(-3 * t) * 0.4 * Math.sin(2 * Math.PI * (t < 0.1 ? 523 : t < 0.2 ? 659 : 783) * t),
    'sounds/happy/happy2.wav': (t, dur) => Math.exp(-2 * t) * 0.4 * Math.sin(2 * Math.PI * (400 + 600 * t) * t),
    'sounds/happy/happy3.wav': (t, dur) => Math.sin(Math.PI * t) * 0.3 * (Math.sin(2 * Math.PI * 880 * t) + Math.sin(2 * Math.PI * 1320 * t)),
    'sounds/laugh/laugh1.wav': (t, dur) => Math.exp(-1.5 * t) * (Math.sin(2 * Math.PI * 6 * t) > 0 ? 1 : 0) * 0.4 * Math.sin(2 * Math.PI * 350 * t),
    'sounds/laugh/laugh2.wav': (t, dur) => Math.exp(-2 * t) * (Math.sin(2 * Math.PI * 9 * t) > 0.2 ? 1 : 0) * 0.4 * Math.sin(2 * Math.PI * 420 * t),
    'sounds/crying/cry1.wav': (t, dur) => Math.sin(Math.PI * t) * 0.4 * Math.sin(2 * Math.PI * (450 - 150 * t) * t),
    'sounds/crying/cry2.wav': (t, dur) => Math.exp(-1 * t) * 0.4 * Math.sin(2 * Math.PI * (380 + 40 * Math.sin(2 * Math.PI * 8 * t)) * t),
    'sounds/angry/angry1.wav': (t, dur) => Math.exp(-1 * t) * 0.4 * (2 * ((110 * t) % 1) - 1),
    'sounds/angry/angry2.wav': (t, dur) => Math.exp(-5 * t) * 0.5 * (Math.sin(2 * Math.PI * 120 * t) + (Math.random() * 2 - 1) * 0.3),

    // 30 Meme Sound Effects
    'sounds/memes/bruh.wav': (t, dur) => Math.exp(-2 * t) * 0.5 * Math.sin(2 * Math.PI * (160 - 40 * t) * t),
    'sounds/memes/emotional_damage.wav': (t, dur) => Math.sin(Math.PI * t) * 0.4 * (Math.sin(2 * Math.PI * 300 * t) + Math.sin(2 * Math.PI * 450 * t)),
    'sounds/memes/vine_boom.wav': (t, dur) => Math.exp(-8 * t) * 0.7 * (Math.sin(2 * Math.PI * (120 - 90 * t) * t) + (Math.random() * 2 - 1) * 0.4),
    'sounds/memes/airhorn.wav': (t, dur) => Math.exp(-1 * t) * 0.4 * (Math.sin(2 * Math.PI * 466 * t) + Math.sin(2 * Math.PI * 622 * t)),
    'sounds/memes/fart.wav': (t, dur) => Math.exp(-3 * t) * 0.5 * (Math.random() * 2 - 1) * (1 + Math.sin(2 * Math.PI * 25 * t)),
    'sounds/memes/sad_violin.wav': (t, dur) => Math.sin(Math.PI * (t / dur)) * 0.4 * Math.sin(2 * Math.PI * (440 + 20 * Math.sin(2 * Math.PI * 5 * t)) * t),
    'sounds/memes/wow.wav': (t, dur) => Math.exp(-2 * t) * 0.4 * Math.sin(2 * Math.PI * (300 + 400 * t) * t),
    'sounds/memes/roblox_oof.wav': (t, dur) => Math.exp(-6 * t) * 0.5 * Math.sin(2 * Math.PI * (500 - 200 * t) * t),
    'sounds/memes/noice.wav': (t, dur) => Math.exp(-4 * t) * 0.4 * Math.sin(2 * Math.PI * 800 * t),
    'sounds/memes/directed_by.wav': (t, dur) => Math.exp(-1.5 * t) * 0.4 * Math.sin(2 * Math.PI * (t < 0.2 ? 523 : 659) * t),
    'sounds/memes/illuminati.wav': (t, dur) => Math.sin(Math.PI * t) * 0.4 * Math.sin(2 * Math.PI * (800 + 50 * Math.sin(2 * Math.PI * 12 * t)) * t),
    'sounds/memes/coffin_dance.wav': (t, dur) => Math.exp(-2 * t) * 0.4 * Math.sin(2 * Math.PI * (t < 0.15 ? 587 : t < 0.3 ? 740 : 880) * t),
    'sounds/memes/fbi_open_up.wav': (t, dur) => Math.exp(-5 * t) * 0.6 * (Math.sin(2 * Math.PI * 200 * t) + (Math.random() * 2 - 1) * 0.5),
    'sounds/memes/quack.wav': (t, dur) => Math.exp(-4 * t) * 0.4 * Math.sin(2 * Math.PI * (350 + 150 * Math.sin(2 * Math.PI * 20 * t)) * t),
    'sounds/memes/badumtss.wav': (t, dur) => Math.exp(-4 * t) * (t < 0.1 ? Math.sin(2 * Math.PI * 150 * t) : (Math.random() * 2 - 1) * 0.4),
    'sounds/memes/metal_pipe.wav': (t, dur) => Math.exp(-6 * t) * 0.5 * (Math.sin(2 * Math.PI * 1200 * t) + (Math.random() * 2 - 1) * 0.4),
    'sounds/memes/gigachad.wav': (t, dur) => Math.exp(-1 * t) * 0.5 * (2 * ((90 * t) % 1) - 1),
    'sounds/memes/taco_bell.wav': (t, dur) => Math.exp(-2 * t) * 0.5 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 440 * t)),
    'sounds/memes/bonk.wav': (t, dur) => Math.exp(-10 * t) * 0.6 * Math.sin(2 * Math.PI * (600 - 400 * t) * t),
    'sounds/memes/victory.wav': (t, dur) => Math.exp(-1.5 * t) * 0.4 * Math.sin(2 * Math.PI * (t < 0.15 ? 523 : t < 0.3 ? 659 : 1046) * t),
    'sounds/memes/fail_horn.wav': (t, dur) => Math.exp(-1 * t) * 0.5 * Math.sin(2 * Math.PI * (220 - 50 * t) * t),
    'sounds/memes/evil_laugh.wav': (t, dur) => Math.exp(-1.5 * t) * (Math.sin(2 * Math.PI * 5 * t) > 0 ? 1 : 0) * 0.4 * Math.sin(2 * Math.PI * 180 * t),
    'sounds/memes/record_scratch.wav': (t, dur) => Math.exp(-5 * t) * 0.5 * (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 1500 * t),
    'sounds/memes/cat_meow.wav': (t, dur) => Math.sin(Math.PI * t) * 0.4 * Math.sin(2 * Math.PI * (600 + 200 * Math.sin(Math.PI * t)) * t),
    'sounds/memes/dog_bark.wav': (t, dur) => Math.exp(-8 * t) * 0.5 * (2 * ((180 * t) % 1) - 1),
    'sounds/memes/dramatic_chipmunk.wav': (t, dur) => Math.exp(-2 * t) * 0.5 * Math.sin(2 * Math.PI * (t < 0.15 ? 200 : t < 0.3 ? 150 : 100) * t),
    'sounds/memes/crickets.wav': (t, dur) => Math.exp(-1 * t) * (Math.sin(2 * Math.PI * 15 * t) > 0.5 ? 1 : 0) * 0.3 * Math.sin(2 * Math.PI * 4500 * t),
    'sounds/memes/spongebob_fail.wav': (t, dur) => Math.exp(-1.5 * t) * 0.4 * Math.sin(2 * Math.PI * (350 - 150 * t) * t),
    'sounds/memes/wilhelm_scream.wav': (t, dur) => Math.exp(-2 * t) * 0.5 * Math.sin(2 * Math.PI * (600 + 300 * Math.sin(Math.PI * t)) * t),
    'sounds/memes/yeet.wav': (t, dur) => Math.exp(-3 * t) * 0.5 * Math.sin(2 * Math.PI * (250 + 500 * t) * t)
};

const baseDir = __dirname;

for (const [relPath, genFn] of Object.entries(soundGenerators)) {
    const fullPath = path.join(baseDir, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const wavBuffer = createWavBuffer(sampleRate, 0.6, genFn);
    fs.writeFileSync(fullPath, wavBuffer);
}
console.log(`Generated ${Object.keys(soundGenerators).length} sound files successfully!`);
