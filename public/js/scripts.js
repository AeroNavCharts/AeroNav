const leftSearch = document.getElementById('leftSearch');
const mobileSearch = document.getElementById('mobileSearch');
const listInner = document.getElementById('listInner');
const backBtn = document.getElementById('backBtn');
const categoryBar = document.getElementById('categoryBar');
const viewerFrame = document.getElementById('viewerFrame');
const chartWrap = document.querySelector('.iframe-wrap');
const scratchpad = new Scratchpad(chartWrap, { onChange: () => renderPinned() });
const zoomReadout = document.getElementById('zoomReadout');
const chartViewer = new ChartViewer(chartWrap, {
    onZoom: (percent) => {
        if (zoomReadout) zoomReadout.textContent = `${percent}%`;
    },
    onDrawMode: (on) => {
        const drawBtn = document.getElementById('drawBtn');
        if (!drawBtn) return;
        drawBtn.classList.toggle('active', on);
        drawBtn.setAttribute('aria-pressed', String(on));
    },
    onDocError: () => {
        if (currentChart && currentChart.link) showChartInFrame(currentChart.link);
    }
});
let chartLoadToken = 0;

function setViewerMode(mode) {
    chartWrap.classList.toggle('image-mode', mode === 'image');
    if (zoomReadout) zoomReadout.hidden = mode !== 'image';
    viewerFrame.hidden = mode === 'image';
}

function showChartInFrame(link) {
    chartViewer.hide();
    setViewerMode('frame');
    viewerFrame.src = toPreview(link) || 'about:blank';
}

viewerFrame.addEventListener('load', () => {
    if (!chartViewer.active) hideLoader();
});
let currentPadId = null;
const viewerLoading = document.getElementById('viewerLoading');
const viewerTitle = document.getElementById('viewerTitle');
const viewerSub = document.getElementById('viewerSub');
const pinnedRow = document.getElementById('pinnedRow');
const pinCurrentBtn = document.getElementById('pinCurrent');
const menuToggle = document.getElementById('menuToggle');
const mobileSearchToggle = document.getElementById('mobileSearchToggle');
const mobileSearchOverlay = document.getElementById('mobileSearchOverlay');
const leftCol = document.getElementById('leftCol');
const moreBtn = document.getElementById('moreBtn');
const controlsDropdown = document.getElementById('controlsDropdown');
const skeletonLoader = document.getElementById('skeletonLoader');
const emptyState = document.getElementById('emptyState');
const quickActionsBtn = document.getElementById('quickActionsBtn');
const quickActionsSheet = document.getElementById('quickActionsSheet');
const clearPinnedBtn = document.getElementById('clearPinned');
const panelTitle = document.getElementById('panelTitle');
const panelSub = document.getElementById('panelSub');
const panelName = document.getElementById('panelName');
const favBtn = document.getElementById('favBtn');
const railButtons = Array.from(document.querySelectorAll('.rail-btn[data-panel]'));
const panelViews = {
    airports: document.getElementById('viewAirports'),
    links: document.getElementById('viewLinks')
};

let searchTimeout = null;

let currentAirport = null;
let currentCategory = null;
let currentChart = null;
let pinned = [];
// new consts
const HOTLINKS = [];
const HOT_BY_KEY = new Map();
// end new consts 

// the rest u can figure out i dont feel like labeling anything else
// "if it works dont touch it" - wise man

function parseHashNumber() {
    const h = (location.hash || '').trim();
    if (!h) return null;
    const m = h.match(/^#?(\d+)$/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
}

function navigateByHash() {
    const n = parseHashNumber();
    if (!n) return;
    const cur = getHotId(currentChart);
    if (cur === n) return;
    openChartByHotId(n);
}

function buildHotlinks() {
    HOTLINKS.length = 0;
    HOT_BY_KEY.clear();
    let counter = 1;
    AIRPORTS.forEach((ap, ai) => {
        (ap.charts || []).forEach((c, ci) => {
            const entry = {
                hotId: counter,
                airportIndex: ai,
                chartIndex: ci,
                icao: ap.icao,
                id: c.id,
                title: c.title,
                category: c.category || '',
                link: c.link
            };
            HOTLINKS.push(entry);
            const key = `${ap.icao}||${c.id}`;
            HOT_BY_KEY.set(key, counter);
            counter++;
        });
    });
}

function getHotId(chartObj) {
    if (!chartObj) return null;
    const icao = chartObj.airportIcao || chartObj.icao;
    const id = chartObj.id;
    if (!icao || !id) return null;
    const key = `${icao}||${id}`;
    return HOT_BY_KEY.get(key) || null;
}

function openChartByHotId(n) {
    const idx = Number(n) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= HOTLINKS.length) return false;
    const ref = HOTLINKS[idx];
    openAirportView(ref.airportIndex);
    const chartObj = {
        airportIndex: ref.airportIndex,
        airportIcao: ref.icao,
        id: ref.id,
        title: ref.title,
        category: ref.category,
        link: ref.link
    };
    loadChartInViewer(chartObj, { fromPinned: false });
    if (window.innerWidth <= 900) closeMobileMenu();
    return true;
}


function showPanel(name) {
    Object.entries(panelViews).forEach(([key, el]) => {
        if (el) el.classList.toggle('active', key === name);
    });
    railButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.panel === name));
    if (leftCol) leftCol.classList.remove('collapsed');
    if (window.innerWidth <= 900 && leftCol) leftCol.classList.add('active');
}

function setPanelHeading(title, sub, name = '') {
    if (panelTitle) panelTitle.textContent = title;
    if (panelName) {
        panelName.textContent = name;
        panelName.hidden = !name;
    }
    if (panelSub) {
        panelSub.textContent = sub;
        panelSub.hidden = !sub;
    }
}

function loadFavorites() {
    try {
        const v = JSON.parse(localStorage.getItem('aeronav_favorites') || '[]');
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function isFavorite(icao) {
    return loadFavorites().includes(icao);
}

function toggleFavorite(icao) {
    const favs = loadFavorites();
    const next = favs.includes(icao) ? favs.filter(f => f !== icao) : [...favs, icao];
    localStorage.setItem('aeronav_favorites', JSON.stringify(next));
    return next.includes(icao);
}

function updateFavButton(airport) {
    if (!favBtn) return;
    favBtn.classList.toggle('hidden', !airport);
    if (!airport) return;
    const on = isFavorite(airport.icao);
    favBtn.classList.toggle('active', on);
    favBtn.setAttribute('aria-pressed', String(on));
    const label = on ? 'Remove from favorites' : 'Add to favorites';
    favBtn.title = label;
    favBtn.setAttribute('aria-label', label);
}

function playPinDrop(button) {
    button.classList.remove('pin-drop');
    void button.offsetWidth;
    button.classList.add('pin-drop');
}

function isPinned(icao, id) {
    return pinned.some(p => p.icao === icao && p.id === id);
}

function buildChartRow(chart, airport) {
    const cat = (chart.category || '').toUpperCase();
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.dataset.icao = airport.icao;
    row.dataset.id = chart.id;
    if (currentChart && currentChart.airportIcao === airport.icao && currentChart.id === chart.id) {
        row.classList.add('selected');
    }
    const main = document.createElement('div');
    main.className = 'chart-main';
    main.innerHTML = `<div class="chart-title">${eh(chart.title)}</div><div class="chart-id">${eh(chart.id)}</div>`;
    const pin = document.createElement('button');
    pin.className = 'chart-pin';
    pin.type = 'button';
    pin.setAttribute('aria-label', 'Pin chart');
    pin.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 13v8"/></svg>`;
    if (isPinned(airport.icao, chart.id)) pin.classList.add('pinned');
    const chartObj = {
        airportIndex: AIRPORTS.indexOf(airport),
        airportIcao: airport.icao,
        id: chart.id,
        title: chart.title,
        category: chart.category || '',
        link: chart.link
    };
    pin.addEventListener('click', e => {
        e.stopPropagation();
        if (isPinned(airport.icao, chart.id)) {
            unpin({ icao: airport.icao, id: chart.id });
        } else {
            pinChart(chartObj);
            pin.classList.add('pinned');
            playPinDrop(pin);
        }
    });
    row.appendChild(main);
    row.appendChild(pin);
    row.addEventListener('click', () => {
        document.querySelectorAll('.chart-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        loadChartInViewer(chartObj, { fromPinned: false });
        if (window.innerWidth <= 900) closeMobileMenu();
    });
    return row;
}

function toggleMobileMenu() {
    if (!leftCol || !menuToggle) return;
    const isActive = leftCol.classList.toggle('active');
    menuToggle.classList.toggle('active', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
}

function closeMobileMenu() {
    if (!leftCol || !menuToggle) return;
    leftCol.classList.remove('active');
    menuToggle.classList.remove('active');
    document.body.style.overflow = '';
}

function toggleMobileSearch() {
    if (!leftSearch) return;
    showPanel('airports');
    if (menuToggle) menuToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
    leftSearch.focus();
    leftSearch.select();
}

let listEnterTimer = null;

let panelPushTimer = null;
let panelGhost = null;

function endPanelPush() {
    clearTimeout(panelPushTimer);
    if (panelGhost) panelGhost.remove();
    panelGhost = null;
    const view = panelViews.airports;
    if (view) view.classList.remove('panel-push-in');
    if (leftCol) leftCol.classList.remove('pushing');
}

function pushPanel(direction, change) {
    const view = panelViews.airports;
    endPanelPush();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!view || !leftCol || still || !view.classList.contains('active') || !view.offsetWidth) {
        change();
        return;
    }
    const list = view.querySelector('.list');
    const scrolled = list ? list.scrollTop : 0;
    const ghost = view.cloneNode(true);
    ghost.classList.add('panel-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.dataset.push = direction;
    ghost.style.top = view.offsetTop + 'px';
    ghost.style.left = view.offsetLeft + 'px';
    ghost.style.width = view.offsetWidth + 'px';
    ghost.style.height = view.offsetHeight + 'px';
    leftCol.classList.add('pushing');
    leftCol.appendChild(ghost);
    const ghostList = ghost.querySelector('.list');
    if (ghostList) ghostList.scrollTop = scrolled;
    panelGhost = ghost;
    change();
    if (list) list.scrollTop = 0;
    view.dataset.push = direction;
    void view.offsetWidth;
    view.classList.add('panel-push-in');
    panelPushTimer = setTimeout(endPanelPush, 340);
}

function slideDirection(button) {
    const siblings = Array.from(button.parentElement.children);
    const previous = siblings.findIndex(el => el.classList.contains('active'));
    return siblings.indexOf(button) < previous ? 'left' : 'right';
}

function animateList(direction) {
    clearTimeout(listEnterTimer);
    listInner.classList.remove('list-enter');
    listInner.dataset.slide = direction || 'up';
    void listInner.offsetWidth;
    listInner.classList.add('list-enter');
    listEnterTimer = setTimeout(() => listInner.classList.remove('list-enter'), 600);
}

function closeMobileSearch() {
    if (!mobileSearchOverlay) return;
    mobileSearchOverlay.classList.remove('active');
}

function toggleMoreMenu() {
    if (!controlsDropdown) return;
    controlsDropdown.classList.toggle('active');
}

function closeMoreMenu() {
    if (!controlsDropdown) return;
    controlsDropdown.classList.remove('active');
}

function toggleQuickActions() {
    if (!quickActionsSheet) return;
    quickActionsSheet.classList.toggle('active');
    document.body.style.overflow = quickActionsSheet.classList.contains('active') ? 'hidden' : '';
}

function closeQuickActions() {
    if (!quickActionsSheet) return;
    quickActionsSheet.classList.remove('active');
    document.body.style.overflow = '';
}

function setupQuickActions() {
    const quickHome = document.getElementById('quickHome');
    const quickFullscreen = document.getElementById('quickFullscreen');
    const quickShare = document.getElementById('quickShare');
    const quickDraw = document.getElementById('quickDraw');

    const quickRotate = document.getElementById('quickRotate');
    if (quickRotate) quickRotate.addEventListener('click', () => chartViewer.rotateBy(90));

    if (quickDraw) {
        quickDraw.addEventListener('click', () => {
            chartViewer.setDrawMode(!chartViewer.drawMode);
            closeQuickActions();
        });
    }
    
    if (quickHome) {
        quickHome.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
    
    
    if (quickFullscreen) {
        quickFullscreen.addEventListener('click', () => {
            const wrap = document.querySelector('.iframe-wrap');
            if (wrap) {
                if (wrap.requestFullscreen) {
                    wrap.requestFullscreen();
                } else if (wrap.webkitRequestFullscreen) {
                    wrap.webkitRequestFullscreen();
                }
            }
            closeQuickActions();
        });
    }
    
    if (quickShare) {
        quickShare.addEventListener('click', () => {
            if (navigator.share && currentChart) {
                const shareData = {
                    title: `${currentChart.airportIcao} ${currentChart.id} - ${currentChart.title}`,
                    text: `Check out this chart: ${currentChart.title}`,
                    url: window.location.href
                };
                navigator.share(shareData).catch(() => {});
            } else {
                const url = window.location.href;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(() => {
                        Swal.fire({
                            title: 'Link copied',
                            text: 'Chart link copied to clipboard',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false,
                            customClass: {
                                popup: 'swal-custom-popup'
                            }
                        });
                    });
                }
            }
            closeQuickActions();
        });
    }
    
    if (quickActionsSheet) {
        quickActionsSheet.addEventListener('click', (e) => {
            if (e.target === quickActionsSheet) {
                closeQuickActions();
            }
        });
    }
}

function clearAllPinned() {
    Swal.fire({
        title: 'Clear all pinned charts?',
        text: 'This will remove all pinned charts except the enroute chart.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Clear all',
        cancelButtonText: 'Cancel',
        customClass: {
            popup: 'swal-custom-popup',
            confirmButton: 'swal-btn-deny',
            cancelButton: 'swal-btn-cancel'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            pinned = pinned.filter(p => p.fixed);
            savePinned();
            renderPinned();
            syncChartPinButtons();
            Swal.fire({
                title: 'Cleared!',
                text: 'All pinned charts have been removed.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                customClass: {
                    popup: 'swal-custom-popup'
                }
            });
        }
    });
}

function updateClearPinnedButton() {
    if (clearPinnedBtn) {
        const hasNonFixed = pinned.some(p => !p.fixed);
        clearPinnedBtn.style.display = hasNonFixed ? 'flex' : 'none';
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        closeMobileMenu();
        closeMobileSearch();
        document.body.style.overflow = '';
    }
});

const slowLoadTimer = setTimeout(() => {
    const text = document.querySelector('#pageLoading .loading-text');
    if (text) text.textContent = 'Still loading, slow connection...';
}, 7000);

window.addEventListener('load', () => {
    clearTimeout(slowLoadTimer);
    const loader = document.getElementById('pageLoading');
    loader.style.opacity = 0;
    setTimeout(() => loader.style.display = 'none', 500);
});

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('cookiesAccepted')) {
        const consent = document.createElement('div');
        consent.id = 'cookieConsent';
        consent.className = 'cookie-consent';

        const text = document.createElement('p');
        text.innerHTML = `We don't set cookies, but the embedded chart viewer does. Continuing means you accept <a href="https://policies.google.com/privacy?hl=en&fg=1" target="_blank">Google's privacy policy</a>.`;

        const btn = document.createElement('button');
        btn.textContent = 'Accept';
        btn.addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            consent.remove();
        });

        consent.appendChild(text);
        consent.appendChild(btn);
        document.body.appendChild(consent);
    }
});


let loaderHideTimer = null;

function showLoader() {
    clearTimeout(loaderHideTimer);
    viewerLoading.style.display = 'flex';
    viewerLoading.style.opacity = '1';
}



function hideLoader() {
    viewerLoading.style.opacity = '0';
    clearTimeout(loaderHideTimer);
    loaderHideTimer = setTimeout(() => {
        viewerLoading.style.display = 'none';
    }, 500);

}

function toPreview(link) {
    if (!link) return null;
    try {
        if (link.includes('drive.google.com') && !link.includes('/preview')) {
            const m = link.match(/\/d\/([A-Za-z0-9_-]+)/);
            if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
            const m2 = link.match(/[?&]id=([A-Za-z0-9_-]+)/);
            if (m2) return `https://drive.google.com/file/d/${m2[1]}/preview`;
        }
    } catch (e) { }
    return link;
}

function eh(s) {
    if (!s && s !== 0) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function init() {
    buildHotlinks();
    setupPinboardToggle();
    renderAirportList();
    animateList();
    leftSearch.addEventListener('input', onSearch);
    if (mobileSearch) {
        mobileSearch.addEventListener('input', onSearch);
    }
    backBtn.addEventListener('click', () => pushPanel('left', () => {
        currentAirport = null;
        currentCategory = null;
        backBtn.classList.add('hidden');
        categoryBar.style.display = 'none';
        airportTabs.classList.add('hidden');
        infoTabs.classList.add('hidden');
        if (searchWrap) searchWrap.style.display = '';
        setPanelHeading('Airports', 'Select an airport to see its charts');
        updateFavButton(null);
        if (leftSearch) {
            leftSearch.value = '';
            leftSearch.placeholder = 'Filter charts and airports';
        }
        renderAirportList();
    }));

    railButtons.forEach(btn => {
        btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    airportTabs.querySelectorAll('[data-tab]').forEach(b => {
        b.style.setProperty('--c', 'var(--accent)');
        b.addEventListener('click', e => {
            e.stopPropagation();
            if (b.disabled) return;
            const direction = slideDirection(b);
            setAirportTab(b.dataset.tab);
            animateList(direction);
        });
    });
    weatherTabs.querySelectorAll('[data-wx]').forEach(b => {
        b.addEventListener('click', e => {
            e.stopPropagation();
            const direction = slideDirection(b);
            weatherTab = b.dataset.wx;
            renderChartList();
            animateList(direction);
        });
    });
    infoTabs.querySelectorAll('[data-info]').forEach(b => {
        b.style.setProperty('--c', 'var(--accent)');
        b.addEventListener('click', e => {
            e.stopPropagation();
            const direction = slideDirection(b);
            infoTab = b.dataset.info;
            renderChartList();
            animateList(direction);
        });
    });

    if (favBtn) {
        favBtn.addEventListener('click', () => {
            if (currentAirport === null) return;
            toggleFavorite(AIRPORTS[currentAirport].icao);
            updateFavButton(AIRPORTS[currentAirport]);
        });
    }

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomFitBtn = document.getElementById('zoomFitBtn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => chartViewer.zoomBy(1.4));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => chartViewer.zoomBy(1 / 1.4));
    if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => chartViewer.fitSmooth());
    const rotateLeftBtn = document.getElementById('rotateLeftBtn');
    const rotateRightBtn = document.getElementById('rotateRightBtn');
    if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => chartViewer.rotateBy(-90));
    if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => chartViewer.rotateBy(90));
    const drawBtn = document.getElementById('drawBtn');
    if (drawBtn) drawBtn.addEventListener('click', () => chartViewer.setDrawMode(!chartViewer.drawMode));
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const shareBtn = document.getElementById('shareBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            const wrap = document.querySelector('.iframe-wrap');
            if (!wrap) return;
            if (document.fullscreenElement) document.exitFullscreen();
            else if (wrap.requestFullscreen) wrap.requestFullscreen();
        });
    }
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(window.location.href).then(() => {
                Swal.fire({
                    title: 'Link copied',
                    text: 'Chart link copied to clipboard',
                    icon: 'success',
                    timer: 1600,
                    showConfirmButton: false,
                    customClass: { popup: 'swal-custom-popup' }
                });
            });
        });
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    if (mobileSearchToggle) {
        mobileSearchToggle.addEventListener('click', toggleMobileSearch);
    }
    
    if (moreBtn) {
        moreBtn.addEventListener('click', toggleMoreMenu);
    }
    
    if (quickActionsBtn) {
        quickActionsBtn.addEventListener('click', toggleQuickActions);
    }
    
    if (clearPinnedBtn) {
        clearPinnedBtn.addEventListener('click', clearAllPinned);
    }
    
    setupQuickActions();
    
    document.addEventListener('click', (e) => {
        const path = e.composedPath();
        const inside = el => !!el && path.includes(el);
        if (leftCol && leftCol.classList.contains('active') &&
            !inside(leftCol) && !inside(menuToggle) && !inside(mobileSearchToggle) && !inside(document.querySelector('.rail'))) {
            closeMobileMenu();
        }
        if (controlsDropdown && controlsDropdown.classList.contains('active') &&
            !inside(moreBtn) && !inside(controlsDropdown)) {
            closeMoreMenu();
        }
        if (mobileSearchOverlay && mobileSearchOverlay.classList.contains('active') &&
            !inside(mobileSearchOverlay) && !inside(mobileSearchToggle)) {
            closeMobileSearch();
        }
    });
    
    loadPinned();
    renderPinned();
    if (!pinned.length || pinned[0].id !== 'ENROUTE') {
        pinned.unshift({
            icao: 'ENR',
            id: 'ENROUTE',
            title: 'ENROUTE CHART',
            link: ENROUTE_LINK,
            category: 'ENROUTE',
            fixed: true
        });
        savePinned();
        renderPinned();
    }
    let loadedByHash = false;
    const hn = parseHashNumber();
    if (hn) loadedByHash = openChartByHotId(hn);
    if (!loadedByHash && pinned && pinned[0]) loadChartInViewer(pinned[0], { fromPinned: true, auto: true });
    window.addEventListener('hashchange', navigateByHash);
}




function openAirport(idx) {
    currentAirport = idx;
    const airport = AIRPORTS[idx];
    backBtn.classList.remove('hidden');
    const cats = [];
    airport.charts.forEach(c => {
        const cat = (c.category || '').toUpperCase() || '';
        if (cat && !cats.includes(cat)) cats.push(cat);
    });
    currentCategory = cats.includes('STAR') ? 'STAR' : cats[0] || '';
    renderCategoryBar(cats);
    renderChartList();
    animateList('right');
}

function renderCategoryBar(cats) {
    categoryBar.style.display = cats.length ? 'flex' : 'none';
    categoryBar.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        const catColor = getCatColor(cat);
        if (catColor) btn.style.setProperty('--c', catColor.trim());
        if (cat === currentCategory) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const direction = slideDirection(btn);
            currentCategory = cat;
            Array.from(categoryBar.children).forEach(ch => {
                ch.classList.remove('active');
            });
            btn.classList.add('active');
            renderChartList();
            animateList(direction);
        });
        categoryBar.appendChild(btn);
    });
}

let airportTab = 'charts';
let infoTab = 'general';
const airportTabs = document.getElementById('airportTabs');
const infoTabs = document.getElementById('infoTabs');
const weatherTabs = document.getElementById('weatherTabs');
let weatherTab = 'metar';
const searchWrap = document.querySelector('#viewAirports .search-wrap');

function syncAirportTabs() {
    const open = currentAirport !== null;
    airportTabs.classList.toggle('hidden', !open);
    infoTabs.classList.toggle('hidden', !open || airportTab !== 'info');
    weatherTabs.classList.toggle('hidden', !open || airportTab !== 'weather');
    weatherTabs.querySelectorAll('[data-wx]').forEach(b => {
        const on = b.dataset.wx === weatherTab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    airportTabs.querySelectorAll('[data-tab]').forEach(b => {
        const on = b.dataset.tab === airportTab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    infoTabs.querySelectorAll('[data-info]').forEach(b => {
        const on = b.dataset.info === infoTab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    if (searchWrap) searchWrap.style.display = open && (airportTab === 'info' || airportTab === 'weather') ? 'none' : '';
    if (open) {
        const hasCats = categoryBar.children.length > 0;
        categoryBar.style.display = airportTab === 'charts' && hasCats ? 'flex' : 'none';
        if (leftSearch) leftSearch.placeholder = airportTab === 'proc' ? 'Filter procedures' : 'Filter charts';
    }
}

const ATIS_URL = 'https://ws.awdevsoftware.org/atis';
const atisCache = { at: 0, data: null, pending: null };
let atisTimer = null;

function fetchAtis(force = false) {
    if (!force && atisCache.data && Date.now() - atisCache.at < 60000) return Promise.resolve(atisCache.data);
    if (atisCache.pending) return atisCache.pending;
    atisCache.pending = fetch(ATIS_URL, { cache: 'no-store' })
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(list => {
            atisCache.data = Array.isArray(list) ? list : [];
            atisCache.at = Date.now();
            return atisCache.data;
        })
        .finally(() => {
            atisCache.pending = null;
        });
    return atisCache.pending;
}

function parseRunways(str) {
    return String(str || '').trim().split(/\s+/).filter(Boolean).map(r => {
        const m = r.match(/^(\d{1,2})([LCR]?)$/);
        return m ? m[1].padStart(2, '0') + m[2] : r;
    });
}

function parseAtis(entry) {
    const text = String(entry.content || (entry.lines || []).join('\n'));
    const out = { letter: entry.letter || '', editor: entry.editor || '', text, lines: entry.lines || text.split('\n') };
    const time = text.match(/TIME\s+(\d{4})Z/);
    if (time) out.time = time[1].slice(0, 2) + ':' + time[1].slice(2) + 'Z';
    const dep = text.match(/DEP\s+RWYS?\s+([\dLCR ]+?)(?=\s+ARR|\n|$)/);
    const arr = text.match(/ARR\s+RWYS?\s+([\dLCR ]+?)(?=\n|$)/);
    out.dep = dep ? parseRunways(dep[1]) : [];
    out.arr = arr ? parseRunways(arr[1]) : [];
    const wind = text.match(/\b(\d{3}|VRB)\/(\d{2,3})(?:G(\d{2,3}))?\b/);
    if (wind) out.wind = { dir: wind[1] === 'VRB' ? null : Number(wind[1]), speed: Number(wind[2]), gust: wind[3] ? Number(wind[3]) : null };
    const vis = text.match(/\/\d{2,3}(?:G\d{2,3})?\s+(\d{4}|CAVOK)\b/);
    if (vis) out.vis = vis[1];
    out.clouds = [...text.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3})\b/g)].map(m => ({ cover: m[1], base: Number(m[2]) * 100 }));
    const temp = text.match(/\s(M?\d{1,2})\/(M?\d{1,2})\s+[QA]\d/);
    if (temp) out.temp = { t: Number(temp[1].replace('M', '-')), d: Number(temp[2].replace('M', '-')) };
    const qnh = text.match(/\b([QA])(\d{3,4})\b/);
    if (qnh) out.qnh = qnh[1] === 'Q' ? `${Number(qnh[2])} hPa` : `${qnh[2].slice(0, 2)}.${qnh[2].slice(2)} inHg`;
    const tl = text.match(/TRANSITION LEVEL\s+(\d{2,3})/);
    if (tl) out.tl = 'FL' + tl[1].padStart(3, '0');
    return out;
}

function atisFor(icao) {
    return fetchAtis().then(list => {
        const entry = list.find(e => String(e.airport).toUpperCase() === icao);
        return entry ? parseAtis(entry) : null;
    });
}

const CLOUD_NAMES = { FEW: 'Few', SCT: 'Scattered', BKN: 'Broken', OVC: 'Overcast' };

function windComponents(wind, rwy) {
    if (!wind || wind.dir === null) return null;
    const hdg = parseInt(rwy, 10) * 10;
    const diff = ((wind.dir - hdg + 540) % 360) - 180;
    const rad = diff * Math.PI / 180;
    const head = Math.round(wind.speed * Math.cos(rad));
    const cross = Math.round(wind.speed * Math.sin(rad));
    const parts = [];
    if (head || !cross) parts.push(head >= 0 ? `${head} kt headwind` : `${-head} kt tailwind`);
    if (cross) parts.push(`${Math.abs(cross)} kt crosswind from the ${cross > 0 ? 'right' : 'left'}`);
    return parts.join(', ');
}

function atisIssued(atis) {
    if (!atis.time) return null;
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), +atis.time.slice(0, 2), +atis.time.slice(3, 5)));
    if (d - now > 5 * 60000) d.setUTCDate(d.getUTCDate() - 1);
    return d;
}

function ageText(date) {
    if (!date) return '';
    const mins = Math.max(0, Math.round((Date.now() - date) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h}h ${mins % 60}m ago` : `${Math.floor(h / 24)}d ago`;
}

function flightCategory(atis) {
    const ceiling = atis.clouds.filter(c => c.cover === 'BKN' || c.cover === 'OVC').reduce((m, c) => Math.min(m, c.base), Infinity);
    const visM = atis.vis === '9999' || atis.vis === 'CAVOK' || !atis.vis ? 10000 : Number(atis.vis);
    const sm = visM / 1609.34;
    if (ceiling < 500 || sm < 1) return 'LIFR';
    if (ceiling < 1000 || sm < 3) return 'IFR';
    if (ceiling <= 3000 || sm <= 5) return 'MVFR';
    return 'VFR';
}

function metarString(icao, atis, issued) {
    const parts = [icao];
    if (issued) parts.push(String(issued.getUTCDate()).padStart(2, '0') + atis.time.replace(':', '').replace('Z', '') + 'Z');
    if (atis.wind) {
        const w = atis.wind;
        const dir = w.dir === null ? 'VRB' : String(w.dir).padStart(3, '0');
        parts.push(`${dir}${String(w.speed).padStart(2, '0')}${w.gust ? 'G' + w.gust : ''}KT`);
    }
    if (atis.vis) parts.push(atis.vis);
    atis.clouds.forEach(c => parts.push(c.cover + String(c.base / 100).padStart(3, '0')));
    const t = n => (n < 0 ? 'M' : '') + String(Math.abs(n)).padStart(2, '0');
    if (atis.temp) parts.push(`${t(atis.temp.t)}/${t(atis.temp.d)}`);
    const q = atis.text.match(/\b([QA])(\d{3,4})\b/);
    if (q) parts.push(q[1] + q[2].padStart(4, '0'));
    return parts.join(' ');
}

function pressureText(atis) {
    const q = atis.text.match(/\b([QA])(\d{3,4})\b/);
    if (!q) return null;
    const hpa = q[1] === 'Q' ? Number(q[2]) : Number(q[2]) / 100 / 0.0295300;
    const inhg = q[1] === 'A' ? Number(q[2]) / 100 : Number(q[2]) * 0.0295300;
    return `${inhg.toFixed(2)} inHg (${hpa.toFixed(q[1] === 'Q' ? 0 : 2)} hPa)`;
}

function cToF(c) {
    return Math.round(c * 9 / 5 + 32);
}

function humidity(t, d) {
    const e = x => Math.exp((17.625 * x) / (243.04 + x));
    return Math.round((100 * e(d)) / e(t));
}

function renderMetar(wrap, icao, atis) {
    const issued = atisIssued(atis);
    const cat = flightCategory(atis);
    const bar = document.createElement('div');
    bar.className = 'wx-status';
    bar.innerHTML = `<span class="wx-dot ${cat.toLowerCase()}"></span><span class="wx-cat">${cat}</span><span class="wx-age">${eh(ageText(issued))}</span>`;
    wrap.appendChild(bar);
    const body = document.createElement('div');
    body.className = 'info-list';
    const raw = document.createElement('div');
    raw.className = 'wx-raw';
    raw.textContent = metarString(icao, atis, issued);
    body.appendChild(raw);
    if (atis.wind) {
        const w = atis.wind;
        body.appendChild(infoRow('Wind', w.dir === null ? `Variable at ${w.speed} KT` : w.speed === 0 ? 'Calm' : `${w.dir}° at ${w.speed} KT${w.gust ? `, gusting ${w.gust} KT` : ''}`));
    }
    if (atis.vis) body.appendChild(infoRow('Visibility', atis.vis === '9999' || atis.vis === 'CAVOK' ? '10 km or more' : `${Number(atis.vis)} m`));
    body.appendChild(infoRow('Clouds', atis.clouds.length
        ? atis.clouds.map(c => `${CLOUD_NAMES[c.cover]} ${c.base.toLocaleString('en-US').replace(/,/g, ' ')} ft`).join(', ')
        : 'Clear'));
    if (atis.temp) {
        body.appendChild(infoRow('Temperature', `${atis.temp.t}° C (${cToF(atis.temp.t)}° F)`));
        body.appendChild(infoRow('Dew point', `${atis.temp.d}° C (${cToF(atis.temp.d)}° F)`));
        body.appendChild(infoRow('Humidity', `${humidity(atis.temp.t, atis.temp.d)} %`));
    }
    const p = pressureText(atis);
    if (p) body.appendChild(infoRow('Altimeter', p));
    const note = document.createElement('div');
    note.className = 'info-empty';
    note.textContent = `From ATIS information ${atis.letter}${atis.editor ? `, published by ${atis.editor}` : ''}.`;
    body.appendChild(note);
    wrap.appendChild(body);
}

const PHONETIC = {
    A: 'ALPHA', B: 'BRAVO', C: 'CHARLIE', D: 'DELTA', E: 'ECHO', F: 'FOXTROT', G: 'GOLF', H: 'HOTEL', I: 'INDIA',
    J: 'JULIETT', K: 'KILO', L: 'LIMA', M: 'MIKE', N: 'NOVEMBER', O: 'OSCAR', P: 'PAPA', Q: 'QUEBEC', R: 'ROMEO',
    S: 'SIERRA', T: 'TANGO', U: 'UNIFORM', V: 'VICTOR', W: 'WHISKEY', X: 'X-RAY', Y: 'YANKEE', Z: 'ZULU'
};

function renderAtis(outer, icao, atis) {
    const sources = document.createElement('div');
    sources.className = 'wx-sources';
    sources.innerHTML = '<span class="wx-source active">PTFS<span class="wx-source-count">1</span></span>';
    outer.appendChild(sources);

    const bar = document.createElement('div');
    bar.className = 'wx-status atis-bar';
    const tags = [];
    if (atis.dep.length) tags.push('DEP');
    if (atis.arr.length) tags.push('ARR');
    bar.innerHTML = `<span class="wx-cat">${eh(icao)} ATIS</span><span class="atis-tag">${eh(atis.letter)}</span>${tags.map(t => `<span class="atis-tag">${t}</span>`).join('')}<span class="wx-age">${eh(ageText(atisIssued(atis)))}</span>`;
    outer.appendChild(bar);

    const body = document.createElement('div');
    body.className = 'info-list';
    const rwyRow = (label, list) => {
        const row = document.createElement('div');
        row.className = 'info-row';
        row.innerHTML = `<div class="info-label">${label}</div><div class="rwy-chips">${list.map(r => `<span class="rwy-chip">${eh(r)}</span>`).join('')}</div>`;
        return row;
    };
    if (atis.dep.length) body.appendChild(rwyRow('Departure', atis.dep));
    if (atis.arr.length) body.appendChild(rwyRow('Arrival', atis.arr));
    const msg = document.createElement('div');
    msg.className = 'info-row';
    msg.innerHTML = '<div class="info-label">Message</div>';
    const text = document.createElement('div');
    text.className = 'atis-message';
    text.textContent = atis.lines.join('\n');
    msg.appendChild(text);
    body.appendChild(msg);
    if (atis.letter) {
        const name = PHONETIC[String(atis.letter).toUpperCase()];
        body.appendChild(infoRow('Designator', name ? `${atis.letter} (${name})` : atis.letter));
    }
    if (atis.editor) body.appendChild(infoRow('Published by', atis.editor));
    outer.appendChild(body);
}

function renderWeatherTab() {
    listInner.innerHTML = '';
    emptyState.style.display = 'none';
    const a = AIRPORTS[currentAirport];
    const outer = document.createElement('div');
    const wrap = document.createElement('div');
    wrap.className = 'info-list';
    wrap.appendChild(infoEmpty('Loading weather…'));
    outer.appendChild(wrap);
    listInner.appendChild(outer);
    const icao = a.icao;
    atisFor(icao).then(atis => {
        if (currentAirport === null || AIRPORTS[currentAirport].icao !== icao || airportTab !== 'weather') return;
        wrap.innerHTML = '';
        if (!atis) {
            wrap.appendChild(infoEmpty(`No weather is published for ${icao} right now.`));
            return;
        }
        if (weatherTab === 'metar') {
            outer.innerHTML = '';
            renderMetar(outer, icao, atis);
            return;
        }
        outer.innerHTML = '';
        renderAtis(outer, icao, atis);
    }).catch(() => {
        if (airportTab !== 'weather') return;
        wrap.innerHTML = '';
        wrap.appendChild(infoEmpty('Could not load ATIS. Check your connection and try again.'));
    });
}

function setAirportTab(tab) {
    airportTab = tab;
    renderChartList();
}

function renderChartList() {
    if (currentAirport !== null) syncAirportTabs();
    if (currentAirport !== null && airportTab === 'info') return renderInfoTab();
    clearInterval(atisTimer);
    if (currentAirport !== null && airportTab === 'proc') return renderProcTab();
    if (currentAirport !== null && airportTab === 'weather') {
        atisTimer = setInterval(() => fetchAtis(true).then(() => airportTab === 'weather' && renderWeatherTab(), () => {}), 60000);
        return renderWeatherTab();
    }
    renderChartsTab();
}

function chartObjFor(airport, c) {
    return {
        airportIndex: AIRPORTS.indexOf(airport),
        airportIcao: airport.icao,
        id: c.id,
        title: c.title,
        category: c.category || '',
        link: c.link
    };
}

function fmtFeet(ft) {
    const n = Number(ft);
    if (!isFinite(n)) return String(ft);
    return `${n.toLocaleString('en-US').replace(/,/g, ' ')} ft (${Math.round(n * 0.3048).toLocaleString('en-US').replace(/,/g, ' ')} m)`;
}

function infoRow(label, value) {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `<div class="info-label">${eh(label)}</div><div class="info-value">${eh(value)}</div>`;
    return row;
}

function infoEmpty(text) {
    const el = document.createElement('div');
    el.className = 'info-empty';
    el.textContent = text;
    return el;
}

function runwayEnds(airport) {
    const ends = new Map();
    airport.charts.forEach(c => {
        const r = runwayOf(c.title);
        if (!r) return;
        if (!ends.has(r)) ends.set(r, []);
        if ((c.category || '').toUpperCase() === 'APP') ends.get(r).push(c.title);
    });
    return groupByRunway([...ends.keys()].map(r => ({ title: 'RWY ' + r })))
        .map(([label]) => [label, ends.get(label.slice(4)) || []]);
}

function renderInfoTab() {
    listInner.innerHTML = '';
    const a = AIRPORTS[currentAirport];
    const info = a.info || {};
    const wrap = document.createElement('div');
    wrap.className = 'info-list';
    if (infoTab === 'general') {
        wrap.appendChild(infoRow('ICAO / IATA', a.iata ? `${a.icao} / ${a.iata}` : a.icao));
        wrap.appendChild(infoRow('Name', a.name));
        if (a.location) wrap.appendChild(infoRow('Location', a.location));
        if (info.elevation != null) wrap.appendChild(infoRow('Elevation', fmtFeet(info.elevation)));
        const longest = (a.runways || []).reduce((m, r) => Math.max(m, Number(r.length) || 0), 0);
        if (longest) wrap.appendChild(infoRow('Longest Runway', fmtFeet(longest)));
        if (info.magVar) wrap.appendChild(infoRow('Magnetic Variation', info.magVar));
        if (info.type) wrap.appendChild(infoRow('Type', info.type));
        if (info.transitionAltitude != null) wrap.appendChild(infoRow('Transition Altitude', fmtFeet(info.transitionAltitude)));
        if (info.transitionLevel != null) {
            const tl = info.transitionLevel;
            wrap.appendChild(infoRow('Transition Level', /^FL/i.test(String(tl)) ? String(tl) : fmtFeet(tl)));
        } else {
            const tlRow = infoRow('Transition Level', '…');
            tlRow.hidden = true;
            wrap.appendChild(tlRow);
            atisFor(a.icao).then(atis => {
                if (atis && atis.tl) {
                    tlRow.querySelector('.info-value').textContent = `${atis.tl} (from ATIS)`;
                    tlRow.hidden = false;
                }
            }, () => {});
        }
        wrap.appendChild(infoRow('Charts', String(a.charts.length)));
    } else if (infoTab === 'runways') {
        if (a.runways && a.runways.length) {
            a.runways.forEach(r => {
                const parts = [r.length ? fmtFeet(r.length) : '', r.surface || '', r.ils ? `ILS ${r.ils}` : ''].filter(Boolean);
                wrap.appendChild(infoRow(`RWY ${r.id}`, parts.join(' · ') || '-'));
            });
        } else {
            const ends = runwayEnds(a);
            if (!ends.length) wrap.appendChild(infoEmpty('No runway data for this airport yet.'));
            const rows = new Map();
            ends.forEach(([label, apps]) => {
                const row = infoRow(label, apps.length ? apps.join(', ') : 'No published approach');
                rows.set(label.slice(4), row);
                wrap.appendChild(row);
            });
            atisFor(a.icao).then(atis => {
                if (!atis) return;
                rows.forEach((row, rwy) => {
                    const label = row.querySelector('.info-label');
                    [['DEP', atis.dep], ['ARR', atis.arr]].forEach(([tag, list]) => {
                        if (!list.includes(rwy)) return;
                        const b = document.createElement('span');
                        b.className = 'rwy-badge ' + tag.toLowerCase();
                        b.textContent = tag;
                        label.appendChild(b);
                    });
                });
            }, () => {});
            if (ends.length) wrap.appendChild(infoEmpty('Runways are listed from the published charts.'));
        }
    } else if (infoTab === 'comms') {
        const comms = a.comms || [];
        if (!comms.length) wrap.appendChild(infoEmpty('No frequencies listed for this airport yet.'));
        comms.forEach(c => wrap.appendChild(infoRow(c.name || c.type, c.freq)));
    } else if (infoTab === 'notam') {
        const notams = a.notams || [];
        if (!notams.length) wrap.appendChild(infoEmpty('No NOTAMs for this airport.'));
        notams.forEach(n => {
            const el = document.createElement('div');
            el.className = 'notam';
            el.textContent = typeof n === 'string' ? n : n.text;
            wrap.appendChild(el);
        });
    }
    listInner.appendChild(wrap);
    emptyState.style.display = 'none';
}

function renderProcTab() {
    listInner.innerHTML = '';
    const a = AIRPORTS[currentAirport];
    const q = (leftSearch.value || '').trim().toLowerCase();
    const match = c => !q || ((c.id || '') + ' ' + (c.title || '')).toLowerCase().includes(q);
    const sections = [
        ['Departures', 'SID'],
        ['Arrivals', 'STAR'],
        ['Approaches', 'APP']
    ];
    let total = 0;
    sections.forEach(([label, cat]) => {
        const charts = a.charts.filter(c => (c.category || '').toUpperCase() === cat && match(c));
        if (!charts.length) return;
        const head = document.createElement('div');
        head.className = 'list-group-header proc-header';
        head.textContent = `${label} (${charts.length})`;
        listInner.appendChild(head);
        const groups = cat === 'APP' ? groupByRunway(charts) : [[null, charts]];
        groups.forEach(([sub, list]) => {
            if (sub) {
                const sh = document.createElement('div');
                sh.className = 'proc-sub';
                sh.textContent = sub;
                listInner.appendChild(sh);
            }
            list.forEach(c => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'proc-row';
                row.innerHTML = `<span class="proc-name">${eh(c.title.replace(/\s+(RNAV\s+)?(ARRIVAL|DEPARTURE|ARR|DEP)$/i, ''))}</span><span class="proc-id">${eh(c.id)}</span>`;
                row.addEventListener('click', () => {
                    loadChartInViewer(chartObjFor(a, c), { fromPinned: false });
                    if (window.innerWidth <= 900) closeMobileMenu();
                });
                listInner.appendChild(row);
                total++;
            });
        });
    });
    emptyState.style.display = total ? 'none' : 'flex';
}

function renderChartsTab() {
    listInner.innerHTML = '';
    if (currentAirport === null) return;
    const airport = AIRPORTS[currentAirport];
    const q = (leftSearch.value || '').trim().toLowerCase();
    const visible = airport.charts.filter(c => {
        const cat = (c.category || '').toUpperCase() || '';
        if (currentCategory && cat !== currentCategory) return false;
        if (!q) return true;
        return ((c.id || '') + ' ' + (c.title || '')).toLowerCase().includes(q);
    });
    if (currentCategory === 'APP') {
        groupByRunway(visible).forEach(([label, charts]) => {
            const head = document.createElement('div');
            head.className = 'list-group-header';
            head.textContent = label;
            listInner.appendChild(head);
            charts.forEach(c => listInner.appendChild(buildChartRow(c, airport)));
        });
    } else {
        visible.forEach(c => listInner.appendChild(buildChartRow(c, airport)));
    }
    checkEmptyState();
}

function runwayOf(title) {
    const m = String(title || '').toUpperCase().match(/\bRWYS?\s*(\d{1,2})([LCR]?)\b/);
    return m ? m[1].padStart(2, '0') + m[2] : null;
}

function groupByRunway(charts) {
    const groups = new Map();
    charts.forEach(c => {
        const rwy = runwayOf(c.title);
        const key = rwy || '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    });
    const side = { L: 0, C: 1, R: 2, '': -1 };
    return [...groups.entries()]
        .sort(([a], [b]) => {
            if (!a) return 1;
            if (!b) return -1;
            return parseInt(a, 10) - parseInt(b, 10) || side[a.slice(2)] - side[b.slice(2)];
        })
        .map(([rwy, list]) => [rwy ? `RWY ${rwy}` : 'Other', list]);
}

function getCatColor(cat) {
    if (!cat) return '';
    const c = String(cat).toUpperCase();
    if (c === 'STAR')
        return getComputedStyle(document.documentElement).getPropertyValue('--cat-STAR') || '#71A25F';
    if (c === 'APP')
        return getComputedStyle(document.documentElement).getPropertyValue('--cat-APP') || '#C9895F';
    if (c === 'TAXI')
        return getComputedStyle(document.documentElement).getPropertyValue('--cat-TAXI') || '#31AADF';
    if (c === 'SID')
        return getComputedStyle(document.documentElement).getPropertyValue('--cat-SID') || '#DC649F';
    if (c === 'REF')
        return getComputedStyle(document.documentElement).getPropertyValue('--cat-REF') || '#8E5BC0';
    return '';
}

function loadChartInViewer(chartObj, opts = {}) {
    if (!opts.auto) document.dispatchEvent(new CustomEvent('aeronav:chart-open'));
    closeScratchpad();
    showLoader();
    const link = chartObj.link || null;
    const loadToken = ++chartLoadToken;
    const driveId = ChartViewer.driveId(link);
    if (driveId) {
        chartViewer.load(driveId, { pdf: /\b(SOP|LOA)\b/i.test(chartObj.title || '') }).then((shown) => {
            if (!shown || loadToken !== chartLoadToken) return;
            setViewerMode('image');
            if (viewerFrame.getAttribute('src') !== 'about:blank') viewerFrame.src = 'about:blank';
            hideLoader();
        }).catch(() => {
            if (loadToken === chartLoadToken) showChartInFrame(link);
        });
    } else {
        showChartInFrame(link);
    }
    const icao = chartObj.airportIcao || chartObj.icao || '';
    const isEnroute = String(chartObj.id || '').toUpperCase() === 'ENROUTE';
    const titleLead = isEnroute ? '' : [icao, chartObj.id].filter(Boolean).join(' ');
    viewerTitle.textContent = [titleLead, chartObj.title].filter(Boolean).join(' - ');
    viewerSub.textContent = chartObj.category || '';
    pinCurrentBtn.onclick = () => {
        if (!chartObj || !chartObj.id) return;
        const icao = chartIcao(chartObj);
        if (isPinned(icao, chartObj.id)) {
            unpin({ icao, id: chartObj.id });
            return;
        }
        pinChart(chartObj);
        playPinDrop(pinCurrentBtn);
    };
    currentChart = chartObj;
    updatePinCurrent();
    markActivePin();
    const hid = getHotId(chartObj);
    if (hid) {
        const targetHash = `#${hid}`;
        if (location.hash !== targetHash) location.hash = targetHash;
    }
}

function pinChart(chart) {
    if (!chart || !chart.id) return;
    if (String(chart.id).toUpperCase() === 'ENROUTE') return;
    const icao = chartIcao(chart);
    const rec = {
        icao: icao,
        id: chart.id,
        title: chart.title,
        link: chart.link,
        category: chart.category || ''
    };
    const exists = pinned.find(p => p.icao === rec.icao && p.id === rec.id);
    if (exists) return;
    pinned.push(rec);
    savePinned();
    renderPinned();
    syncChartPinButtons();
    setPinboardVisible(true);
}

function openPinnedChart(p) {
    const ap = AIRPORTS.find(a => a.icao === p.icao);
    const ch = ap && ap.charts.find(c => c.id === p.id);
    if (ch) {
        loadChartInViewer({
            airportIndex: AIRPORTS.indexOf(ap),
            airportIcao: ap.icao,
            id: ch.id,
            title: ch.title,
            category: ch.category,
            link: ch.link
        }, { fromPinned: true });
    } else {
        loadChartInViewer(p, { fromPinned: true });
    }
}

function unpin(p) {
    pinned = pinned.filter(x => !(x.icao === p.icao && x.id === p.id));
    savePinned();
    renderPinned();
    syncChartPinButtons();
}

function chartIcao(chart) {
    return chart.airportIcao ||
        chart.icao ||
        (AIRPORTS[chart.airportIndex] && AIRPORTS[chart.airportIndex].icao) ||
        '';
}

function updatePinCurrent() {
    const chart = !currentPadId && currentChart;
    const on = !!(chart && chart.id && isPinned(chartIcao(chart), chart.id));
    const fixed = !!(chart && String(chart.id).toUpperCase() === 'ENROUTE');
    pinCurrentBtn.classList.toggle('active', on || fixed);
    pinCurrentBtn.disabled = !chart || fixed;
    pinCurrentBtn.setAttribute('aria-pressed', String(on || fixed));
    const label = pinCurrentBtn.querySelector('span');
    if (label) label.textContent = fixed ? 'Pinned' : on ? 'Unpin' : 'Pin';
    pinCurrentBtn.title = fixed ? 'Always pinned' : on ? 'Unpin chart' : 'Pin chart';
    pinCurrentBtn.setAttribute('aria-label', pinCurrentBtn.title);
}

function syncChartPinButtons() {
    updatePinCurrent();
    document.querySelectorAll('.chart-row').forEach(row => {
        const btn = row.querySelector('.chart-pin');
        if (btn) btn.classList.toggle('pinned', isPinned(row.dataset.icao, row.dataset.id));
    });
}

function markActivePin() {
    if (!pinnedRow) return;
    pinnedRow.querySelectorAll('.pin-card').forEach(card => {
        const on = card.dataset.pad
            ? card.dataset.pad === currentPadId
            : !currentPadId && !!currentChart &&
            card.dataset.icao === (currentChart.airportIcao || currentChart.icao || '') &&
            card.dataset.id === currentChart.id;
        card.classList.toggle('active', on);
        if (on) card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
}

function openScratchpad(id) {
    const pad = scratchpad.get(id);
    if (!pad) return;
    currentPadId = id;
    hideLoader();
    chartWrap.classList.add('pad-mode');
    scratchpad.open(id);
    viewerTitle.textContent = pad.name;
    viewerSub.textContent = 'SCRATCHPAD';
    pinCurrentBtn.onclick = null;
    updatePinCurrent();
    markActivePin();
}

function closeScratchpad() {
    if (!currentPadId) return;
    currentPadId = null;
    chartWrap.classList.remove('pad-mode');
    scratchpad.close();
}

function deleteScratchpad(pad) {
    const doDelete = () => {
        const wasOpen = currentPadId === pad.id;
        scratchpad.remove(pad.id);
        if (wasOpen) {
            closeScratchpad();
            if (currentChart) loadChartInViewer(currentChart, { fromPinned: true });
        }
    };
    if (scratchpad.isEmpty(pad) || typeof Swal === 'undefined') return doDelete();
    Swal.fire({
        title: `Delete ${pad.name}?`,
        text: 'Your notes on this scratchpad cannot be recovered.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        customClass: { popup: 'swal-custom-popup', confirmButton: 'swal-btn-confirm', cancelButton: 'swal-btn-cancel' }
    }).then(r => r.isConfirmed && doDelete());
}

function buildPadGroup() {
    if (!scratchpad.pads.length) return null;
    const group = document.createElement('div');
    group.className = 'pin-group';
    group.setAttribute('role', 'listitem');
    const chip = document.createElement('div');
    chip.className = 'pin-airport pad-chip';
    chip.textContent = 'PAD';
    group.appendChild(chip);
    scratchpad.pads.forEach(pad => {
        const card = document.createElement('div');
        card.className = 'pin-card pad-card';
        card.tabIndex = 0;
        card.dataset.pad = pad.id;
        card.innerHTML = `<div class="pin-text"><span class="pin-code">${eh(pad.name)}</span></div>`;
        const rem = document.createElement('button');
        rem.className = 'pin-remove';
        rem.type = 'button';
        rem.title = 'Delete scratchpad';
        rem.setAttribute('aria-label', `Delete ${pad.name}`);
        rem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 7l10 10M17 7 7 17"/></svg>';
        rem.addEventListener('click', e => {
            e.stopPropagation();
            deleteScratchpad(pad);
        });
        card.appendChild(rem);
        card.addEventListener('click', () => openScratchpad(pad.id));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openScratchpad(pad.id);
            }
        });
        group.appendChild(card);
    });
    return group;
}

function renderPinned() {
    pinnedRow.innerHTML = '';
    updateClearPinnedButton();
    const padGroup = buildPadGroup();
    if (padGroup) pinnedRow.appendChild(padGroup);
    const groups = [];
    pinned.forEach(p => {
        const last = groups[groups.length - 1];
        if (last && last.icao === p.icao) last.items.push(p);
        else groups.push({ icao: p.icao, items: [p] });
    });
    groups.forEach(g => {
        const group = document.createElement('div');
        group.className = 'pin-group';
        group.setAttribute('role', 'listitem');
        const chip = document.createElement('button');
        chip.className = 'pin-airport';
        chip.type = 'button';
        chip.textContent = g.icao;
        const apIdx = AIRPORTS.findIndex(a => a.icao === g.icao);
        if (apIdx >= 0) {
            chip.title = `Show ${g.icao} charts`;
            chip.addEventListener('click', () => openAirportView(apIdx));
        } else {
            chip.disabled = true;
        }
        group.appendChild(chip);
        g.items.forEach(p => {
            const card = document.createElement('div');
            card.className = 'pin-card';
            card.tabIndex = 0;
            card.dataset.icao = p.icao;
            card.dataset.id = p.id;
            const color = getCatColor(p.category);
            if (color) card.style.setProperty('--c', color.trim());
            card.innerHTML = `<div class="pin-text"><span class="pin-code">${eh(p.id)}</span> ${eh(p.title)}</div>`;
            if (!p.fixed) {
                const rem = document.createElement('button');
                rem.className = 'pin-remove';
                rem.type = 'button';
                rem.title = 'Unpin';
                rem.setAttribute('aria-label', `Unpin ${p.icao} ${p.id}`);
                rem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 7l10 10M17 7 7 17"/></svg>';
                rem.addEventListener('click', e => {
                    e.stopPropagation();
                    unpin(p);
                });
                card.appendChild(rem);
            }
            card.addEventListener('click', () => openPinnedChart(p));
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPinnedChart(p);
                }
            });
            group.appendChild(card);
        });
        pinnedRow.appendChild(group);
    });
    markActivePin();
}

let setPinboardVisible = () => {};

function setupPinboardToggle() {
    const toggle = document.getElementById('pinboardToggle');
    const board = document.getElementById('pinboard');
    if (!toggle || !board) return;
    const apply = on => {
        board.classList.toggle('hidden', !on);
        toggle.classList.toggle('active', on);
        toggle.setAttribute('aria-pressed', String(on));
        localStorage.setItem('pinboardVisible', String(on));
    };
    setPinboardVisible = apply;
    apply(localStorage.getItem('pinboardVisible') !== 'false');
    toggle.addEventListener('click', () => apply(board.classList.contains('hidden')));
    const newPad = document.getElementById('newScratchpad');
    if (newPad) {
        newPad.addEventListener('click', () => {
            scratchpad.pick().then(key => {
                if (key) openScratchpad(scratchpad.create(key).id);
            });
        });
    }
}

function savePinned() {
    try {
        localStorage.setItem('aeronav_pinned', JSON.stringify(pinned));
    } catch (e) { }
}

function loadPinned() {
    let saved = [];
    try {
        saved = JSON.parse(localStorage.getItem('aeronav_pinned') || '[]');
    } catch (e) {
        saved = [];
    }
    const en = {
        icao: 'ENR',
        id: 'ENROUTE',
        title: 'ENROUTE CHART',
        link: ENROUTE_LINK,
        category: 'ENROUTE',
        fixed: true
    };
    pinned = [en];
    if (Array.isArray(saved)) {
        for (const p of saved) {
            if (!p) continue;
            if (String(p.id).toUpperCase() === 'ENROUTE') continue;
            if (p.id === 'N/A') {
                const ap = AIRPORTS.find(a => a.icao === p.icao);
                const ch = ap && ap.charts.find(c => c.link === p.link || c.title === p.title);
                if (ch) p.id = ch.id;
            }
            if (pinned.some(x => x.icao === p.icao && x.id === p.id)) continue;
            pinned.push(p);
        }
    }
    savePinned();
}

function pinCurrent() {
    if (!currentChart) return;
    pinChart(currentChart);
}

function onSearch(e) {
    clearTimeout(searchTimeout);
    const source = e && e.target ? e.target : leftSearch;
    if (source === mobileSearch && leftSearch) leftSearch.value = mobileSearch.value;
    else if (mobileSearch && leftSearch) mobileSearch.value = leftSearch.value;
    searchTimeout = setTimeout(() => {
        const q = (leftSearch.value || '').trim().toLowerCase();
        if (q) {
            showSkeletonLoader();
        }
        setTimeout(() => {
            hideSkeletonLoader();
            if (currentAirport === null) {
                renderAirportList(q);
            } else {
                renderChartList();
            }
            checkEmptyState();
        }, 300);
    }, 150);
}

function showSkeletonLoader() {
    if (skeletonLoader) {
        skeletonLoader.classList.add('active');
        listInner.style.display = 'none';
    }
}

function hideSkeletonLoader() {
    if (skeletonLoader) {
        skeletonLoader.classList.remove('active');
        listInner.style.display = 'block';
    }
}

function checkEmptyState() {
    if (!emptyState) return;
    const hasItems = listInner && listInner.children.length > 0;
    emptyState.style.display = hasItems ? 'none' : 'flex';
}

function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (m, p, c) => p + c.toUpperCase())
        .replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase())
        .replace(/\bAfb\b/g, 'AFB');
}

function renderAirportList(filter) {
    listInner.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    let count = 0;
    const favs = loadFavorites();
    const order = AIRPORTS.map((a, idx) => idx)
        .sort((x, y) => (favs.includes(AIRPORTS[y].icao) - favs.includes(AIRPORTS[x].icao)) || x - y);
    order.forEach(idx => {
        const a = AIRPORTS[idx];
        const hay = `${a.icao} ${a.name} ${a.iata}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        const div = document.createElement('div');
        div.className = 'item-airport';
        div.innerHTML = `<div class="airport-main">
                         <div class="airport-title">${eh(a.icao)}${a.iata ? ' / ' + eh(a.iata) : ''}${favs.includes(a.icao) ? '<span class="fav-mark" aria-label="Favorite">★</span>' : ''}</div>
                         <div class="airport-name">${eh(titleCase(a.name))}</div>${a.location ? `<div class="airport-sub">${eh(a.location)}</div>` : ''}
                       </div>
                       <div class="airport-count">${a.charts.length}</div>`;
        div.addEventListener('click', () => openAirportView(idx));
        listInner.appendChild(div);
        count++;
    });
    checkEmptyState();
}

function openAirportView(idx) {
    pushPanel('right', () => showAirportView(idx));
}

function showAirportView(idx) {
    currentAirport = idx;
    backBtn.classList.remove('hidden');
    showPanel('airports');
    const airport = AIRPORTS[idx];
    setPanelHeading(airport.iata ? `${airport.icao} / ${airport.iata}` : airport.icao, airport.location || '', titleCase(airport.name));
    updateFavButton(airport);
    if (leftSearch) leftSearch.placeholder = 'Filter charts';
    const cats = [];
    airport.charts.forEach(c => {
        const cat = (c.category || '').toUpperCase() || '';
        if (cat && !cats.includes(cat)) cats.push(cat);
    });
    currentCategory = cats.includes('STAR') ? 'STAR' : cats[0] || '';
    airportTab = 'charts';
    infoTab = 'general';
    renderCategoryBarView(cats);
    renderChartListView();
}

function renderCategoryBarView(cats) {
    categoryBar.style.display = cats.length ? 'flex' : 'none';
    categoryBar.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        const catColor = getCatColor(cat);
        if (catColor) btn.style.setProperty('--c', catColor.trim());
        if (cat === currentCategory) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const direction = slideDirection(btn);
            currentCategory = cat;
            Array.from(categoryBar.children).forEach(ch => {
                ch.classList.remove('active');
            });
            btn.classList.add('active');
            renderChartListView();
            animateList(direction);
        });
        categoryBar.appendChild(btn);
    });
}

function renderChartListView() {
    renderChartList();
}

init();

document.addEventListener('DOMContentLoaded', function () {
    const hideBtn = document.getElementById('hideBtn');
    const panel = document.getElementById('leftCol');
    const searchInput = document.getElementById('leftSearch');
    const doneBtn = document.getElementById('doneBtn');
    const listInnerDiv = document.getElementById('listInner');

    const showPanelBtn = document.createElement('button');
    showPanelBtn.className = 'panel-restore';
    showPanelBtn.setAttribute('aria-label', 'Show panel');
    showPanelBtn.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M9 5l7 7-7 7\"/></svg>";
    showPanelBtn.style.display = 'none';
    document.body.appendChild(showPanelBtn);

    function setPanelCollapsed(collapsed) {
        if (!panel) return;
        panel.classList.toggle('collapsed', collapsed);
        showPanelBtn.style.display = collapsed ? 'flex' : 'none';
    }

    if (hideBtn) hideBtn.addEventListener('click', () => setPanelCollapsed(true));
    showPanelBtn.addEventListener('click', () => setPanelCollapsed(false));

    const siteAd = document.getElementById('siteAd');
    const adCloseBtn = document.getElementById('adCloseBtn');

    if (siteAd) {
        if (localStorage.getItem('adsHidden') === 'true') siteAd.classList.add('ad-hidden');
        if (adCloseBtn) {
            adCloseBtn.addEventListener('click', () => {
                siteAd.classList.add('ad-hidden');
                localStorage.setItem('adsHidden', 'true');
            });
        }
    }

    if (doneBtn && searchInput) {
        doneBtn.addEventListener('click', () => {
            searchInput.value = '';
            doneBtn.disabled = true;
            if (currentAirport === null) renderAirportList();
            else renderChartList();
            checkEmptyState();
        });
        searchInput.addEventListener('input', () => {
            doneBtn.disabled = !searchInput.value.trim().length;
        });
    }

    if (listInnerDiv && searchInput && doneBtn) {
        listInnerDiv.addEventListener('click', e => {
            if (e.target.closest('.item-airport')) {
                searchInput.value = '';
                doneBtn.disabled = true;
            }
        }, true);
    }
});
