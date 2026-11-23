// A local UI-only cache prevents a light flash before Chrome settings arrive.
try { document.documentElement.dataset.theme = localStorage.getItem('unifetch-theme') === 'dark' ? 'dark' : 'light'; }
catch { document.documentElement.dataset.theme = 'light'; }
