(() => {
  const endpoint = 'https://stats.aeronav.space/api/ad';
  const send = (ad, type) => {
    const body = JSON.stringify({ ad, type });
    if (navigator.sendBeacon && navigator.sendBeacon(endpoint, body)) return;
    fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {});
  };

  document.querySelectorAll('[data-ad]').forEach((el) => {
    const ad = el.dataset.ad;
    let timer = null;
    let seen = false;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !timer && !document.hidden) {
          timer = setTimeout(() => {
            seen = true;
            observer.disconnect();
            send(ad, 'view');
          }, 1000);
        } else if (!visible && timer) {
          clearTimeout(timer);
          timer = null;
        }
      }, { threshold: 0.5 });
      observer.observe(el);
    }

    const onClick = (e) => {
      if (!e.target.closest('a')) return;
      if (e.type === 'auxclick' && e.button !== 1) return;
      if (!seen) {
        seen = true;
        send(ad, 'view');
      }
      send(ad, 'click');
    };
    el.addEventListener('click', onClick);
    el.addEventListener('auxclick', onClick);
  });
})();
