/*!
 * DigChat Web Chat Widget
 * Embed: <script src="…/webchat/widget.js" data-channel="ID" data-key="API_KEY"
 *           data-position="bottom-right" data-color="#6d28d9"
 *           data-title="Suporte" data-subtitle="Responderemos em breve" async></script>
 */
(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────────────
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var SERVER      = new URL(script.src).origin;
  var CHANNEL_ID  = script.getAttribute('data-channel') || '';
  var API_KEY     = script.getAttribute('data-key') || '';
  var POSITION    = script.getAttribute('data-position') || 'bottom-right';
  var COLOR       = script.getAttribute('data-color') || '#6d28d9';
  var TITLE       = script.getAttribute('data-title') || 'Suporte';
  var SUBTITLE    = script.getAttribute('data-subtitle') || 'Responderemos em breve';

  if (!CHANNEL_ID || !API_KEY) return;

  // ─── State ───────────────────────────────────────────────────────────────────
  var STORAGE_SESSION = 'digchat_s_' + CHANNEL_ID;
  var STORAGE_VISITOR = 'digchat_vid';
  var STORAGE_NAME    = 'digchat_name_' + CHANNEL_ID;

  var sessionToken   = null;
  var visitorName    = null;
  var lastMessageId  = 0;
  var pollTimer      = null;
  var isOpen         = false;
  var isInitializing = false;
  var isPolling      = false;
  var unreadCount    = 0;

  function getVisitorId() {
    try {
      var vid = localStorage.getItem(STORAGE_VISITOR);
      if (!vid) {
        vid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        localStorage.setItem(STORAGE_VISITOR, vid);
      }
      return vid;
    } catch (e) { return 'anon_' + Math.random().toString(36).slice(2); }
  }

  function loadSession() {
    try { sessionToken = localStorage.getItem(STORAGE_SESSION) || null; } catch (e) {}
  }

  function saveSession(token) {
    sessionToken = token;
    try { localStorage.setItem(STORAGE_SESSION, token); } catch (e) {}
  }

  function loadName() {
    try { visitorName = localStorage.getItem(STORAGE_NAME) || null; } catch (e) {}
  }

  function saveName(name) {
    visitorName = name;
    try { localStorage.setItem(STORAGE_NAME, name); } catch (e) {}
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────────
  var css = [
    '#digchat-btn{position:fixed;z-index:2147483646;width:56px;height:56px;border-radius:50%;',
    'background:' + COLOR + ';border:none;cursor:pointer;display:flex;align-items:center;',
    'justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.24);transition:transform .2s,box-shadow .2s;outline:none;}',
    '#digchat-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.3);}',
    '#digchat-btn svg{width:26px;height:26px;fill:#fff;transition:opacity .2s;}',
    '#digchat-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;',
    'background:#ef4444;color:#fff;font-size:11px;font-weight:700;border-radius:9px;',
    'display:flex;align-items:center;justify-content:center;padding:0 4px;',
    'font-family:system-ui,sans-serif;pointer-events:none;display:none;}',
    '#digchat-panel{position:fixed;z-index:2147483645;width:360px;height:520px;',
    'background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.2);',
    'display:flex;flex-direction:column;overflow:hidden;opacity:0;',
    'transform:scale(.95) translateY(12px);transition:opacity .22s,transform .22s;',
    'pointer-events:none;font-family:system-ui,-apple-system,sans-serif;}',
    '#digchat-panel.open{opacity:1;transform:scale(1) translateY(0);pointer-events:all;}',
    '#digchat-header{background:' + COLOR + ';padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
    '#digchat-header-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.25);',
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '#digchat-header-avatar svg{width:20px;height:20px;fill:#fff;}',
    '#digchat-header-info{flex:1;min-width:0;}',
    '#digchat-header-title{color:#fff;font-size:15px;font-weight:700;line-height:1.2;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '#digchat-header-subtitle{color:rgba(255,255,255,.8);font-size:12px;margin-top:1px;}',
    '#digchat-header-close{background:rgba(255,255,255,.18);border:none;cursor:pointer;',
    'width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
    'flex-shrink:0;transition:background .15s;}',
    '#digchat-header-close:hover{background:rgba(255,255,255,.35);}',
    '#digchat-header-close svg{width:14px;height:14px;fill:#fff;}',
    '#digchat-messages{flex:1;overflow-y:auto;padding:12px 14px;display:flex;',
    'flex-direction:column;gap:8px;scroll-behavior:smooth;}',
    '#digchat-messages::-webkit-scrollbar{width:4px;}',
    '#digchat-messages::-webkit-scrollbar-track{background:transparent;}',
    '#digchat-messages::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:2px;}',
    '.dcm{max-width:82%;display:flex;flex-direction:column;gap:2px;}',
    '.dcm-in{align-self:flex-start;}',
    '.dcm-out{align-self:flex-end;}',
    '.dcm-bubble{padding:8px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;',
    'word-break:break-word;white-space:pre-wrap;}',
    '.dcm-in .dcm-bubble{background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px;}',
    '.dcm-out .dcm-bubble{background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px;}',
    '.dcm-out .dcm-bubble.sending{opacity:.65;}',
    '.dcm-time{font-size:10.5px;color:#94a3b8;align-self:flex-end;margin-top:1px;}',
    '.dcm-in .dcm-time{align-self:flex-start;}',
    '.dcm-buttons{display:flex;flex-direction:column;gap:6px;margin-top:4px;width:100%;}',
    '.dcm-btn{background:#fff;border:1.5px solid ' + COLOR + ';color:' + COLOR + ';',
    'border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer;',
    'transition:background .15s,color .15s;text-align:center;line-height:1.3;}',
    '.dcm-btn:hover{background:' + COLOR + ';color:#fff;}',
    '.dcm-btn:disabled{opacity:.45;cursor:default;pointer-events:none;}',
    '#digchat-typing{display:none;align-self:flex-start;padding:4px 0;}',
    '#digchat-typing span{width:7px;height:7px;background:#94a3b8;border-radius:50%;',
    'display:inline-block;margin:0 2px;animation:dcm-bounce .9s infinite ease-in-out;}',
    '#digchat-typing span:nth-child(2){animation-delay:.15s;}',
    '#digchat-typing span:nth-child(3){animation-delay:.3s;}',
    '@keyframes dcm-bounce{0%,80%,100%{transform:scale(.7);}40%{transform:scale(1);}}',
    '#digchat-composer{border-top:1px solid #e2e8f0;padding:10px 12px;display:flex;',
    'align-items:flex-end;gap:8px;flex-shrink:0;background:#fff;}',
    '#digchat-input{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;',
    'padding:9px 12px;font-size:13.5px;resize:none;outline:none;',
    'font-family:inherit;line-height:1.4;max-height:100px;overflow-y:auto;',
    'background:#fafafa;color:#1e293b;transition:border-color .15s;}',
    '#digchat-input:focus{border-color:' + COLOR + ';}',
    '#digchat-input::placeholder{color:#94a3b8;}',
    '#digchat-send{width:38px;height:38px;border-radius:10px;background:' + COLOR + ';',
    'border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;',
    'flex-shrink:0;transition:opacity .15s;opacity:.5;}',
    '#digchat-send.ready{opacity:1;}',
    '#digchat-send:hover.ready{opacity:.88;}',
    '#digchat-send svg{width:18px;height:18px;fill:#fff;}',
    '#digchat-name-form{display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'flex:1;gap:14px;padding:24px 20px;}',
    '#digchat-name-form p{font-size:14px;color:#334155;text-align:center;line-height:1.5;margin:0;}',
    '#digchat-name-input{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;',
    'padding:10px 14px;font-size:14px;outline:none;font-family:inherit;',
    'background:#fff;color:#1e293b;transition:border-color .15s;box-sizing:border-box;}',
    '#digchat-name-input::placeholder{color:#94a3b8;}',
    '#digchat-name-input:focus{border-color:' + COLOR + ';}',
    '#digchat-name-submit{width:100%;background:' + COLOR + ';color:#fff;border:none;',
    'border-radius:10px;padding:11px 14px;font-size:14px;font-weight:600;cursor:pointer;',
    'transition:opacity .15s;font-family:inherit;}',
    '#digchat-name-submit:hover{opacity:.88;}',
    '#digchat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'flex:1;gap:10px;color:#94a3b8;font-size:13px;text-align:center;padding:20px;}',
    '#digchat-empty svg{width:40px;height:40px;opacity:.35;}',
    '@media(max-width:420px){#digchat-panel{width:calc(100vw - 20px) !important;',
    'height:calc(100vh - 80px) !important;border-radius:12px !important;}}',
  ].join('');

  // ─── Position ─────────────────────────────────────────────────────────────────
  var posMap = {
    'bottom-right': { btn: 'right:20px;bottom:20px;', panel: 'right:20px;bottom:86px;' },
    'bottom-left':  { btn: 'left:20px;bottom:20px;',  panel: 'left:20px;bottom:86px;'  },
    'top-right':    { btn: 'right:20px;top:20px;',     panel: 'right:20px;top:86px;'    },
    'top-left':     { btn: 'left:20px;top:20px;',      panel: 'left:20px;top:86px;'     },
  };
  var pos = posMap[POSITION] || posMap['bottom-right'];

  // ─── Build DOM ───────────────────────────────────────────────────────────────
  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildUI() {
    // Button
    var btn = document.createElement('button');
    btn.id = 'digchat-btn';
    btn.setAttribute('aria-label', 'Abrir chat');
    btn.style.cssText = pos.btn;
    btn.innerHTML = [
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '<path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>',
      '</svg>',
      '<div id="digchat-badge"></div>',
    ].join('');

    // Panel
    var panel = document.createElement('div');
    panel.id = 'digchat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', TITLE);
    panel.style.cssText = pos.panel;
    panel.innerHTML = [
      '<div id="digchat-header">',
        '<div id="digchat-header-avatar">',
          '<svg viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
        '</div>',
        '<div id="digchat-header-info">',
          '<div id="digchat-header-title">' + escHtml(TITLE) + '</div>',
          '<div id="digchat-header-subtitle">' + escHtml(SUBTITLE) + '</div>',
        '</div>',
        '<button id="digchat-header-close" aria-label="Fechar chat">',
          '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
        '</button>',
      '</div>',
      '<div id="digchat-messages">',
        '<div id="digchat-empty">',
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
          '<span>Nenhuma mensagem ainda.<br>Diga olá! 👋</span>',
        '</div>',
        '<div id="digchat-typing"><span></span><span></span><span></span></div>',
      '</div>',
      '<div id="digchat-composer">',
        '<textarea id="digchat-input" placeholder="Digite sua mensagem…" rows="1" aria-label="Mensagem"></textarea>',
        '<button id="digchat-send" aria-label="Enviar"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>',
      '</div>',
    ].join('');

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // Events
    btn.addEventListener('click', toggleChat);
    document.getElementById('digchat-header-close').addEventListener('click', closeChat);
    document.getElementById('digchat-input').addEventListener('input', onInputChange);
    document.getElementById('digchat-input').addEventListener('keydown', onKeyDown);
    document.getElementById('digchat-send').addEventListener('click', onSendClick);
  }

  // ─── Chat open/close ─────────────────────────────────────────────────────────
  function toggleChat() {
    if (isOpen) { closeChat(); } else { openChat(); }
  }

  function showNameForm() {
    var messages = document.getElementById('digchat-messages');
    var composer = document.getElementById('digchat-composer');
    if (!messages || !composer) return;

    composer.style.display = 'none';
    messages.innerHTML = '';

    var form = document.createElement('div');
    form.id = 'digchat-name-form';
    form.innerHTML = [
      '<p>Olá! Qual é o seu nome?</p>',
      '<input id="digchat-name-input" type="text" placeholder="Seu nome" maxlength="128" autocomplete="given-name" />',
      '<button id="digchat-name-submit">Iniciar conversa</button>',
    ].join('');
    messages.appendChild(form);

    setTimeout(function () {
      var inp = document.getElementById('digchat-name-input');
      if (inp) inp.focus();
    }, 150);

    function submitName() {
      var inp = document.getElementById('digchat-name-input');
      var name = inp ? inp.value.trim() : '';
      if (!name) { if (inp) inp.focus(); return; }
      saveName(name);
      var composer2 = document.getElementById('digchat-composer');
      if (composer2) composer2.style.display = '';
      messages.innerHTML = [
        '<div id="digchat-empty" style="display:none"></div>',
        '<div id="digchat-typing"><span></span><span></span><span></span></div>',
      ].join('');
      initSession();
    }

    document.getElementById('digchat-name-submit').addEventListener('click', submitName);
    document.getElementById('digchat-name-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitName(); }
    });
  }

  function openChat() {
    isOpen = true;
    resetUnread();
    var panel = document.getElementById('digchat-panel');
    if (panel) panel.classList.add('open');
    document.getElementById('digchat-btn').innerHTML = [
      '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      '<div id="digchat-badge"></div>',
    ].join('');
    setTimeout(function () { var inp = document.getElementById('digchat-input'); if (inp) inp.focus(); }, 250);

    if (!sessionToken && !isInitializing) {
      if (!visitorName) {
        showNameForm();
      } else {
        initSession();
      }
    } else if (sessionToken) {
      startPolling();
    }
  }

  function closeChat() {
    isOpen = false;
    stopPolling();
    var panel = document.getElementById('digchat-panel');
    if (panel) panel.classList.remove('open');
    document.getElementById('digchat-btn').innerHTML = [
      '<svg viewBox="0 0 24 24"><path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
      '<div id="digchat-badge"></div>',
    ].join('');
    updateBadge();
  }

  // ─── Session ─────────────────────────────────────────────────────────────────
  function initSession() {
    isInitializing = true;
    showTyping();

    var body = { api_key: API_KEY, visitor_id: getVisitorId() };
    if (visitorName) body.visitor_name = visitorName;

    fetch(SERVER + '/api/webchat/' + CHANNEL_ID + '/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        isInitializing = false;
        hideTyping();
        if (data.session_token) {
          saveSession(data.session_token);
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            renderMessages(data.messages);
            lastMessageId = data.messages[data.messages.length - 1].id || 0;
          }
          startPolling();
        } else {
          showError('Não foi possível iniciar o chat. Tente novamente.');
        }
      })
      .catch(function () {
        isInitializing = false;
        hideTyping();
        showError('Falha de conexão. Tente novamente.');
      });
  }

  // ─── Polling ─────────────────────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    poll();
    pollTimer = setInterval(poll, 2500);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function poll() {
    if (!sessionToken || isPolling) return;
    isPolling = true;
    fetch(SERVER + '/api/webchat/' + CHANNEL_ID + '/messages?session=' +
          encodeURIComponent(sessionToken) + '&after=' + lastMessageId, {
      headers: { 'Accept': 'application/json' },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        isPolling = false;
        if (data.error === 'Sessão inválida ou expirada.') {
          sessionToken = null;
          try { localStorage.removeItem(STORAGE_SESSION); } catch (e) {}
          stopPolling();
          if (isOpen) { initSession(); }
          return;
        }
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          renderMessages(data.messages);
          lastMessageId = data.messages[data.messages.length - 1].id || lastMessageId;
          if (!isOpen) { incrementUnread(data.messages.length); }
        }
      })
      .catch(function () { isPolling = false; });
  }

  // ─── Send ─────────────────────────────────────────────────────────────────────
  function sendText(text) {
    if (!text.trim()) return;
    addOptimisticMessage(text);
    doSendRequest({ text: text });
  }

  function sendButton(buttonId, buttonTitle) {
    // Disabilita todos os botões do último grupo
    var btns = document.querySelectorAll('.dcm-btn');
    btns.forEach(function (b) { b.disabled = true; });

    addOptimisticMessage(buttonTitle || buttonId);
    doSendRequest({ button_id: buttonId, button_title: buttonTitle });
  }

  function doSendRequest(payload) {
    if (!sessionToken) {
      if (!isInitializing) initSession();
      return;
    }
    showTyping();

    payload.session = sessionToken;

    fetch(SERVER + '/api/webchat/' + CHANNEL_ID + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        if (data.error === 'Sessão inválida ou expirada.') {
          // Conversa encerrada (ex: boleto enviado com sucesso) — reinicia sessão.
          var opt = document.querySelector('[data-optimistic]');
          if (opt) opt.remove();
          sessionToken = null;
          try { localStorage.removeItem(STORAGE_SESSION); } catch (e) {}
          stopPolling();
          if (isOpen) { initSession(); }
          return;
        }
        if (data.ok) {
          // Força um poll imediato para pegar a resposta
          setTimeout(poll, 400);
        }
      })
      .catch(function () { hideTyping(); });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function renderMessages(messages) {
    var container = document.getElementById('digchat-messages');
    if (!container) return;

    var empty = document.getElementById('digchat-empty');
    if (empty && messages.length > 0) empty.style.display = 'none';

    var typing = document.getElementById('digchat-typing');

    messages.forEach(function (msg) {
      // Ignora se já foi renderizado
      if (container.querySelector('[data-msg-id="' + msg.id + '"]')) return;

      // Remove optimistic se existir
      var opt = document.querySelector('[data-optimistic="' + escAttr(msg.body) + '"]');
      if (opt) opt.remove();

      var wrap = document.createElement('div');
      wrap.className = 'dcm ' + (msg.direction === 'out' ? 'dcm-in' : 'dcm-out');
      wrap.setAttribute('data-msg-id', msg.id);

      var bubble = document.createElement('div');
      bubble.className = 'dcm-bubble';

      if (msg.media_url && msg.direction === 'out') {
        var label = msg.filename || msg.body || 'Arquivo';
        var icon  = msg.type === 'image' ? '🖼️' : (msg.type === 'audio' ? '🎵' : '📄');
        var link  = document.createElement('a');
        link.href   = msg.media_url + '?session=' + encodeURIComponent(sessionToken || '');
        link.target = '_blank';
        link.rel    = 'noopener noreferrer';
        link.style.cssText = 'display:flex;align-items:center;gap:6px;color:inherit;text-decoration:none;font-weight:500;word-break:break-word;';
        link.textContent = icon + ' ' + label;
        bubble.appendChild(link);
        if (msg.body && msg.body !== '[document]' && msg.body !== '[image]' && msg.body !== '[audio]' && msg.body !== '[video]') {
          var cap = document.createElement('div');
          cap.style.cssText = 'margin-top:4px;font-size:12px;opacity:.8;';
          cap.textContent = msg.body;
          bubble.appendChild(cap);
        }
      } else {
        bubble.textContent = msg.body || '';
      }
      wrap.appendChild(bubble);

      // Botões (mensagem interativa do bot)
      if (msg.direction === 'out' && msg.buttons && msg.buttons.length > 0) {
        var btnGroup = document.createElement('div');
        btnGroup.className = 'dcm-buttons';
        msg.buttons.forEach(function (b) {
          var btnEl = document.createElement('button');
          btnEl.className = 'dcm-btn';
          btnEl.textContent = b.title;
          btnEl.setAttribute('data-btn-id', b.id);
          btnEl.addEventListener('click', function () { sendButton(b.id, b.title); });
          btnGroup.appendChild(btnEl);
        });
        wrap.appendChild(btnGroup);
      }

      // Lista (rows)
      if (msg.direction === 'out' && msg.rows && msg.rows.length > 0) {
        var rowGroup = document.createElement('div');
        rowGroup.className = 'dcm-buttons';
        msg.rows.forEach(function (r) {
          var rowEl = document.createElement('button');
          rowEl.className = 'dcm-btn';
          rowEl.textContent = r.title;
          if (r.description) {
            var desc = document.createElement('div');
            desc.style.cssText = 'font-size:11px;opacity:.7;font-weight:400;margin-top:2px;';
            desc.textContent = r.description;
            rowEl.appendChild(desc);
          }
          rowEl.setAttribute('data-btn-id', r.id);
          rowEl.addEventListener('click', function () { sendButton(r.id, r.title); });
          rowGroup.appendChild(rowEl);
        });
        wrap.appendChild(rowGroup);
      }

      var time = document.createElement('div');
      time.className = 'dcm-time';
      time.textContent = formatTime(msg.created_at);
      wrap.appendChild(time);

      container.insertBefore(wrap, typing);
    });

    scrollToBottom();
  }

  function addOptimisticMessage(text) {
    var container = document.getElementById('digchat-messages');
    if (!container) return;

    var empty = document.getElementById('digchat-empty');
    if (empty) empty.style.display = 'none';

    var wrap = document.createElement('div');
    wrap.className = 'dcm dcm-out';
    wrap.setAttribute('data-optimistic', text);

    var bubble = document.createElement('div');
    bubble.className = 'dcm-bubble sending';
    bubble.textContent = text;
    wrap.appendChild(bubble);

    var typing = document.getElementById('digchat-typing');
    container.insertBefore(wrap, typing);
    scrollToBottom();
  }

  function showTyping() {
    var t = document.getElementById('digchat-typing');
    if (t) t.style.display = 'flex';
    scrollToBottom();
  }

  function hideTyping() {
    var t = document.getElementById('digchat-typing');
    if (t) t.style.display = 'none';
  }

  function scrollToBottom() {
    var c = document.getElementById('digchat-messages');
    if (c) { c.scrollTop = c.scrollHeight; }
  }

  function showError(msg) {
    var c = document.getElementById('digchat-messages');
    if (!c) return;
    var el = document.createElement('div');
    el.style.cssText = 'text-align:center;color:#ef4444;font-size:12px;padding:8px;';
    el.textContent = msg;
    var typing = document.getElementById('digchat-typing');
    c.insertBefore(el, typing);
  }

  // ─── Input handlers ──────────────────────────────────────────────────────────
  function onInputChange() {
    var inp = document.getElementById('digchat-input');
    var btn = document.getElementById('digchat-send');
    if (!inp || !btn) return;
    btn.classList.toggle('ready', inp.value.trim().length > 0);
    // Auto-resize
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  function onSendClick() { doSend(); }

  function doSend() {
    var inp = document.getElementById('digchat-input');
    if (!inp) return;
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    inp.style.height = 'auto';
    onInputChange();
    sendText(text);
  }

  // ─── Badge / unread ──────────────────────────────────────────────────────────
  function incrementUnread(n) {
    unreadCount += (n || 1);
    updateBadge();
  }

  function resetUnread() {
    unreadCount = 0;
    updateBadge();
  }

  function updateBadge() {
    var badge = document.getElementById('digchat-badge');
    if (!badge) return;
    if (unreadCount > 0 && !isOpen) {
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ─── Utils ───────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/\n/g, ' ');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function boot() {
    injectStyles();
    buildUI();
    loadSession();
    loadName();
    // Se já tem sessão, começa polling silencioso para capturas de mensagens
    // enquanto o chat está fechado (ex.: mensagem proativa).
    // Optamos por não fazer polling com chat fechado para não sobrecarregar — inicia ao abrir.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
