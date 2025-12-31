const leftSearch = document.getElementById('leftSearch');
const listInner = document.getElementById('listInner');
const backBtn = document.getElementById('backBtn');
const categoryBar = document.getElementById('categoryBar');
const viewerFrame = document.getElementById('viewerFrame');
const viewerLoading = document.getElementById('viewerLoading');
const viewerTitle = document.getElementById('viewerTitle');
const viewerSub = document.getElementById('viewerSub');
const pinnedRow = document.getElementById('pinnedRow');
const pinCurrentBtn = document.getElementById('pinCurrent');

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


window.addEventListener('load', () => {
    const loader = document.getElementById('pageLoading');
    loader.style.opacity = 0;
    setTimeout(() => loader.style.display = 'none', 500);
});

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('cookiesAccepted')) {
        const consent = document.createElement('div');
        consent.id = 'cookieConsent';
        consent.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 33, 50, 0.85);
            backdrop-filter: blur(10px);
            color: #fff;
            padding: 14px 24px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 9999;
            width: 50%;
            font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        const text = document.createElement('p');
        text.style.margin = '0';
        text.style.fontSize = '14px';
        text.innerHTML = `Hey User! While we don't use cookies here, the embedded chart viewer does. By clicking continue, you agree to the privacy policy of <a href="https://policies.google.com/privacy?hl=en&fg=1" target="_blank">Google</a>.`;

        const btn = document.createElement('button');
        btn.textContent = 'Accept';
        btn.style.cssText = `
            background: rgba(0, 200, 255, 0.8);
            color: #000;
            border: none;
            border-radius: 12px;
            padding: 8px 16px;
            cursor: pointer;
            z-index: 2147483647;
            font-weight: bold;
        `;
        btn.onmouseover = () => btn.style.background = 'rgba(0, 200, 255, 1)';
        btn.onmouseout = () => btn.style.background = 'rgba(0, 200, 255, 0.8)';
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
    backBtn.addEventListener('click', () => {
        currentAirport = null;
        currentCategory = null;
        currentChart = null;
        backBtn.classList.add('hidden');
        categoryBar.style.display = 'none';
        renderAirportList();
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
        const row = document.createElement('div');
        row.className = 'chart-row';
        row.innerHTML = `<div class="chart-id">${eh(c.id)}</div>
                     <div class="chart-title">${eh(c.title)}<div class="chart-small">${eh(airport.icao)}</div></div>
                     <div class="chart-meta">${eh(cat)}</div>`;
        row.addEventListener('click', () => {
            Array.from(document.querySelectorAll('.chart-row')).forEach(r =>
                r.classList.remove('selected')
            );
            row.classList.add('selected');
            currentChart = {
                airportIndex: currentAirport,
                airportIcao: airport.icao,
                id: c.id,
                title: c.title,
                category: c.category || '',
                link: c.link
            };
            loadChartInViewer(currentChart, {
                fromPinned: false
            });
        });
        listInner.appendChild(row);
    });
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
    const q = (leftSearch.value || '').trim().toLowerCase();
    if (currentAirport === null) {
        renderAirportList(q);
    } else {
        renderChartList();
    }
}

function renderAirportList(filter) {
    listInner.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    AIRPORTS.forEach((a, idx) => {
        const hay = `${a.icao} ${a.name} ${a.iata}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        const div = document.createElement('div');
        div.className = 'item-airport';
        div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
                       <div>
                         <div class="airport-title">${eh(a.icao)} — ${eh(a.name)}</div>
                         <div class="airport-sub">${eh(a.iata)}</div>
                       </div>
                       <div class="airport-sub">Charts: ${a.charts.length}</div>
                     </div>`;
        div.addEventListener('click', () => openAirportView(idx));
        listInner.appendChild(div);
    });
}

function openAirportView(idx) {
    currentAirport = idx;
    backBtn.classList.remove('hidden');
    const airport = AIRPORTS[idx];
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
        const row = document.createElement('div');
        row.className = 'chart-row';
        row.innerHTML = `<div class="chart-id">${eh(c.id)}</div><div class="chart-title">${eh(c.title)}<div class="chart-small">${eh(airport.icao)}</div></div><div class="chart-meta">${eh(cat)}</div>`;
        row.addEventListener('click', () => {
            Array.from(document.querySelectorAll('.chart-row')).forEach(r =>
                r.classList.remove('selected')
            );
            row.classList.add('selected');
            const chartObj = {
                airportIndex: currentAirport,
                airportIcao: airport.icao,
                id: c.id,
                title: c.title,
                category: c.category || '',
                link: c.link
            };
            loadChartInViewer(chartObj, {
                fromPinned: false
            });
        });
        listInner.appendChild(row);
    });
}

init();

document.addEventListener('DOMContentLoaded', function () {
    const hideBtn = document.getElementById('hideBtn');
    const leftCol = document.getElementById('leftCol');
    const rightCol = document.getElementById('rightCol');
    const viewer = document.querySelector('.viewer');
    const searchInput = document.getElementById('leftSearch');
    const doneBtn = document.getElementById('doneBtn');
    const categoryBar = document.getElementById('categoryBar');
    const listInnerDiv = document.getElementById('listInner');

    const showArrow = document.createElement('button');
    showArrow.innerHTML = '&#9654;';
    showArrow.style.cssText =
        'display:none;position:fixed;top:50%;left:10px;transform:translateY(-50%);background:#12314a;color:#fff;border:none;border-radius:50%;padding:10px 14px;font-size:18px;cursor:pointer;z-index:9999;';
    document.body.appendChild(showArrow);

    if (hideBtn) {
        hideBtn.addEventListener('click', function () {
            if (leftCol.style.display !== 'none') {
                leftCol.style.display = 'none';
                rightCol.style.flex = '1 1 100%';
                viewer.style.height = 'calc(100vh - 160px)';
                showArrow.style.display = 'block';
            } else {
                leftCol.style.display = 'flex';
                rightCol.style.flex = '1';
                viewer.style.height = '';
                showArrow.style.display = 'none';
            }
        });
    }

    showArrow.addEventListener('click', function () {
        leftCol.style.display = 'flex';
        rightCol.style.flex = '1';
        viewer.style.height = '';
        showArrow.style.display = 'none';
    });

    // Ad show/hide controls (keeps GIF, accessible and persistable)
    const siteAd = document.getElementById('siteAd');
    const adCloseBtn = document.getElementById('adCloseBtn');
    const showAdBtn = document.getElementById('showAdBtn');

    function hideSiteAd(persist = true) {
        if (!siteAd) return;
        siteAd.classList.add('ad-hidden');
        siteAd.setAttribute('aria-hidden', 'true');
        if (showAdBtn) {
            showAdBtn.style.display = 'block';
            showAdBtn.setAttribute('aria-hidden', 'false');
        }
        if (persist) localStorage.setItem('adsHidden', 'true');
    }

    function showSiteAd(persist = true) {
        if (!siteAd) return;
        siteAd.classList.remove('ad-hidden');
        siteAd.setAttribute('aria-hidden', 'false');
        if (showAdBtn) {
            showAdBtn.style.display = 'none';
            showAdBtn.setAttribute('aria-hidden', 'true');
        }
        if (persist) localStorage.removeItem('adsHidden');
    }

    if (siteAd) {
        // initialize based on stored preference
        if (localStorage.getItem('adsHidden') === 'true') {
            hideSiteAd(false);
        } else {
            showSiteAd(false);
        }
        if (adCloseBtn) adCloseBtn.addEventListener('click', () => hideSiteAd(true));
        if (showAdBtn) showAdBtn.addEventListener('click', () => showSiteAd(true));
    }

    function resetSearch() {
        searchInput.value = '';
        if (currentAirport === null) {
            window.renderAirportList();
        } else {
            window.renderChartList();
        }
    }

    doneBtn.addEventListener('click', function () {
        resetSearch();
        doneBtn.disabled = true;
    });

    searchInput.addEventListener('input', function () {
        doneBtn.disabled = !searchInput.value.trim().length;
    });

    listInnerDiv.addEventListener(
        'click',
        function (e) {
            if (e.target.closest('.item-airport')) {
                searchInput.value = '';
                doneBtn.disabled = true;
            }
        },
        true
    );

    window.renderChartList = function () {
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
            const row = document.createElement('div');
            row.className = 'chart-row';
            row.innerHTML = `<div class="chart-id">${eh(c.id)}</div>
                       <div class="chart-title">${eh(c.title)}<div class="chart-small">${eh(airport.icao)}</div></div>
                       <div class="chart-meta">${eh(cat)}</div>`;
            row.addEventListener('click', () => {
                Array.from(document.querySelectorAll('.chart-row')).forEach(r =>
                    r.classList.remove('selected')
                );
                row.classList.add('selected');
                currentChart = {
                    airportIndex: currentAirport,
                    airportIcao: airport.icao,
                    id: c.id,
                    title: c.title,
                    category: c.category || '',
                    link: c.link
                };
                loadChartInViewer(currentChart, {
                    fromPinned: false
                });
                searchInput.value = '';
                doneBtn.disabled = true;
            });
            listInner.appendChild(row);
        });
    };
});
