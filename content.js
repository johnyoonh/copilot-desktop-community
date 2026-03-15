console.log('%c[Copilot Shortcuts] Extension Loaded - Waiting for Ctrl+Key combo', 'color: #0078D4; font-weight: bold; font-size: 14px;');

// Helper to simulate a trusted click for React/SPA elements
function simulateClick(el) {
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(type => {
        const event = new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });
        el.dispatchEvent(event);
    });
}

document.addEventListener('keydown', (e) => {
    // Debug logging for any Ctrl keydown
    if (e.ctrlKey) {
        console.log(`[Copilot Shortcuts Debug] Ctrl pressed + ${e.code} (e.key: ${e.key})`, e);
    }

    // Intercept when Ctrl is the only modifier pressed.
    if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    let selector = null;

    switch (e.code) {
        case 'KeyN':
            selector = '[aria-label="New chat"], [data-testid="sidebar-new-conversation-nav-item"]';
            break;
        case 'KeyL':
            selector = '[aria-label="Library"]';
            break;
        case 'KeyT':
            selector = '[aria-label="Tasks"]';
            break;
        case 'KeyD':
            selector = '[aria-label="Discover"], [data-testid="sidebar-discover-button"]';
            break;
        case 'KeyS':
            selector = '[aria-label="Shopping"], [data-testid="sidebar-shopping-button"]';
            break;
        case 'KeyI':
            selector = '[aria-label="Imagine"]';
            break;
        case 'KeyA':
        case 'KeyB':
            // "Labs" -> Ctrl+A or Ctrl+B as Ctrl+L is used for Library
            selector = '[aria-label="Labs"]';
            break;
        case 'KeyC':
            selector = '[data-testid="composer-create-button"]';
            break;
        case 'KeyM':
            selector = '[data-testid="composer-chat-mode-smart-button"]';
            break;
        case 'KeyV':
            selector = '[aria-label="Talk to Copilot"], [data-testid="audio-call-button"]';
            break;
        case 'KeyX':
            selector = '[title="Invite"]';
            break;
        case 'KeyF':
            selector = '#userInput';
            break;
        default:
            return; // Not a mapped shortcut
    }

    if (selector) {
        console.log(`[Copilot Shortcuts Debug] Match found for ${e.code}. Active selector: ${selector}`);
        const el = document.querySelector(selector);
        
        if (el) {
            console.log(`[Copilot Shortcuts Debug] Triggering element:`, el);
            e.preventDefault();
            e.stopPropagation();

            if (selector === '#userInput') {
                el.focus();
            } else {
                simulateClick(el);
            }
        } else {
            console.warn(`[Copilot Shortcuts Debug] Element NOT found for selector: ${selector}`);
        }
    }
}, true); // Use capture phase to intercept before other handlers
