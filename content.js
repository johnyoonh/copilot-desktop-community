// =============================================================
//  Copilot Shortcuts — Cmd/Ctrl edition
// =============================================================

if (window.__copilotDesktopShortcutsLoaded) {
  console.log("[Copilot Shortcuts] Already loaded, skipping duplicate injection");
} else {
window.__copilotDesktopShortcutsLoaded = true;

console.log(
  "%c[Copilot Shortcuts] Loaded — listening for Cmd/Ctrl+Key combos",
  "color: #78D4; font-weight: bold; font-size: 14px;"
);

document.addEventListener('click', (event) => {
  const target = event.target?.closest?.('a, button, [role="button"], input[type="button"], input[type="submit"]');
  if (!target) return;

  const label = [
    target.getAttribute?.('aria-label'),
    target.getAttribute?.('title'),
    target.innerText,
    target.textContent,
    target.value,
  ].find((value) => value && value.trim())?.trim().replace(/\s+/g, ' ').slice(0, 160);

  console.info('[Copilot Login Diagnostic] click', JSON.stringify({
    url: window.location.href,
    tag: target.tagName,
    role: target.getAttribute?.('role'),
    label,
    href: target.href,
  }));
}, true);

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
  KeyM: { selector: '[data-testid="composer-chat-mode-reasoning-button"], [data-testid="composer-chat-mode-smart-button"], [data-testid="task-chat-mode-dropdown-button"]' },
  KeyE: { selector: '[data-testid="composer-create-button"]', isInput: true },
  KeyU: { selector: '[aria-label="Talk to Copilot"], [data-testid="audio-call-button"]' },
  KeyX: { selector: '[title="Invite"]' },
  KeyK: { selector: '[aria-label="Search chats"], [aria-label="Search"], [data-testid="search-button"]', isInput: true },
  Comma: { selector: '[aria-label="Settings"], [data-testid="sidebar-settings-button"]' },
  Period: { selector: '[aria-label="Close sidebar"], [aria-label="Open sidebar"], [aria-label="Open sidebar!"]' }
};

let lastEnterTime = 0;
let cmdPressTimeout = null;
let isCmdPressed = false;
let hintsShowing = false;

function showCmdHints() {
   if (hintsShowing) return;
   hintsShowing = true;
   
   Object.entries(SHORTCUTS).forEach(([code, mapping]) => {
      if (code === 'KeyO') return; // Skip KeyO, we will combine it with KeyN

      let keyChar = '';
      if (code.startsWith('Key')) keyChar = code.replace('Key', '');
      else if (code === 'Comma') keyChar = ',';
      else if (code === 'Period') keyChar = '.';
      else return;

      const elements = Array.from(document.querySelectorAll(mapping.selector)).filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
      });

      if (elements.length > 0) {
          const el = elements[0];
          let hint = document.createElement('div');
          hint.className = 'copilot-longpress-hint';
          hint.style.cssText = 'position: fixed; background: #fffacd; color: #302505; border: 1px solid #d3c6a6; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 2px 6px; z-index: 2147483647; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; pointer-events: none;';
          
          const rect = el.getBoundingClientRect();
          hint.style.top = `${rect.top + rect.height/2}px`;
          hint.style.left = `${rect.left + rect.width/2}px`;
          hint.style.transform = 'translate(-50%, -50%)';
          
          let displayStr = `⌘${keyChar}`;
          if (code === 'KeyN') displayStr = `⌘N (⌘⇧O)`;
          
          hint.textContent = displayStr;
          document.body.appendChild(hint);
      }
   });

   // Cmd+1-9 hints for Recent Conversations
   const recentItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]')).filter(el => {
       const rect = el.getBoundingClientRect();
       if (el.closest('#composer-dropdown-button-menu-contents, #task-chat-mode-dropdown-menu, [data-testid="task-chat-mode-dropdown-menu-contents"]')) return false;
       return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
   });
   
   const uniqueRecent = [...new Set(recentItems)];
   uniqueRecent.forEach((el, index) => {
       if (index >= 9) return;
       let hint = document.createElement('div');
       hint.className = 'copilot-longpress-hint';
       hint.style.cssText = 'position: fixed; background: #fffacd; color: #302505; border: 1px solid #d3c6a6; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 2px 6px; z-index: 2147483647; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; pointer-events: none;';
       
       const rect = el.getBoundingClientRect();
       hint.style.top = `${rect.top + rect.height/2}px`;
       hint.style.left = `${rect.right - 24}px`;
       hint.style.transform = 'translate(-50%, -50%)';
       
       hint.textContent = `⌘${index + 1}`;
       document.body.appendChild(hint);
   });
}

function hideCmdHints() {
   hintsShowing = false;
   document.querySelectorAll('.copilot-longpress-hint').forEach(hint => hint.remove());
}

document.addEventListener('keyup', (e) => {
  if (e.key === 'Meta' || e.key === 'Control') {
     isCmdPressed = false;
     clearTimeout(cmdPressTimeout);
     hideCmdHints();
  }
}, true);

window.addEventListener('blur', () => {
    isCmdPressed = false;
    clearTimeout(cmdPressTimeout);
    hideCmdHints();
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        isCmdPressed = false;
        clearTimeout(cmdPressTimeout);
        hideCmdHints();
    }
});

const handler = (e) => {
  if (e.key === 'Meta' || e.key === 'Control') {
     if (!isCmdPressed) {
        isCmdPressed = true;
        cmdPressTimeout = setTimeout(() => {
           showCmdHints();
        }, 600); // 600ms long press delay
     }
  }

  // Handle Option+Up/Down to navigate sidebar lists (conversations, tasks)
  if (e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const active = document.activeElement;
      const tag = (active?.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || active?.isContentEditable || active?.getAttribute?.("role") === "textbox";
      
      if (!isTyping) {
          const items = Array.from(document.querySelectorAll('[role="option"], ul[role="list"] li a')).filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          });

          if (items.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              const idx = items.indexOf(active);

              let targetIdx = idx;
              if (targetIdx === -1 && active) {
                  const closestItem = active.closest('[role="option"], ul[role="list"] li a');
                  if (closestItem) targetIdx = items.indexOf(closestItem);
              }

              if (targetIdx === -1) {
                  if (e.key === 'ArrowUp') items[items.length - 1].focus();
                  else items[0].focus();
              } else {
                  if (e.key === 'ArrowUp') {
                      items[Math.max(0, targetIdx - 1)].focus();
                  } else {
                      items[Math.min(items.length - 1, targetIdx + 1)].focus();
                  }
              }
              return;
          }
      }
  }

  // Prevent double submissions in Copilot prompt (race condition block)
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    const ae = document.activeElement;
    const tag = (ae?.tagName || "").toLowerCase();
    const isTextInput = tag === "textarea" || tag === "input" || ae?.isContentEditable || ae?.getAttribute?.("role") === "textbox";
    
    if (isTextInput) {
      const now = Date.now();
      if (now - lastEnterTime < 400) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastEnterTime = now;
    }
  }

  if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
    const ae = document.activeElement;
    const tag = (ae?.tagName || "").toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || ae?.isContentEditable || ae?.getAttribute?.("role") === "textbox";
    if (isTyping) {
      e.stopPropagation(); // Stop Copilot from intercepting '/' natively
      return; // Let the browser naturally insert the '/'
    }
    // NOT typing: focus the prompt box
    e.preventDefault();
    e.stopPropagation();
    const promptInput = document.querySelector('textarea, [id*="userInput"], [placeholder*="Ask"], [aria-label*="Ask"]');
    if (promptInput) promptInput.focus();
    return;
  }

  // Handle number keys to click on opened popup menu items or recent conversations
  if (e.key >= '1' && e.key <= '9' && !e.altKey && !e.shiftKey) {
    const ae = document.activeElement;
    const tag = (ae?.tagName || "").toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || ae?.isContentEditable || ae?.getAttribute?.("role") === "textbox";
    
    if (e.metaKey || e.ctrlKey) {
        // Cmd + 1-9: Select recent conversations (role="menuitem" outside of composer dropdown)
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            if (el.closest('#composer-dropdown-button-menu-contents, #task-chat-mode-dropdown-menu, [data-testid="task-chat-mode-dropdown-menu-contents"]')) return false;
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });
        
        const uniqueItems = [...new Set(items)];
        if (uniqueItems.length > 0) {
            const num = parseInt(e.key, 10);
            if (num > 0 && num <= uniqueItems.length) {
                e.preventDefault();
                e.stopPropagation();
                uniqueItems[num - 1].click();
                return;
            }
        }
    } else if (!isTyping) {
        // 1-9 without Cmd: Select from composer dropdown list, task chat modes, or radio options
        const items = Array.from(document.querySelectorAll('#composer-dropdown-button-menu-contents button, #task-chat-mode-dropdown-menu button, [data-testid="task-chat-mode-dropdown-menu-contents"] button, [role="radiogroup"] [role="radio"]')).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
        });
        
        const uniqueItems = [...new Set(items)];
        if (uniqueItems.length > 0) {
            const num = parseInt(e.key, 10);
            if (num > 0 && num <= uniqueItems.length) {
                e.preventDefault();
                e.stopPropagation();
                uniqueItems[num - 1].click();
                return;
            }
        }
    }
  }

  if (!(e.metaKey || e.ctrlKey)) return;
  if (e.shiftKey && e.code !== 'KeyO') return;
  const code = e.code;
  const mapping = SHORTCUTS[code];
  if (!mapping) return;

  const ae = document.activeElement;
  const tag = (ae?.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || ae?.isContentEditable || ae?.getAttribute?.("role") === "textbox";
  if (typing && !mapping.isInput && code !== 'KeyO' && code !== 'KeyN' && code !== 'KeyU') return;

  // Let standard browser shortcuts (Select All, Copy, Paste, Cut) pass through
  if (code === 'KeyA' || code === 'KeyC' || code === 'KeyV' || code === 'KeyX') return;

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

// Add Vimium-style hints to visible dropdown list items
setInterval(() => {
    const items = Array.from(document.querySelectorAll('#composer-dropdown-button-menu-contents button, #task-chat-mode-dropdown-menu button, [data-testid="task-chat-mode-dropdown-menu-contents"] button, [role="radiogroup"] [role="radio"]')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });
    const uniqueItems = [...new Set(items)];
    
    document.querySelectorAll('.copilot-shortcut-hint').forEach(hint => {
        if (!uniqueItems.includes(hint.parentElement)) {
            hint.remove();
        }
    });

    uniqueItems.forEach((item, index) => {
        if (index >= 9) {
            const extraHint = item.querySelector('.copilot-shortcut-hint');
            if (extraHint) extraHint.remove();
            return;
        }
        const num = index + 1;
        let hint = item.querySelector('.copilot-shortcut-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'copilot-shortcut-hint';
            hint.style.cssText = 'position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: #fffacd; color: #302505; border: 1px solid #d3c6a6; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 2px 6px; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; pointer-events: none;';
            if (window.getComputedStyle(item).position === 'static') {
                item.style.position = 'relative';
            }
            item.appendChild(hint);
        }
        hint.textContent = `${num}`;
    });
}, 250);

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

    let searchTimeout = null;
    findInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const text = findInput.value;
        if (text.length >= 2) {
          window.electronSearch?.find(text, true, false);
        } else {
          findResultsCount.textContent = '0/0';
          window.electronSearch?.stop();
        }
      }, 500);
    });

    nextBtn.onclick = () => { if (findInput.value.length >= 2) window.electronSearch?.find(findInput.value, true, true); };
    prevBtn.onclick = () => { if (findInput.value.length >= 2) window.electronSearch?.find(findInput.value, false, true); };

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (findInput.value.length >= 2) window.electronSearch?.find(findInput.value, !e.shiftKey, true);
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
    // ensure search bar retains focus so user can keep typing
    if (findInput && findBar?.style?.display === 'flex' && document.activeElement !== findInput) {
        findInput.focus();
    }
  });
})();

// =============================================================
//  Keyboard Shortcuts Modal overlay
// =============================================================

(function initShortcutsModal() {
  if (window.self !== window.top) return;
  
  let modal = null;

  function createModal() {
    if (modal) return;
    
    modal = document.createElement('div');
    modal.id = 'copilot-shortcuts-modal';
    
    // Glassmorphism overlay
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 2147483647;
      display: none; justify-content: center; align-items: center;
      opacity: 0; transition: opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
      background: rgba(20, 20, 20, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      width: 500px; max-width: 90vw;
      padding: 32px;
      color: #fff;
      transform: scale(0.95) translateY(10px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; gap: 20px;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 16px;';
    
    const title = document.createElement('h2');
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = 'margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background: rgba(255,255,255,0.1); border: none; cursor: pointer; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: background 0.2s;';
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';
    closeBtn.onclick = hideModal;

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);

    const list = document.createElement('div');
    list.style.cssText = 'display: grid; grid-template-columns: 1fr; gap: 12px; max-height: 60vh; overflow-y: auto; padding-right: 8px;';

    const shortcutsList = [
      { key: 'Cmd + N', altKey: 'Cmd + Shift + O', desc: 'New Chat' },
      { key: 'Cmd + L', desc: 'Library' },
      { key: 'Cmd + T', desc: 'Tasks' },
      { key: 'Cmd + D', desc: 'Discover' },
      { key: 'Cmd + S', desc: 'Shopping' },
      { key: 'Cmd + I', desc: 'Imagine' },
      { key: 'Cmd + B', desc: 'Labs' },
      { key: 'Cmd + M', desc: 'Switch Chat Mode' },
      { key: 'Cmd + U', desc: 'Voice / Talk' },
      { key: 'Cmd + X', desc: 'Invite' },
      { key: 'Cmd + E', desc: 'Attach / Create' },
      { key: 'Cmd + K', desc: 'Search Chats' },
      { key: 'Cmd + ,', desc: 'Settings' },
      { key: 'Cmd + .', desc: 'Toggle Sidebar' },
      { key: 'Cmd + F', desc: 'Find in Page' },
      { key: 'Cmd + [ / ]', desc: 'History Back / Forward' },
      { key: 'Cmd + 1 - 9', desc: 'Select Recent Conversation' },
      { key: '1 - 9', desc: 'Select List Item' },
      { key: 'Cmd + /', desc: 'Show this Modal' },
      { key: '/', desc: 'Focus Chat Input' },
    ];

    shortcutsList.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; transition: background 0.2s;';
      row.onmouseover = () => row.style.background = 'rgba(255, 255, 255, 0.07)';
      row.onmouseout = () => row.style.background = 'rgba(255, 255, 255, 0.03)';
      
      const desc = document.createElement('span');
      desc.textContent = item.desc;
      desc.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255, 255, 255, 0.9);';
      
      const keys = document.createElement('div');
      keys.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; align-items: center;';
      
      const renderKeyString = (keyStr, isAlt) => {
          const container = document.createElement('div');
          container.style.cssText = 'display: flex; gap: 4px; align-items: center;';
          
          if (isAlt) {
              const parenL = document.createElement('span');
              parenL.textContent = '(';
              parenL.style.cssText = 'color: #888; font-size: 14px; margin-left: 4px;';
              container.appendChild(parenL);
          }
          
          const parts = keyStr.split(' ').filter(p => !!p);
          parts.forEach(part => {
            if (part !== '+') {
              const keyBadge = document.createElement('kbd');
              keyBadge.textContent = part.replace('Cmd', '⌘').replace('Shift', '⇧');
              keyBadge.style.cssText = `
                background: rgba(255, 255, 255, 0.1); 
                border: 1px solid rgba(255, 255, 255, 0.2); 
                border-radius: 6px; padding: 4px 8px; 
                font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                box-shadow: 0 2px 0 rgba(0,0,0,0.2);
                color: #ddd;
              `;
              container.appendChild(keyBadge);
            } else if (part === '+') {
              const plus = document.createElement('span');
              plus.textContent = '+';
              plus.style.cssText = 'color: #888; font-size: 12px; font-weight: bold; padding: 0 2px;';
              container.appendChild(plus);
            }
          });
          
          if (isAlt) {
              const parenR = document.createElement('span');
              parenR.textContent = ')';
              parenR.style.cssText = 'color: #888; font-size: 14px;';
              container.appendChild(parenR);
          }
          
          return container;
      };

      keys.appendChild(renderKeyString(item.key, false));
      if (item.altKey) {
          keys.appendChild(renderKeyString(item.altKey, true));
      }
      
      row.appendChild(desc);
      row.appendChild(keys);
      list.appendChild(row);
    });

    const style = document.createElement('style');
    style.textContent = `
      #copilot-shortcuts-modal *::-webkit-scrollbar { width: 6px; }
      #copilot-shortcuts-modal *::-webkit-scrollbar-track { background: transparent; }
      #copilot-shortcuts-modal *::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
      #copilot-shortcuts-modal *::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
    `;
    modal.appendChild(style);

    container.appendChild(list);
    modal.appendChild(container);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
        hideModal();
      }
    });
  }

  let autoDismissTimer = null;

  function showModal() {
    createModal();
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      modal.children[1].style.transform = 'scale(1) translateY(0)';
    });
    clearTimeout(autoDismissTimer);
    autoDismissTimer = setTimeout(() => hideModal(), 5000);
  }

  function hideModal() {
    if (!modal) return;
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
    modal.style.opacity = '0';
    modal.children[1].style.transform = 'scale(0.95) translateY(10px)';
    setTimeout(() => {
      if (modal.style.opacity === '0') modal.style.display = 'none';
    }, 300);
  }

  window.addEventListener('show-shortcuts-modal', () => {
    if (modal && modal.style.display === 'flex') hideModal();
    else showModal();
  });
})();
}
