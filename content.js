// =============================================================
//  Copilot Shortcuts — Cmd/Ctrl edition
// =============================================================

console.log(
  "%c[Copilot Shortcuts] Loaded — listening for Cmd/Ctrl+Key combos",
  "color: #78D4; font-weight: bold; font-size: 14px;"
);

function triggerElement(el, isInput) {
  if (!el) return;
  try {
    el.focus();
    el.click?.();
  } catch (err) {}

  if (!isInput) {
    try {
      const fire = (type, key, code, keyCode) =>
        el.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true }));
      fire("keydown", "Enter", "Enter", 13);
      fire("keyup", "Enter", "Enter", 13);
    } catch {}
  }
}

function findElement(selector) {
  return document.querySelector(selector);
}

const SHORTCUTS = {
  KeyN: { selector: '[aria-label="New chat"], [data-testid="sidebar-new-conversation-nav-item"]' },
  KeyO: { selector: '[aria-label="New chat"], [data-testid="sidebar-new-conversation-nav-item"]' },
  KeyL: { selector: '[aria-label="Library"]' },
  KeyT: { selector: '[aria-label="Tasks"]' },
  KeyD: { selector: '[aria-label="Discover"], [data-testid="sidebar-discover-button"]' },
  KeyS: { selector: '[aria-label="Shopping"], [data-testid="sidebar-shopping-button"]' },
  KeyI: { selector: '[aria-label="Imagine"]' },
  KeyB: { selector: '[aria-label="Labs"]' }, // Labs moved to B to free up A for Select All
  KeyM: { selector: '[data-testid="composer-chat-mode-smart-button"]' },
  KeyV: { selector: '[aria-label="Talk to Copilot"], [data-testid="audio-call-button"]' },
  KeyX: { selector: '[title="Invite"]' },
  KeyK: { selector: '[aria-label="Search"], [data-testid="search-button"]', isInput: true },
  Comma: { selector: '[aria-label="Settings"], [data-testid="sidebar-settings-button"]' },
  Period: { selector: '[aria-label="Close sidebar"], [aria-label="Open sidebar"], [aria-label="Open sidebar!"]' },
  Slash: { selector: '[aria-label="Search"], [data-testid="search-button"]', isInput: true },
};

const handler = (e) => {
  if (!(e.metaKey || e.ctrlKey) && e.key !== '/') return;
  if (e.shiftKey && e.code !== 'KeyO') return;
  const code = (e.key === '/' && !e.metaKey && !e.ctrlKey) ? 'Slash' : e.code;
  const mapping = SHORTCUTS[code];
  if (!mapping) return;

  const ae = document.activeElement;
  const tag = (ae?.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || ae?.isContentEditable || ae?.getAttribute?.("role") === "textbox";
  if (typing && !mapping.isInput && code !== 'KeyO' && code !== 'KeyN') return;

  // Let standard browser shortcuts (Select All, Copy, Paste) pass through
  if (code === 'KeyA' || code === 'KeyC' || code === 'KeyV') return;

  e.preventDefault();
  e.stopPropagation();

  const el = findElement(mapping.selector);
  if (el) triggerElement(el, mapping.isInput ?? false);
};

document.addEventListener("keydown", handler, true);

// Iframe injection handled by main process
window.addEventListener('copilot-shortcut', (e) => {
  const mapping = SHORTCUTS[e.detail.code];
  if (mapping) {
    const el = findElement(mapping.selector);
    if (el) triggerElement(el, mapping.isInput ?? false);
  }
});

// -------------------------------------------------------------
//  Browser-style "Find in Page" (Cmd+F) Implementation
// -------------------------------------------------------------

(function initFindInPage() {
  if (window.self !== window.top) return;

  let findBar = null;
  let findInput = null;
  let findResultsCount = null;

  function createFindBar() {
    if (findBar) return;

    findBar = document.createElement('div');
    findBar.id = 'electron-find-bar';
    findBar.style.cssText = `
      position: fixed !important; top: 10px !important; right: 20px !important; z-index: 2147483647 !important;
      background: #ffffff !important; border: 1px solid #ccc !important; border-radius: 8px !important;
      padding: 8px 12px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
      display: none; align-items: center !important; gap: 10px !important; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    `;

    findInput = document.createElement('input');
    findInput.type = 'text';
    findInput.placeholder = 'Find in page...';
    findInput.style.cssText = 'padding: 6px !important; border: none !important; outline: none !important; width: 180px !important; font-size: 14px !important; color: #333 !important; background: transparent !important;';

    findResultsCount = document.createElement('span');
    findResultsCount.textContent = '0/0';
    findResultsCount.style.cssText = 'font-size: 12px !important; color: #888 !important; min-width: 40px !important; text-align: center !important;';

    const navContainer = document.createElement('div');
    navContainer.style.cssText = 'display: flex !important; gap: 4px !important; border-left: 1px solid #eee !important; padding-left: 8px !important;';

    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '↑';
    prevBtn.style.cssText = 'background: none !important; border: none !important; cursor: pointer !important; padding: 4px !important; font-size: 16px !important; color: #555 !important;';
    
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '↓';
    nextBtn.style.cssText = 'background: none !important; border: none !important; cursor: pointer !important; padding: 4px !important; font-size: 16px !important; color: #555 !important;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background: none !important; border: none !important; cursor: pointer !important; font-size: 14px !important; color: #999 !important; margin-left: 4px !important;';

    navContainer.appendChild(prevBtn);
    navContainer.appendChild(nextBtn);
    findBar.appendChild(findInput);
    findBar.appendChild(findResultsCount);
    findBar.appendChild(navContainer);
    findBar.appendChild(closeBtn);
    document.body.appendChild(findBar);

    function hideFindBar() {
        findBar.style.display = 'none';
        window.electronSearch?.stop();
    }

    findInput.addEventListener('input', () => {
      const text = findInput.value;
      if (text) {
        window.electronSearch?.find(text, true, false);
      } else {
        findResultsCount.textContent = '0/0';
        window.electronSearch?.stop();
      }
    });

    nextBtn.onclick = () => window.electronSearch?.find(findInput.value, true, true);
    prevBtn.onclick = () => window.electronSearch?.find(findInput.value, false, true);

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.electronSearch?.find(findInput.value, !e.shiftKey, true);
      } else if (e.key === 'Escape') {
        hideFindBar();
      }
    });

    closeBtn.onclick = hideFindBar;
  }

  window.addEventListener('show-find-bar', () => {
    createFindBar();
    findBar.style.display = 'flex';
    findInput.focus();
    findInput.select();
  });

  window.addEventListener('find-results', (e) => {
    if (findResultsCount) {
        findResultsCount.textContent = `${e.detail.activeMatchOrdinal}/${e.detail.matches}`;
    }
  });
})();
