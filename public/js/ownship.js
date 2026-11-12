class Ownship {
    constructor(viewer, opts = {}) {
        this.viewer = viewer;
        this.button = opts.button || null;
        this.chip = opts.chip || null;
        this.host = opts.host || null;
        this.url = 'wss://ws.awdevhardware.org/';
        this.nameKey = 'aeronav_pilot_name';
        this.enabledKey = 'aeronav_ownship_on';
        this.geoKey = 'aeronav_chart_geo';
        this.pointsKey = 'aeronav_chart_geo_points';
        this.name = this.read(this.nameKey, '');
        this.enabled = false;
        this.socket = null;
        this.retry = null;
        this.retryDelay = 2000;
        this.fleets = { main: {}, event: {} };
        this.plans = { main: [], event: [] };
        this.plan = null;
        this.mine = null;
        this.callsign = '';
        this.shown = null;
        this.move = null;
        this.frame = null;
        this.shownChart = null;
        this.calibrating = new URLSearchParams(location.search).has('calibrate');
        if (this.button) this.button.addEventListener('click', () => this.toggle());
        if (this.chip) this.chip.addEventListener('click', () => this.rename());
        document.addEventListener('visibilitychange', () => {
            if (!this.enabled) return;
            if (document.hidden) this.disconnect();
            else this.connect();
        });
        if (this.calibrating) this.buildPanel();
        if (this.name && this.read(this.enabledKey, '') === '1') this.setEnabled(true);
        this.render();
    }

    read(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch { }
    }

    readJson(key) {
        try {
            const data = JSON.parse(this.read(key, '{}'));
            return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        } catch {
            return {};
        }
    }

    static fit(points) {
        if (points.length < 2) return null;
        const similarity = (p, q) => {
            const dx = q[0] - p[0];
            const dy = q[1] - p[1];
            const du = q[2] - p[2];
            const dv = q[3] - p[3];
            const den = dx * dx + dy * dy;
            if (!den) return null;
            const ar = (du * dx + dv * dy) / den;
            const ai = (dv * dx - du * dy) / den;
            return [ar, -ai, p[2] - ar * p[0] + ai * p[1], ai, ar, p[3] - ai * p[0] - ar * p[1]];
        };
        if (points.length === 2) return similarity(points[0], points[1]);
        const n = points.length;
        const mean = (i) => points.reduce((sum, p) => sum + p[i], 0) / n;
        const [mx, my, mu, mv] = [mean(0), mean(1), mean(2), mean(3)];
        let sxx = 0, sxy = 0, syy = 0, sxu = 0, syu = 0, sxv = 0, syv = 0;
        points.forEach(([x, y, u, v]) => {
            const X = x - mx;
            const Y = y - my;
            sxx += X * X;
            sxy += X * Y;
            syy += Y * Y;
            sxu += X * (u - mu);
            syu += Y * (u - mu);
            sxv += X * (v - mv);
            syv += Y * (v - mv);
        });
        const det = sxx * syy - sxy * sxy;
        if (Math.abs(det) < 1e-6 * sxx * syy || !det) return similarity(points[0], points[n - 1]);
        const a = (sxu * syy - syu * sxy) / det;
        const b = (syu * sxx - sxu * sxy) / det;
        const d = (sxv * syy - syv * sxy) / det;
        const e = (syv * sxx - sxv * sxy) / det;
        return [a, b, mu - a * mx - b * my, d, e, mv - d * mx - e * my];
    }

    static kind(type) {
        const name = String(type || '').toLowerCase();
        if (/concorde/.test(name)) return 'concorde';
        if (/cessna|c172|c182|caravan|atr|dhc|otter|piper|cub|diamond|da\d|extra|p-?51|mustang|spitfire|hurricane|king air|q400|dash|c-?130|hercules|bearcat|corsair|stearman|pitts|kodiak|pc-?12|tbm|saab 340|fokker 50|cirrus sr/.test(name)) return 'prop';
        if (/cirrus vision|learjet|citation|gulfstream|falcon|challenger|global|phenom|hondajet|\bf-?\d|mig|\bsu-?\d|hawk|eurofighter|typhoon|rafale|gripen|harrier|\ba-?10\b|t-?38|l-?39|phantom|tomcat|hornet|raptor|lightning|viper/.test(name)) return 'jet';
        return 'airliner';
    }

    geoFor(id) {
        if (!id) return null;
        const local = this.readJson(this.geoKey)[id];
        if (Array.isArray(local) && local.length === 6) return local;
        const built = typeof CHART_GEO !== 'undefined' ? CHART_GEO[id] : null;
        return Array.isArray(built) && built.length === 6 ? built : null;
    }

    project(geo, entry) {
        const { x, y } = entry.position;
        const [a, b, c, d, e, f] = geo;
        const h = (entry.heading * Math.PI) / 180;
        const south = a * e - b * d >= 0 ? -1 : 1;
        const gx = Math.sin(h);
        const gy = Math.cos(h) * south;
        const px = a * gx + b * gy;
        const py = d * gx + e * gy;
        return { u: a * x + b * y + c, v: d * x + e * y + f, heading: (Math.atan2(px, -py) * 180) / Math.PI, kind: Ownship.kind(entry.aircraftType) };
    }

    find() {
        const wanted = this.name.trim().toLowerCase();
        if (!wanted) return null;
        for (const fleet of [this.fleets.main, this.fleets.event]) {
            for (const [callsign, entry] of Object.entries(fleet)) {
                if (!entry || !entry.position) continue;
                if (String(entry.playerName || '').toLowerCase() === wanted || callsign.toLowerCase() === wanted) {
                    return { callsign, entry };
                }
            }
        }
        return null;
    }

    findPlan(found) {
        if (!found) return null;
        const tidy = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const player = tidy(found.entry.playerName);
        const callsign = tidy(found.callsign);
        let best = null;
        [...this.plans.main, ...this.plans.event].forEach((plan) => {
            if (!plan) return;
            const mine = tidy(plan.robloxName) === player || tidy(plan.realcallsign) === callsign;
            if (mine && (!best || (plan.filedAt || 0) >= (best.filedAt || 0))) best = plan;
        });
        return best;
    }

    static routePoints(plan) {
        if (!plan || typeof NAV_FIXES === 'undefined' || typeof NAV_AIRPORTS === 'undefined') return [];
        const points = [];
        const push = (pos) => {
            const last = points[points.length - 1];
            if (pos && !(last && last[0] === pos[0] && last[1] === pos[1])) points.push(pos);
        };
        const code = (value) => String(value || '').trim().toUpperCase();
        push(NAV_AIRPORTS[code(plan.departing)]);
        code(plan.route).split(/[^A-Z0-9]+/).forEach((token) => {
            if (token) push(NAV_FIXES[token] || NAV_AIRPORTS[token] || NAV_FIXES[token.replace(/\d[A-Z]?$/, '')]);
        });
        push(NAV_AIRPORTS[code(plan.arriving)]);
        return points;
    }

    async askName() {
        const label = 'Your Roblox username or callsign on the ATC24 server';
        if (!window.Swal) {
            const typed = window.prompt(label, this.name);
            return typed === null ? null : typed.trim();
        }
        const result = await window.Swal.fire({
            title: 'Show my aircraft',
            input: 'text',
            inputLabel: label,
            inputValue: this.name,
            inputAttributes: { autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' },
            showCancelButton: true,
            confirmButtonText: 'Track',
        });
        return result.isConfirmed ? String(result.value || '').trim() : null;
    }

    async rename() {
        const name = await this.askName();
        if (name === null) return;
        this.name = name;
        this.write(this.nameKey, name);
        if (!name) {
            this.setEnabled(false);
            return;
        }
        this.setEnabled(true);
        this.update();
    }

    async toggle() {
        if (this.enabled) {
            this.setEnabled(false);
            return;
        }
        if (!this.name) {
            await this.rename();
            return;
        }
        this.setEnabled(true);
    }

    setEnabled(on) {
        this.enabled = on;
        this.write(this.enabledKey, on ? '1' : '0');
        if (on) this.connect();
        else {
            this.disconnect();
            this.mine = null;
            this.plan = null;
            this.viewer.setRoute(null);
            this.place(null);
        }
        this.render();
    }

    connect() {
        clearTimeout(this.retry);
        if (this.socket || !this.enabled) return;
        let socket;
        try {
            socket = new WebSocket(this.url);
        } catch {
            this.scheduleRetry();
            return;
        }
        this.socket = socket;
        socket.addEventListener('open', () => {
            this.retryDelay = 2000;
        });
        socket.addEventListener('message', (event) => {
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (!message || typeof message.d !== 'object' || !message.d) return;
            if (message.t === 'ACFT_DATA') this.fleets.main = message.d;
            else if (message.t === 'EVENT_ACFT_DATA') this.fleets.event = message.d;
            else if (message.t === 'FLIGHT_PLAN_LIST' && Array.isArray(message.d)) this.plans.main = message.d;
            else if (message.t === 'EVENT_FLIGHT_PLAN_LIST' && Array.isArray(message.d)) this.plans.event = message.d;
            else if (message.t === 'FLIGHT_PLAN' && !Array.isArray(message.d)) this.plans.main = [...this.plans.main, message.d];
            else if (message.t === 'EVENT_FLIGHT_PLAN' && !Array.isArray(message.d)) this.plans.event = [...this.plans.event, message.d];
            else return;
            this.update();
        });
        const lost = () => {
            if (this.socket !== socket) return;
            this.socket = null;
            this.scheduleRetry();
        };
        socket.addEventListener('close', lost);
        socket.addEventListener('error', lost);
    }

    scheduleRetry() {
        clearTimeout(this.retry);
        if (!this.enabled || document.hidden) return;
        this.retry = setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(30000, this.retryDelay * 2);
    }

    disconnect() {
        clearTimeout(this.retry);
        const socket = this.socket;
        this.socket = null;
        if (socket) socket.close();
    }

    refresh() {
        this.shown = null;
        this.update();
    }

    update() {
        if (!this.enabled) return;
        const found = this.find();
        this.mine = found ? found.entry : null;
        this.callsign = found ? found.callsign : '';
        const id = this.viewer.chartId;
        const geo = this.geoFor(id);
        this.plan = this.findPlan(found);
        const [a, b, c, d, e, f] = geo || [];
        const route = geo ? Ownship.routePoints(this.plan).map(([x, y]) => [a * x + b * y + c, d * x + e * y + f]) : [];
        this.viewer.setRoute(route);
        this.place(found && geo ? this.project(geo, found.entry) : null, id);
        this.render();
    }

    place(target, id) {
        cancelAnimationFrame(this.frame);
        if (!target) {
            this.shown = null;
            this.move = null;
            this.viewer.setPlane(null);
            return;
        }
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!this.shown || this.shownChart !== id || still) {
            this.shownChart = id;
            this.shown = target;
            this.viewer.setPlane(target);
            return;
        }
        const from = this.shown;
        const swing = ((target.heading - from.heading + 540) % 360) - 180;
        const started = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - started) / 1500);
            this.shown = {
                u: from.u + (target.u - from.u) * t,
                v: from.v + (target.v - from.v) * t,
                heading: from.heading + swing * t,
                kind: target.kind,
            };
            this.viewer.setPlane(this.shown);
            if (t < 1) this.frame = requestAnimationFrame(step);
        };
        this.frame = requestAnimationFrame(step);
    }

    status() {
        if (!this.enabled) return '';
        if (!this.mine) return `Looking for ${this.name} on ATC24`;
        if (!this.geoFor(this.viewer.chartId)) return `${this.callsign}: no position on this chart`;
        const plan = this.plan;
        const leg = plan && plan.departing && plan.arriving ? `, ${plan.departing} to ${plan.arriving}` : '';
        return `Tracking ${this.callsign}${leg}`;
    }

    render() {
        if (this.button) {
            this.button.classList.toggle('active', this.enabled);
            this.button.setAttribute('aria-pressed', String(this.enabled));
        }
        if (this.chip) {
            const text = this.status();
            this.chip.hidden = !text;
            this.chip.textContent = text;
        }
        this.renderPanel();
    }

    points() {
        const id = this.viewer.chartId;
        const all = this.readJson(this.pointsKey);
        return id && Array.isArray(all[id]) ? all[id] : [];
    }

    savePoints(points) {
        const id = this.viewer.chartId;
        if (!id) return;
        const all = this.readJson(this.pointsKey);
        const fits = this.readJson(this.geoKey);
        if (points.length) all[id] = points;
        else delete all[id];
        const fit = Ownship.fit(points);
        if (fit) fits[id] = fit;
        else delete fits[id];
        this.write(this.pointsKey, JSON.stringify(all));
        this.write(this.geoKey, JSON.stringify(fits));
        this.refresh();
        this.render();
    }

    async addPoint(manual) {
        let position = null;
        if (manual) {
            const typed = window.prompt('Game position as x,y');
            const parts = (typed || '').split(',').map((part) => Number(part.trim()));
            if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return;
            position = { x: parts[0], y: parts[1] };
        } else if (!this.mine) {
            this.panelNote = 'Turn on tracking and join ATC24 first.';
            this.renderPanel();
            return;
        }
        this.panelNote = manual ? 'Click that position on the chart.' : 'Click the chart where your aircraft is right now.';
        this.renderPanel();
        const [u, v] = await this.viewer.pickPoint();
        const at = position || (this.mine && this.mine.position);
        this.panelNote = '';
        if (!at) {
            this.renderPanel();
            return;
        }
        this.savePoints([...this.points(), [at.x, at.y, u, v]]);
    }

    buildPanel() {
        if (!this.host) return;
        const panel = document.createElement('div');
        panel.className = 'geo-panel';
        const text = document.createElement('div');
        text.className = 'geo-panel-text';
        panel.appendChild(text);
        const row = document.createElement('div');
        row.className = 'geo-panel-row';
        const button = (label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'bar-btn';
            b.textContent = label;
            b.addEventListener('click', fn);
            row.appendChild(b);
        };
        button('Point at my aircraft', () => this.addPoint(false));
        button('Point by x,y', () => this.addPoint(true));
        button('Undo', () => this.savePoints(this.points().slice(0, -1)));
        button('Clear', () => this.savePoints([]));
        button('Copy', () => {
            const id = this.viewer.chartId;
            const geo = this.geoFor(id);
            if (!geo || !navigator.clipboard) return;
            const line = `"${id}": [${geo.map((n) => Number(n.toPrecision(8))).join(', ')}],`;
            navigator.clipboard.writeText(line).then(() => {
                this.panelNote = 'Copied.';
                this.renderPanel();
            });
        });
        panel.appendChild(row);
        this.host.appendChild(panel);
        this.panel = panel;
        this.panelText = text;
        this.panelNote = '';
    }

    renderPanel() {
        if (!this.panelText) return;
        const count = this.points().length;
        const geo = this.geoFor(this.viewer.chartId);
        const state = geo ? (count ? 'calibrated here' : 'built-in calibration') : 'not calibrated';
        const where = this.mine ? ` Aircraft at ${Math.round(this.mine.position.x)}, ${Math.round(this.mine.position.y)}.` : '';
        this.panelText.textContent = `Calibration: ${count} point${count === 1 ? '' : 's'}, ${state}.${where} ${this.panelNote || ''}`;
    }
}
