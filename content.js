document.addEventListener('keydown', (e) => {
    // Intercept when Alt (Option on Mac) is the only modifier pressed.
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

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
            // "Labs" -> Alt+A or Alt+B as Alt+L is used for Library
            selector = '[aria-label="Labs"]';
            break;
        default:
            return;
    }

    if (selector) {
        const el = document.querySelector(selector);
        if (el) {
            e.preventDefault();
            e.stopPropagation();
            el.click();
        }
    }
}, true); // Use capture phase to intercept before other handlers
