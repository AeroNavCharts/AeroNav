const leftSearch = document.getElementById('leftSearch');
const mobileSearch = document.getElementById('mobileSearch');
const listInner = document.getElementById('listInner');
const backBtn = document.getElementById('backBtn');
const categoryBar = document.getElementById('categoryBar');
const viewerFrame = document.getElementById('viewerFrame');
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
const railButtons = Array.from(document.querySelectorAll('.rail-btn[data-panel]'));
const panelViews = {
    airports: document.getElementById('viewAirports'),
    pinned: document.getElementById('viewPinned'),
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

function setPanelHeading(title, sub) {
    if (panelTitle) panelTitle.textContent = title;
    if (panelSub) panelSub.textContent = sub;
}

function isPinned(icao, id) {
    return pinned.some(p => p.icao === icao && p.id === id);
}

function buildChartRow(chart, airport) {
    const cat = (chart.category || '').toUpperCase();
    const row = document.createElement('div');
    row.className = 'chart-row';
    if (currentChart && currentChart.airportIcao === airport.icao && currentChart.id === chart.id) {
        row.classList.add('selected');
    }
    const main = document.createElement('div');
    main.className = 'chart-main';
    main.innerHTML = `<div class="chart-title">${eh(chart.title)}</div><div class="chart-id">${eh(chart.id)}${cat ? ' · ' + eh(cat) : ''}</div>`;
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
            pinned = pinned.filter(p => !(p.icao === airport.icao && p.id === chart.id));
            savePinned();
            renderPinned();
            pin.classList.remove('pinned');
        } else {
            pinChart(chartObj);
            pin.classList.add('pinned');
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
    if (!mobileSearchOverlay) return;
    const isActive = mobileSearchOverlay.classList.toggle('active');
    if (isActive && mobileSearch) {
        setTimeout(() => mobileSearch.focus(), 100);
    }
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
    const quickRefresh = document.getElementById('quickRefresh');
    const quickFullscreen = document.getElementById('quickFullscreen');
    const quickShare = document.getElementById('quickShare');
    
    if (quickHome) {
        quickHome.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
    
    if (quickRefresh) {
        quickRefresh.addEventListener('click', () => {
            if (currentChart) {
                loadChartInViewer(currentChart, { fromPinned: false });
            }
            closeQuickActions();
        });
    }
    
    if (quickFullscreen) {
        quickFullscreen.addEventListener('click', () => {
            const iframe = document.getElementById('viewerFrame');
            if (iframe) {
                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                } else if (iframe.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                } else if (iframe.msRequestFullscreen) {
                    iframe.msRequestFullscreen();
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
                            title: 'Link Copied!',
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
        confirmButtonText: 'Clear All',
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
        clearPinnedBtn.style.display = hasNonFixed ? 'block' : 'none';
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        closeMobileMenu();
        closeMobileSearch();
        document.body.style.overflow = '';
    }
});

window.addEventListener('load', () => {
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


function showLoader() {
    viewerLoading.style.display = 'flex';
    viewerLoading.style.opacity = '1';
}



function hideLoader() {
    viewerLoading.style.opacity = '0';
    setTimeout(() => {
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
    renderAirportList();
    leftSearch.addEventListener('input', onSearch);
    if (mobileSearch) {
        mobileSearch.addEventListener('input', onSearch);
    }
    backBtn.addEventListener('click', () => {
        currentAirport = null;
        currentCategory = null;
        backBtn.classList.add('hidden');
        categoryBar.style.display = 'none';
        setPanelHeading('Airports', 'Select an airport to see its charts');
        if (leftSearch) {
            leftSearch.value = '';
            leftSearch.placeholder = 'Filter charts and airports';
        }
        renderAirportList();
    });

    railButtons.forEach(btn => {
        btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    const refreshBtn = document.getElementById('refreshBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const shareBtn = document.getElementById('shareBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (currentChart) loadChartInViewer(currentChart, { fromPinned: false });
        });
    }
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
        if (leftCol && leftCol.classList.contains('active') && 
            !leftCol.contains(e.target) && !menuToggle.contains(e.target)) {
            closeMobileMenu();
        }
        if (controlsDropdown && controlsDropdown.classList.contains('active') &&
            !moreBtn.contains(e.target) && !controlsDropdown.contains(e.target)) {
            closeMoreMenu();
        }
        if (mobileSearchOverlay && mobileSearchOverlay.classList.contains('active') &&
            !mobileSearchOverlay.contains(e.target) && !mobileSearchToggle.contains(e.target)) {
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
    if (!loadedByHash && pinned && pinned[0]) loadChartInViewer(pinned[0], { fromPinned: true });
    pinCurrentBtn.addEventListener('click', () => {
        if (currentChart) pinCurrent();
    });
    window.addEventListener('hashchange', navigateByHash);
    if (!localStorage.getItem('botPromptDontAskAgain')) {
        Swal.fire({
            title: 'Enhance your experience!',
            text: 'Get charts in Discord with our new bot!',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Add Bot',
            cancelButtonText: 'No thanks',
            customClass: {
                popup: 'swal-custom-popup',
                confirmButton: 'swal-btn-confirm',
                cancelButton: 'swal-btn-cancel'
            },
            didOpen: () => {
                const btn = document.createElement('button');
                btn.textContent = "Nah, and don't ask again";
                btn.className = 'swal-btn-deny';
                btn.style.display = 'block';
                btn.style.margin = '12px auto 0';
                btn.style.width = '60%';
                btn.addEventListener('click', () => {
                    localStorage.setItem('botPromptDontAskAgain', 'true');
                    Swal.close();
                });

                const container = Swal.getPopup().querySelector('.swal2-actions');
                container.parentNode.appendChild(btn);
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.open('https://discord.com/oauth2/authorize?client_id=1426101225056632959', '_blank');
            }
        });
    }
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
}

function renderCategoryBar(cats) {
    categoryBar.style.display = cats.length ? 'flex' : 'none';
    categoryBar.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        if (cat === currentCategory) {
            btn.classList.add('active');
            const color = getCatColor(cat);
            if (color) {
                btn.style.background = color;
                btn.style.color = '#fff';
            }
        }
        btn.addEventListener('click', e => {
            e.stopPropagation();
            currentCategory = cat;
            Array.from(categoryBar.children).forEach(ch => {
                ch.classList.remove('active');
                ch.style.background = '';
                ch.style.color = '';
            });
            btn.classList.add('active');
            const color = getCatColor(cat);
            if (color) {
                btn.style.background = color;
                btn.style.color = '#fff';
            }
            renderChartList();
        });
        categoryBar.appendChild(btn);
    });
}

function renderChartList() {
    listInner.innerHTML = '';
    if (currentAirport === null) return;
    const airport = AIRPORTS[currentAirport];
    const q = (leftSearch.value || '').trim().toLowerCase();
    airport.charts.forEach(c => {
        const cat = (c.category || '').toUpperCase() || '';
        if (currentCategory && cat !== currentCategory) return;
        if (q) {
            const hay = ((c.id || '') + ' ' + (c.title || '')).toLowerCase();
            if (!hay.includes(q)) return;
        }
        listInner.appendChild(buildChartRow(c, airport));
    });
    checkEmptyState();
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
    showLoader();
    const link = chartObj.link || null;
    viewerFrame.src = toPreview(link) || 'about:blank';
    const icao = chartObj.airportIcao || chartObj.icao || '';
    viewerTitle.textContent = `${icao} — ${chartObj.id || ''} ${chartObj.title ? '- ' + chartObj.title : ''}`;
    viewerSub.textContent = chartObj.category || '';
    pinCurrentBtn.onclick = () => {
        if (chartObj && chartObj.id) pinChart(chartObj);
    };
    currentChart = chartObj;
    viewerFrame.addEventListener('load', hideLoader);
    const hid = getHotId(chartObj);
    if (hid) {
        const targetHash = `#${hid}`;
        if (location.hash !== targetHash) location.hash = targetHash;
    }
}

function pinChart(chart) {
    if (!chart || !chart.id) return;
    if (String(chart.id).toUpperCase() === 'ENROUTE') return;
    const icao =
        chart.airportIcao ||
        chart.icao ||
        (AIRPORTS[chart.airportIndex] && AIRPORTS[chart.airportIndex].icao) ||
        '';
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
}

function renderPinned() {
    pinnedRow.innerHTML = '';
    updateClearPinnedButton();
    pinned.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'pin-card';
        const left = document.createElement('div');
        left.className = 'pin-left';
        left.innerHTML = `<div class="pin-title">${eh(p.icao)} ${eh(p.id)}</div><div class="pin-sub">${eh(p.title)}</div>`;
        card.appendChild(left);
        const actions = document.createElement('div');
        actions.className = 'pin-actions';
        if (p.fixed) {
            const fixed = document.createElement('div');
            fixed.className = 'pin-fixed';
            fixed.textContent = 'ENROUTE';
            actions.appendChild(fixed);
        } else {
            const rem = document.createElement('button');
            rem.className = 'pin-remove';
            rem.textContent = 'Remove';
            rem.addEventListener('click', e => {
                e.stopPropagation();
                pinned = pinned.filter(x => !(x.icao === p.icao && x.id === p.id));
                savePinned();
                renderPinned();
            });
            actions.appendChild(rem);
        }
        card.appendChild(actions);
        card.addEventListener('click', () => {
            if (p.id && String(p.id).toUpperCase() === 'ENROUTE') {
                loadChartInViewer(p, {
                    fromPinned: true
                });
                return;
            }
            const ap = AIRPORTS.find(a => a.icao === p.icao);
            if (ap) {
                const ch = ap.charts.find(c => c.id === p.id);
                if (ch) {
                    loadChartInViewer({
                        airportIndex: AIRPORTS.indexOf(ap),
                        airportIcao: ap.icao,
                        id: ch.id,
                        title: ch.title,
                        category: ch.category,
                        link: ch.link
                    }, {
                        fromPinned: true
                    });
                    return;
                }
            }
            loadChartInViewer(p, {
                fromPinned: true
            });
        });
        pinnedRow.appendChild(card);
    });
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
            pinned.push(p);
        }
    }
    savePinned();
}

function pinCurrent() {
    if (!currentChart) return;
    pinChart(currentChart);
}

function onSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const q = (leftSearch.value || '').trim().toLowerCase();
        if (mobileSearch && mobileSearch.value !== leftSearch.value) {
            mobileSearch.value = leftSearch.value;
        }
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

function renderAirportList(filter) {
    listInner.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    let count = 0;
    AIRPORTS.forEach((a, idx) => {
        const hay = `${a.icao} ${a.name} ${a.iata}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        const div = document.createElement('div');
        div.className = 'item-airport';
        div.innerHTML = `<div style="min-width:0">
                         <div class="airport-title">${eh(a.icao)} — ${eh(a.name)}</div>
                         <div class="airport-sub">${eh(a.iata)}</div>
                       </div>
                       <div class="airport-count">${a.charts.length}</div>`;
        div.addEventListener('click', () => openAirportView(idx));
        listInner.appendChild(div);
        count++;
    });
    checkEmptyState();
}

function openAirportView(idx) {
    currentAirport = idx;
    backBtn.classList.remove('hidden');
    showPanel('airports');
    const airport = AIRPORTS[idx];
    setPanelHeading(`${airport.icao} — ${airport.iata}`, airport.name);
    if (leftSearch) leftSearch.placeholder = 'Filter charts';
    const cats = [];
    airport.charts.forEach(c => {
        const cat = (c.category || '').toUpperCase() || '';
        if (cat && !cats.includes(cat)) cats.push(cat);
    });
    currentCategory = cats.includes('STAR') ? 'STAR' : cats[0] || '';
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
        if (cat === currentCategory) {
            btn.classList.add('active');
            const color = getCatColor(cat);
            if (color) {
                btn.style.background = color;
                btn.style.color = '#fff';
            }
        }
        btn.addEventListener('click', e => {
            e.stopPropagation();
            currentCategory = cat;
            Array.from(categoryBar.children).forEach(ch => {
                ch.classList.remove('active');
                ch.style.background = '';
                ch.style.color = '';
            });
            btn.classList.add('active');
            const color = getCatColor(cat);
            if (color) {
                btn.style.background = color;
                btn.style.color = '#fff';
            }
            renderChartListView();
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
