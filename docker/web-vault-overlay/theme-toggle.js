(()=>{
  function initThemeToggle() {
    if (document.getElementById('novus-theme-toggle')) return;
    
    const root = document.documentElement;
    const body = document.body;
    const modes = ['system', 'dark', 'light'];
    const icons = { system: '🖥️', dark: '🌙', light: '☀️' };
    const labels = {
      ru: { system: 'Система', dark: 'Тёмная', light: 'Светлая' },
      en: { system: 'System', dark: 'Dark', light: 'Light' },
      uk: { system: 'Система', dark: 'Темна', light: 'Світла' },
    };

    const lang = (navigator.language || 'ru').slice(0, 2);
    const loc = labels[lang] || labels.ru;

    function getSavedMode() {
      return localStorage.getItem('novus_theme') || 'system';
    }

    let isApplying = false;

    function apply(mode) {
      isApplying = true;
      const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        root.classList.remove('theme_light');
        root.classList.add('theme_dark');
        root.setAttribute('data-theme', 'dark');
        if (body) {
          body.classList.remove('theme_light');
          body.classList.add('theme_dark');
          body.setAttribute('data-theme', 'dark');
        }
      } else {
        root.classList.remove('theme_dark');
        root.classList.add('theme_light');
        root.setAttribute('data-theme', 'light');
        if (body) {
          body.classList.remove('theme_dark');
          body.classList.add('theme_light');
          body.setAttribute('data-theme', 'light');
        }
      }
      updateBtn(mode);
      setTimeout(() => { isApplying = false; }, 50);
    }

    const btn = document.createElement('div');
    btn.id = 'novus-theme-toggle';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Theme switcher');
    btn.style.cssText = `
      position: fixed;
      top: 14px;
      right: 20px;
      z-index: 10000;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    `;

    function updateBtn(mode) {
      const isDark = root.classList.contains('theme_dark') || root.getAttribute('data-theme') === 'dark';
      if (isDark) {
        btn.style.background = 'rgba(15, 23, 42, 0.8)';
        btn.style.backdropFilter = 'blur(12px)';
        btn.style.webkitBackdropFilter = 'blur(12px)';
        btn.style.border = '1px solid rgba(56, 189, 248, 0.35)';
        btn.style.color = '#e2e8f0';
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.9)';
        btn.style.backdropFilter = 'blur(12px)';
        btn.style.webkitBackdropFilter = 'blur(12px)';
        btn.style.border = '1px solid rgba(2, 132, 199, 0.3)';
        btn.style.color = '#0f172a';
      }
      btn.innerHTML = `<span style="font-size: 13px; line-height: 1;">${icons[mode]}</span><span>${loc[mode]}</span>`;
      btn.title = `Текущая тема: ${loc[mode]} (нажмите для переключения)`;
    }

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-1px)';
      const isDark = root.classList.contains('theme_dark');
      btn.style.borderColor = isDark ? '#38bdf8' : '#0284c7';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'none';
      const isDark = root.classList.contains('theme_dark');
      btn.style.borderColor = isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.3)';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = getSavedMode();
      const nextIdx = (modes.indexOf(cur) + 1) % modes.length;
      const nextMode = modes[nextIdx];
      localStorage.setItem('novus_theme', nextMode);
      apply(nextMode);
    });

    apply(getSavedMode());
    (body || root).appendChild(btn);

    // Watch for any external code trying to revert root classes
    const observer = new MutationObserver(() => {
      if (isApplying) return;
      const saved = getSavedMode();
      const isDark = saved === 'dark' || (saved === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const expectedClass = isDark ? 'theme_dark' : 'theme_light';
      if (!root.classList.contains(expectedClass)) {
        apply(saved);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getSavedMode() === 'system') {
          apply('system');
        }
      });
    }

    // Dynamic brand text scrubbing for cached i18n
    function scrubBrand() {
      if (!document.body) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && (node.nodeValue.includes('Bitwarden') || node.nodeValue.includes('Vaultwarden'))) {
          node.nodeValue = node.nodeValue
            .replace(/Bitwarden/g, 'NovusWarden')
            .replace(/Vaultwarden/g, 'NovusWarden');
        }
      }
    }
    scrubBrand();
    setInterval(scrubBrand, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
