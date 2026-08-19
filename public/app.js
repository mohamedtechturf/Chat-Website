(function () {
  const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = wsProto + '//' + location.host;
  let socket;
  let myName = null;
  let hasJoined = false;

  // detect touch devices
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

  // elements
  const overlay = document.getElementById('overlay');
  const usernameInput = document.getElementById('usernameInput');
  const joinBtn = document.getElementById('joinBtn');
  const joinError = document.getElementById('joinError');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsForm = document.getElementById('settingsForm');
  const settingsClose = document.getElementById('settingsClose');
  const currentUser = document.getElementById('currentUser');
  const usersList = document.getElementById('usersList');
  const messagesEl = document.getElementById('messages');
  const compose = document.getElementById('compose');
  const msgInput = document.getElementById('msg');
  const sendBtn = document.getElementById('sendBtn');
  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const clearFileBtn = document.getElementById('clearFileBtn');
  const typingEl = document.getElementById('typing');
  
  // Emoji & Sticker Picker elements
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiSearch = document.getElementById('emojiSearch');
  const emojiCategories = document.getElementById('emojiCategories');
  const stickersList = document.getElementById('stickersList');
  const emojiPickerClose = document.querySelector('.emoji-picker-close');
  
  let emojiData = null;
  let stickersData = [];
  let currentTheme = sessionStorage.getItem('chat-theme') || 'default';
  
  // Load emoji data and stickers on page load
  async function loadEmojiData() {
    try {
      const response = await fetch('/database/emojis.json');
      if (response.ok) {
        emojiData = await response.json();
        renderEmojiPicker();
      }
    } catch (err) {
      console.error('Failed to load emoji data:', err);
    }
  }
  
  async function loadStickers() {
    try {
      const response = await fetch('/api/stickers');
      if (response.ok) {
        const data = await response.json();
        stickersData = data.stickers || [];
        renderStickersList();
      }
    } catch (err) {
      console.error('Failed to load stickers:', err);
    }
  }
  
  function renderEmojiPicker() {
    if (!emojiData) return;
    emojiCategories.innerHTML = '';
    
    const categories = emojiData.categories || {};
    for (const [catId, cat] of Object.entries(categories)) {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'emoji-category';
      
      const titleDiv = document.createElement('div');
      titleDiv.className = 'emoji-category-title';
      titleDiv.textContent = cat.label;
      categoryDiv.appendChild(titleDiv);
      
      const gridDiv = document.createElement('div');
      gridDiv.className = 'emoji-grid';
      
      (cat.emojis || []).forEach(emoji => {
        const emojiChar = emoji.char;
        const emojiName = emoji.name || '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-item';
        btn.textContent = emojiChar;
        btn.title = emojiName;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          insertEmoji(emojiChar);
        });
        gridDiv.appendChild(btn);
      });
      
      categoryDiv.appendChild(gridDiv);
      emojiCategories.appendChild(categoryDiv);
    }
  }
  
  function renderStickersList() {
    stickersList.innerHTML = '';
    
    if (stickersData.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'stickers-no-results';
      noResults.textContent = 'No stickers found';
      stickersList.appendChild(noResults);
      return;
    }
    
    stickersData.forEach(sticker => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sticker-item';
      btn.title = sticker.name;
      
      const img = document.createElement('img');
      img.src = sticker.url;
      img.alt = sticker.name;
      img.onerror = () => { btn.remove(); }; // Remove failed sticker images
      
      btn.appendChild(img);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        sendSticker(sticker);
      });
      
      stickersList.appendChild(btn);
    });
  }
  
  function insertEmoji(emoji) {
    msgInput.focus();
    const start = msgInput.selectionStart;
    const end = msgInput.selectionEnd;
    const text = msgInput.value;
    msgInput.value = text.substring(0, start) + emoji + text.substring(end);
    msgInput.selectionStart = msgInput.selectionEnd = start + emoji.length;
    autoResizeTextarea();
  }
  
  function sendSticker(sticker) {
    const replyTo = window.__replyTo || null;
    sendJSON({ type: 'sticker', stickerUrl: sticker.url, replyTo });
    closeEmojiPicker();
    window.__replyTo = null;
    hideReplyPreview();
  }
  
  function openEmojiPicker() {
    if (!emojiPicker || !emojiBtn) return;
    emojiPicker.classList.remove('hidden');
    
    // Position picker near the emoji button
    const btnRect = emojiBtn.getBoundingClientRect();
    const pickerWidth = 360;
    const pickerHeight = 500;
    const gap = 10;
    
    // Position above button if space available, otherwise below
    let top = btnRect.top - pickerHeight - gap;
    let left = btnRect.right - pickerWidth + 10;
    
    // Adjust if off-screen
    if (top < 10) {
      top = btnRect.bottom + gap;
    }
    if (left < 10) {
      left = 10;
    }
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 10;
    }
    
    emojiPicker.style.top = top + 'px';
    emojiPicker.style.left = left + 'px';
    
    emojiSearch.focus();
    // Update emoji button with current theme emoji
    updateEmojiButtonIcon();
  }
  
  function closeEmojiPicker() {
    if (!emojiPicker) return;
    emojiPicker.classList.add('hidden');
    emojiSearch.value = '';
    renderEmojiPicker(); // Reset search
  }
  
  function updateEmojiButtonIcon() {
    if (!emojiBtn) return;
    const theme = sessionStorage.getItem('chat-theme') || 'default';
    const emojiFile = getEmojiForTheme(theme);
    emojiBtn.style.backgroundImage = `url('/images/emoji/${emojiFile}')`;
  }
  
  function getEmojiForTheme(theme) {
    const themeMap = {
      'default': 'default.webp',
      'pink': 'blossom.webp',
      'bloody': 'bloody_red.webp',
      'cyber': 'cyber_yellow.webp',
      'forest': 'green_forest.webp',
      'ultra': 'ultra_violet.webp',
      'titanium': 'titanium_white.webp',
      'marron-chestnut': 'marron_chestlnut.webp',
      'watch-dogs': 'watch_dogs.webp',
      'midnight-blue': 'midnight_blue.webp',
      'cotton-candy': 'cotton_candy.webp',
      'sandstorm': 'sandstorm.webp',
      'vintage': 'vintage.webp',
      'retro': 'retro.webp',
      'iceberg': 'iceberg.webp'
    };
    return themeMap[theme] || 'default.webp';
  }
  
  // Emoji search functionality
  emojiSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
      renderEmojiPicker();
      return;
    }
    
    emojiCategories.innerHTML = '';
    const gridDiv = document.createElement('div');
    gridDiv.className = 'emoji-grid';
    let found = 0;
    
    // Search through all categories and emojis
    if (emojiData && emojiData.categories) {
      for (const [catKey, cat] of Object.entries(emojiData.categories)) {
        for (const emoji of (cat.emojis || [])) {
          const emojiChar = emoji.char;
          const emojiName = emoji.name || '';
          const emojiTags = emoji.tags || [];
          
          // Check if query matches name or any tag
          const matchesName = emojiName.toLowerCase().includes(query);
          const matchesTags = emojiTags.some(tag => tag.toLowerCase().includes(query));
          
          if (matchesName || matchesTags) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-item';
            btn.textContent = emojiChar;
            btn.title = emojiName;
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              insertEmoji(emojiChar);
            });
            gridDiv.appendChild(btn);
            found++;
          }
        }
      }
    }
    
    if (found === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'emoji-item-no-results';
      noResults.textContent = 'No emojis found';
      gridDiv.appendChild(noResults);
    }
    
    emojiCategories.appendChild(gridDiv);
  });
  
  // Emoji picker tab switching
  document.querySelectorAll('.emoji-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = btn.dataset.tab;
      
      // Update active button
      document.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active tab
      document.querySelectorAll('.emoji-tab').forEach(tab => tab.classList.remove('active'));
      if (tabName === 'emojis') {
        document.getElementById('emojisTab').classList.add('active');
        // Show search for emojis
        emojiSearch.style.display = 'block';
      } else if (tabName === 'stickers') {
        document.getElementById('stickersTab').classList.add('active');
        // Hide search for stickers
        emojiSearch.style.display = 'none';
        emojiSearch.value = '';
      }
    });
  });
  
  // Emoji button state
  let emojiCycleIndex = 0;
  const emojiBatchArray = ['😀', '😂', '🤣', '😍', '😂', '😍', '🤔', '😎', '🎉', '🚀'];
  
  // Emoji button click - toggle picker and cycle emoji on mobile
  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (emojiPicker.classList.contains('hidden')) {
      openEmojiPicker();
    } else {
      closeEmojiPicker();
    }
    // Cycle emoji on click (mobile behavior)
    if (isTouchDevice) {
      cycleEmojiButtonEmoji();
    }
  });
  
  // Emoji button hover - cycle emoji on PC
  emojiBtn.addEventListener('mouseenter', (e) => {
    if (!isTouchDevice) {
      cycleEmojiButtonEmoji();
    }
  });
  
  function cycleEmojiButtonEmoji() {
    emojiBtn.textContent = emojiBatchArray[emojiCycleIndex % emojiBatchArray.length];
    emojiCycleIndex++;
  }
  
  // Close emoji picker button
  emojiPickerClose.addEventListener('click', (e) => {
    e.preventDefault();
    closeEmojiPicker();
  });
  
  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!emojiPicker.classList.contains('hidden')) {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        closeEmojiPicker();
      }
    }
  });
  
  // Close emoji picker on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !emojiPicker.classList.contains('hidden')) {
      closeEmojiPicker();
    }
  });
  
  // Drag and drop support for media files
  function handleDropFiles(files) {
    if (!files || !files.length) return;
    // Only handle first file for now (can be extended for multi-upload)
    fileInput.files = files;
    // Trigger change event
    const event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);
  }

  // Highlight compose area on dragover
  compose.addEventListener('dragover', (e) => {
    e.preventDefault();
    compose.classList.add('dragover');
  });
  compose.addEventListener('dragleave', (e) => {
    e.preventDefault();
    compose.classList.remove('dragover');
  });
  compose.addEventListener('drop', (e) => {
    e.preventDefault();
    compose.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  });

  // helper to show settings overlay and sync selected theme visuals
  function showSettingsOverlay(){
    if (settingsOverlay) settingsOverlay.classList.remove('hidden');
    // add animating class for staggered option entrance
    try{ settingsOverlay.classList.remove('closing'); settingsOverlay.classList.add('animating'); setTimeout(()=>settingsOverlay.classList.remove('animating'),520); }catch(e){}
    const cur = sessionStorage.getItem('chat-theme') || '';
    if (settingsForm){
      const el = settingsForm.querySelector('input[name=theme][value="' + cur + '"]');
      if (el) el.checked = true;
      // update visual selection
      const opts = settingsForm.querySelectorAll('.theme-option');
      opts.forEach(opt => opt.classList.remove('selected'));
      const checked = settingsForm.querySelector('input[name="theme"]:checked');
      if (checked){ const parent = checked.closest('.theme-option'); if (parent) parent.classList.add('selected'); }
    }
  }

  // add settings button to topbar (improve UI) if not present
  (function addSettingsButton(){
    try{
      const topbar = document.querySelector('.topbar');
      if (!topbar) return;
      let controls = topbar.querySelector('.controls');
      if (!controls){
        controls = document.createElement('div');
        controls.className = 'controls';
        topbar.appendChild(controls);
      }
      if (!document.getElementById('settingsBtn')){
        const btn = document.createElement('button');
        btn.id = 'settingsBtn';
        btn.className = 'btn icon';
        btn.type = 'button';
        btn.title = 'Settings';
        btn.innerHTML = '\u2699'; // simple gear
        controls.appendChild(btn);
      }
    }catch(e){/* ignore */}
  })();

  // Sidebar toggle & drag-to-collapse behavior
  (function sidebarToggleAndDrag(){
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    const toggle = document.getElementById('sidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !toggle) return;

    // create handle for dragging
    let handle = sidebar.querySelector('.sidebar-handle');
    if (!handle){
      handle = document.createElement('div');
      handle.className = 'sidebar-handle';
      sidebar.appendChild(handle);
    }

    const DESKTOP_WIDTH = sidebar.getBoundingClientRect().width || 220;
    let isCollapsed = false;
    let dragging = false;
    let startX = 0;
    let startWidth = DESKTOP_WIDTH;

    function setCollapsed(collapsed, skipBodyClass){
      isCollapsed = !!collapsed;
      const main = document.querySelector('.main');
      const isMobile = window.matchMedia('(max-width:600px)').matches;
      if (isCollapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '';
        if (main) main.classList.add('sidebar-collapsed');
        // hide mobile backdrop if present
        if (!skipBodyClass && isMobile && backdrop) backdrop.classList.remove('visible');
      } else {
        sidebar.classList.remove('collapsed');
        if (main) main.classList.remove('sidebar-collapsed');
        // only show backdrop on mobile (desktop doesn't need a backdrop)
        if (!skipBodyClass && isMobile && backdrop) backdrop.classList.add('visible');
      }
    }

  if (window.matchMedia('(max-width:600px)').matches) {
    setCollapsed(true, true);
  }

    // toggle click
    toggle.addEventListener('click', (e)=>{
      e.preventDefault();
      setCollapsed(!isCollapsed);
      // small focus management
      try{ toggle.focus(); }catch(e){}
    });

    // pointer-based dragging (works for mouse and touch via pointer events)
    handle.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      dragging = true;
      startX = ev.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      sidebar.style.transition = 'none';
      // capture pointer so we receive move/up even if pointer leaves handle
      handle.setPointerCapture(ev.pointerId);
    });

    function onPointerMove(ev){
      if (!dragging) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.max(0, startWidth + delta);
      sidebar.style.width = newWidth + 'px';
      // if newWidth is very small indicate collapsed
      if (newWidth < 24){
        sidebar.style.opacity = '0.2';
      } else {
        sidebar.style.opacity = '';
      }
    }

    function endDrag(ev){
      if (!dragging) return;
      dragging = false;
      try{ handle.releasePointerCapture(ev.pointerId); }catch(e){}
      sidebar.style.transition = '';
      const finalWidth = sidebar.getBoundingClientRect().width;
      if (finalWidth < (DESKTOP_WIDTH * 0.45)){
        // collapse fully
        setCollapsed(true);
      } else {
        // restore full size
        // restore and ensure no mobile backdrop toggled
        setCollapsed(false, true);
        sidebar.style.width = '';
      }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Close on backdrop click on mobile
    document.addEventListener('click', (e)=>{
      if (!(backdrop && backdrop.classList.contains('visible'))) return;
      if (sidebar.contains(e.target) || e.target === toggle) return;
      // clicked outside while sidebar is open -> collapse
      setCollapsed(true);
    });

    // initialize collapsed state for small screens: open on desktop, closed on mobile
    function refreshForViewport(){
      const isMobileNow = window.matchMedia('(max-width:600px)').matches;
      // recompute base width when viewport changes
      try{ startWidth = sidebar.getBoundingClientRect().width || DESKTOP_WIDTH; }catch(e){}
      if (isMobileNow){
        // mobile: start collapsed
        setCollapsed(true, true); // skip body class toggle here
      } else {
        // desktop: ensure open
        setCollapsed(false, true);
      }
    }
    window.addEventListener('resize', refreshForViewport);
    // run once on load
    refreshForViewport();
  })();

  // attach a click handler to the settings button (works whether created above or present in HTML)
  (function attachSettingsHandler(){
    try{
      const btn = document.getElementById('settingsBtn');
      if (!btn) return;
      if (btn.dataset.settingsAttached) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showSettingsOverlay();
      });
      btn.dataset.settingsAttached = '1';
    }catch(e){}
  })();

  // ensure send button has accessible label
  sendBtn.setAttribute('aria-label', 'Send message');

  // attach animation for attach button (visual feedback)
  try{
    const attachBtn = document.querySelector('.fileLabel');
      if (attachBtn){
      attachBtn.addEventListener('click', (e)=>{
        try{ attachBtn.classList.add('send-pulse'); setTimeout(()=>attachBtn.classList.remove('send-pulse'),540); }catch(e){}
      });
    }
  }catch(e){}

  function connectWs() {
    socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      if (myName) sendJSON({ type: 'join', username: myName });
    });

    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }

      if (msg.type === 'joined') {
        if (msg.success) {
          hasJoined = true;
          hideOverlay(overlay);
          joinError.textContent = '';
          currentUser.textContent = msg.username;
          myName = msg.username;
          loadEmojiData();
          loadStickers();
        } else {
          hasJoined = false;
          joinError.textContent = msg.reason || 'Join failed';
        }
        return;
      }

      if (!hasJoined) return;

      if (msg.type === 'userlist') renderUserList(msg.users || []);
      if (msg.type === 'typingUpdate') renderTyping(msg.users || []);
      if (msg.type === 'system') appendSystem(msg.text, msg.ts);
      if (msg.type === 'message') appendMessage(msg.from, msg.text, msg.ts, msg.id, { replyTo: msg.replyTo, edited: msg.edited, deleted: msg.deleted });
      if (msg.type === 'file') appendFile(msg.from, msg.filename, msg.mime, msg.data, msg.ts, msg.id, { text: msg.text, edited: msg.edited, deleted: msg.deleted, thumbnail: msg.thumbnail });
      if (msg.type === 'sticker') appendSticker(msg.from, msg.stickerUrl, msg.ts, msg.id, { replyTo: msg.replyTo, deleted: msg.deleted });
      if (msg.type === 'edit') handleRemoteEdit(msg.id, msg.text, msg.ts, msg.fileEdit);
      if (msg.type === 'delete') handleRemoteDelete(msg.id, msg.ts);
      if (msg.type === 'left') appendSystem(`${msg.username} left`, msg.ts);
    });

    socket.addEventListener('close', () => {
      if (!hasJoined) {
        messagesEl.innerHTML = '';
        usersList.innerHTML = '';
        typingEl.textContent = '';
      }
      currentUser.textContent = 'Disconnected';
      setTimeout(() => connectWs(), 1200);
    });

    socket.addEventListener('error', () => {});
  }

  function sendJSON(obj) {
    if (obj.type !== 'join' && !hasJoined) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Use setTimeout to defer JSON.stringify to prevent blocking on large payloads
      // This allows the UI to remain responsive while stringify happens
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(obj));
        }
      }, 0);
    }
  }

  function renderUserList(users) {
    usersList.innerHTML = '';
    users.forEach((u) => {
      const li = document.createElement('li');
      // no avatar element by design (user requested removal of the colored box)
      const name = document.createElement('div');
      name.textContent = u;
      if (u === myName) name.style.fontWeight = '700';
      li.appendChild(name);
      usersList.appendChild(li);
    });
  }

  function appendSystem(text, ts) {
    const div = document.createElement('div');
    div.className = 'msg system msg--enter';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = new Date(ts || Date.now()).toLocaleTimeString();
    div.textContent = text;
    div.appendChild(meta);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Helper function to create reply teaser with thumbnail
  function createReplyTeaser(replyToId) {
    const r = document.createElement('div');
    r.className = 'reply-teaser';
    
    const original = messagesEl.querySelector(`[data-id="${replyToId}"]`);
    if (!original) return r;
    
    // Get author name
    let author = 'Unknown';
    const meta = original.querySelector('.meta');
    if (meta) {
      const metaText = meta.textContent;
      const parts = metaText.split(' • ');
      author = parts[0].trim() || 'Unknown';
    }
    
    // Create content wrapper
    const contentDiv = document.createElement('div');
    contentDiv.className = 'reply-content';
    
    const authorDiv = document.createElement('div');
    authorDiv.className = 'reply-author';
    
    // Check if self-reply
    if (author === myName) {
      // For self-reply, show time instead
      const timeStr = meta ? meta.textContent.split(' • ').slice(1).join(' • ') : 'Unknown time';
      authorDiv.textContent = timeStr;
    } else {
      authorDiv.textContent = `Reply to ${author}`;
    }
    contentDiv.appendChild(authorDiv);
    
    // Try to create thumbnail
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'reply-thumbnail';
    
    const stickerImg = original.querySelector('.sticker-content img');
    // For media files, find the actual media (not the hyperlink icon)
    const fileBlockMediaImg = original.querySelector('.file-block img:not([style*="width: 14px"])');
    const fileBlockVideo = original.querySelector('.file-block video');
    
    let hasThumbnail = false;
    
    if (stickerImg) {
      // Sticker thumbnail
      const stickerThumb = document.createElement('div');
      stickerThumb.className = 'sticker-thumb';
      const img = document.createElement('img');
      img.src = stickerImg.src;
      img.style.maxWidth = '90%';
      img.style.maxHeight = '90%';
      stickerThumb.appendChild(img);
      thumbDiv.appendChild(stickerThumb);
      hasThumbnail = true;
    } else if (fileBlockMediaImg && fileBlockMediaImg.src && !fileBlockMediaImg.src.includes('/images/')) {
      // Image thumbnail - make sure it's not an icon
      const img = document.createElement('img');
      img.src = fileBlockMediaImg.src;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'contain';
      thumbDiv.appendChild(img);
      hasThumbnail = true;
    } else if (fileBlockVideo) {
      // Video thumbnail - use the video element
      const video = document.createElement('video');
      video.src = fileBlockVideo.src;
      if (fileBlockVideo.poster) {
        video.poster = fileBlockVideo.poster;
      }
      thumbDiv.appendChild(video);
      hasThumbnail = true;
    }
    
    // Add author line first
    r.appendChild(authorDiv);
    
    // Then add thumbnail and excerpt if available
    if (hasThumbnail) {
      r.appendChild(thumbDiv);
    }
    
    // Get excerpt from original message
    const excerptDiv = document.createElement('div');
    excerptDiv.className = 'reply-excerpt';
    const textContent = original.querySelector('.text-content');
    if (textContent) {
      excerptDiv.textContent = textContent.textContent.substring(0, 60) + (textContent.textContent.length > 60 ? '...' : '');
    }
    if (excerptDiv.textContent) {
      r.appendChild(excerptDiv);
    }
    
    // Make reply teaser clickable
    try{
      r.style.cursor = 'pointer';
      r.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const dot = document.createElement('span');
        dot.className = 'reply-click-dot';
        r.appendChild(dot);
        try{
          const rect = r.getBoundingClientRect();
          const x = (ev.clientX || (ev.touches && ev.touches[0] && ev.touches[0].clientX)) - rect.left;
          const y = (ev.clientY || (ev.touches && ev.touches[0] && ev.touches[0].clientY)) - rect.top;
          dot.style.left = x + 'px';
          dot.style.top = y + 'px';
        }catch(e){}
        requestAnimationFrame(()=> dot.classList.add('active'));
        if (original){
          try{
            const rect = original.getBoundingClientRect();
            const elCenter = (rect.top + rect.bottom) / 2;
            const centerY = window.innerHeight / 2;
            const distance = Math.abs(elCenter - centerY);
            const CLOSE_THRESHOLD = 240;
            const MID_THRESHOLD = 1000;
            const SHORT_DELAY = 60;
            const POST_SCROLL_DELAY = 250;
            if (distance <= CLOSE_THRESHOLD) {
              try{ original.scrollIntoView({ behavior: 'auto', block: 'center' }); }catch(e){}
              setTimeout(()=>{
                try{ original.classList.add('reply-scroll-target'); }catch(e){}
                setTimeout(()=>{ try{ original.classList.remove('reply-scroll-target'); }catch(e){} }, 900);
              }, SHORT_DELAY);
            } else if (distance <= MID_THRESHOLD) {
              const MID_MULT = 0.55;
              const MAX_MID = 700;
              const estimated = Math.min(MAX_MID, Math.round(distance * MID_MULT));
              try{ original.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(e){}
              setTimeout(()=>{
                try{ original.classList.add('reply-scroll-target'); }catch(e){}
                setTimeout(()=>{ try{ original.classList.remove('reply-scroll-target'); }catch(e){} }, 900);
              }, estimated + 80);
            } else {
              try{ original.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(e){}
              waitForElementCentered(original, 1600).then(()=>{
                setTimeout(()=>{
                  try{ original.classList.add('reply-scroll-target'); }catch(e){}
                  setTimeout(()=>{ try{ original.classList.remove('reply-scroll-target'); }catch(e){} }, 900);
                }, POST_SCROLL_DELAY);
              });
            }
          }catch(e){
            try{ original.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(_){}
            setTimeout(()=>{ try{ original.classList.add('reply-scroll-target'); }catch(e){}; setTimeout(()=>{ try{ original.classList.remove('reply-scroll-target'); }catch(e){} },900); }, 200);
          }
        }
        dot.addEventListener('animationend', ()=>{ try{ dot.remove(); }catch(e){} });
        setTimeout(()=>{ if (dot.parentNode) dot.remove(); }, 1200);
      });
    }catch(e){}
    
    return r;
  }

  // Wait until an element is approximately centered in the viewport (used to wait for smooth scroll)
  // Wait until an element is approximately centered in the viewport AND scrolling has finished.
  // Uses the messages scroller's 'scroll' events to detect when the smooth-scroll animation has ended.
  function waitForElementCentered(el, timeout = 1200, idle = 120) {
    return new Promise((resolve) => {
      const start = Date.now();
      let lastScroll = Date.now();
      const scroller = (typeof messagesEl !== 'undefined' && messagesEl) ? messagesEl : window;

      function onScroll() { lastScroll = Date.now(); }
      try { scroller.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {}

      function cleanup() {
        try { scroller.removeEventListener('scroll', onScroll); } catch (e) {}
      }

      function check() {
        try {
          const rect = el.getBoundingClientRect();
          const centerY = window.innerHeight / 2;
          const elCenter = (rect.top + rect.bottom) / 2;
          const centered = Math.abs(elCenter - centerY) < 48;
          const scrolledIdle = (Date.now() - lastScroll) > idle;
          if (centered && scrolledIdle) { cleanup(); return resolve(); }
        } catch (e) {
          cleanup(); return resolve();
        }
        if (Date.now() - start > timeout) { cleanup(); return resolve(); }
        requestAnimationFrame(check);
      }
      check();
    });
  }

  function appendMessage(from, text, ts, id, opts) {
    opts = opts || {};
    const div = document.createElement('div');
    div.className = 'msg' + (from === myName ? ' mine' : '');
    if (opts.deleted) div.classList.add('deleted');
    if (id) div.dataset.id = id;
    if (opts.replyTo) div.dataset.replyTo = opts.replyTo;
    const body = document.createElement('div');
    body.className = 'body';
    const meta = document.createElement('div');
    meta.className = 'meta';
    // Only show sender name for messages from others
    if (from === myName) {
      meta.textContent = formatTime(ts) + (opts.edited ? ' • edited' : '');
    } else {
      meta.textContent = `${from} • ${formatTime(ts)}` + (opts.edited ? ' • edited' : '');
    }

    // reply teaser - use helper function for consistency with thumbnails
    if (opts.replyTo) {
      const r = createReplyTeaser(opts.replyTo);
      body.appendChild(r);
    }

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = text;

    body.appendChild(meta);
    body.appendChild(content);
    div.appendChild(body);

    // actions button - only for non-deleted messages
    if (!opts.deleted) {
      const actions = document.createElement('button');
      actions.className = 'actions';
      actions.type = 'button';
      actions.title = 'Options';
      actions.innerHTML = '⋯';
      actions.addEventListener('click', (e)=>{ e.stopPropagation(); showContextMenu(e, { id, from, type: 'message', text }); });
      div.appendChild(actions);
    }

    div.classList.add('msg--enter');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    // remove enter class after animation to keep DOM tidy
    setTimeout(() => div.classList.remove('msg--enter'), 600);
  }

  async function appendFile(from, filename, mime, base64, ts, id, opts) {
    opts = opts || {};
    // Remove temporary uploading placeholder if this is from current user
    if (from === myName) {
      const tempMsg = messagesEl.querySelector('[data-temp="1"]');
      if (tempMsg) tempMsg.remove();
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'msg' + (from === myName ? ' mine' : '');
    if (opts.deleted) wrapper.classList.add('deleted');
    if (id) wrapper.dataset.id = id;
    if (opts.replyTo) wrapper.dataset.replyTo = opts.replyTo;
    const body = document.createElement('div');
    body.className = 'body';
    const meta = document.createElement('div');
    meta.className = 'meta';
    // Only show sender name for file messages from others
    if (from === myName) {
      meta.textContent = formatTime(ts) + (opts.edited ? ' • edited' : '');
    } else {
      meta.textContent = `${from} • ${formatTime(ts)}` + (opts.edited ? ' • edited' : '');
    }
    body.appendChild(meta);

    // reply teaser for file messages - use helper function for consistency with thumbnails
    if (opts.replyTo) {
      const r = createReplyTeaser(opts.replyTo);
      body.appendChild(r);
    }

    const lower = document.createElement('div');
    lower.className = 'file-block';
    lower.style.position = 'relative';

    let url = null;
    // Prefer data URL to avoid async delays - use blob conversion only if file is large
    const dataUrl = 'data:' + (mime || 'application/octet-stream') + ';base64,' + base64;
    url = dataUrl;

    // Check if we have a thumbnail (for videos/images)
    const hasThumbnail = opts.thumbnail && opts.thumbnail.length > 0;

    // Create open button for media files (positioned at top-right)
    const openBtn = document.createElement('button');
    openBtn.className = 'media-open-btn';
    openBtn.type = 'button';
    
    // Create img element for hyperlink icon
    const linkIcon = document.createElement('img');
    linkIcon.src = '/images/hyperlink.png';
    linkIcon.style.width = '14px';
    linkIcon.style.height = '14px';
    linkIcon.style.opacity = '0';
    linkIcon.style.transition = 'opacity 0.2s ease';
    linkIcon.style.pointerEvents = 'none';
    openBtn.appendChild(linkIcon);
    
    openBtn.title = 'Open in new tab';
    openBtn.style.position = 'absolute';
    openBtn.style.top = '6px';
    openBtn.style.right = '6px';
    openBtn.style.zIndex = '10';
    openBtn.style.background = 'transparent';
    openBtn.style.border = 'none';
    openBtn.style.cursor = 'pointer';
    openBtn.style.display = 'flex';
    openBtn.style.alignItems = 'center';
    openBtn.style.justifyContent = 'center';
    openBtn.style.width = '24px';
    openBtn.style.height = '24px';
    openBtn.style.padding = '0';
    openBtn.style.margin = '0';
    
    // Show/hide icon on hover of the media file container
    const showIcon = () => {
      linkIcon.style.opacity = '1';
    };
    const hideIcon = () => {
      linkIcon.style.opacity = '0';
    };
    
    // Add listeners to the container so button shows on media hover
    lower.addEventListener('mouseenter', showIcon);
    lower.addEventListener('mouseleave', hideIcon);
    openBtn.addEventListener('focus', showIcon);
    openBtn.addEventListener('blur', hideIcon);
    
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Convert data URL to blob and open it
      try {
        const byteString = atob(base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mime || 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (err) {
        console.error('Error opening file:', err);
        // Fallback to data URL if blob creation fails
        window.open(url, '_blank');
      }
    });
    lower.appendChild(openBtn);

    if (mime.startsWith('image/')) {
      let thumbImg = null;
      if (hasThumbnail) {
        // Show low-quality thumbnail first, blurred
        thumbImg = document.createElement('img');
        thumbImg.src = 'data:image/jpeg;base64,' + opts.thumbnail;
        thumbImg.style.borderRadius = '8px';
        thumbImg.style.display = 'block';
        thumbImg.classList.add('maybe-blurred');
        thumbImg.style.objectFit = 'contain';
        lower.appendChild(thumbImg);
      }
      const img = document.createElement('img');
      img.src = url;
      img.style.borderRadius = '8px';
      img.classList.add('maybe-blurred');
      img.style.objectFit = 'contain';
      // Remove blur on load
      const onLoad = () => {
        img.classList.remove('maybe-blurred');
        if (thumbImg) thumbImg.remove();
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
      const onError = () => {
        img.classList.remove('maybe-blurred');
        if (thumbImg) thumbImg.remove();
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      lower.appendChild(img);
    } else if (mime.startsWith('video/')) {
      const mediaContainer = document.createElement('div');
      mediaContainer.style.position = 'relative';
      mediaContainer.style.display = 'inline-block';
      let thumbImg = null;
      if (hasThumbnail) {
        thumbImg = document.createElement('img');
        thumbImg.src = 'data:image/jpeg;base64,' + opts.thumbnail;
        thumbImg.style.borderRadius = '8px';
        thumbImg.style.display = 'block';
        thumbImg.classList.add('maybe-blurred');
        thumbImg.dataset.type = 'thumbnail';
        thumbImg.style.objectFit = 'contain';
        mediaContainer.appendChild(thumbImg);
      }
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.style.borderRadius = '8px';
      v.style.display = hasThumbnail ? 'none' : 'block';
      v.dataset.type = 'fullvideo';
      v.style.objectFit = 'contain';
      if (hasThumbnail) {
        v.classList.add('maybe-blurred');
      }
      const onLoadedMetadata = () => {
        if (hasThumbnail && thumbImg) {
          thumbImg.remove();
        }
        v.style.display = 'block';
        v.classList.remove('maybe-blurred');
        v.removeEventListener('loadedmetadata', onLoadedMetadata);
        v.removeEventListener('error', onError);
      };
      const onError = () => {
        v.style.display = 'block';
        v.classList.remove('maybe-blurred');
        if (thumbImg) thumbImg.remove();
        v.removeEventListener('loadedmetadata', onLoadedMetadata);
        v.removeEventListener('error', onError);
      };
      v.addEventListener('loadedmetadata', onLoadedMetadata);
      v.addEventListener('error', onError);
      mediaContainer.appendChild(v);
      lower.appendChild(mediaContainer);
    } else if (mime.startsWith('audio/')) {
      const a = document.createElement('audio');
      a.src = url;
      a.controls = true;
      lower.appendChild(a);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.textContent = `Download ${filename}`;
      if (loadingPlaceholder.parentNode) loadingPlaceholder.remove();
      lower.appendChild(a);
    }
    // Add optional caption text for file
    if (opts.text) {
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = opts.text;
      body.appendChild(lower);
      body.appendChild(content);
    } else {
      body.appendChild(lower);
    }
    // actions button - only for non-deleted messages
    if (!opts.deleted) {
      const actions = document.createElement('button');
      actions.className = 'actions';
      actions.type = 'button';
      actions.title = 'Options';
      actions.innerHTML = '⋯';
      actions.addEventListener('click', (e)=>{ e.stopPropagation(); showContextMenu(e, { id, from, type: 'file', filename, mime, text: opts.text }); });
      wrapper.appendChild(actions);
    }
    wrapper.appendChild(body);
    wrapper.classList.add('msg--enter');
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(() => wrapper.classList.remove('msg--enter'), 600);
  }

  // Append sticker message
  function appendSticker(from, stickerUrl, ts, id, opts) {
    opts = opts || {};
    const div = document.createElement('div');
    div.className = 'msg' + (from === myName ? ' mine' : '');
    if (opts.deleted) div.classList.add('deleted');
    if (id) div.dataset.id = id;
    if (opts.replyTo) div.dataset.replyTo = opts.replyTo;
    
    const body = document.createElement('div');
    body.className = 'body';
    
    // reply teaser for sticker - ADD BEFORE STICKER CONTENT
    if (opts.replyTo) {
      const r = createReplyTeaser(opts.replyTo);
      body.appendChild(r);
    }
    
    // Sticker image content
    const stickerContent = document.createElement('div');
    stickerContent.className = 'sticker-content';
    stickerContent.style.display = 'inline-block';
    stickerContent.style.maxWidth = '140px';
    stickerContent.style.maxHeight = '140px';
    
    const img = document.createElement('img');
    img.src = stickerUrl;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    stickerContent.appendChild(img);
    
    body.appendChild(stickerContent);
    
    const meta = document.createElement('div');
    meta.className = 'meta';
    // Only show sender name for stickers from others
    if (from === myName) {
      meta.textContent = formatTime(ts);
    } else {
      meta.textContent = `${from} • ${formatTime(ts)}`;
    }
    body.appendChild(meta);

    div.appendChild(body);

    // actions button - only for non-deleted messages
    // NOTE: No edit allowed for stickers, only reply and delete
    if (!opts.deleted) {
      const actions = document.createElement('button');
      actions.className = 'actions';
      actions.type = 'button';
      actions.title = 'Options';
      actions.innerHTML = '⋯';
      actions.addEventListener('click', (e)=>{ e.stopPropagation(); showContextMenu(e, { id, from, type: 'sticker', text: '(sticker)' }); });
      div.appendChild(actions);
    }

    div.classList.add('msg--enter');
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(() => div.classList.remove('msg--enter'), 600);
  }

  // render typing indicator for other users
  function renderTyping(users){
    if (!typingEl) return;
    // Filter out the current user from the typing list
    const otherUsers = (users || []).filter(u => u !== myName);
    if (!otherUsers || otherUsers.length === 0){ typingEl.textContent = ''; typingEl.style.display = 'none'; return; }
    typingEl.style.display = 'block';
    const count = otherUsers.length;
    
    // Build the user names part
    let usersText = '';
    if (count === 1) {
      usersText = `(${otherUsers[0]}) is typing`;
    } else if (count === 2) {
      usersText = `(${otherUsers[0]}, ${otherUsers[1]}) are typing`;
    } else if (count === 3) {
      usersText = `(${otherUsers[0]}, ${otherUsers[1]}, ${otherUsers[2]}) are typing`;
    } else {
      usersText = `(${count} people) are typing`;
    }
    
    // Create the typing indicator with animated dots (not text dots)
    typingEl.innerHTML = `<span class="typing-text">${usersText}</span><span class="typing-dots"><span></span><span></span><span></span></span>`;
  }

  // small helpers for avatar/color/time
  // Note: initials removed per request; avatars are color-only marks now.

  function colorFromName(name){
    // deterministic pastel palette from name hash
    let h = 0; for (let i=0;i<name.length;i++) h = name.charCodeAt(i) + ((h<<5)-h);
    const hue = Math.abs(h) % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 70%), hsl(${(hue+40)%360} 70% 60%))`;
  }

  function formatTime(ts){
    try{ const d = new Date(ts || Date.now()); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }catch(e){ return '' }
  }

  // Convert a base64 string to a Blob without blocking the main thread.
  // This decodes the base64 in chunks and yields back to the event loop between chunks.
  async function base64ToBlob(b64, mime) {
    if (!b64) return new Blob([], { type: mime });
    const chunkChars = 32768; // must be multiple of 4
    const byteArrays = [];
    for (let offset = 0; offset < b64.length; offset += chunkChars) {
      const slice = b64.slice(offset, offset + chunkChars);
      // decode this slice
      const byteChars = atob(slice);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
      // yield so the UI thread can handle user interactions
      await new Promise((r) => setTimeout(r, 0));
    }
    return new Blob(byteArrays, { type: mime });
  }

  // Helper: read the current message text from DOM (prevents stale captured variables)
  function getMessageTextById(id){
    try{
      if (!id) return '';
      const el = messagesEl.querySelector(`[data-id="${id}"]`);
      if (!el) return '';
      const content = el.querySelector('.content');
      return content ? content.textContent : '';
    }catch(e){ return ''; }
  }

  // Join flow
  function tryJoin(name) {
    if (!name || !name.trim()) {
      joinError.textContent = 'Please enter a username';
      return;
    }
    joinError.textContent = '';
    myName = name.trim().slice(0, 20);
    sendJSON({ type: 'join', username: myName });
  }

  joinBtn.addEventListener('click', () => tryJoin(usernameInput.value));
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin(usernameInput.value);
  });

  // message send (form submit)
  compose.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = msgInput.value.trim();
    if (!text) return;
    const replyTo = window.__replyTo || null;
    sendJSON({ type: 'message', text, replyTo });
    msgInput.value = '';
    autoResizeTextarea();
    window.__replyTo = null;
    hideReplyPreview();

    // keep focus on textarea so the keyboard remains open on phones
    focusAndKeepKeyboard();
  });

  // send button click behavior
  // on touch devices we try to avoid blurring the textarea so the keyboard stays
  sendBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // prevent synthetic mouse events and avoid blur
    handleSendAction();
  }, { passive: false });

  // also handle mouse click for non-touch devices
  sendBtn.addEventListener('click', (e) => {
    // prevent default form button behavior causing blur
    e.preventDefault();
    handleSendAction();
  });

  function handleSendAction() {
    const text = msgInput.value.trim();
    if (!text) {
      // if there's a pending file, allow sending it without text
      if (pendingFile) {
        const fileToSend = pendingFile;
        showUploadingPlaceholder(fileToSend);
        // Clear UI immediately so user can send other messages
        pendingFile = null;
        preview.innerHTML = '';
        clearFileBtn.style.display = 'none';
        window.__replyTo = null;
        hideReplyPreview();
        focusAndKeepKeyboard();
        // IMPORTANT: Send file asynchronously WITHOUT waiting
        // This allows message input to be available immediately
        sendFile(fileToSend);
        return;
      }
      // keep focus even if empty
      focusAndKeepKeyboard();
      return;
    }

    // if pending file exists, send it together with text
    if (pendingFile) {
      const replyTo = window.__replyTo || null;
      const withText = Object.assign({}, pendingFile, { text, replyTo });
      const fileToSend = withText;
      showUploadingPlaceholder(fileToSend);
      // Clear UI immediately
      pendingFile = null;
      preview.innerHTML = '';
      clearFileBtn.style.display = 'none';
      msgInput.value = '';
      autoResizeTextarea();
      window.__replyTo = null;
      hideReplyPreview();
      focusAndKeepKeyboard();
      try{ sendJSON({ type: 'typing', typing: false }); lastTypingSent = false; }catch(e){}
      // IMPORTANT: Send file asynchronously WITHOUT waiting
      sendFile(fileToSend);
      return;
    }

    const replyTo = window.__replyTo || null;
    sendJSON({ type: 'message', text, replyTo });
    // stop typing state when message sent
    try{ sendJSON({ type: 'typing', typing: false }); lastTypingSent = false; }catch(e){}
    msgInput.value = '';
    autoResizeTextarea();
    window.__replyTo = null;
    hideReplyPreview();
    focusAndKeepKeyboard();
    // small visual feedback on send
    try{ sendBtn.classList.add('send-pulse'); setTimeout(()=>sendBtn.classList.remove('send-pulse'),540); }catch(e){}
  }

  // helpers to keep keyboard open or quickly refocus
  function focusAndKeepKeyboard() {
    // Save selection, refocus and restore caret to end
    try {
      msgInput.focus({ preventScroll: true });
      const len = msgInput.value.length;
      msgInput.setSelectionRange(len, len);
      // On some Android browsers a small delay helps keep the keyboard visible
      setTimeout(() => {
        msgInput.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }, 50);
    } catch (e) {
      // fallback
      msgInput.focus();
    }
  }

  // Make Enter do send on PC (non-touch). Shift+Enter inserts newline.
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (!isTouchDevice && !e.shiftKey) {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text) {
          return;
        }
        const replyTo = window.__replyTo || null;
        // if pending file exists, send it together with text
        if (pendingFile) {
          const withText = Object.assign({}, pendingFile, { text, replyTo });
          const fileToSend = withText;
          showUploadingPlaceholder(fileToSend);
          // Clear UI immediately
          pendingFile = null;
          preview.innerHTML = '';
          clearFileBtn.style.display = 'none';
          msgInput.value = '';
          autoResizeTextarea();
          window.__replyTo = null;
          hideReplyPreview();
          // IMPORTANT: Send file asynchronously WITHOUT waiting
          sendFile(fileToSend);
        } else {
          sendJSON({ type: 'message', text, replyTo });
          msgInput.value = '';
          autoResizeTextarea();
          window.__replyTo = null;
          hideReplyPreview();
        }
      }
    }
  });

  // file input with preview
  let pendingFile = null;
  let typingTimeout = null;
  let lastTypingSent = false;
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    preview.innerHTML = '';
    pendingFile = null;
    if (!file) return;

    // File size check (synchronous, quick)
    if (file.size > 50 * 1024 * 1024) {
      const p = document.createElement('div');
      p.className = 'info';
      p.textContent = 'File too large (max 50 MB)';
      preview.appendChild(p);
      fileInput.value = '';
      // Auto-clear error after 4 seconds
      setTimeout(() => {
        if (preview.contains(p)) preview.removeChild(p);
      }, 4000);
      return;
    }

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    preview.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'info';
    info.textContent = `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    preview.appendChild(info);

    let thumbnail = null;

    // Show preview immediately
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.addEventListener('load', () => img.classList.add('loaded'));
      thumb.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.src = URL.createObjectURL(file);
      v.muted = true;
      v.autoplay = false;
      v.controls = true;
      v.addEventListener('loadeddata', () => v.classList.add('loaded'));
      thumb.appendChild(v);
      // Generate thumbnail in background (non-blocking)
      generateVideoThumbnail(file).then(t => { thumbnail = t; }).catch(() => {});
    } else if (file.type.startsWith('audio/')) {
      const a = document.createElement('audio');
      a.src = URL.createObjectURL(file);
      a.controls = true;
      a.addEventListener('loadeddata', () => a.classList.add('loaded'));
      thumb.appendChild(a);
    } else {
      thumb.textContent = 'File';
    }

    // Start validation and base64 conversion in background (non-blocking)
    // This allows UI to be responsive immediately
    validateAndConvertFile(file, thumbnail);
    
    // Return to UI immediately without awaiting validation
    fileInput.value = '';
    clearFileBtn.style.display = 'flex';
    focusAndKeepKeyboard();
  });

  // Clear attached file button handler
  clearFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    preview.innerHTML = '';
    clearFileBtn.style.display = 'none';
    pendingFile = null;
    fileInput.value = '';
  });

  async function validateAndConvertFile(file, thumbnail) {
    // Corrupted/empty PNG/GIF check (100% transparent or empty images)
    if (file.type === 'image/png' || file.type === 'image/gif') {
      try {
        const img = new window.Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Create canvas to check transparency
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, img.width, img.height).data;
            let allTransparent = true;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] !== 0) { allTransparent = false; break; }
            }
            if (allTransparent && img.width * img.height > 0) {
              reject(new Error('Image is 100% transparent and has no visible content.'));
            } else {
              resolve();
            }
          };
          img.onerror = () => reject(new Error('Corrupted or unreadable image.'));
        });
      } catch (err) {
        // Clear the preview and show error
        preview.innerHTML = '';
        clearFileBtn.style.display = 'none';
        const p = document.createElement('div');
        p.className = 'info';
        p.textContent = 'This PNG/GIF file is empty, 100% transparent, or corrupted and cannot be sent.';
        preview.appendChild(p);
        pendingFile = null;
        // Auto-clear error after 4 seconds
        setTimeout(() => {
          if (preview.contains(p)) preview.removeChild(p);
        }, 4000);
        return;
      }
    }

    // Corrupted audio file check (try to load audio and check for error)
    if (file.type.startsWith('audio/')) {
      try {
        await new Promise((resolve, reject) => {
          const audio = document.createElement('audio');
          audio.preload = 'metadata';
          audio.src = URL.createObjectURL(file);
          audio.addEventListener('loadedmetadata', () => {
            if (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0) {
              reject(new Error('Audio file is corrupted or empty.'));
            } else {
              resolve();
            }
          });
          audio.onerror = () => reject(new Error('Audio file is corrupted or unreadable.'));
        });
      } catch (err) {
        preview.innerHTML = '';
        clearFileBtn.style.display = 'none';
        const p = document.createElement('div');
        p.className = 'info';
        p.textContent = 'This audio file is corrupted, empty, or unreadable and cannot be sent.';
        preview.appendChild(p);
        pendingFile = null;
        // Auto-clear error after 4 seconds
        setTimeout(() => {
          if (preview.contains(p)) preview.removeChild(p);
        }, 4000);
        return;
      }
    }

    // General corrupted file check (try to read as data URL)
    let b64 = null;
    try {
      b64 = await fileToBase64(file);
    } catch (err) {
      preview.innerHTML = '';
      clearFileBtn.style.display = 'none';
      const p = document.createElement('div');
      p.className = 'info';
      p.textContent = 'This file appears to be corrupted or unreadable and cannot be sent.';
      preview.appendChild(p);
      pendingFile = null;
      // Auto-clear error after 4 seconds
      setTimeout(() => {
        if (preview.contains(p)) preview.removeChild(p);
      }, 4000);
      return;
    }

    // All validations passed - store the file and it's ready to send
    pendingFile = { filename: file.name, mime: file.type || 'application/octet-stream', b64, file, thumbnail };
  }

  // typing detection: notify server when user is typing; debounce stop
  function sendTyping(isTyping){
    try{
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      // avoid redundant sends
      if (isTyping === lastTypingSent) return;
      sendJSON({ type: 'typing', typing: !!isTyping });
      lastTypingSent = !!isTyping;
    }catch(e){}
  }

  msgInput.addEventListener('input', (e)=>{
    // existing resize
    autoResizeTextarea();
    const hasText = msgInput.value.trim().length > 0;
    if (hasText){
      sendTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(()=>{ sendTyping(false); lastTypingSent = false; }, 1200);
    } else {
      // empty -> send stop
      sendTyping(false);
      clearTimeout(typingTimeout);
      lastTypingSent = false;
    }
  });

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        const dataUrl = fr.result;
        const idx = dataUrl.indexOf(',');
        res(dataUrl.slice(idx + 1));
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // Generate a low-quality thumbnail for video files (0.5 sec preview, small size)
  function generateVideoThumbnail(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.currentTime = 0.5; // 0.5 seconds into video
      video.muted = true;

      const onCanPlay = () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        const canvas = document.createElement('canvas');
        canvas.width = 160; // small thumbnail width
        canvas.height = 90; // 16:9 aspect ratio
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = reader.result.split(',')[1];
            resolve(b64);
          };
          reader.readAsDataURL(blob);
          URL.revokeObjectURL(video.src);
        }, 'image/jpeg', 0.6); // 60% quality for small file size
      };

      const onError = () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
        URL.revokeObjectURL(video.src);
        resolve(null); // no thumbnail available
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }

  // Split file into chunks for efficient transmission
  function splitFileIntoChunks(base64Str, chunkSize = 65536) { // 64KB chunks
    const chunks = [];
    for (let i = 0; i < base64Str.length; i += chunkSize) {
      chunks.push(base64Str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  function sendFile(obj) {
    if (!obj) return;
    
    // If b64 is already available, send immediately
    if (obj.b64) {
      sendJSON({ 
        type: 'file', 
        filename: obj.filename, 
        mime: obj.mime, 
        data: obj.b64, 
        text: obj.text || '', 
        thumbnail: obj.thumbnail || '',
        replyTo: obj.replyTo || null
      });
      return;
    }
    
    // If b64Promise is pending, wait for it in background (non-blocking)
    if (obj.b64Promise) {
      obj.b64Promise.then(b64 => {
        sendJSON({ 
          type: 'file', 
          filename: obj.filename, 
          mime: obj.mime, 
          data: b64, 
          text: obj.text || '', 
          thumbnail: obj.thumbnail || '',
          replyTo: obj.replyTo || null
        });
      }).catch(err => {
        console.error('Failed to convert file to base64:', err);
      });
    }
  }

  // utilities
  function autoResizeTextarea() {
    msgInput.style.height = 'auto';
    msgInput.style.height = msgInput.scrollHeight + 'px';
  }
  msgInput.addEventListener('input', autoResizeTextarea);

  // reply preview UI above textarea
  function showReplyPreview(item){
    try{
      window.__replyTo = item && item.id ? item.id : null;
      let el = document.getElementById('replyPreview');
      if (!el){
        el = document.createElement('div');
        el.id = 'replyPreview';
        el.className = 'reply-preview';
        el.innerHTML = '<div class="reply-body"><strong class="reply-author"></strong><div class="reply-text"></div></div>';
        const btn = document.createElement('button');
        btn.id = 'cancelReply';
        btn.className = 'btn';
        btn.type = 'button';
        btn.textContent = '✕';
        el.appendChild(btn);
        compose.insertBefore(el, compose.firstChild);
        // Make the X button cancel the reply preview only (do not send)
        document.getElementById('cancelReply').addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){ }
          try{ window.__replyTo = null; }catch(_){ }
          try{ hideReplyPreview(); }catch(_){ }
        });
      }
      if (!item){ hideReplyPreview(); return; }
      el.querySelector('.reply-author').textContent = item.from || 'Unknown';
      el.querySelector('.reply-text').textContent = (item.type === 'file') ? (item.filename || 'Attachment') : (item.text || '');
      el.style.display = 'flex';
    }catch(e){}
  }
  function hideReplyPreview(){ const el = document.getElementById('replyPreview'); if (el) el.style.display='none'; }

  // show placeholder for upload while waiting for server broadcast
  function showUploadingPlaceholder(fileObj){
    const wrapper = document.createElement('div');
    wrapper.className = 'msg mine uploading';
    wrapper.dataset.temp = '1';
    const body = document.createElement('div'); body.className='body';
    const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `${myName} • Uploading...`;
    const content = document.createElement('div'); content.className='content'; content.textContent = fileObj.filename || 'Uploading...';
    body.appendChild(meta); body.appendChild(content); wrapper.appendChild(body);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // handle remote edit/delete events
  function handleRemoteEdit(id, text, ts, fileEdit){
    const el = messagesEl.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    // If fileEdit, only update the caption/quote for file messages
    if (fileEdit) {
      const body = el.querySelector('.body');
      if (!body) return;
      // Check if content element exists
      let content = body.querySelector('.content');
      if (!content) {
        // Create content element if it doesn't exist (original message had no caption)
        content = document.createElement('div');
        content.className = 'content';
        // Append to body after all other elements
        body.appendChild(content);
      }
      content.textContent = text;
      const meta = body.querySelector('.meta');
      if (meta && !meta.textContent.includes('edited')) meta.textContent = meta.textContent + ' • edited';
      return;
    }
    // Otherwise, normal edit for text message
    const content = el.querySelector('.content');
    if (content) content.textContent = text;
    const meta = el.querySelector('.meta');
    if (meta && !meta.textContent.includes('edited')) meta.textContent = meta.textContent + ' • edited';
  }
  function handleRemoteDelete(id, ts){
    const el = messagesEl.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    
    // Find and remove all reply teasers that reference this deleted message
    const allMessages = messagesEl.querySelectorAll('[data-id]');
    allMessages.forEach(msg => {
      const replyToId = msg.dataset.replyTo;
      if (replyToId === id) {
        const replyTeaser = msg.querySelector('.reply-teaser');
        if (replyTeaser) replyTeaser.remove();
      }
    });
    
    // Remove the file block if it exists
    const fileBlock = el.querySelector('.file-block');
    if (fileBlock) fileBlock.remove();
    
    // Remove the sticker content if it exists
    const stickerContent = el.querySelector('.sticker-content');
    if (stickerContent) stickerContent.remove();
    
    // Remove any reply teaser in this message (if it was replying to something)
    const replyTeaser = el.querySelector('.reply-teaser');
    if (replyTeaser) replyTeaser.remove();
    
    // Add/update the content text
    let content = el.querySelector('.content');
    if (!content) {
      content = document.createElement('div');
      content.className = 'content';
      const body = el.querySelector('.body');
      if (body) body.appendChild(content);
    }
    if (content) content.textContent = 'Message deleted';
    
    el.classList.add('deleted');
    // remove the actions button for deleted messages
    const actions = el.querySelector('.actions');
    if (actions) actions.remove();
  }

  // confirmation popup with action buttons (similar to username modal style)
  function showConfirmationMenu(title, message, actions) {
    // close existing
    const existing = document.getElementById('confirmMenu'); if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'confirmMenu';
    overlay.className = 'overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = title;
    modal.appendChild(titleEl);
    
    if (message) {
      const msgEl = document.createElement('p');
      msgEl.style.margin = '12px 0';
      msgEl.style.fontSize = '14px';
      msgEl.textContent = message;
      modal.appendChild(msgEl);
    }
    
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '8px';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.marginTop = '16px';
    
    let primaryBtn = null;
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (action.primary ? ' primary' : '');
      if (action.danger) btn.style.color = '#ff9b9b';
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        overlay.remove();
        if (action.callback) action.callback();
      });
      if (action.primary) primaryBtn = btn;
      buttonRow.appendChild(btn);
    });
    
    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.classList.add('animating');
    setTimeout(()=>overlay.classList.remove('animating'),520);
    
    // click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    
    // Enter key to confirm primary action
    document.addEventListener('keydown', function handleConfirmKey(e) {
      if (e.key === 'Enter' && overlay.parentElement) {
        e.preventDefault();
        if (primaryBtn) primaryBtn.click();
        document.removeEventListener('keydown', handleConfirmKey);
      }
    });
  }

  // context menu for message actions (edit/delete/reply/info)
  function showContextMenu(ev, msg){
    // close existing
    const existing = document.getElementById('ctxMenu'); if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.id = 'ctxMenu';
    menu.className = 'context-menu';
    const ul = document.createElement('div'); ul.className = 'context-list';

    // Reply (everyone)
    const replyBtn = document.createElement('button'); replyBtn.className='ctx'; replyBtn.textContent='Reply';
    replyBtn.addEventListener('click', ()=>{ document.body.removeChild(menu); showReplyPreview(msg); });
    ul.appendChild(replyBtn);

    // Edit (only owner and only for text messages or file messages with a caption)
    if (
      (msg.type === 'message' && msg.from === myName) ||
      (msg.type === 'file' && msg.from === myName)
    ) {
      // Always allow editing media caption, even if originally empty
      const editBtn = document.createElement('button'); editBtn.className='ctx'; editBtn.textContent='Edit';
      editBtn.addEventListener('click', ()=>{
        document.body.removeChild(menu);
        // For file, only edit the caption/quote
        let curText = '';
        if (msg.type === 'file') {
          // Try to get current caption from DOM
          const el = messagesEl.querySelector(`[data-id="${msg.id}"]`);
          const content = el ? el.querySelector('.content') : null;
          curText = content ? content.textContent : (msg.text || '');
        } else {
          curText = getMessageTextById(msg.id) || (msg.text || '');
        }
        showEditMenu(msg.id, curText, msg.type);
      });
      ul.appendChild(editBtn);
    }

    // Delete (only owner)
    if (msg.from === myName){
      const delBtn = document.createElement('button'); delBtn.className='ctx del'; delBtn.textContent='Delete';
      delBtn.addEventListener('click', ()=>{
        document.body.removeChild(menu);
        showConfirmationMenu('Delete Message', 'Are you sure you want to delete this message?', [
          { label: 'Cancel', callback: null },
          { label: 'Delete', primary: true, danger: true, callback: () => {
            sendJSON({ type: 'delete', id: msg.id });
          }}
        ]);
      });
      ul.appendChild(delBtn);
    }

    // close option
    const closeBtn = document.createElement('button'); closeBtn.className='ctx'; closeBtn.textContent='Close';
    closeBtn.addEventListener('click', ()=>{ try{ menu.remove(); }catch(e){} });
    ul.appendChild(closeBtn);

    menu.appendChild(ul);
    document.body.appendChild(menu);
    // position
    const x = ev.clientX || (ev.pageX || 100);
    const y = ev.clientY || (ev.pageY || 100);
    menu.style.left = (x + 6) + 'px';
    menu.style.top = (y + 6) + 'px';
    // click outside closes
    setTimeout(()=>{
      const onDoc = (e)=>{ if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', onDoc); } };
      document.addEventListener('click', onDoc);
    }, 10);
  }

  // edit menu popup
  function showEditMenu(id, currentText, msgType) {
    const existing = document.getElementById('editMenu'); if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'editMenu';
    overlay.className = 'overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'title';
    titleEl.textContent = (msgType === 'file') ? 'Edit Media Caption' : 'Edit Message';
    modal.appendChild(titleEl);
    
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = currentText;
    textarea.style.width = '100%';
    textarea.style.minHeight = '80px';
    textarea.style.padding = '10px';
    textarea.style.borderRadius = '8px';
    textarea.style.border = '1px solid rgba(255,255,255,0.03)';
    textarea.style.background = 'var(--input-bg)';
    textarea.style.color = 'inherit';
    textarea.style.fontSize = '14px';
    textarea.style.fontFamily = 'inherit';
    textarea.style.marginTop = '12px';
    textarea.style.resize = 'vertical';
    modal.appendChild(textarea);
    
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '8px';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.marginTop = '16px';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());
    buttonRow.appendChild(cancelBtn);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn primary';
    saveBtn.textContent = 'Save';
    const doSave = () => {
      const newText = textarea.value.trim();
      if (newText !== currentText) {
        // For file, only allow editing the caption/quote
        if (msgType === 'file') {
          sendJSON({ type: 'edit', id: id, text: newText, fileEdit: true });
        } else {
          sendJSON({ type: 'edit', id: id, text: newText });
        }
      }
      overlay.remove();
    };
    saveBtn.addEventListener('click', doSave);
    buttonRow.appendChild(saveBtn);
    
    modal.appendChild(buttonRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.classList.add('animating');
    setTimeout(()=>overlay.classList.remove('animating'),520);
    
    // click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    
    // Enter key to save, Escape to cancel
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        overlay.remove();
      }
    });
    
    // focus textarea for convenience
    textarea.focus();
  }

  updateEmojiButtonIcon();
  if (emojiBtn) {
    emojiBtn.textContent = emojiBatchArray[0];
  }

  connectWs();

  // show overlay on first open
  overlay.classList.remove('hidden');
  // animate join overlay entrance
  try{ overlay.classList.add('animating'); setTimeout(()=>overlay.classList.remove('animating'),520); }catch(e){}
  usernameInput.focus();

  // Theme handling: apply session theme if present
  function applyTheme(name){
    try{
      // add a transitional hint class so CSS can show a subtle animation
      try{ document.documentElement.classList.add('theme-changing'); }catch(e){}
      // use 'default' as explicit sentinel for clearing theme
      if (!name || name === 'default') {
        document.documentElement.removeAttribute('data-theme');
        sessionStorage.setItem('chat-theme', 'default');
        updateEmojiButtonIcon();
        colorizeIconButtons('default');
        // remove the transitional hint after animation (matches CSS theme flash duration)
        setTimeout(()=>{ try{ document.documentElement.classList.remove('theme-changing'); }catch(e){} }, 900);
        return;
      }
      // apply the theme attribute which updates CSS variables; CSS transitions will animate many surfaces
      document.documentElement.setAttribute('data-theme', name);
      sessionStorage.setItem('chat-theme', name);
      updateEmojiButtonIcon();
      colorizeIconButtons(name);
  // clear transition class after the animation window (matches CSS theme flash duration)
  setTimeout(()=>{ try{ document.documentElement.classList.remove('theme-changing'); }catch(e){} }, 900);
    }catch(e){}
  }

  function colorizeIconButtons(theme) {
    const themeColors = {
      'default': '#58d5c8',
      'pink': '#ff6ba6',
      'bloody': '#ff3333',
      'cyber': '#ffed4e',
      'forest': '#2dd4bf',
      'ultra': '#a78bfa',
      'titanium': '#0066ff',
      'marron-chestnut': '#d2691e',
      'watch-dogs': '#007AFF',
      'midnight-blue': '#5ba3f5',
      'cotton-candy': '#ff2d8f',
      'sandstorm': '#ff9800',
      'vintage': '#c97b0f',
      'retro': '#ff5733',
      'iceberg': '#0ea5e9'
    };
    
    const color = themeColors[theme] || '#58d5c8';
    const style = document.createElement('style');
    style.id = 'icon-button-colors';
    const existing = document.getElementById('icon-button-colors');
    if (existing) existing.remove();
    
    style.textContent = `
      #sendBtn {
        background-image: none !important;
        background-color: ${color};
        -webkit-mask-image: url('/images/send.png');
        mask-image: url('/images/send.png');
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
      }
      
      .fileLabel.icon-btn {
        background-image: none !important;
        background-color: ${color};
        -webkit-mask-image: url('/images/attach-file.png');
        mask-image: url('/images/attach-file.png');
        -webkit-mask-size: contain;
        mask-size: contain;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
      }
    `;
    document.head.appendChild(style);
  }

  // On load, apply previously selected theme for session
  (function initTheme(){
    const t = sessionStorage.getItem('chat-theme') || 'default';
    applyTheme(t);
  })();

  // Settings overlay handlers
  if (settingsForm){
    // helper to sync UI selection state
    function updateThemeSelectionUI(){
      const opts = settingsForm.querySelectorAll('.theme-option');
      opts.forEach(opt => opt.classList.remove('selected'));
      const checked = settingsForm.querySelector('input[name="theme"]:checked');
      if (checked){
        const parent = checked.closest('.theme-option');
        if (parent) parent.classList.add('selected');
      }
    }

    // click on the visual option should select the radio
    const themeOptions = settingsForm.querySelectorAll('.theme-option');
    themeOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        const radio = opt.querySelector('input[name="theme"]');
        if (radio){
          radio.checked = true;
          radio.dispatchEvent(new Event('change', {bubbles:true}));
        }
      });
    });

    // when a radio changes, update UI and apply theme after a short delay so selection animation can play
    const radios = settingsForm.querySelectorAll('input[name="theme"]');
    radios.forEach(r => r.addEventListener('change', () => {
      updateThemeSelectionUI();
      const v = settingsForm.querySelector('input[name="theme"]:checked');
      const val = v ? v.value : '';
      // delay application slightly to let selection animation start
      setTimeout(() => applyTheme(val), 120);
    }));

    // submit still closes the modal and ensures theme is stored
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = settingsForm.querySelector('input[name="theme"]:checked');
      const val = v ? v.value : '';
      applyTheme(val);
      if (settingsOverlay) hideOverlay(settingsOverlay);
    });

    // initialize selection visuals from session
    setTimeout(() => updateThemeSelectionUI(), 30);
  }
  if (settingsClose){
    settingsClose.addEventListener('click', () => {
      if (settingsOverlay) hideOverlay(settingsOverlay);
    });
  }

  // Helper to hide overlays with a closing animation
  function hideOverlay(el){
    if (!el) return;
    try{
      el.classList.remove('animating');
      el.classList.add('closing');
      setTimeout(()=>{
        el.classList.remove('closing');
        el.classList.add('hidden');
      }, 340);
    }catch(e){}
  }


  // keyboard accessibility: Esc to clear overlay if joined
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!overlay.classList.contains('hidden')) {
        usernameInput.value = '';
      }
    }
  });

})();