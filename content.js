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
  StopTalking: { selector: '[aria-label="Stop talking"]' },
  KeyX: { selector: '[title="Invite"]' },
  KeyK: { selector: '[aria-label="Search chats"], [aria-label="Search"], [data-testid="search-button"]', isInput: true },
  Comma: { selector: '[aria-label="Settings"], [data-testid="sidebar-settings-button"]' },
  Period: { selector: '[aria-label="Close sidebar"], [aria-label="Open sidebar"], [aria-label="Open sidebar!"]' }
};

const MODE_STORAGE_KEY = 'copilot-desktop:last-chat-mode';
const MODE_MENU_BUTTON_SELECTOR = '[data-testid="composer-chat-mode-reasoning-button"], [data-testid="composer-chat-mode-smart-button"], [data-testid="task-chat-mode-dropdown-button"]';
const MODE_OPTION_SELECTOR = '#composer-dropdown-button-menu-contents button, #task-chat-mode-dropdown-menu button, [data-testid="task-chat-mode-dropdown-menu-contents"] button, [role="radiogroup"] [role="radio"], [role="menuitemradio"], [role="option"]';
let modeRestoreInProgress = false;
let lastModeRestoreValue = null;

function isVisible(el) {
  const rect = el?.getBoundingClientRect?.();
  return !!rect && rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
}

function elementText(el) {
  return [
    el?.getAttribute?.('aria-label'),
    el?.getAttribute?.('title'),
    el?.innerText,
    el?.textContent,
    el?.value,
  ].find((value) => value && value.trim())?.trim().replace(/\s+/g, ' ') || '';
}

function normalizeModeLabel(text) {
  return (text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function readStoredMode() {
  const raw = localStorage.getItem(MODE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.normalized) return parsed;
  } catch {}

  return { label: raw, normalized: normalizeModeLabel(raw) };
}

function isSelectedModeControl(el) {
  return el?.getAttribute?.('aria-checked') === 'true' ||
    el?.getAttribute?.('aria-selected') === 'true' ||
    el?.getAttribute?.('data-state') === 'checked' ||
    el?.getAttribute?.('data-selected') === 'true';
}

function modeOptions() {
  return Array.from(document.querySelectorAll(MODE_OPTION_SELECTOR))
    .filter(isVisible)
    .map((el) => {
      const text = elementText(el);
      return { el, text, normalized: normalizeModeLabel(text) };
    })
    .filter((item) => item.normalized);
}

function rememberModeFromElement(el) {
  const label = elementText(el);
  const normalized = normalizeModeLabel(label);
  if (!normalized) return;

  localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify({ label, normalized }));
  lastModeRestoreValue = normalized;
  console.info('[Copilot Mode Persistence] saved', label);
}

function currentModeValue() {
  const selectedOption = modeOptions().find((item) => isSelectedModeControl(item.el));
  if (selectedOption) return selectedOption.normalized;

  const menuButton = document.querySelector(MODE_MENU_BUTTON_SELECTOR);
  return normalizeModeLabel(elementText(menuButton));
}

function clickStoredModeIfVisible(storedMode) {
  const match = modeOptions().find((item) => item.normalized === storedMode.normalized);
  if (!match) return false;

  if (isSelectedModeControl(match.el)) return true;
  match.el.click();
  console.info('[Copilot Mode Persistence] restored', match.text);
  return true;
}

function restoreStoredMode() {
  if (modeRestoreInProgress) return;
  const storedMode = readStoredMode();
  if (!storedMode?.normalized) return;
  if (currentModeValue() === storedMode.normalized) return;

  modeRestoreInProgress = true;
  try {
    if (clickStoredModeIfVisible(storedMode)) return;

    const menuButton = document.querySelector(MODE_MENU_BUTTON_SELECTOR);
    if (!isVisible(menuButton)) return;

    menuButton.click();
    setTimeout(() => {
      clickStoredModeIfVisible(storedMode);
      modeRestoreInProgress = false;
    }, 250);
    return;
  } finally {
    if (!document.querySelector('#composer-dropdown-button-menu-contents, #task-chat-mode-dropdown-menu, [data-testid="task-chat-mode-dropdown-menu-contents"]')) {
      modeRestoreInProgress = false;
    }
  }
}

function scheduleModeRestore() {
  [800, 2000, 5000].forEach((delay) => setTimeout(restoreStoredMode, delay));
}

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

document.addEventListener('click', (event) => {
  const modeControl = event.target?.closest?.(MODE_OPTION_SELECTOR);
  if (modeControl) rememberModeFromElement(modeControl);
}, true);

scheduleModeRestore();
new MutationObserver(() => {
  const storedMode = readStoredMode();
  if (storedMode?.normalized && storedMode.normalized !== lastModeRestoreValue) {
    lastModeRestoreValue = storedMode.normalized;
    setTimeout(restoreStoredMode, 250);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

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

    const highlightStyle = document.createElement('style');
    highlightStyle.textContent = `
      mark.copilot-find-highlight {
        background: #fff176 !important;
        color: inherit !important;
        border-radius: 2px !important;
        padding: 0 1px !important;
      }
      mark.copilot-find-highlight-active {
        background: #ff9800 !important;
        color: #111 !important;
        outline: 2px solid #d35f00 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(highlightStyle);

    let searchTimeout = null;
    let findBarVisible = false;
    let highlightedMatches = [];
    let activeMatchIndex = -1;
    let lastSearchText = '';

    function focusFindInput() {
      if (!findBarVisible || !findInput) return;
      findInput.focus({ preventScroll: true });
    }

    function restoreFindInputFocus() {
      focusFindInput();
      requestAnimationFrame(focusFindInput);
      [50, 150, 300].forEach((delay) => setTimeout(focusFindInput, delay));
    }

    function consumeFindEvent(e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }

    function jumpToMatch(match) {
      const scrollRoots = [document.documentElement, document.body].filter(Boolean);
      const previousScrollBehavior = scrollRoots.map((el) => [el, el.style.scrollBehavior]);

      scrollRoots.forEach((el) => {
        el.style.scrollBehavior = 'auto';
      });

      try {
        match.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      } catch {
        match.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      } finally {
        requestAnimationFrame(() => {
          previousScrollBehavior.forEach(([el, value]) => {
            el.style.scrollBehavior = value;
          });
        });
      }
    }

    function hideFindBar() {
      clearTimeout(searchTimeout);
      findBarVisible = false;
      lastSearchText = '';
      clearHighlights();
      findBar.style.display = 'none';
      window.electronSearch?.stop();
    }

    function isSearchableTextNode(node) {
      if (!node.nodeValue?.trim()) return false;

      let el = node.parentElement;
      while (el) {
        if (el === findBar || el.closest?.('#electron-find-bar')) return false;
        if (el.closest?.('[aria-label="Sidebar"], nav, aside')) return false;
        if (el.classList?.contains('copilot-find-highlight')) return false;

        const tag = el.tagName?.toLowerCase();
        if (['script', 'style', 'noscript', 'textarea', 'input', 'select', 'option'].includes(tag)) {
          return false;
        }
        if (el.isContentEditable || el.getAttribute?.('aria-hidden') === 'true') return false;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        el = el.parentElement;
      }

      return true;
    }

    function collectTextNodes() {
      const nodes = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => isSearchableTextNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
        }
      );

      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }

      return nodes;
    }

    function clearHighlights() {
      const marks = highlightedMatches.length
        ? [...highlightedMatches]
        : Array.from(document.querySelectorAll('mark.copilot-find-highlight'));

      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      });

      highlightedMatches = [];
      activeMatchIndex = -1;
      findResultsCount.textContent = '0/0';
    }

    function createHighlight(text) {
      const mark = document.createElement('mark');
      mark.className = 'copilot-find-highlight';
      mark.textContent = text;
      return mark;
    }

    function highlightMatches(query) {
      clearHighlights();

      const normalizedQuery = query.toLocaleLowerCase();
      collectTextNodes().forEach((node) => {
        const text = node.nodeValue;
        const normalizedText = text.toLocaleLowerCase();
        let index = normalizedText.indexOf(normalizedQuery);
        if (index === -1) return;

        const fragment = document.createDocumentFragment();
        let cursor = 0;

        while (index !== -1) {
          if (index > cursor) {
            fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
          }

          const matchText = text.slice(index, index + query.length);
          const mark = createHighlight(matchText);
          fragment.appendChild(mark);
          highlightedMatches.push(mark);

          cursor = index + query.length;
          index = normalizedText.indexOf(normalizedQuery, cursor);
        }

        if (cursor < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(cursor)));
        }

        node.parentNode.replaceChild(fragment, node);
      });
    }

    function setActiveMatch(index) {
      if (!highlightedMatches.length) {
        activeMatchIndex = -1;
        findResultsCount.textContent = '0/0';
        focusFindInput();
        return;
      }

      highlightedMatches[activeMatchIndex]?.classList.remove('copilot-find-highlight-active');

      activeMatchIndex = (index + highlightedMatches.length) % highlightedMatches.length;
      const activeMatch = highlightedMatches[activeMatchIndex];
      activeMatch.classList.add('copilot-find-highlight-active');
      findResultsCount.textContent = `${activeMatchIndex + 1}/${highlightedMatches.length}`;
      jumpToMatch(activeMatch);
      restoreFindInputFocus();
    }

    function runSearch({ forward = true, findNext = false } = {}) {
      clearTimeout(searchTimeout);

      const text = findInput.value;
      if (text.length < 2) {
        lastSearchText = '';
        clearHighlights();
        window.electronSearch?.stop();
        focusFindInput();
        return;
      }

      if (text !== lastSearchText) {
        lastSearchText = text;
        highlightMatches(text);
        setActiveMatch(0);
        return;
      }

      if (findNext) {
        setActiveMatch(activeMatchIndex + (forward ? 1 : -1));
        return;
      }

      setActiveMatch(activeMatchIndex >= 0 ? activeMatchIndex : 0);
    }

    findInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        runSearch({ forward: true, findNext: false });
      }, 350);
    });

    [prevBtn, nextBtn, closeBtn].forEach((button) => {
      button.type = 'button';
      button.addEventListener('mousedown', (e) => e.preventDefault());
    });

    nextBtn.onclick = () => runSearch({ forward: true, findNext: true });
    prevBtn.onclick = () => runSearch({ forward: false, findNext: true });

    function replaceInputSelection(text) {
      const start = findInput.selectionStart ?? findInput.value.length;
      const end = findInput.selectionEnd ?? findInput.value.length;
      findInput.setRangeText(text, start, end, 'end');
      findInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.addEventListener('keydown', (e) => {
      if (!findBarVisible) return;

      if (e.key === 'Enter') {
        consumeFindEvent(e);
        runSearch({ forward: !e.shiftKey, findNext: true });
        restoreFindInputFocus();
        return;
      }

      if (e.key === 'Escape') {
        consumeFindEvent(e);
        hideFindBar();
        return;
      }

      if (document.activeElement === findInput || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Backspace') {
        consumeFindEvent(e);
        focusFindInput();
        if (findInput.selectionStart !== findInput.selectionEnd) {
          replaceInputSelection('');
        } else if (findInput.selectionStart > 0) {
          const cursor = findInput.selectionStart;
          findInput.setSelectionRange(cursor - 1, cursor);
          replaceInputSelection('');
        }
        return;
      }

      if (e.key.length === 1) {
        consumeFindEvent(e);
        focusFindInput();
        replaceInputSelection(e.key);
      }
    }, true);

    findInput.addEventListener('blur', () => {
      if (!findBarVisible) return;
      setTimeout(focusFindInput, 80);
    });

    closeBtn.onclick = hideFindBar;

    findBar._show = () => {
      findBarVisible = true;
      findBar.style.display = 'flex';
      focusFindInput();
      findInput.select();
    };
  }

  window.addEventListener('show-find-bar', () => {
    createFindBar();
    findBar._show();
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
      { key: 'Cmd + Shift + U', desc: 'Stop Voice / Talk' },
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

// =============================================================
//  Microphone diagnostics banner (Cmd+Shift+D)
// =============================================================
(function initMicDiagnostics() {
  if (window.self !== window.top) return;

  async function showBanner() {
    const existing = document.getElementById('copilot-mic-diag');
    if (existing) existing.remove();

    const diag = await window.electronMic?.getDiagnostics?.();
    const probe = await window.electronMic?.probe?.();

    const banner = document.createElement('div');
    banner.id = 'copilot-mic-diag';
    banner.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(20,20,20,0.95); color: #fff; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px; padding: 16px 20px; z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; line-height: 1.5; box-shadow: 0 12px 40px rgba(0,0,0,0.5);
      max-width: 560px; min-width: 420px;
    `;

    const probeLine = probe?.ok
      ? '<span style="color:#5dd85d">getUserMedia OK — audio track obtained</span>'
      : `<span style="color:#ff6b6b">getUserMedia failed: ${probe?.name || 'Unknown'} — ${probe?.message || ''}</span>`;

    const micStatusColor = diag?.micStatus === 'granted' ? '#5dd85d'
      : diag?.micStatus === 'denied' ? '#ff6b6b' : '#ffcb6b';

    banner.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:14px;">Microphone diagnostics</strong>
        <button id="copilot-mic-diag-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;">
        <div>App: ${diag?.appName} v${diag?.version} (Electron ${diag?.electronVersion})</div>
        <div>Binary: ${diag?.execPath}</div>
        <div>macOS mic status: <span style="color:${micStatusColor}">${diag?.micStatus}</span></div>
        <div>Probe: ${probeLine}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="copilot-mic-diag-open" style="background:#4c9aff;color:#fff;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;">Open System Settings → Microphone</button>
        <button id="copilot-mic-diag-reprobe" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:8px 12px;cursor:pointer;font-size:13px;">Re-probe</button>
      </div>
      <div style="margin-top:10px;color:#aaa;font-size:11px;">
        If status is "denied", macOS is blocking audio — toggle this app in System Settings, fully quit, and relaunch.
        If status is "granted" but probe fails, Electron's permission handler is the issue.
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('#copilot-mic-diag-close').onclick = () => banner.remove();
    banner.querySelector('#copilot-mic-diag-open').onclick = () => window.electronMic?.openSystemSettings?.();
    banner.querySelector('#copilot-mic-diag-reprobe').onclick = () => showBanner();
  }

  window.addEventListener('show-mic-diagnostics', showBanner);
})();
}
