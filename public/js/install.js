(() => {
    const OPENS_KEY = 'aeronav_chart_opens';
    const DISMISSED_KEY = 'aeronav_install_dismissed';
    const OPENS_NEEDED = 3;

    const nudge = document.getElementById('installNudge');
    const nudgeSub = document.getElementById('installNudgeSub');
    const nudgeGo = document.getElementById('installNudgeGo');
    const nudgeClose = document.getElementById('installNudgeClose');
    const linkRow = document.getElementById('installLink');
    if (!nudge || !linkRow) return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const IOS_STEPS = 'Tap the Share button, then "Add to Home Screen".';

    let deferredPrompt = null;

    const read = (key) => {
        try { return localStorage.getItem(key); } catch (error) { return null; }
    };
    const write = (key, value) => {
        try { localStorage.setItem(key, value); } catch (error) { return; }
    };

    const canInstall = () => Boolean(deferredPrompt) || isIos;

    const refresh = () => {
        linkRow.hidden = !canInstall();
        const earned = Number(read(OPENS_KEY) || 0) >= OPENS_NEEDED;
        nudge.hidden = !(canInstall() && earned && read(DISMISSED_KEY) !== '1');
        if (isIos && !deferredPrompt) {
            nudgeSub.textContent = IOS_STEPS;
            nudgeGo.hidden = true;
        } else {
            nudgeGo.hidden = false;
        }
    };

    const dismiss = () => {
        write(DISMISSED_KEY, '1');
        refresh();
    };

    const install = async () => {
        if (deferredPrompt) {
            const prompt = deferredPrompt;
            deferredPrompt = null;
            prompt.prompt();
            await prompt.userChoice.catch(() => null);
            dismiss();
            return;
        }
        if (isIos) {
            if (window.Swal) {
                window.Swal.fire({ title: 'Install AeroNav', text: IOS_STEPS, confirmButtonText: 'Got it' });
            } else {
                window.alert(IOS_STEPS);
            }
        }
    };

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        refresh();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        write(DISMISSED_KEY, '1');
        linkRow.hidden = true;
        nudge.hidden = true;
    });

    document.addEventListener('aeronav:chart-open', () => {
        write(OPENS_KEY, String(Number(read(OPENS_KEY) || 0) + 1));
        refresh();
    });

    nudgeGo.addEventListener('click', install);
    linkRow.addEventListener('click', install);
    nudgeClose.addEventListener('click', dismiss);

    refresh();
})();
