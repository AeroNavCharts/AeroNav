class RoutePlanner {
    constructor(viewer, ownship, els, actions = {}) {
        this.viewer = viewer;
        this.ownship = ownship;
        this.els = els;
        this.actions = actions;
        this.key = 'aeronav_route_plan';
        this.options = [];
        this.picked = 0;
        const saved = this.read();
        this.from = saved.from || '';
        this.to = saved.to || '';
        this.speed = saved.speed >= 40 && saved.speed <= 2000 ? saved.speed : 250;
        this.fill();
        this.bind();
        this.plan();
    }

    static get STUDS_PER_NM() {
        return 3307.14286;
    }

    static distance(a, b) {
        return Math.hypot(b[0] - a[0], b[1] - a[1]) / RoutePlanner.STUDS_PER_NM;
    }

    static code(name) {
        return name.replace(/\s+/g, '');
    }

    static procedures(icao, kind) {
        const all = typeof NAV_PROCEDURES !== 'undefined' ? NAV_PROCEDURES[icao] : null;
        const list = (all && all[kind]) || [];
        return [null, ...list.map(([name, fixes]) => ({ name, fixes: fixes.filter((fix) => NAV_FIXES[fix]) }))];
    }

    static build(from, to) {
        const start = NAV_AIRPORTS[from];
        const end = NAV_AIRPORTS[to];
        if (!start || !end || from === to) return [];
        const found = new Map();
        RoutePlanner.procedures(from, 'SID').forEach((sid) => {
            RoutePlanner.procedures(to, 'STAR').forEach((star) => {
                const exits = sid ? sid.fixes : [null];
                const entries = star ? star.fixes : [null];
                let best = null;
                exits.forEach((exit) => {
                    entries.forEach((entry) => {
                        const names = [exit, entry].filter((fix, i, list) => fix && list.indexOf(fix) === i);
                        const points = [start, ...names.map((fix) => NAV_FIXES[fix]), end];
                        let distance = 0;
                        for (let i = 1; i < points.length; i += 1) distance += RoutePlanner.distance(points[i - 1], points[i]);
                        const named = (sid && sid.name.startsWith(exit) ? 0 : 1) + (star && star.name.startsWith(entry) ? 0 : 1);
                        if (!best || distance < best.distance - 1e-6) best = { sid, star, names, points, distance, named };
                    });
                });
                if (!best) return;
                const shape = best.names.join(' ') || 'DCT';
                const old = found.get(shape);
                const better = !old || best.named < old.named || (best.named === old.named && Boolean(best.sid) + Boolean(best.star) > Boolean(old.sid) + Boolean(old.star));
                if (better) found.set(shape, best);
            });
        });
        const all = [...found.values()].sort((a, b) => a.distance - b.distance);
        const direct = all.find((option) => !option.names.length);
        const top = all.filter((option) => option !== direct).slice(0, 4);
        return [...top, direct].filter(Boolean).sort((a, b) => a.distance - b.distance).map((option) => ({
            ...option,
            via: [option.sid && option.sid.name, option.star && option.star.name].filter(Boolean).join(' → ') || 'Direct',
            text: [from, option.sid && RoutePlanner.code(option.sid.name), option.names.join(' DCT ') || 'DCT', option.star && RoutePlanner.code(option.star.name), to].filter(Boolean).join(' ')
        }));
    }

    read() {
        try {
            return JSON.parse(localStorage.getItem(this.key)) || {};
        } catch (e) {
            return {};
        }
    }

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify({ from: this.from, to: this.to, speed: this.speed }));
        } catch (e) { }
    }

    fill() {
        if (typeof NAV_AIRPORTS === 'undefined') return;
        const names = {};
        if (typeof AIRPORTS !== 'undefined') AIRPORTS.forEach((airport) => { names[airport.icao] = airport.name; });
        const title = (text) => text.toLowerCase().replace(/(^|[\s(])\w/g, (letter) => letter.toUpperCase());
        const codes = Object.keys(NAV_AIRPORTS).sort((a, b) => Boolean(names[b]) - Boolean(names[a]) || a.localeCompare(b));
        const html = codes.map((icao) => `<option value="${icao}">${icao}${names[icao] ? ` · ${title(names[icao])}` : ''}</option>`).join('');
        [this.els.from, this.els.to].forEach((select) => {
            select.innerHTML = `<option value="">Choose airport</option>${html}`;
        });
        this.els.from.value = this.from;
        this.els.to.value = this.to;
        this.els.speed.value = this.speed;
    }

    bind() {
        const { from, to, swap, speed, list, copy, enroute } = this.els;
        from.addEventListener('change', () => { this.from = from.value; this.plan(); });
        to.addEventListener('change', () => { this.to = to.value; this.plan(); });
        swap.addEventListener('click', () => {
            [this.from, this.to] = [this.to, this.from];
            from.value = this.from;
            to.value = this.to;
            this.plan();
        });
        speed.addEventListener('input', () => {
            const value = Number(speed.value);
            if (value < 40 || value > 2000) return;
            this.speed = value;
            this.save();
            this.renderList();
        });
        list.addEventListener('click', (event) => {
            const card = event.target.closest('[data-index]');
            if (!card) return;
            this.picked = Number(card.dataset.index);
            this.renderList();
            this.draw();
        });
        copy.addEventListener('click', () => this.copy());
        enroute.addEventListener('click', () => this.actions.openEnroute && this.actions.openEnroute());
    }

    plan() {
        this.save();
        this.options = typeof NAV_AIRPORTS === 'undefined' ? [] : RoutePlanner.build(this.from, this.to);
        this.picked = 0;
        this.renderList();
        this.draw();
    }

    minutes(option) {
        return Math.max(1, Math.round(option.distance / this.speed * 60));
    }

    static clock(minutes) {
        return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
    }

    async copy() {
        const option = this.options[this.picked];
        if (!option) return;
        try {
            await navigator.clipboard.writeText(option.text);
            this.flash('Flight plan copied.');
        } catch (e) {
            this.flash(option.text);
        }
    }

    flash(text) {
        const { note } = this.els;
        note.textContent = text;
        note.hidden = false;
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => this.renderNote(), 4000);
    }

    draw() {
        const geo = this.ownship ? this.ownship.geoFor(this.viewer.chartId) : null;
        const option = this.options[this.picked];
        if (!geo || !option) {
            this.viewer.setPlanned(null);
        } else {
            const [a, b, c, d, e, f] = geo;
            const project = (points) => points.map(([x, y]) => [a * x + b * y + c, d * x + e * y + f]);
            this.viewer.setPlanned(project(option.points), this.options.filter((other) => other !== option).map((other) => project(other.points)));
        }
        this.renderNote();
    }

    renderList() {
        const { list, empty, actions } = this.els;
        const ready = this.options.length > 0;
        actions.hidden = !ready;
        empty.hidden = ready;
        if (!ready) {
            empty.textContent = this.from && this.to && this.from === this.to ? 'Pick two different airports.' : 'Pick a departure and an arrival airport to see route options, fastest first.';
            list.innerHTML = '';
            return;
        }
        const fastest = this.minutes(this.options[0]);
        list.innerHTML = this.options.map((option, index) => {
            const minutes = this.minutes(option);
            const extra = index === 0 ? 'Fastest' : minutes === fastest ? 'Same time' : `+${RoutePlanner.clock(minutes - fastest)}`;
            return `<li>
                <button type="button" class="route-card${index === this.picked ? ' active' : ''}" data-index="${index}" aria-pressed="${index === this.picked}">
                    <span class="route-card-top">
                        <span class="route-card-time">${RoutePlanner.clock(minutes)}</span>
                        <span class="route-card-tag${index === 0 ? ' best' : ''}">${extra}</span>
                    </span>
                    <span class="route-card-via">${option.via} · ${option.distance.toFixed(1)} NM</span>
                    <span class="route-card-text">${option.text}</span>
                </button>
            </li>`;
        }).join('');
    }

    renderNote() {
        const { note } = this.els;
        const hasGeo = this.ownship && this.ownship.geoFor(this.viewer.chartId);
        note.hidden = !this.options.length || Boolean(hasGeo);
        note.textContent = 'This chart has no position data, so routes are not drawn on it. Open the enroute chart to see them.';
    }
}
