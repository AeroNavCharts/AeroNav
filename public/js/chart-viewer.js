class ChartViewer {
    constructor(wrap, opts = {}) {
        this.wrap = wrap;
        this.onZoom = opts.onZoom || (() => { });
        this.stage = document.createElement('div');
        this.stage.className = 'chart-stage';
        this.stage.hidden = true;
        this.img = document.createElement('img');
        this.img.className = 'chart-img';
        this.img.alt = '';
        this.img.draggable = false;
        this.img.referrerPolicy = 'no-referrer';
        this.stage.appendChild(this.img);
        wrap.insertBefore(this.stage, wrap.querySelector('iframe'));
        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.fitScale = 1;
        this.token = 0;
        this.pointers = new Map();
        this.pinch = null;
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
        this.stage.hidden = true;
        this.img.removeAttribute('src');
        this.natW = 0;
        this.natH = 0;
    }

    get active() {
        return !this.stage.hidden;
    }

    measureFit() {
        const pad = 16;
        const w = this.stage.clientWidth - pad * 2;
        const h = this.stage.clientHeight - pad * 2;
        this.fitScale = Math.max(0.01, Math.min(w / this.natW, h / this.natH));
    }

    fit() {
        if (!this.natW) return;
        this.measureFit();
        this.scale = this.fitScale;
        this.x = (this.stage.clientWidth - this.natW * this.scale) / 2;
        this.y = (this.stage.clientHeight - this.natH * this.scale) / 2;
        this.apply();
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
        const w = this.natW * this.scale;
        const h = this.natH * this.scale;
        this.x = Math.min(this.stage.clientWidth - keep, Math.max(keep - w, this.x));
        this.y = Math.min(this.stage.clientHeight - keep, Math.max(keep - h, this.y));
        this.img.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
        this.onZoom(Math.round((this.scale / this.fitScale) * 100));
    }

    point(e) {
        const r = this.stage.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
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
            const p = this.point(e);
            if (this.scale > this.fitScale * 1.05) this.fit();
            else this.zoomAt(p.x, p.y, 2.5);
        });

        stage.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            stage.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, this.point(e));
            this.pinch = null;
            stage.classList.add('dragging');
        });

        stage.addEventListener('pointermove', (e) => {
            const prev = this.pointers.get(e.pointerId);
            if (!prev) return;
            const now = this.point(e);
            this.pointers.set(e.pointerId, now);
            if (this.pointers.size === 1) {
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
            if (!this.pointers.size) stage.classList.remove('dragging');
        };
        stage.addEventListener('pointerup', release);
        stage.addEventListener('pointercancel', release);

        new ResizeObserver(() => {
            if (!this.active || !this.natW || !stage.clientWidth) return;
            const wasFit = Math.abs(this.scale - this.fitScale) < 1e-6;
            if (wasFit) this.fit();
            else {
                this.measureFit();
                this.apply();
            }
        }).observe(stage);
    }
}
