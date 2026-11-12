(function () {
    var img = document.getElementById('plateImg');
    var plate = document.getElementById('heroPlate');
    if (!img || !plate) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var BANDS = [
        '0 0 0 93%',
        '5.2% 63.9% 85.7% 3.7%',
        '14.3% 63.9% 74.1% 3.7%',
        '25.9% 63.9% 47% 3.7%',
        '53% 63.9% 39.8% 3.7%',
        '0 6.8% 0 36.1%',
        '60.2% 63.9% 0 0'
    ];
    var STAGGER = 220;
    var BAND_MS = 450;

    var layer = null;
    var finished = false;
    var errors = 0;

    plate.classList.add('building');

    function finish() {
        if (finished) return;
        finished = true;
        plate.classList.add('settling');
        plate.classList.remove('building');
        if (layer) layer.classList.add('done');
        setTimeout(function () {
            plate.classList.remove('settling');
            if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
        }, 950);
    }

    function run() {
        layer = document.createElement('div');
        layer.className = 'plate-build';
        layer.setAttribute('aria-hidden', 'true');
        var src = img.currentSrc || img.src;
        var cors = img.getAttribute('crossorigin');
        BANDS.forEach(function (inset, i) {
            var band = document.createElement('img');
            if (cors !== null) band.crossOrigin = cors;
            band.referrerPolicy = 'no-referrer';
            band.alt = '';
            band.src = src;
            band.style.clipPath = 'inset(' + inset + ')';
            band.style.animationDelay = i * STAGGER + 'ms';
            layer.appendChild(band);
        });
        plate.appendChild(layer);
        setTimeout(finish, (BANDS.length - 1) * STAGGER + BAND_MS + 150);
    }

    if (img.complete && img.naturalWidth) run();
    else {
        img.addEventListener('load', run, { once: true });
        img.addEventListener('error', function () {
            if (++errors > 1) finish();
        });
    }
    setTimeout(function () {
        if (!layer) finish();
    }, 10000);
})();
