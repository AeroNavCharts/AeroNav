const CHART_INKS = ['#e0218a', '#d32f2f', '#1565c0', '#111111'];

class ChartViewer {
    constructor(wrap, opts = {}) {
        this.wrap = wrap;
        this.onZoom = opts.onZoom || (() => { });
        this.onDrawMode = opts.onDrawMode || (() => { });
        this.storageKey = 'aeronav_chart_marks';
        this.rotationKey = 'aeronav_chart_rotation';
        this.rotation = 0;
        this.stage = document.createElement('div');
        this.stage.className = 'chart-stage';
        this.stage.hidden = true;
        this.img = document.createElement('img');
        this.img.className = 'chart-img';
        this.img.alt = '';
        this.img.draggable = false;
        this.img.referrerPolicy = 'no-referrer';
        this.ink = document.createElement('canvas');
        this.ink.className = 'chart-ink';
        this.inkCtx = this.ink.getContext('2d');
        this.stage.append(this.img, this.ink);
        wrap.insertBefore(this.stage, wrap.querySelector('iframe'));
        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.fitScale = 1;
        this.token = 0;
        this.pointers = new Map();
        this.pinch = null;
        this.chartId = null;
        this.marks = [];
        this.drawMode = false;
        this.tool = 'pen';
        this.color = CHART_INKS[0];
        this.drawing = null;
        this.editing = null;
        this.swatches = [];
        this.toolbar = this.buildToolbar();
        this.toolbar.hidden = true;
        wrap.insertBefore(this.toolbar, wrap.querySelector('iframe'));
        this.bind();
    }

    static driveId(link) {
        if (!link || !link.includes('drive.google.com')) return null;
        const m = link.match(/\/d\/([A-Za-z0-9_-]+)/) || link.match(/[?&]id=([A-Za-z0-9_-]+)/);
        return m ? m[1] : null;
    }

    static imageUrl(id, width) {
        return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
    }

    fetchImage(url) {
        return new Promise((resolve, reject) => {
            const probe = new Image();
            probe.referrerPolicy = 'no-referrer';
            probe.onload = () => resolve(probe);
            probe.onerror = reject;
            probe.src = url;
        });
    }

    async load(id) {
        const token = ++this.token;
        const low = await this.fetchImage(ChartViewer.imageUrl(id, 1200));
        if (token !== this.token) return false;
        this.commitText();
        this.chartId = id;
        this.marks = this.readMarks()[id] || [];
        this.rotation = this.readRotations()[id] || 0;
        this.show(low, true);
        this.fetchImage(ChartViewer.imageUrl(id, 3200)).then((high) => {
            if (token !== this.token || high.naturalWidth <= this.img.naturalWidth) return;
            this.show(high, false);
        }).catch(() => { });
        return true;
    }

    show(source, reset) {
        const previous = this.natW || source.naturalWidth;
        this.natW = source.naturalWidth;
        this.natH = source.naturalHeight;
        this.img.src = source.src;
        this.img.width = this.natW;
        this.img.height = this.natH;
        this.stage.hidden = false;
        this.sizeInk();
        if (reset) {
            this.fit();
            return;
        }
        this.scale *= previous / this.natW;
        this.measureFit();
        this.apply();
    }

    hide() {
        this.token++;
        this.setDrawMode(false);
        this.stage.hidden = true;
        this.img.removeAttribute('src');
        this.natW = 0;
        this.natH = 0;
        this.chartId = null;
        this.marks = [];
        this.rotation = 0;
    }

    get active() {
        return !this.stage.hidden;
    }

    measureFit() {
        const pad = 16;
        const w = this.stage.clientWidth - pad * 2;
        const h = this.stage.clientHeight - pad * 2;
        const sideways = this.rotation % 180 !== 0;
        const natW = sideways ? this.natH : this.natW;
        const natH = sideways ? this.natW : this.natH;
        this.fitScale = Math.max(0.01, Math.min(w / natW, h / natH));
    }

    get turn() {
        const r = (this.rotation * Math.PI) / 180;
        return { c: Math.round(Math.cos(r)), s: Math.round(Math.sin(r)) };
    }

    spin(vx, vy) {
        const { c, s } = this.turn;
        return [vx * c - vy * s, vx * s + vy * c];
    }

    unspin(vx, vy) {
        const { c, s } = this.turn;
        return [vx * c + vy * s, vy * c - vx * s];
    }

    bounds() {
        const [ax, ay] = this.spin(this.natW * this.scale, 0);
        const [bx, by] = this.spin(0, this.natH * this.scale);
        return {
            left: Math.min(0, ax, bx, ax + bx),
            top: Math.min(0, ay, by, ay + by),
            width: Math.abs(ax) + Math.abs(bx),
            height: Math.abs(ay) + Math.abs(by),
        };
    }

    toLocal(p) {
        return this.unspin(p.x - this.x, p.y - this.y);
    }

    fit() {
        if (!this.natW) return;
        this.measureFit();
        this.scale = this.fitScale;
        const b = this.bounds();
        this.x = (this.stage.clientWidth - b.width) / 2 - b.left;
        this.y = (this.stage.clientHeight - b.height) / 2 - b.top;
        this.apply();
    }

    rotateBy(delta) {
        if (!this.natW) return;
        const wasFit = Math.abs(this.scale - this.fitScale) < 1e-6;
        const cx = this.stage.clientWidth / 2;
        const cy = this.stage.clientHeight / 2;
        const dx = this.x - cx;
        const dy = this.y - cy;
        const clockwise = delta > 0;
        this.rotation = (this.rotation + (clockwise ? 90 : 270)) % 360;
        this.x = cx + (clockwise ? -dy : dy);
        this.y = cy + (clockwise ? dx : -dx);
        this.saveRotation();
        if (wasFit) {
            this.fit();
            return;
        }
        this.measureFit();
        this.apply();
    }

    readRotations() {
        try {
            const data = JSON.parse(localStorage.getItem(this.rotationKey) || '{}');
            return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        } catch {
            return {};
        }
    }

    saveRotation() {
        if (!this.chartId) return;
        const all = this.readRotations();
        if (this.rotation) all[this.chartId] = this.rotation;
        else delete all[this.chartId];
        try {
            localStorage.setItem(this.rotationKey, JSON.stringify(all));
        } catch { }
    }

    zoomAt(px, py, factor) {
        if (!this.natW) return;
        const next = Math.min(this.fitScale * 12, Math.max(this.fitScale * 0.5, this.scale * factor));
        const k = next / this.scale;
        this.x = px - (px - this.x) * k;
        this.y = py - (py - this.y) * k;
        this.scale = next;
        this.apply();
    }

    zoomBy(factor) {
        this.zoomAt(this.stage.clientWidth / 2, this.stage.clientHeight / 2, factor);
    }

    apply() {
        const keep = 80;
        const b = this.bounds();
        this.x = Math.min(this.stage.clientWidth - keep, Math.max(keep - b.width, this.x + b.left)) - b.left;
        this.y = Math.min(this.stage.clientHeight - keep, Math.max(keep - b.height, this.y + b.top)) - b.top;
        this.img.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rotation}deg) scale(${this.scale})`;
        this.onZoom(Math.round((this.scale / this.fitScale) * 100));
        this.placeInput();
        this.renderInk();
    }

    point(e) {
        const r = this.stage.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    get unit() {
        return this.scale * this.natW;
    }

    toChart(p) {
        const round = (n) => Math.round(n * 100000) / 100000;
        const [lx, ly] = this.toLocal(p);
        return [round(lx / this.unit), round(ly / this.unit)];
    }

    readMarks() {
        try {
            const data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
        } catch {
            return {};
        }
    }

    saveMarks() {
        if (!this.chartId) return;
        const all = this.readMarks();
        if (this.marks.length) all[this.chartId] = this.marks;
        else delete all[this.chartId];
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(all));
        } catch { }
    }

    buildToolbar() {
        const bar = document.createElement('div');
        bar.className = 'scratch-tools chart-ink-tools';
        const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${d}</svg>`;
        const button = (title, svg, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'icon-btn';
            b.title = title;
            b.setAttribute('aria-label', title);
            b.innerHTML = svg;
            b.addEventListener('click', fn);
            bar.appendChild(b);
            return b;
        };

        this.penBtn = button('Pen', icon('<path d="M4 20l4-1 11-11-3-3L5 16l-1 4Z"/><path d="m14 6 3 3"/>'), () => this.setTool('pen'));
        this.textBtn = button('Text', icon('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'), () => this.setTool('text'));
        this.eraserBtn = button('Eraser', icon('<path d="M8 20h12"/><path d="m4 15 9-9 6 6-7 7H7l-3-4Z"/>'), () => this.setTool('eraser'));

        CHART_INKS.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'scratch-swatch';
            b.style.setProperty('--swatch', c);
            b.title = 'Ink colour';
            b.setAttribute('aria-label', 'Ink colour');
            b.addEventListener('pointerdown', (e) => e.preventDefault());
            b.addEventListener('click', () => {
                this.color = c;
                if (this.editing) {
                    this.editing.item.c = c;
                    this.editing.input.style.color = c;
                    this.editing.input.focus();
                }
                this.setTool(this.tool === 'eraser' ? 'pen' : this.tool);
            });
            bar.appendChild(b);
            this.swatches.push({ el: b, color: c });
        });

        button('Undo (Ctrl+Z)', icon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), () => this.undo());
        button('Clear drawings', icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'), () => this.clearMarks());
        button('Done drawing', icon('<path d="m5 12 5 5 9-10"/>'), () => this.setDrawMode(false));

        this.setTool('pen');
        return bar;
    }

    setTool(tool) {
        this.tool = tool;
        if (tool !== 'text') this.commitText();
        this.penBtn.classList.toggle('active', tool === 'pen');
        this.textBtn.classList.toggle('active', tool === 'text');
        this.eraserBtn.classList.toggle('active', tool === 'eraser');
        this.swatches.forEach((s) => s.el.classList.toggle('active', tool !== 'eraser' && s.color === this.color));
        this.stage.dataset.tool = tool;
    }

    setDrawMode(on) {
        const next = !!on && this.active;
        if (!next) this.commitText();
        this.drawMode = next;
        this.drawing = null;
        this.stage.classList.toggle('drawing-mode', next);
        if (this.toolbar) this.toolbar.hidden = !next;
        this.onDrawMode(next);
    }

    sizeInk() {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(this.stage.clientWidth * dpr);
        const h = Math.round(this.stage.clientHeight * dpr);
        if (this.ink.width !== w) this.ink.width = w;
        if (this.ink.height !== h) this.ink.height = h;
    }

    renderInk() {
        const ctx = this.inkCtx;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.ink.width, this.ink.height);
        if (!this.natW || !this.marks.length) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const k = this.unit;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        const sx = (u) => u * k;
        const sy = (v) => v * k;
        this.marks.forEach((m) => {
            if (this.editing && this.editing.item === m) return;
            ctx.strokeStyle = m.c;
            ctx.fillStyle = m.c;
            if (m.k === 'text') {
                ctx.font = `600 ${m.f * k}px Inter, sans-serif`;
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(m.s, sx(m.x), sy(m.y));
                return;
            }
            const p = m.p;
            const width = Math.max(1, m.w * k);
            if (p.length === 1) {
                ctx.beginPath();
                ctx.arc(sx(p[0][0]), sy(p[0][1]), width / 2, 0, Math.PI * 2);
                ctx.fill();
                return;
            }
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
            for (let i = 1; i < p.length - 1; i++) {
                const mx = (p[i][0] + p[i + 1][0]) / 2;
                const my = (p[i][1] + p[i + 1][1]) / 2;
                ctx.quadraticCurveTo(sx(p[i][0]), sy(p[i][1]), sx(mx), sy(my));
            }
            const last = p[p.length - 1];
            ctx.lineTo(sx(last[0]), sy(last[1]));
            ctx.stroke();
        });
    }

    textHit(m, p, pad) {
        const k = this.unit;
        this.inkCtx.save();
        this.inkCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.inkCtx.font = `600 ${m.f * k}px Inter, sans-serif`;
        const w = this.inkCtx.measureText(m.s).width;
        this.inkCtx.restore();
        const left = m.x * k;
        const base = m.y * k;
        const h = m.f * k;
        const [lx, ly] = this.toLocal(p);
        return lx >= left - pad && lx <= left + w + pad && ly >= base - h - pad && ly <= base + pad;
    }

    eraseAt(p) {
        const radius = 12;
        const k = this.unit;
        const before = this.marks.length;
        const [lx, ly] = this.toLocal(p);
        this.marks = this.marks.filter((m) => {
            if (m.k === 'text') return !this.textHit(m, p, radius);
            const reach = radius + (m.w * k) / 2;
            return !m.p.some(([u, v]) => Math.hypot(u * k - lx, v * k - ly) < reach);
        });
        if (this.marks.length !== before) this.renderInk();
    }

    startText(p) {
        this.commitText();
        const [x, y] = this.toChart(p);
        const item = { k: 'text', x, y, s: '', c: this.color, f: 18 / this.unit };
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'scratch-text-input';
        input.spellcheck = false;
        input.style.color = item.c;
        this.editing = { item, input };
        this.stage.appendChild(input);
        this.placeInput();
        requestAnimationFrame(() => input.focus());
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') this.commitText();
            if (e.key === 'Escape') this.commitText(true);
        });
        input.addEventListener('blur', () => this.commitText());
    }

    placeInput() {
        const ed = this.editing;
        if (!ed) return;
        const k = this.unit;
        const size = ed.item.f * k;
        ed.input.style.left = this.x + 'px';
        ed.input.style.top = this.y + 'px';
        ed.input.style.transformOrigin = '0 0';
        ed.input.style.transform = `rotate(${this.rotation}deg) translate(${ed.item.x * k}px, ${ed.item.y * k - size * 0.95}px)`;
        ed.input.style.fontSize = size + 'px';
        ed.input.style.height = size * 1.25 + 'px';
        ed.input.style.width = Math.max(140, size * 12) + 'px';
    }

    commitText(cancel = false) {
        const ed = this.editing;
        if (!ed) return;
        this.editing = null;
        const text = ed.input.value.trim();
        ed.input.remove();
        if (!cancel && text) {
            ed.item.s = text;
            this.marks.push(ed.item);
            this.saveMarks();
        }
        this.renderInk();
    }

    undo() {
        if (!this.marks.length) return;
        this.marks.pop();
        this.saveMarks();
        this.renderInk();
    }

    clearMarks() {
        if (!this.marks.length) return;
        this.marks = [];
        this.saveMarks();
        this.renderInk();
    }

    startDrawing(e) {
        const p = this.point(e);
        if (this.tool === 'text') {
            e.preventDefault();
            this.startText(p);
            return;
        }
        if (this.tool === 'eraser') {
            this.drawing = { id: e.pointerId, erase: true, count: this.marks.length };
            this.eraseAt(p);
            return;
        }
        const width = e.pointerType === 'pen' ? 1.5 + (e.pressure || 0.5) * 3 : 3;
        const stroke = { c: this.color, w: width / this.unit, p: [this.toChart(p)] };
        this.drawing = { id: e.pointerId, stroke, last: p };
        this.marks.push(stroke);
        this.renderInk();
    }

    continueDrawing(e) {
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        (events.length ? events : [e]).forEach((ev) => {
            const p = this.point(ev);
            if (this.drawing.erase) {
                this.eraseAt(p);
                return;
            }
            const last = this.drawing.last;
            if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
            this.drawing.stroke.p.push(this.toChart(p));
            this.drawing.last = p;
        });
        this.renderInk();
    }

    cancelDrawing() {
        if (!this.drawing) return;
        if (this.drawing.stroke) this.marks = this.marks.filter((m) => m !== this.drawing.stroke);
        this.drawing = null;
        this.renderInk();
    }

    bind() {
        const stage = this.stage;

        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const p = this.point(e);
            const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            this.zoomAt(p.x, p.y, Math.exp(-delta * 0.0015));
        }, { passive: false });

        stage.addEventListener('dblclick', (e) => {
            if (this.drawMode) return;
            const p = this.point(e);
            if (this.scale > this.fitScale * 1.05) this.fit();
            else this.zoomAt(p.x, p.y, 2.5);
        });

        stage.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            stage.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, this.point(e));
            this.pinch = null;
            if (this.drawMode && this.natW) {
                if (this.pointers.size === 1) {
                    this.startDrawing(e);
                    return;
                }
                this.cancelDrawing();
            }
            stage.classList.add('dragging');
        });

        stage.addEventListener('pointermove', (e) => {
            const prev = this.pointers.get(e.pointerId);
            if (!prev) return;
            if (this.drawing) {
                if (this.drawing.id === e.pointerId) this.continueDrawing(e);
                return;
            }
            const now = this.point(e);
            this.pointers.set(e.pointerId, now);
            if (this.pointers.size === 1) {
                if (this.drawMode) return;
                this.x += now.x - prev.x;
                this.y += now.y - prev.y;
                this.apply();
                return;
            }
            const [a, b] = [...this.pointers.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            if (this.pinch) {
                this.x += mid.x - this.pinch.mid.x;
                this.y += mid.y - this.pinch.mid.y;
                this.zoomAt(mid.x, mid.y, dist / this.pinch.dist);
            }
            this.pinch = { dist, mid };
        });

        const release = (e) => {
            this.pointers.delete(e.pointerId);
            this.pinch = null;
            if (this.drawing && this.drawing.id === e.pointerId) {
                this.drawing = null;
                this.saveMarks();
            }
            if (!this.pointers.size) stage.classList.remove('dragging');
        };
        stage.addEventListener('pointerup', release);
        stage.addEventListener('pointercancel', release);

        document.addEventListener('keydown', (e) => {
            if (!this.drawMode || !this.active || this.editing || !stage.clientWidth) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
            if (e.key === 'Escape') this.setDrawMode(false);
        });

        new ResizeObserver(() => {
            if (!this.active || !this.natW || !stage.clientWidth) return;
            this.sizeInk();
            const wasFit = Math.abs(this.scale - this.fitScale) < 1e-6;
            if (wasFit) this.fit();
            else {
                this.measureFit();
                this.apply();
            }
        }).observe(stage);
    }
}
