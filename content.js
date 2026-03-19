// =============================================================
//  Copilot Shortcuts — Alt+Key edition
//  Modifier: Alt (Option on Mac)
//  Why Alt: Ctrl+N/T/L/F/A are browser-reserved and silently
//  swallowed before any content script sees them. Alt combos
//  are almost entirely free from browser conflicts.
// =============================================================

console.log(
  '%c[Copilot Shortcuts] Loaded — listening for Alt+Key combos',
  'color: #78D4; font-weight: bold; font-size: 14px;'
);

// -------------------------------------------------------------
//  Trigger strategy
//
//  Copilot ignores synthetic pointer events (isTrusted === false).
//  However, it accepts keyboard navigation within the iframe.
//  So we focus the element and dispatch synthetic Enter key events.
// -------------------------------------------------------------

function triggerElement(el, isInput) {
  if (isInput) {
    el.focus();
    return;
  }
  
  // Focus the element first
  el.focus();
  
  // Dispatch Enter key down
  el.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  }));
  
  // Dispatch Enter key up
  el.dispatchEvent(new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  }));
}

// -------------------------------------------------------------
//  SPA-safe querySelector
//
//  Search the top document and all iframes.
//  Retry once after a short delay if the first query returns null.
// -------------------------------------------------------------

function findElement(selector, callback) {
  function traverse() {
    let el = document.querySelector(selector);
    if (el) return el;
    
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        if (iframe.contentDocument) {
          el = iframe.contentDocument.querySelector(selector);
          if (el) return el;
        }
      } catch (err) {}
    }
    return null;
  }

  let el = traverse();
  if (el) {
    callback(el);
    return;
  }

  // Single retry after 300 ms — covers most SPA render cycles
  setTimeout(() => {
    el = traverse();
    if (el) {
      console.log('[Copilot Shortcuts Debug] Element found after retry:', el);
      callback(el);
    } else {
      console.warn(`[Copilot Shortcuts Debug] Element NOT found (even after retry): ${selector}`);
    }
  }, 300);
}

// -------------------------------------------------------------
//  Shortcut map
// -------------------------------------------------------------

const SHORTCUTS = {
  KeyN: { selector: '[aria-label="New chat"], [data-testid="sidebar-new-conversation-nav-item"]' },
  KeyL: { selector: '[aria-label="Library"]' },
  KeyT: { selector: '[aria-label="Tasks"]' },
  KeyD: { selector: '[aria-label="Discover"], [data-testid="sidebar-discover-button"]' },
  KeyS: { selector: '[aria-label="Shopping"], [data-testid="sidebar-shopping-button"]' },
  KeyI: { selector: '[aria-label="Imagine"]' },
  KeyA: { selector: '[aria-label="Labs"]' },
  KeyB: { selector: '[aria-label="Labs"]' },
  KeyC: { selector: '[data-testid="composer-create-button"]' },
  KeyM: { selector: '[data-testid="composer-chat-mode-smart-button"]' },
  KeyV: { selector: '[aria-label="Talk to Copilot"], [data-testid="audio-call-button"]' },
  KeyX: { selector: '[title="Invite"]' },
  KeyF: { selector: '#userInput', isInput: true },
};

// -------------------------------------------------------------
//  Keydown listener (capture phase)
// -------------------------------------------------------------

const handler = (e) => {
  // Debug: log every keydown
  console.log(
    `[Copilot Shortcuts Debug] keydown — code: ${e.code} | key: ${e.key} | ` +
    `alt: ${e.altKey} | ctrl: ${e.ctrlKey} | meta: ${e.metaKey} | shift: ${e.shiftKey}`
  );

  // Only fire when Alt is the sole modifier
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

  const mapping = SHORTCUTS[e.code];
  if (!mapping) return; // Not a mapped key

  console.log(`[Copilot Shortcuts Debug] Matched ${e.code} → selector: "${mapping.selector}"`);

  // Prevent default browser behaviour for this combo
  e.preventDefault();
  e.stopPropagation();

  findElement(mapping.selector, (el) => {
    console.log('[Copilot Shortcuts Debug] Triggering element:', el);
    triggerElement(el, mapping.isInput ?? false);
  });
};

function attach(doc) {
  if (!doc) return;
  // Prevent duplicate attachments if script runs multiple times
  if (doc.dataset && doc.dataset.copilotShortcutsAttached) return;
  if (doc.dataset) doc.dataset.copilotShortcutsAttached = 'true';
  
  doc.addEventListener('keydown', handler, true);
}

// Attach to top document
attach(document);

// Attach to existing iframes immediately
for (const iframe of document.querySelectorAll('iframe')) {
  try {
    attach(iframe.contentDocument);
  } catch (err) {}
}

// Also observe for dynamically added iframes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.tagName === 'IFRAME') {
        node.addEventListener('load', () => {
          try {
            attach(node.contentDocument);
          } catch (err) {}
        });
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
