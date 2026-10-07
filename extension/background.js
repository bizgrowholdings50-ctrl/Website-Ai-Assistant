// WebClaw Extension - Background Service Worker
// Handles installation, onboarding, commands, and cross-tab messaging.

// =============================================
// Installation & Onboarding
// =============================================

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[WebClaw] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      gatewayUrl: 'http://localhost:8080',
      autoActivate: false,
      seamlessVoice: true,
      sendDom: true,
      voiceSwitch: true,
      defaultPersonal: false,
      avatarColor: '#FF4D4D',
      showLimbs: true,
      showBubbles: true,
      onboardingComplete: false,
    });

    // Open onboarding tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html'),
      active: true,
    });
  }
});

// =============================================
// Keyboard Shortcuts
// =============================================

chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;

    if (command === 'toggle-webclaw') {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' });
    }

    if (command === 'switch-agent') {
      chrome.tabs.sendMessage(tab.id, { type: 'SWITCH_AGENT_TOGGLE' });
    }
  });
});

// =============================================
// Message Relay (popup ↔ content script)
// =============================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Relay agent messages from content script to popup
  if (msg.type === 'AGENT_MESSAGE' || msg.type === 'AGENT_STATUS' || msg.type === 'AGENT_SWITCHED') {
    // Broadcast to all extension views (popup, options, etc.)
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // Handle settings queries
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse(settings);
    });
    return true; // async response
  }

  return false;
});

// =============================================
// Context Menu (optional enhancement)
// =============================================

// Could add right-click context menu items here for quick actions
