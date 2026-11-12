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
    const isAndroid = /android/i.test(ua);
    const PITCH = 'Charts open instantly and work offline.';
    const IOS_STEPS = 'Tap the Share button, then "Add to Home Screen".';
    const ANDROID_STEPS = 'Tap the browser menu (three dots), then "Install app" or "Add to Home screen".';
    const manualSteps = isIos ? IOS_STEPS : isAndroid ? ANDROID_STEPS : '';

    let deferredPrompt = null;

    const read = (key) => {
        try { return localStorage.getItem(key); } catch (error) { return null; }
    };
    const write = (key, value) => {
        try { localStorage.setItem(key, value); } catch (error) { return; }
    };

    const canInstall = () => Boolean(deferredPrompt) || Boolean(manualSteps);

    const refresh = () => {
        linkRow.hidden = !canInstall();
        const earned = Number(read(OPENS_KEY) || 0) >= OPENS_NEEDED;
        nudge.hidden = !(canInstall() && earned && read(DISMISSED_KEY) !== '1');
        const manual = !deferredPrompt && Boolean(manualSteps);
        nudgeSub.textContent = manual ? manualSteps : PITCH;
        nudgeGo.hidden = manual;
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
        if (!manualSteps) return;
        if (window.Swal) {
            window.Swal.fire({ title: 'Install AeroNav', text: manualSteps, confirmButtonText: 'Got it' });
        } else {
            window.alert(manualSteps);
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
