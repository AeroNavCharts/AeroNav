class RoutePlanner {
    constructor(viewer, ownship, els, actions = {}) {
        this.viewer = viewer;
        this.ownship = ownship;
        this.els = els;
        this.actions = actions;
        this.key = 'aeronav_route_plan';
        this.pilotKey = 'aeronav_route_pilot';
        this.options = [];
        this.picked = 0;
        this.seed = 1;
        this.run = 0;
        this.active = {};
        const saved = this.read();
        this.from = saved.from || '';
        this.to = saved.to || '';
        this.speed = saved.speed >= 40 && saved.speed <= 2000 ? saved.speed : 250;
        this.fill();
        this.bind();
        this.plan();
    }

    static get DISCORD_AIRPORTS() {
        return {
            IRFD: 'Greater Rockford',
            IPPH: 'Perth',
            IZOL: 'Izolirani',
            ITKO: 'Tokyo',
            ILAR: 'Larnaca',
            IIAB: 'McConnell AFB',
            IKFL: 'Keflavik',
            IPAP: 'Paphos',
            ISAU: 'Sauthemptona',
            IMLR: 'Mellor',
            IBTH: 'Saint Barth\u00e9lemy',
            IDCS: 'Saba',
            ITRC: 'Training Centre',
            ILKL: 'Lukla',
            IJAF: 'Al Najaf',
            IGAR: 'Airbase Garry',
            ISCM: 'RAF Scampton',
            IHEN: 'Hentsridge Airfield',
            ISKP: 'Skopelos',
            IBLT: 'Boltic Airfield'
        };
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

    static procedures(icao, kind, runways) {
        const all = typeof NAV_PROCEDURES !== 'undefined' ? NAV_PROCEDURES[icao] : null;
        const list = ((all && all[kind]) || []).map(([name, fixes, serves]) => ({ name, fixes: fixes.filter((fix) => NAV_FIXES[fix]), serves: serves || null }));
        if (!runways || !runways.length) return list;
        const usable = list.filter((proc) => !proc.serves || proc.serves.some((runway) => runways.includes(runway)));
        return usable.length ? usable : list;
    }

    static gates(proc) {
        const own = proc.fixes.filter((fix) => proc.name.startsWith(`${fix} `));
        return own.length ? own : proc.fixes;
    }

    static random(seed) {
        let state = seed >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    static network(from, to, active) {
        const seen = new Set();
        const nodes = [];
        Object.entries(NAV_FIXES).forEach(([name, pos]) => {
            const key = pos.join(',');
            if (name.length < 4 || seen.has(key)) return;
            seen.add(key);
            nodes.push({ name, pos });
        });
        const index = new Map(nodes.map((node, i) => [node.name, i]));
        const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        const links = nodes.map(() => new Map());
        nodes.forEach((node, i) => {
            nodes.map((other, j) => [span(node.pos, other.pos), j])
                .filter(([, j]) => j !== i)
                .sort((a, b) => a[0] - b[0])
                .slice(0, 6)
                .forEach(([length, j]) => {
                    links[i].set(j, length);
                    links[j].set(i, length);
                });
        });
        const gate = (icao, kind) => {
            const pos = NAV_AIRPORTS[icao];
            const named = new Set(RoutePlanner.procedures(icao, kind, kind === 'SID' ? active.dep : active.arr).flatMap(RoutePlanner.gates).filter((fix) => index.has(fix)));
            const picks = named.size ? [...named].map((fix) => index.get(fix)) : nodes.map((node, i) => [span(pos, node.pos), i]).sort((a, b) => a[0] - b[0]).slice(0, 5).map(([, i]) => i);
            return new Map(picks.map((i) => [i, span(pos, nodes[i].pos)]));
        };
        return { nodes, links, exits: gate(from, 'SID'), entries: gate(to, 'STAR') };
    }

    static shortest(net, cost) {
        const count = net.nodes.length;
        const best = new Array(count).fill(Infinity);
        const prev = new Array(count).fill(-1);
        const done = new Array(count).fill(false);
        net.exits.forEach((length, i) => { best[i] = cost(-1, i, length); });
        for (let step = 0; step < count; step += 1) {
            let at = -1;
            for (let i = 0; i < count; i += 1) if (!done[i] && (at < 0 || best[i] < best[at])) at = i;
            if (at < 0 || best[at] === Infinity) break;
            done[at] = true;
            net.links[at].forEach((length, next) => {
                const total = best[at] + cost(at, next, length);
                if (total < best[next]) {
                    best[next] = total;
                    prev[next] = at;
                }
            });
        }
        let end = -1;
        let total = Infinity;
        net.entries.forEach((length, i) => {
            const value = best[i] + cost(i, -2, length);
            if (value < total) {
                total = value;
                end = i;
            }
        });
        if (end < 0) return null;
        const path = [];
        for (let i = end; i >= 0; i = prev[i]) path.unshift(i);
        return path;
    }

    static tidy(points, names) {
        const keep = [0];
        for (let i = 1; i < points.length - 1; i += 1) {
            const a = points[keep[keep.length - 1]];
            const b = points[i];
            const c = points[i + 1];
            const turn = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
            const bend = Math.min(turn, Math.PI * 2 - turn);
            if (bend > 0.12 || i === 1 || i === points.length - 2) keep.push(i);
        }
        keep.push(points.length - 1);
        return { points: keep.map((i) => points[i]), names: keep.slice(1, -1).map((i) => names[i - 1]) };
    }

    static spread(a, b) {
        const near = (p, line) => {
            let best = Infinity;
            for (let i = 1; i < line.length; i += 1) {
                const [x1, y1] = line[i - 1];
                const [x2, y2] = line[i];
                const dx = x2 - x1;
                const dy = y2 - y1;
                const t = Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy || 1)));
                best = Math.min(best, Math.hypot(p[0] - x1 - t * dx, p[1] - y1 - t * dy));
            }
            return best;
        };
        let total = 0;
        let samples = 0;
        for (let i = 1; i < a.length; i += 1) {
            for (let step = 0; step < 6; step += 1) {
                const t = step / 6;
                total += near([a[i - 1][0] + (a[i][0] - a[i - 1][0]) * t, a[i - 1][1] + (a[i][1] - a[i - 1][1]) * t], b);
                samples += 1;
            }
        }
        return total / (samples || 1);
    }

    static build(from, to, seed = 1, active = {}) {
        const start = NAV_AIRPORTS[from];
        const end = NAV_AIRPORTS[to];
        if (!start || !end || from === to) return [];
        const net = RoutePlanner.network(from, to, active);
        const random = RoutePlanner.random(seed * 7919 + from.charCodeAt(1) * 131 + to.charCodeAt(2));
        const wear = new Map();
        const found = new Map();
        const measure = (points) => {
            let distance = 0;
            for (let i = 1; i < points.length; i += 1) distance += RoutePlanner.distance(points[i - 1], points[i]);
            return distance;
        };
        for (let round = 0; round < 36; round += 1) {
            const noise = new Map();
            const cost = (a, b, length) => {
                const key = `${a}>${b}`;
                if (!noise.has(key)) noise.set(key, round || seed > 1 ? 1 + random() * 0.5 : 1);
                return (length + 900) * noise.get(key) * (wear.get(key) || 1);
            };
            const path = RoutePlanner.shortest(net, cost);
            if (!path) break;
            [-1, ...path, -2].forEach((node, i, list) => {
                if (!i) return;
                const key = `${list[i - 1]}>${node}`;
                wear.set(key, (wear.get(key) || 1) * 1.25);
            });
            const tidy = RoutePlanner.tidy([start, ...path.map((i) => net.nodes[i].pos), end], path.map((i) => net.nodes[i].name));
            const shape = tidy.names.join(' ');
            if (!found.has(shape)) found.set(shape, { ...tidy, distance: measure(tidy.points) });
        }
        const direct = { names: [], points: [start, end], distance: RoutePlanner.distance(start, end) };
        const every = [...found.values()].sort((a, b) => a.distance - b.distance);
        const near = every.filter((option) => option.distance <= direct.distance * 1.5);
        const pool = near.length ? near : every.slice(0, 3);
        const chosen = pool.length ? [pool.splice(seed > 1 ? Math.floor(random() * Math.min(3, pool.length)) : 0, 1)[0]] : [];
        while (chosen.length < 5 && pool.length) {
            let pick = 0;
            let score = -1;
            pool.forEach((option, i) => {
                const apart = Math.min(...chosen.map((other) => RoutePlanner.spread(option.points, other.points)));
                const value = apart / (option.distance / direct.distance);
                if (value > score) {
                    score = value;
                    pick = i;
                }
            });
            if (score < 400) break;
            chosen.push(pool.splice(pick, 1)[0]);
        }
        const label = (kind, icao, fix) => {
            const list = RoutePlanner.procedures(icao, kind, kind === 'SID' ? active.dep : active.arr);
            return list.find((proc) => RoutePlanner.gates(proc).includes(fix)) || null;
        };
        return (chosen.length ? chosen : [direct]).sort((a, b) => a.distance - b.distance).map((option) => {
            const sid = option.names.length ? label('SID', from, option.names[0]) : null;
            const star = option.names.length ? label('STAR', to, option.names[option.names.length - 1]) : null;
            return {
                ...option,
                sid,
                star,
                via: option.names.length ? [sid && sid.name, star && star.name].filter(Boolean).join(' → ') || `via ${option.names[0]}` : 'Direct',
                text: [from, sid && RoutePlanner.code(sid.name), option.names.join(' ') || 'DCT', star && RoutePlanner.code(star.name), to].filter(Boolean).join(' ')
            };
        });
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
        const names = RoutePlanner.DISCORD_AIRPORTS;
        const charted = typeof NAV_PROCEDURES !== 'undefined' ? NAV_PROCEDURES : {};
        const codes = Object.keys(NAV_AIRPORTS).sort((a, b) => Boolean(charted[b]) - Boolean(charted[a]) || a.localeCompare(b));
        const html = codes.map((icao) => `<option value="${icao}">${icao} ${names[icao] || ''}</option>`).join('');
        [this.els.from, this.els.to].forEach((select) => {
            select.innerHTML = `<option value="">Choose airport</option>${html}`;
        });
        this.els.from.value = this.from;
        this.els.to.value = this.to;
        this.els.speed.value = this.speed;
    }

    renderEnds(info) {
        const names = RoutePlanner.DISCORD_AIRPORTS;
        const short = {};
        if (typeof AIRPORTS !== 'undefined') AIRPORTS.forEach((airport) => { short[airport.icao] = airport.iata; });
        const paint = (end, icao, idle, runways, verb, known) => {
            end.code.textContent = icao ? [icao, short[icao]].filter(Boolean).join(' / ') : 'Not Selected';
            end.name.textContent = icao ? names[icao] || icao : idle;
            end.runway.textContent = !icao || !info ? '' : runways.length ? `${verb} runway ${runways.join(', ')}` : known ? '' : 'No ATIS available';
        };
        paint(this.els.ends.from, this.from, 'Origin Airport not selected', info ? info.depNames : [], 'Departing', info && info.origin);
        paint(this.els.ends.to, this.to, 'Destination Airport not selected', info ? info.arrNames : [], 'Landing', info && info.target);
        this.els.title.textContent = this.from && this.to ? `${this.from} to ${this.to}` : 'New Flight';
    }

    setTab(name) {
        this.els.tabs.forEach((tab) => {
            const on = tab.dataset.routeTab === name;
            tab.classList.toggle('active', on);
            tab.setAttribute('aria-selected', String(on));
        });
        this.els.panes.forEach((pane) => { pane.hidden = pane.dataset.routePane !== name; });
    }

    bind() {
        const { from, to, swap, speed, list, copy, enroute, shuffle } = this.els;
        const chosen = () => {
            this.seed = 1;
            this.active = {};
            this.plan();
            if (this.options.length) this.setTab('routes');
        };
        from.addEventListener('change', () => { this.from = from.value; chosen(); });
        to.addEventListener('change', () => { this.to = to.value; chosen(); });
        shuffle.addEventListener('click', () => { this.seed += 1; this.plan(); });
        swap.addEventListener('click', () => {
            [this.from, this.to] = [this.to, this.from];
            this.active = {};
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
        this.els.command.addEventListener('click', () => this.copyCommand());
        this.els.find.addEventListener('click', () => this.setTab('routes'));
        this.els.hide.addEventListener('click', () => this.actions.hide && this.actions.hide());
        this.els.tabs.forEach((tab) => tab.addEventListener('click', () => this.setTab(tab.dataset.routeTab)));
        this.els.clear.addEventListener('click', () => this.clear());
        this.bindPilot();
        enroute.addEventListener('click', () => this.actions.openEnroute && this.actions.openEnroute());
    }

    plan() {
        this.save();
        const run = ++this.run;
        this.renderEnds(null);
        this.compute();
        const ready = this.actions.atis && this.from && this.to && this.from !== this.to;
        if (!ready) {
            this.renderAtis(null);
            return;
        }
        const ask = (icao) => this.actions.atis(icao).catch(() => null);
        Promise.all([ask(this.from), ask(this.to)]).then(([origin, target]) => {
            if (run !== this.run) return;
            const numbers = (list) => (list || []).map((runway) => parseInt(runway, 10)).filter((runway) => runway > 0);
            const info = { origin, target, depNames: origin ? origin.dep : [], arrNames: target ? target.arr : [] };
            this.active = { dep: numbers(info.depNames), arr: numbers(info.arrNames) };
            this.compute();
            this.renderAtis(info);
        });
    }

    compute() {
        this.options = typeof NAV_AIRPORTS === 'undefined' ? [] : RoutePlanner.build(this.from, this.to, this.seed, this.active);
        this.picked = 0;
        this.renderList();
        this.draw();
    }

    renderAtis(info) {
        this.renderEnds(info);
    }

    minutes(option) {
        return Math.max(1, Math.round(option.distance / this.speed * 60));
    }

    static clock(minutes) {
        return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
    }

    readPilot() {
        try {
            return JSON.parse(localStorage.getItem(this.pilotKey)) || {};
        } catch (e) {
            return {};
        }
    }

    bindPilot() {
        const saved = this.readPilot();
        if (!saved.ingamename) {
            try {
                saved.ingamename = localStorage.getItem('aeronav_pilot_name') || '';
            } catch (e) { }
        }
        Object.entries(this.els.fields).forEach(([name, field]) => {
            if (saved[name]) field.value = saved[name];
            field.addEventListener('input', () => {
                const values = {};
                Object.entries(this.els.fields).forEach(([key, el]) => { values[key] = el.value.trim(); });
                try {
                    localStorage.setItem(this.pilotKey, JSON.stringify(values));
                } catch (e) { }
            });
        });
    }

    command() {
        const option = this.options[this.picked];
        if (!option) return '';
        const { fields } = this.els;
        const value = (name) => fields[name].value.trim();
        const level = value('flightlevel').replace(/\D/g, '');
        const parts = [
            ['ingamecallsign', value('ingamecallsign')],
            ['callsign', value('callsign').toUpperCase()],
            ['aircraft', value('aircraft')],
            ['flightrules', value('flightrules')],
            ['departing', RoutePlanner.DISCORD_AIRPORTS[this.from] || this.from],
            ['arriving', RoutePlanner.DISCORD_AIRPORTS[this.to] || this.to],
            ['flightlevel', level ? level.padStart(3, '0') : ''],
            ['ingamename', value('ingamename')],
            ['route', option.text.split(' ').slice(1, -1).join(' ')]
        ];
        return `/createflightplan ${parts.filter(([, text]) => text).map(([name, text]) => `${name}:${text}`).join(' ')}`;
    }

    async write(text, done) {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            this.flash(done);
        } catch (e) {
            this.flash(text);
        }
    }

    copy() {
        const option = this.options[this.picked];
        return this.write(option ? option.text : '', 'Route copied.');
    }

    copyCommand() {
        const missing = ['ingamecallsign', 'callsign', 'aircraft', 'flightlevel'].filter((name) => !this.els.fields[name].value.trim());
        return this.write(this.command(), missing.length ? 'Command copied, but some details are still empty.' : 'Discord command copied.');
    }

    clear() {
        this.from = '';
        this.to = '';
        this.seed = 1;
        this.active = {};
        this.els.from.value = '';
        this.els.to.value = '';
        this.plan();
        this.setTab('general');
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
        const { list, empty, actions, count, text } = this.els;
        const ready = this.options.length > 0;
        actions.hidden = !ready;
        this.els.tools.hidden = !ready;
        empty.hidden = ready;
        if (!ready) {
            empty.textContent = this.from && this.to && this.from === this.to ? 'Origin and destination are the same airport.' : 'Select an origin and a destination on the General tab to see routes.';
            count.textContent = 'Routes';
            text.textContent = 'No route selected yet.';
            list.innerHTML = '';
            return;
        }
        count.textContent = `${this.options.length} ${this.options.length === 1 ? 'Route' : 'Routes'}, Fastest First`;
        text.textContent = this.options[this.picked].text;
        const fastest = this.minutes(this.options[0]);
        list.innerHTML = this.options.map((option, index) => {
            const minutes = this.minutes(option);
            const extra = index === 0 ? 'Fastest' : minutes === fastest ? 'Same time' : `+${RoutePlanner.clock(minutes - fastest)}`;
            const on = index === this.picked;
            const procs = [option.sid ? option.sid.name : this.from, option.star ? option.star.name : this.to].join(' to ');
            return `<li>
                <button type="button" class="chart-row route-row${on ? ' selected' : ''}" data-index="${index}" aria-pressed="${on}">
                    <span class="chart-main">
                        <span class="chart-title">${procs}</span>
                        <span class="chart-id">${option.names.join(' ') || 'DCT'}</span>
                    </span>
                    <span class="route-row-side">
                        <span class="route-row-time">${RoutePlanner.clock(minutes)}</span>
                        <span class="route-row-sub">${option.distance.toFixed(1)} NM</span>
                        <span class="route-row-sub${index === 0 ? ' best' : ''}">${extra}</span>
                    </span>
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
