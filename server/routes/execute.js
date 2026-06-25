const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ── Local runners (no API key needed) ─────────────────────────────────────────
const IS_WIN = process.platform === 'win32';

const LOCAL = {
  javascript: { cmd: 'node',                        ext: 'js'  },
  python:     { cmd: IS_WIN ? 'python' : 'python3', ext: 'py'  },
  bash:       !IS_WIN ? { cmd: 'bash',              ext: 'sh'  } : null,
};

function runLocal(code, language, stdin = '') {
  const runner = LOCAL[language];
  if (!runner) return null;

  const id   = crypto.randomBytes(8).toString('hex');
  const file = path.join(os.tmpdir(), `coda_${id}.${runner.ext}`);
  fs.writeFileSync(file, code, 'utf8');

  return new Promise((resolve) => {
    const start = Date.now();
    const proc  = spawn(runner.cmd, [file], { cwd: os.tmpdir() });

    let stdout = '', stderr = '';
    const MAX = 100 * 1024; // 100 KB output cap

    proc.stdout.on('data', (d) => { stdout += d; if (stdout.length > MAX) proc.kill('SIGKILL'); });
    proc.stderr.on('data', (d) => { stderr += d; if (stderr.length > MAX) proc.kill('SIGKILL'); });

    proc.stdin.write(stdin || '');
    proc.stdin.end();

    const timer = setTimeout(() => proc.kill('SIGKILL'), 10_000);

    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      fs.unlink(file, () => {});
      const time = ((Date.now() - start) / 1000).toFixed(3);
      resolve({
        stdout,
        stderr,
        status: signal ? 'Time Limit Exceeded' : code === 0 ? 'Accepted' : 'Runtime Error',
        time,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      fs.unlink(file, () => {});
      resolve({
        stdout: '',
        stderr: `Cannot start '${runner.cmd}': ${err.message}\nMake sure ${language} is installed on your system.`,
        status: 'Error',
        time: '0',
      });
    });
  });
}

// ── Judge0 fallback (requires JUDGE0_API_KEY) ──────────────────────────────────
const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_IDS = {
  typescript: 94, go: 60, rust: 73, java: 62,
  cpp: 54, c: 50, csharp: 51, sql: 82,
};

async function runJudge0(code, language, stdin) {
  const apiKey = process.env.JUDGE0_API_KEY;
  const langId = JUDGE0_IDS[language];

  if (!langId) {
    return {
      stdout: '',
      stderr: `'${language}' is not supported for local execution and has no Judge0 mapping.`,
      status: 'Error',
    };
  }

  if (!apiKey) {
    return {
      stdout: '',
      stderr: [
        `'${language}' requires the Judge0 API for execution.`,
        `Local execution supports: ${Object.keys(LOCAL).filter(k => LOCAL[k]).join(', ')}.`,
        `To enable ${language}: add JUDGE0_API_KEY to your .env file`,
        `(free tier at rapidapi.com/judge0-official/api/judge0-ce)`,
      ].join('\n'),
      status: 'Not Configured',
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
  };

  const submitRes = await fetch(
    `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
    { method: 'POST', headers, body: JSON.stringify({ source_code: code, language_id: langId, stdin }) }
  );
  const { token } = await submitRes.json();
  if (!token) throw new Error('No token returned from Judge0');

  let result;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const poll = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, { headers });
    result = await poll.json();
    if (result.status?.id > 2) break;
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || result.compile_output || '',
    status: result.status?.description || 'Unknown',
    time: result.time,
    memory: result.memory,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.use(authenticate);

router.post('/', async (req, res) => {
  const { code, language, stdin = '' } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // 1. Try local runner
    const local = await runLocal(code, language, stdin);
    if (local) return res.json(local);

    // 2. Fall back to Judge0
    const result = await runJudge0(code, language, stdin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ stderr: `Execution error: ${err.message}`, stdout: '', status: 'Error' });
  }
});

module.exports = router;
