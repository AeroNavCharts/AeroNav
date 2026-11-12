const SCRATCH_TEMPLATES = {
    blank: { label: 'Blank Paper', group: 'basic', paper: 'blank', rows: [] },
    lined: { label: 'Lined Paper', group: 'basic', paper: 'lined', rows: [] },
    grid: { label: 'Grid Paper', group: 'basic', paper: 'grid', rows: [] },
    notepad: { label: 'Notepad', group: 'type', text: true, rows: [] },
    atis: {
        label: 'ATIS',
        group: 'template',
        rows: ['Information', 'Time', 'Runway', 'Wind', 'Visibility', 'Weather', 'Cloud', 'Temp / Dew', 'QNH', 'Remarks']
    },
    pirep: {
        label: 'PIREP',
        group: 'template',
        rows: ['Location', 'Time', 'Altitude', 'Aircraft type', 'Sky cover', 'Weather', 'Temperature', 'Wind', 'Turbulence', 'Icing', 'Remarks']
    },
    times: {
        label: 'Times Out/In',
        group: 'template',
        rows: ['# Times', 'Out', 'Off', 'On', 'In', '# Totals', 'Flight time', 'Block time', 'Fuel out', 'Fuel in']
    },
    told: {
        label: 'Take-Off & Landing Data',
        group: 'template',
        rows: ['# Take-off', 'Runway', 'Wind / Temp', 'QNH', 'Weight', 'Flaps / Trim', 'V1 / VR / V2', '# Landing', 'Runway', 'Wind / Temp', 'QNH', 'Weight', 'Flaps', 'VREF / VAPP']
    },
    craft: {
        label: 'C.R.A.F.T',
        group: 'template',
        rows: ['Clearance limit', 'Route', 'Altitude', 'Frequency', 'Transponder']
    }
};

const SCRATCH_GROUPS = [
    ['basic', 'Basic'],
    ['type', 'Type'],
    ['template', 'Templates']
];

const SCRATCH_ICONS = {
    blank: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3"/>',
    lined: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M8.5 10h7M8.5 13.5h7M8.5 17h7"/>',
    grid: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M5 10h14M5 15h14M9.7 6v15M14.3 6v15"/>',
    notepad: '<path d="M3 18 7.5 6h1L13 18M4.6 14h6.8"/><path d="M20 18v-5.5a2.5 2.5 0 0 0-4.6-1.3M15 15.2c0-1.5 1.3-2.2 5-2.2M15 15.5a2.5 2.5 0 0 0 5 0"/>',
    template: '<path d="M12 4v16M4 12h16"/>'
};

const SCRATCH_COLORS = ['#ffffff', '#ffd54a', '#4fc3f7', '#ff6b6b'];

class Scratchpad {
    constructor(stage, opts = {}) {
        this.stage = stage;
        this.onChange = opts.onChange || (() => {});
        this.storageKey = 'aeronav_scratchpads';
        this.pageW = 1000;
        this.pageH = 1300;
        this.pads = this.loadAll();
        this.current = null;
        this.tool = 'pen';
        this.color = SCRATCH_COLORS[0];
        this.drawing = null;
        this.swatches = [];

        this.root = document.createElement('div');
        this.root.className = 'scratch';
        this.root.hidden = true;
        this.paper = document.createElement('canvas');
        this.paper.className = 'scratch-paper';
        this.note = document.createElement('textarea');
        this.note.className = 'scratch-note';
        this.note.placeholder = 'Type your notes…';
        this.note.spellcheck = false;
        this.textSize = 30;
        this.editing = null;
        this.toolbar = this.buildToolbar();
        this.root.append(this.paper, this.note, this.toolbar);
        this.stage.appendChild(this.root);
        this.ctx = this.paper.getContext('2d');
        this.bind();
    }

    loadAll() {
        try {
            const data = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            return Array.isArray(data) ? data.map(p => ({ strokes: [], text: '', ...p })) : [];
        } catch {
            return [];
        }
    }

    saveAll() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.pads));
        } catch {}
    }

    template(pad = this.current) {
        return SCRATCH_TEMPLATES[pad && pad.template] || SCRATCH_TEMPLATES.blank;
    }

    isEmpty(pad) {
        return !pad.strokes.length && !(pad.text || '').trim();
    }

    pick() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'pad-picker-overlay';
            const dialog = document.createElement('div');
            dialog.className = 'pad-picker';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'padPickerTitle');

            const head = document.createElement('div');
            head.className = 'pad-picker-head';
            head.innerHTML = '<div class="pad-picker-title" id="padPickerTitle">Add Scratchpad</div>';
            const x = document.createElement('button');
            x.type = 'button';
            x.className = 'pad-picker-x';
            x.setAttribute('aria-label', 'Close');
            x.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7l10 10M17 7 7 17"/></svg>';
            head.appendChild(x);

            const list = document.createElement('div');
            list.className = 'pad-picker-list';
            SCRATCH_GROUPS.forEach(([group, title]) => {
                const h = document.createElement('div');
                h.className = 'pad-picker-section';
                h.textContent = title;
                list.appendChild(h);
                Object.entries(SCRATCH_TEMPLATES).filter(([, t]) => t.group === group).forEach(([key, t]) => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'pad-picker-item';
                    const icon = SCRATCH_ICONS[key] || SCRATCH_ICONS.template;
                    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${icon}</svg><span>${t.label}</span>`;
                    b.addEventListener('click', () => done(key));
                    list.appendChild(b);
                });
            });

            const foot = document.createElement('div');
            foot.className = 'pad-picker-foot';
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'pad-picker-cancel';
            cancel.textContent = 'Cancel';
            foot.appendChild(cancel);

            dialog.append(head, list, foot);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const first = list.querySelector('.pad-picker-item');
            if (first) first.focus();

            const onKey = e => {
                if (e.key === 'Escape') done(null);
            };
            const done = key => {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(key);
            };
            x.addEventListener('click', () => done(null));
            cancel.addEventListener('click', () => done(null));
            overlay.addEventListener('click', e => e.target === overlay && done(null));
            document.addEventListener('keydown', onKey);
        });
    }

    create(templateKey = 'blank') {
        const t = SCRATCH_TEMPLATES[templateKey] ? templateKey : 'blank';
        const base = SCRATCH_TEMPLATES[t].label;
        const used = new Set(this.pads.map(p => p.name));
        let n = 1;
        while (used.has(`${base} ${n}`)) n++;
        const pad = { id: 'sp' + Date.now().toString(36), name: `${base} ${n}`, template: t, strokes: [], text: '' };
        this.pads.push(pad);
        this.saveAll();
        this.onChange();
        return pad;
    }

    remove(id) {
        this.pads = this.pads.filter(p => p.id !== id);
        if (this.current && this.current.id === id) this.close();
        this.saveAll();
        this.onChange();
    }

    get(id) {
        return this.pads.find(p => p.id === id) || null;
    }

    open(id) {
        this.commitText();
        this.current = this.get(id);
        if (!this.current) return;
        const textMode = !!this.template().text;
        this.root.hidden = false;
        this.root.classList.toggle('text-mode', textMode);
        if (textMode) {
            this.note.value = this.current.text || '';
            this.note.focus();
        }
        this.layout();
    }

    close() {
        this.commitText();
        this.current = null;
        this.root.hidden = true;
    }

    buildToolbar() {
        const bar = document.createElement('div');
        bar.className = 'scratch-tools';
        const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${d}</svg>`;
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

        SCRATCH_COLORS.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'scratch-swatch';
            b.style.setProperty('--swatch', c);
            b.addEventListener('pointerdown', e => e.preventDefault());
            b.title = 'Ink colour';
            b.setAttribute('aria-label', 'Ink colour');
            b.addEventListener('click', () => {
                this.color = c;
                if (this.editing) {
                    this.editing.color = c;
                    this.editing.input.style.color = c;
                    this.editing.input.focus();
                }
                this.setTool(this.tool === 'eraser' ? 'pen' : this.tool);
            });
            bar.appendChild(b);
            this.swatches.push({ el: b, color: c });
        });

        button('Undo (Ctrl+Z)', icon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'), () => this.undo());
        button('Clear pad', icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'), () => this.clear());

        this.setTool('pen');
        return bar;
    }

    setTool(tool) {
        this.tool = tool;
        if (tool !== 'text') this.commitText();
        this.penBtn.classList.toggle('active', tool === 'pen');
        this.textBtn.classList.toggle('active', tool === 'text');
        this.eraserBtn.classList.toggle('active', tool === 'eraser');
        this.swatches.forEach(s => s.el.classList.toggle('active', tool !== 'eraser' && s.color === this.color));
        if (this.paper) this.paper.dataset.tool = tool;
    }

    bind() {
        new ResizeObserver(() => !this.root.hidden && this.layout()).observe(this.stage);

        let noteTimer = null;
        this.note.addEventListener('input', () => {
            if (!this.current) return;
            this.current.text = this.note.value;
            clearTimeout(noteTimer);
            noteTimer = setTimeout(() => this.saveAll(), 300);
        });
        this.note.addEventListener('blur', () => this.saveAll());

        this.paper.addEventListener('pointerdown', e => {
            if (!this.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
            e.preventDefault();
            this.paper.setPointerCapture(e.pointerId);
            const pt = this.toPage(e);
            if (this.tool === 'text') {
                this.startText(pt);
                return;
            }
            if (this.tool === 'eraser') {
                this.drawing = { erase: true, id: e.pointerId };
                this.eraseAt(pt);
                return;
            }
            const width = e.pointerType === 'pen' ? 2 + (e.pressure || 0.5) * 4 : 4;
            this.drawing = { id: e.pointerId, stroke: { c: this.color, w: Math.round(width * 10) / 10, p: [pt] } };
            this.current.strokes.push(this.drawing.stroke);
            this.render();
        });

        this.paper.addEventListener('pointermove', e => {
            if (!this.drawing || this.drawing.id !== e.pointerId) return;
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            events.forEach(ev => {
                const pt = this.toPage(ev);
                if (this.drawing.erase) {
                    this.eraseAt(pt);
                } else {
                    const pts = this.drawing.stroke.p;
                    const last = pts[pts.length - 1];
                    if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 1.2) pts.push(pt);
                }
            });
            this.render();
        });

        const end = e => {
            if (!this.drawing || this.drawing.id !== e.pointerId) return;
            this.drawing = null;
            this.saveAll();
        };
        this.paper.addEventListener('pointerup', end);
        this.paper.addEventListener('pointercancel', end);

        document.addEventListener('keydown', e => {
            if (this.root.hidden || this.root.classList.contains('text-mode') || this.editing) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            }
        });
    }

    toPage(e) {
        const r = this.paper.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * this.pageW;
        const y = ((e.clientY - r.top) / r.height) * this.pageH;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    }

    textBox(item) {
        this.ctx.save();
        this.ctx.font = `600 ${item.f}px Inter, sans-serif`;
        const w = this.ctx.measureText(item.s).width;
        this.ctx.restore();
        return { x: item.x, y: item.y - item.f * 0.8, w, h: item.f };
    }

    hitText([x, y], pad = 0) {
        const items = this.current.strokes;
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].k !== 'text') continue;
            const b = this.textBox(items[i]);
            if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return items[i];
        }
        return null;
    }

    snapRow([x, y]) {
        const t = this.template();
        if (!t.rows.length) return [x, y];
        const m = 40;
        const rowH = Math.min(140, (this.pageH - m * 2) / t.rows.length);
        const i = Math.floor((y - m) / rowH);
        if (i < 0 || i >= t.rows.length || t.rows[i].startsWith('# ')) return [x, y];
        return [Math.max(x, m + 8), m + (i + 1) * rowH - 12];
    }

    startText(pt) {
        this.commitText();
        const existing = this.hitText(pt, 6);
        const item = existing || { k: 'text', x: 0, y: 0, s: '', c: this.color, f: this.textSize };
        if (!existing) [item.x, item.y] = this.snapRow(pt);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'scratch-text-input';
        input.value = item.s;
        input.spellcheck = false;
        input.style.color = item.c;
        this.editing = { item, input, isNew: !existing, color: item.c };
        this.placeInput();
        this.root.appendChild(input);
        this.render();
        requestAnimationFrame(() => input.focus());
        input.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') this.commitText();
            if (e.key === 'Escape') this.commitText(true);
        });
        input.addEventListener('blur', () => this.commitText());
    }

    placeInput() {
        const ed = this.editing;
        if (!ed) return;
        const { item, input } = ed;
        const css = this.scale / (window.devicePixelRatio || 1);
        const r = this.paper.getBoundingClientRect();
        const root = this.root.getBoundingClientRect();
        input.style.left = r.left - root.left + item.x * css + 'px';
        input.style.top = r.top - root.top + (item.y - item.f * 0.95) * css + 'px';
        input.style.fontSize = item.f * css + 'px';
        input.style.height = item.f * 1.25 * css + 'px';
        input.style.width = Math.max(120, (this.pageW - item.x - 40) * css) + 'px';
    }

    commitText(cancel = false) {
        const ed = this.editing;
        if (!ed) return;
        this.editing = null;
        const text = ed.input.value.trim();
        ed.input.remove();
        if (!this.current) return;
        if (!cancel) {
            ed.item.s = text;
            ed.item.c = ed.color;
            if (ed.isNew && text) this.current.strokes.push(ed.item);
            if (!ed.isNew && !text) this.current.strokes = this.current.strokes.filter(s => s !== ed.item);
            this.saveAll();
        }
        this.render();
    }

    eraseAt([x, y]) {
        const radius = 14;
        const before = this.current.strokes.length;
        const hitText = this.hitText([x, y], radius);
        this.current.strokes = this.current.strokes.filter(s => s.k === 'text'
            ? s !== hitText
            : !s.p.some(([px, py]) => Math.hypot(px - x, py - y) < radius + s.w));
        if (this.current.strokes.length !== before) this.render();
    }

    undo() {
        if (!this.current || !this.current.strokes.length) return;
        this.current.strokes.pop();
        this.saveAll();
        this.render();
    }

    clear() {
        if (!this.current || !this.current.strokes.length) return;
        this.current.strokes = [];
        this.saveAll();
        this.render();
    }

    layout() {
        const pad = 16;
        const textMode = this.root.classList.contains('text-mode');
        const toolbar = textMode ? 0 : 56;
        const vw = this.stage.clientWidth - pad * 2;
        const vh = this.stage.clientHeight - pad * 2 - toolbar;
        if (vw <= 0 || vh <= 0) return;
        const scale = Math.min(vw / this.pageW, vh / this.pageH);
        const w = this.pageW * scale;
        const h = this.pageH * scale;
        const left = (this.stage.clientWidth - w) / 2 + 'px';
        const top = pad + toolbar + (vh - h) / 2 + 'px';
        [this.paper, this.note].forEach(el => {
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.left = left;
            el.style.top = top;
        });
        if (textMode) return;
        const dpr = window.devicePixelRatio || 1;
        this.paper.width = Math.round(w * dpr);
        this.paper.height = Math.round(h * dpr);
        this.scale = scale * dpr;
        this.render();
        this.placeInput();
    }

    render() {
        const ctx = this.ctx;
        const k = this.scale || 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.paper.width, this.paper.height);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        this.drawTemplate(ctx);
        if (!this.current) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.current.strokes.forEach(s => {
            if (this.editing && this.editing.item === s) return;
            if (s.k === 'text') this.drawText(ctx, s);
            else this.drawStroke(ctx, s);
        });
    }

    line(ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    drawTemplate(ctx) {
        const t = this.template();
        const m = 40;
        if (t.paper === 'lined') {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            for (let y = 90; y < this.pageH - m; y += 50) this.line(ctx, m, y, this.pageW - m, y);
            ctx.strokeStyle = 'rgba(255,107,107,0.35)';
            this.line(ctx, 110, m, 110, this.pageH - m);
            return;
        }
        if (t.paper === 'grid') {
            ctx.strokeStyle = 'rgba(255,255,255,0.09)';
            ctx.lineWidth = 1.2;
            for (let x = m; x <= this.pageW - m; x += 40) this.line(ctx, x, m, x, this.pageH - m);
            for (let y = m; y <= this.pageH - m; y += 40) this.line(ctx, m, y, this.pageW - m, y);
            return;
        }
        if (!t.rows.length) return;
        const rowH = Math.min(140, (this.pageH - m * 2) / t.rows.length);
        ctx.textBaseline = 'top';
        t.rows.forEach((label, i) => {
            const y = m + i * rowH;
            if (label.startsWith('# ')) {
                ctx.fillStyle = 'rgba(29,89,149,0.35)';
                ctx.fillRect(m, y + 6, this.pageW - m * 2, rowH - 12);
                ctx.fillStyle = '#ffffff';
                ctx.font = '700 28px Inter, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(label.slice(2).toUpperCase(), m + 14, y + rowH / 2);
                ctx.textBaseline = 'top';
                return;
            }
            ctx.fillStyle = 'rgba(40,123,204,0.95)';
            ctx.font = '600 24px Inter, sans-serif';
            ctx.fillText(label.toUpperCase(), m + 8, y + 10);
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 2;
            this.line(ctx, m, y + rowH, this.pageW - m, y + rowH);
        });
    }

    drawText(ctx, t) {
        ctx.fillStyle = t.c;
        ctx.font = `600 ${t.f}px Inter, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(t.s, t.x, t.y);
    }

    drawStroke(ctx, s) {
        const p = s.p;
        ctx.strokeStyle = s.c;
        ctx.fillStyle = s.c;
        ctx.lineWidth = s.w;
        if (p.length === 1) {
            ctx.beginPath();
            ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length - 1; i++) {
            const mx = (p[i][0] + p[i + 1][0]) / 2;
            const my = (p[i][1] + p[i + 1][1]) / 2;
            ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
        }
        const last = p[p.length - 1];
        ctx.lineTo(last[0], last[1]);
        ctx.stroke();
    }
}
