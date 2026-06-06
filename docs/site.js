(function () {
  const file = location.pathname.split('/').pop() || 'index.html';
  const navMap = {
    'index.html': 'home',
    '': 'home',
    'user-guide.html': 'user-guide',
    'architecture.html': 'architecture',
  };
  const current = navMap[file];
  if (!current) return;
  document.querySelectorAll('[data-nav="' + current + '"]').forEach(function (el) {
    el.setAttribute('aria-current', 'page');
  });
})();
