const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cases = require('../src/data/seed/listening_cases.json');
const outputDirectory = path.resolve(__dirname, '..', 'assets', 'audio', 'generated');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jlpt-listening-audio-'));
const edgeTtsBinary = process.env.EDGE_TTS_BIN || 'edge-tts';

const deliveryProfiles = {
  femaleFormal: { voice: 'ja-JP-NanamiNeural', rate: -6, pitch: 0, pause: 0.42 },
  femaleWarm: { voice: 'ja-JP-NanamiNeural', rate: -5, pitch: 1, pause: 0.32 },
  femaleCasual: { voice: 'ja-JP-NanamiNeural', rate: -3, pitch: 2, pause: 0.28 },
  femaleCalm: { voice: 'ja-JP-NanamiNeural', rate: -7, pitch: -1, pause: 0.36 },
  femaleService: { voice: 'ja-JP-NanamiNeural', rate: -6, pitch: 1, pause: 0.34 },
  femaleAnnouncement: { voice: 'ja-JP-NanamiNeural', rate: -7, pitch: 0, pause: 0.48 },
  maleFormal: { voice: 'ja-JP-KeitaNeural', rate: -6, pitch: 0, pause: 0.38 },
  maleSenior: { voice: 'ja-JP-KeitaNeural', rate: -8, pitch: -2, pause: 0.42 },
  maleCalm: { voice: 'ja-JP-KeitaNeural', rate: -7, pitch: -1, pause: 0.36 },
  maleDirect: { voice: 'ja-JP-KeitaNeural', rate: -3, pitch: 1, pause: 0.3 },
  maleYoung: { voice: 'ja-JP-KeitaNeural', rate: -4, pitch: 2, pause: 0.28 },
};

const roleProfilesByCase = {
  'planning-meeting-001': {
    '女（司会）': 'femaleFormal',
    男A: 'maleCalm',
    男B: 'maleDirect',
    女: 'femaleWarm',
    全員: 'femaleCasual',
  },
  'customer-service-001': { 店長: 'maleFormal', 新人: 'femaleWarm' },
  'airport-announcement-001': { アナウンス: 'femaleAnnouncement' },
  'office-reassignment-001': {
    主管: 'maleFormal',
    员工A: 'femaleWarm',
    员工B: 'maleYoung',
  },
  'campus-schedule-001': {
    学生A: 'femaleCasual',
    学生B: 'maleYoung',
    学生C: 'femaleCalm',
  },
  'family-dinner-001': { 母亲: 'femaleWarm', 孩子: 'maleYoung' },
  'restaurant-change-001': { 顾客: 'maleCalm', 店员: 'femaleService' },
  'public-broadcast-001': {
    广播: 'femaleAnnouncement',
    乘客A: 'maleYoung',
    乘客B: 'femaleCasual',
  },
  'clinic-reservation-001': { 来电者: 'maleCalm', 前台: 'femaleService' },
  'warehouse-shift-001': {
    班长: 'maleFormal',
    工作人员A: 'femaleCasual',
    工作人员B: 'maleYoung',
  },
  'instant-reply-001': { 題目句: 'femaleCalm' },
  'instant-reply-002': { 題目句: 'maleYoung' },
  'instant-reply-003': { 題目句: 'femaleCalm' },
  'instant-reply-004': { 題目句: 'maleDirect' },
  'instant-reply-005': { 題目句: 'femaleWarm' },
  'synthesis-001': {
    司会: 'femaleFormal',
    専門家A: 'maleDirect',
    専門家B: 'femaleCalm',
  },
  'synthesis-002': {
    部長: 'maleSenior',
    主任: 'femaleFormal',
    担当者: 'maleYoung',
  },
  'synthesis-003': { 司会: 'femaleFormal', 嘉宾: 'maleCalm' },
};

function signed(value, unit) {
  return `${value >= 0 ? '+' : ''}${value}${unit}`;
}

function deliveryFor(item, line) {
  const profileName = roleProfilesByCase[item.id]?.[line.speaker];
  const profile = deliveryProfiles[profileName];

  if (!profile) {
    throw new Error(`No voice profile for ${item.id}/${line.speaker}`);
  }

  let rate = profile.rate;
  let pitch = profile.pitch;

  if (/すみません|ご迷惑|申し訳|残念/.test(line.text)) {
    rate -= 2;
    pitch -= 1;
  } else if (/ありがとう|助かり|賛成|よろしく/.test(line.text)) {
    rate += 1;
    pitch += 1;
  } else if (/急|今日中|明日の朝まで|注意してください/.test(line.text)) {
    rate += 2;
    pitch += 1;
  }

  return {
    ...profile,
    rate: Math.max(-10, Math.min(0, rate)),
    pitch: Math.max(-3, Math.min(3, pitch)),
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.error) {
    throw new Error(
      `${command} could not start. Install edge-tts with ` +
        '`python3 -m pip install edge-tts` or set EDGE_TTS_BIN.\n' +
        result.error.message,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

fs.mkdirSync(outputDirectory, { recursive: true });

try {
  run(edgeTtsBinary, ['--version']);

  for (const item of cases) {
    if (item.audioKey.startsWith('N2M')) continue;

    const clipPaths = item.dialogue.map((line, index) => {
      const delivery = deliveryFor(item, line);
      const synthesizedPath = path.join(
        temporaryDirectory,
        `${item.id}-${index}-synthesized.mp3`,
      );
      const clipPath = path.join(temporaryDirectory, `${item.id}-${index}.wav`);
      run(edgeTtsBinary, [
        '--voice',
        delivery.voice,
        `--rate=${signed(delivery.rate, '%')}`,
        `--pitch=${signed(delivery.pitch, 'Hz')}`,
        '--text',
        line.text,
        '--write-media',
        synthesizedPath,
      ]);
      run('ffmpeg', [
        '-loglevel',
        'error',
        '-y',
        '-i',
        synthesizedPath,
        '-af',
        `apad=pad_dur=${delivery.pause}`,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-codec:a',
        'pcm_s16le',
        clipPath,
      ]);
      return clipPath;
    });
    const concatPath = path.join(temporaryDirectory, `${item.id}.txt`);
    const stagedOutputPath = path.join(temporaryDirectory, `${item.audioKey}.mp3`);
    const outputPath = path.join(outputDirectory, `${item.audioKey}.mp3`);

    fs.writeFileSync(
      concatPath,
      clipPaths.map((clipPath) => `file '${clipPath}'`).join('\n'),
    );
    run('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      stagedOutputPath,
    ]);
    const duration = Number(
      run('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        stagedOutputPath,
      ]).trim(),
    );
    const characterCount = item.dialogue.reduce(
      (total, line) => total + line.text.length,
      0,
    );

    if (!Number.isFinite(duration) || duration < Math.max(2, characterCount / 12)) {
      throw new Error(`Generated audio is unexpectedly short for ${item.id}: ${duration}s`);
    }
    if (fs.statSync(stagedOutputPath).size < 1024) {
      throw new Error(`Generated audio is unexpectedly small for ${item.id}`);
    }
    run('ffmpeg', [
      '-v',
      'error',
      '-xerror',
      '-i',
      stagedOutputPath,
      '-f',
      'null',
      '-',
    ]);
    fs.copyFileSync(stagedOutputPath, outputPath);
    process.stdout.write(`generated ${path.relative(process.cwd(), outputPath)}\n`);
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
