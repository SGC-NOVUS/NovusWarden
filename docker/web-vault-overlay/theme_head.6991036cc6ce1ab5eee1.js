(()=>{
  const root = document.documentElement;
  function getTheme() {
    const saved = localStorage.getItem('novus_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme) {
    if (theme === 'dark') {
      root.classList.remove('theme_light');
      root.classList.add('theme_dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('theme_dark');
      root.classList.add('theme_light');
      root.setAttribute('data-theme', 'light');
    }
  }
  applyTheme(getTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const saved = localStorage.getItem('novus_theme') || 'system';
      if (saved === 'system') {
        applyTheme(getTheme());
      }
    });
  }
})();
