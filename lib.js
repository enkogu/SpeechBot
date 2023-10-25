const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv');
dotenv.config();


async function transcribeAudio(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-1');

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
                ...form.getHeaders(),
            },
        });
    
        const result = response.data;
        return result.text || Promise.reject('⛔️ No text');
    } catch (error) {
        console.error('⛔️ err:', error)
        throw error;        
    }    
}

async function downloadFile(url, filePath) {
    const file = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            response.pipe(file);
            file.on('finish', resolve);
            file.on('error', reject);
        });
    });
}

async function convertFile(inputPath) {
    const outputPath = path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}${Math.random()}.mp3`);
    const cmd = spawn('ffmpeg', ['-i', inputPath, outputPath]);

    return new Promise((resolve, reject) => {
        cmd.on('error', reject);
        cmd.on('close', code => code === 0 ? resolve(outputPath) : reject(new Error(`🔊 convert: ⛔️ error. code: ${code}`)));
    });
}

async function prepareAudio(ctx) {
    const fileId = ctx.message.voice.file_id;
    console.log('fileId:', fileId)
    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log('filelink:', fileLink.href)
    const name = `data/${fileLink.href.split('/').pop()}`;
    await downloadFile(fileLink, name);
    return convertFile(name);
}

async function voiceHandler(ctx, bot) {
    try {
        const outputPath = await prepareAudio(ctx);
        const recognizedText = await transcribeAudio(outputPath);
        ctx.replyWithMarkdown(`${recognizedText}`);
    } catch (err) {
        console.log('⛔️ err:', err)
        ctx.replyWithMarkdown(`⛔️ *Error*\n${JSON.stringify(err)}`);
    }
}


module.exports = { voiceHandler };
