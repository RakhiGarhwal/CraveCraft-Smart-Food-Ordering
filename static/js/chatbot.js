/**
 * CraveCraft — CraveBot Floating AI Dining Concierge
 * Handles chat widget UI, prompt suggestions, streaming typing simulation,
 * interactive in-chat "Add to Cart" actions, and instant response evaluation trigger.
 */

const CraveChat = {
  isOpen: false,
  history: [],
  isWaiting: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnToggle = document.getElementById('btnToggleBot');
    const btnClose = document.getElementById('btnCloseBot');
    const btnMinimize = document.getElementById('btnMinimizeBot');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => this.toggleBot());
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => this.toggleBot(false));
    }

    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => this.toggleBot(false));
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input ? input.value.trim() : '';
        if (text) {
          this.sendMessage(text);
          if (input) input.value = '';
        }
      });
    }

    // Quick prompt pills inside chat
    document.querySelectorAll('.chat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const prompt = pill.getAttribute('data-prompt');
        if (prompt) this.sendMessage(prompt);
      });
    });

    // Preset prompts from showcase section
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        if (query) {
          this.openWithPrompt(query);
        }
      });
    });
  },

  toggleBot(forceState) {
    const win = document.getElementById('cravebotWindow');
    const tooltip = document.getElementById('botTooltip');

    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;

    if (this.isOpen) {
      win.classList.add('open');
      if (tooltip) tooltip.style.display = 'none';
      const input = document.getElementById('chatInput');
      if (input) input.focus();
    } else {
      win.classList.remove('open');
    }
  },

  openWithPrompt(promptText) {
    this.toggleBot(true);
    setTimeout(() => {
      this.sendMessage(promptText);
    }, 250);
  },

  async sendMessage(queryText) {
    if (this.isWaiting || !queryText) return;

    // 1. Append User Message
    this.appendUserMessage(queryText);
    this.history.push({ sender: 'user', text: queryText });

    // 2. Show Typing Indicator
    this.showTypingIndicator();
    this.isWaiting = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          chat_history: this.history
        })
      });

      const data = await res.json();
      this.removeTypingIndicator();
      this.isWaiting = false;

      if (data.success) {
        this.appendBotMessage(data.reply, data.suggested_items || [], data.model, queryText);
        this.history.push({
          sender: 'bot',
          text: data.reply,
          suggested_items: data.suggested_items
        });
      } else {
        this.appendBotMessage(
          "I apologize, I ran into a slight culinary hiccup. Please ask me about our menu, budget options, or signature dishes!",
          [],
          "System Notice",
          queryText
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      this.removeTypingIndicator();
      this.isWaiting = false;
      this.appendBotMessage(
        "I'm currently running in offline culinary mode. Feel free to ask about any dish on our menu, prices under ₹500, or spicy options!",
        [],
        "Offline Heuristic",
        queryText
      );
    }
  },

  appendUserMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg user';
    msgEl.innerHTML = `
      <div class="msg-bubble">
        ${this.escapeHTML(text)}
      </div>
    `;

    container.appendChild(msgEl);
    this.scrollToBottom();
  },

  appendBotMessage(markdownText, suggestedItems, modelName, originalQuestion) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const msgId = 'msg-' + Date.now();
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg bot';
    msgEl.id = msgId;

    const formattedHTML = this.formatMarkdown(markdownText);

    // Build suggested items action chips
    let suggestionsHTML = '';
    if (suggestedItems && suggestedItems.length > 0) {
      suggestionsHTML = `
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: #ff9d66; font-weight: 700;">
            One-Click Order Options:
          </div>
          ${suggestedItems.map(item => `
            <div class="chat-suggested-card">
              <div class="chat-suggested-name">
                <span>${item.is_veg ? '🟢' : '🔴'}</span>
                <span>${item.name}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="chat-suggested-price">₹${item.price}</span>
                <button type="button" class="btn-chat-add" data-dish-id="${item.id}">
                  Add +
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="msg-bubble">
        ${formattedHTML}
        ${suggestionsHTML}
      </div>
      <div class="msg-eval-bar">
        <span>${modelName || 'CraveBot'}</span>
        <button type="button" class="btn-eval-bubble" data-msg-id="${msgId}" title="Audit response quality & factual consistency">
          <span>⚡ Evaluate Response</span>
        </button>
      </div>
    `;

    container.appendChild(msgEl);

    // Attach in-chat Add-to-Cart handlers
    msgEl.querySelectorAll('.btn-chat-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const dishId = btn.getAttribute('data-dish-id');
        if (window.CraveApp) {
          window.CraveApp.addToCart(dishId);
          btn.textContent = '✓ Added';
          btn.style.background = 'var(--veg-color)';
          setTimeout(() => {
            btn.textContent = 'Add +';
            btn.style.background = '';
          }, 2000);
        }
      });
    });

    // Attach Evaluate Response handler (Requirement 9)
    const evalBtn = msgEl.querySelector('.btn-eval-bubble');
    if (evalBtn) {
      evalBtn.addEventListener('click', () => {
        if (window.CraveEvaluator) {
          window.CraveEvaluator.openLiveEvaluationModal(originalQuestion, markdownText);
        }
      });
    }

    this.scrollToBottom();
  },

  showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const typingEl = document.createElement('div');
    typingEl.id = 'chatTyping';
    typingEl.className = 'chat-msg bot';
    typingEl.innerHTML = `
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;

    container.appendChild(typingEl);
    this.scrollToBottom();
  },

  removeTypingIndicator() {
    const typing = document.getElementById('chatTyping');
    if (typing) typing.remove();
  },

  scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatMarkdown(text) {
    if (!text) return '';

    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h4 style="font-size:0.95rem;margin:8px 0 4px;color:#ffa260;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="font-size:1.05rem;margin:10px 0 6px;color:#fff;">$1</h3>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italics
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\_(.*?)\_/g, '<em>$1</em>')
      // Bullet points
      .replace(/^\- (.*$)/gim, '<div style="margin:3px 0;padding-left:12px;position:relative;"><span style="position:absolute;left:0;color:var(--accent-primary);">•</span>$1</div>')
      // Numbered lists
      .replace(/^(\d+)\. (.*$)/gim, '<div style="margin:3px 0;padding-left:16px;"><strong>$1.</strong> $2</div>')
      // Line breaks
      .replace(/\n{2,}/g, '</p><p style="margin-top:6px;">')
      .replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }
};

// Initialize CraveChat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  CraveChat.init();
});

// Export globally
window.CraveChat = CraveChat;
