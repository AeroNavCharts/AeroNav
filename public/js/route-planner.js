class RoutePlanner {
    constructor(viewer, ownship, els, actions = {}) {
        this.viewer = viewer;
        this.ownship = ownship;
        this.els = els;
        this.actions = actions;
        this.routeKey = 'aeronav_route';
        this.speedKey = 'aeronav_route_speed';
        this.tokens = this.readTokens();
        this.speed = this.readSpeed();
        this.bind();
        this.fillOptions();
        this.render();
    }

    static get STUDS_PER_NM() {
        return 3307.14286;
    }

    static resolve(token) {
        if (typeof NAV_FIXES === 'undefined' || typeof NAV_AIRPORTS === 'undefined') return null;
        return NAV_AIRPORTS[token] || NAV_FIXES[token] || NAV_FIXES[token.replace(/\d[A-Z]?$/, '')] || null;
    }

    static split(text) {
        return String(text || '').toUpperCase().split(/[^A-Z0-9]+/).filter((token) => token && token !== 'DCT');
    }

    static leg(from, to) {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const track = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        return { track: Math.round(track) % 360 || 360, distance: Math.hypot(dx, dy) / RoutePlanner.STUDS_PER_NM };
    }

    readTokens() {
        try {
            return RoutePlanner.split(localStorage.getItem(this.routeKey));
        } catch (e) {
            return [];
        }
    }

    readSpeed() {
        try {
            const saved = Number(localStorage.getItem(this.speedKey));
            return saved >= 40 && saved <= 2000 ? saved : 250;
        } catch (e) {
            return 250;
        }
    }

    save() {
        try {
            localStorage.setItem(this.routeKey, this.tokens.join(' '));
            localStorage.setItem(this.speedKey, String(this.speed));
        } catch (e) { }
    }

    bind() {
        const { form, input, speed, clear, copy, filed, enroute, list } = this.els;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.add(input.value);
            input.value = '';
        });
        speed.value = this.speed;
        speed.addEventListener('input', () => {
            const value = Number(speed.value);
            if (value >= 40 && value <= 2000) {
                this.speed = value;
                this.save();
                this.renderSummary();
            }
        });
        clear.addEventListener('click', () => this.set([]));
        copy.addEventListener('click', () => this.copy());
        filed.addEventListener('click', () => this.useFiled());
        enroute.addEventListener('click', () => this.actions.openEnroute && this.actions.openEnroute());
        list.addEventListener('click', (event) => {
            const button = event.target.closest('[data-act]');
            if (!button) return;
            const index = Number(button.dataset.index);
            if (button.dataset.act === 'remove') this.tokens.splice(index, 1);
            if (button.dataset.act === 'up' && index > 0) this.swap(index, index - 1);
            if (button.dataset.act === 'down' && index < this.tokens.length - 1) this.swap(index, index + 1);
            this.changed();
        });
    }

    fillOptions() {
        if (typeof NAV_FIXES === 'undefined' || typeof NAV_AIRPORTS === 'undefined') return;
        const names = [...Object.keys(NAV_AIRPORTS), ...Object.keys(NAV_FIXES).sort()];
        this.els.options.innerHTML = names.map((name) => `<option value="${name}"></option>`).join('');
    }

    swap(a, b) {
        [this.tokens[a], this.tokens[b]] = [this.tokens[b], this.tokens[a]];
    }

    add(text) {
        const tokens = RoutePlanner.split(text);
        if (!tokens.length) return;
        this.tokens.push(...tokens);
        this.changed();
    }

    set(tokens) {
        this.tokens = tokens;
        this.changed();
    }

    changed() {
        this.save();
        this.render();
    }

    filedTokens() {
        const plan = this.ownship && this.ownship.plan;
        if (!plan) return [];
        return RoutePlanner.split(`${plan.departing || ''} ${plan.route || ''} ${plan.arriving || ''}`);
    }

    useFiled() {
        const tokens = this.filedTokens();
        if (!tokens.length) {
            this.flash('No filed flight plan found. Turn on "Show my aircraft" and file a plan first.');
            return;
        }
        this.set(tokens);
    }

    async copy() {
        if (!this.tokens.length) return;
        try {
            await navigator.clipboard.writeText(this.tokens.join(' '));
            this.flash('Route copied.');
        } catch (e) {
            this.flash(this.tokens.join(' '));
        }
    }

    flash(text) {
        const { note } = this.els;
        note.textContent = text;
        note.hidden = false;
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => this.renderNote(), 4000);
    }

    points() {
        const out = [];
        this.tokens.forEach((token) => {
            const pos = RoutePlanner.resolve(token);
            const last = out[out.length - 1];
            if (pos && !(last && last[0] === pos[0] && last[1] === pos[1])) out.push(pos);
        });
        return out;
    }

    draw() {
        const geo = this.ownship ? this.ownship.geoFor(this.viewer.chartId) : null;
        const points = this.points();
        if (!geo || points.length < 2) {
            this.viewer.setPlanned(null);
        } else {
            const [a, b, c, d, e, f] = geo;
            this.viewer.setPlanned(points.map(([x, y]) => [a * x + b * y + c, d * x + e * y + f]));
        }
        this.renderNote();
    }

    render() {
        this.renderList();
        this.renderSummary();
        this.draw();
    }

    renderList() {
        const { list, empty } = this.els;
        empty.hidden = this.tokens.length > 0;
        let previous = null;
        list.innerHTML = this.tokens.map((token, index) => {
            const pos = RoutePlanner.resolve(token);
            let detail = 'Start';
            if (!pos) detail = 'Unknown point, skipped';
            else if (previous) {
                const leg = RoutePlanner.leg(previous, pos);
                detail = `${String(leg.track).padStart(3, '0')}° · ${leg.distance.toFixed(1)} NM`;
            }
            if (pos) previous = pos;
            return `<li class="route-row${pos ? '' : ' route-row-bad'}">
                <span class="route-index">${index + 1}</span>
                <span class="route-name">${token}</span>
                <span class="route-leg">${detail}</span>
                <button type="button" class="route-act" data-act="up" data-index="${index}" aria-label="Move ${token} up" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="route-act" data-act="down" data-index="${index}" aria-label="Move ${token} down" ${index === this.tokens.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="route-act" data-act="remove" data-index="${index}" aria-label="Remove ${token}">×</button>
            </li>`;
        }).join('');
    }

    renderSummary() {
        const { total, time, summary } = this.els;
        const points = this.points();
        let distance = 0;
        for (let i = 1; i < points.length; i += 1) distance += RoutePlanner.leg(points[i - 1], points[i]).distance;
        summary.hidden = points.length < 2;
        total.textContent = `${distance.toFixed(1)} NM`;
        const minutes = Math.round(distance / this.speed * 60);
        time.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
    }

    renderNote() {
        const { note } = this.els;
        const hasRoute = this.points().length > 1;
        const hasGeo = this.ownship && this.ownship.geoFor(this.viewer.chartId);
        note.hidden = !hasRoute || Boolean(hasGeo);
        note.textContent = 'This chart has no position data, so the route is not drawn on it. Open the enroute chart to see it.';
    }
}
