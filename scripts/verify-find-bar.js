const path = require('path');

const EXIT_MARKER_PREFIX = '[verify-find-bar] EXIT';

if (process.versions.electron) {
  runElectronVerifier().catch((err) => {
    console.error('[verify-find-bar] FAIL');
    console.error(err);
    shutdown(1);
  });
} else {
  runNodeWrapper();
}

function runNodeWrapper() {
  const { spawn } = require('child_process');
  const electronPath = require('electron');

  const child = spawn(electronPath, [__filename], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let finished = false;
  let sawFail = false;
  let sawPass = false;
  let sawExitCode = null;

  const timeout = setTimeout(() => {
    const exitCode = sawPass && !sawFail ? 0 : 1;
    finish(exitCode, true);
  }, 25000);

  function inspectOutput(text) {
    if (text.includes('[verify-find-bar] FAIL')) sawFail = true;
    if (text.includes('[verify-find-bar] PASS')) sawPass = true;

    const marker = text.match(/\[verify-find-bar\] EXIT (\d+)/);
    if (marker) {
      sawExitCode = Number(marker[1]);
      setTimeout(() => finish(sawExitCode, true), 250);
    }
  }

  function finish(exitCode, killChild) {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);

    if (killChild && !child.killed) {
      child.kill();
    }

    process.exit(exitCode);
  }

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    inspectOutput(chunk.toString());
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    inspectOutput(chunk.toString());
  });

  child.on('error', (err) => {
    console.error('[verify-find-bar] FAIL');
    console.error(err);
    finish(1, false);
  });

  child.on('exit', (code) => {
    if (sawExitCode !== null) {
      finish(sawExitCode, false);
      return;
    }

    if (sawPass && !sawFail) {
      finish(0, false);
      return;
    }

    finish(code === 0 ? 0 : code || 1, false);
  });
}

async function runElectronVerifier() {
  const { app, BrowserWindow } = require('electron');
  const fs = require('fs');
  const contentJs = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

  await app.whenReady();

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
    },
  });

  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; font-family: system-ui, sans-serif; }
          [aria-label="Sidebar"] {
            position: fixed; left: 0; top: 0; bottom: 0; width: 220px;
            background: #101827; color: white; padding: 20px;
          }
          main { margin-left: 260px; padding: 40px; }
          .spacer { height: 900px; }
          p { font-size: 18px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <aside aria-label="Sidebar">sidebar targetterm should be ignored</aside>
        <main>
          <div class="spacer">top spacer</div>
          <p id="match-one">First conversation targetterm match.</p>
          <div class="spacer"></div>
          <p id="match-two">Second conversation targetterm match.</p>
          <div class="spacer"></div>
          <p id="match-three">Third conversation targetterm match.</p>
        </main>
      </body>
    </html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await evaluate(win, `
    (() => {
      window.electronSearch = {
        stop() {
          window.__electronSearchStopCalled = true;
        }
      };
      return true;
    })();
  `);
  await win.webContents.executeJavaScript(`
    (() => {
      ${contentJs}
      return true;
    })();
  `);

  await evaluate(win, `window.dispatchEvent(new CustomEvent('show-find-bar'));`);
  await evaluate(win, `
    const input = document.querySelector('#electron-find-bar input');
    input.value = 'targetterm';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await delay(700);

  const first = await evaluate(win, `
    (() => {
      const active = document.querySelector('mark.copilot-find-highlight-active');
      return {
        counter: document.querySelector('#electron-find-bar span').textContent,
        matchCount: document.querySelectorAll('mark.copilot-find-highlight').length,
        activeId: active?.closest('[id]')?.id,
        scrollY: window.scrollY,
        focused: document.activeElement === document.querySelector('#electron-find-bar input'),
      };
    })();
  `);

  if (first.counter !== '1/3' || first.matchCount !== 3 || first.activeId !== 'match-one') {
    throw new Error(`Initial search failed: ${JSON.stringify(first)}`);
  }
  if (first.scrollY <= 0) {
    throw new Error(`Initial search did not scroll to first match: ${JSON.stringify(first)}`);
  }
  if (!first.focused) {
    throw new Error(`Find input did not retain focus after initial search: ${JSON.stringify(first)}`);
  }

  await evaluate(win, `
    document.querySelector('#electron-find-bar input').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
  `);
  await delay(700);

  const second = await evaluate(win, `
    (() => {
      const active = document.querySelector('mark.copilot-find-highlight-active');
      return {
        counter: document.querySelector('#electron-find-bar span').textContent,
        activeId: active?.closest('[id]')?.id,
        scrollY: window.scrollY,
        focused: document.activeElement === document.querySelector('#electron-find-bar input'),
      };
    })();
  `);

  if (second.counter !== '2/3' || second.activeId !== 'match-two') {
    throw new Error(`Enter did not advance to second match: ${JSON.stringify(second)}`);
  }
  if (second.scrollY <= first.scrollY) {
    throw new Error(`Enter did not scroll down to second match: ${JSON.stringify({ first, second })}`);
  }
  if (!second.focused) {
    throw new Error(`Find input did not retain focus after Enter: ${JSON.stringify(second)}`);
  }

  await evaluate(win, `
    document.querySelector('#electron-find-bar input').dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }));
  `);
  await delay(700);

  const previous = await evaluate(win, `
    (() => {
      const active = document.querySelector('mark.copilot-find-highlight-active');
      return {
        counter: document.querySelector('#electron-find-bar span').textContent,
        activeId: active?.closest('[id]')?.id,
        scrollY: window.scrollY,
        focused: document.activeElement === document.querySelector('#electron-find-bar input'),
      };
    })();
  `);

  if (previous.counter !== '1/3' || previous.activeId !== 'match-one') {
    throw new Error(`Shift+Enter did not move back to first match: ${JSON.stringify(previous)}`);
  }
  if (previous.scrollY >= second.scrollY) {
    throw new Error(`Shift+Enter did not scroll back up: ${JSON.stringify({ second, previous })}`);
  }
  if (!previous.focused) {
    throw new Error(`Find input did not retain focus after Shift+Enter: ${JSON.stringify(previous)}`);
  }

  console.log('[verify-find-bar] PASS');
  console.log(JSON.stringify({ first, second, previous }, null, 2));
  shutdown(0);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluate(win, code) {
  return win.webContents.executeJavaScript(code, true);
}

function shutdown(exitCode) {
  console.log(`${EXIT_MARKER_PREFIX} ${exitCode}`);
  process.exit(exitCode);
}
