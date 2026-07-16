/*
 * booknav.js -- client-side prev/next navigation for the static zf_info pages.
 *
 * Loaded with `defer` from the shared layout footer, so it NEVER blocks page
 * render: the page paints first, then this runs and (asynchronously) fetches the
 * TOC manifest + the current page's collection spine, and -- only if the page is
 * in a spine -- inserts a "Prev | Contents | Next" bar at the bottom. Non-spine
 * pages (collection landing/TOC pages, the anatomy dictionary, etc.) get nothing.
 *
 * Cost: zero network for non-zf_info pages (synchronous bail-out); otherwise at
 * most two small, browser-cacheable JSON fetches (manifest + one collection),
 * none of which block rendering.
 *
 * DISABLED BY DEFAULT: it does nothing unless localStorage 'zfin-booknav' === 'on'
 * (toggle on /zf_info/toc/fulltoc.html).
 */
(function () {
    var path = window.location.pathname;

    // Cheap synchronous bail-out -- no fetch (and no work) for pages that can't
    // or shouldn't show nav.
    if (path.indexOf('/zf_info/') !== 0) return;      // not a zf_info page
    if (path.indexOf('/zf_info/toc/') === 0) return;  // the TOC/index pages themselves
    // Off by default; opt in via the toggle on /zf_info/toc/fulltoc.html.
    try { if (localStorage.getItem('zfin-booknav') !== 'on') return; } catch (e) { return; }

    var TOC = '/zf_info/toc/';
    var decoder = document.createElement('textarea');
    function decode(s) { decoder.innerHTML = s || ''; return decoder.value; }

    // Map the current path to a collection: longest matching prefix wins,
    // else the manifest's `fallback` collection (misc single pages).
    function pick(collections) {
        var best = null, bestLen = -1, fallback = null;
        collections.forEach(function (c) {
            if (c.fallback) fallback = c;
            (c.prefixes || []).forEach(function (pre) {
                if (path.indexOf(pre) === 0 && pre.length > bestLen) { best = c; bestLen = pre.length; }
            });
        });
        return best || fallback;
    }

    fetch(TOC + 'list-of-tocs.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (manifest) {
            if (!manifest || !manifest.collections) return null;
            var c = pick(manifest.collections);
            return c ? fetch(TOC + c.json).then(function (r) { return r.ok ? r.json() : null; }) : null;
        })
        .then(function (data) {
            if (!data || !data.spine) return;
            var spine = data.spine, idx = -1;
            for (var i = 0; i < spine.length; i++) {
                if (spine[i].href === path) { idx = i; break; }
            }
            if (idx < 0) return;                       // not part of this spine -> no nav
            insertNav(spine[idx - 1], spine[idx + 1], data.seed || (TOC + 'fulltoc.html'));
        })
        .catch(function () { /* progressive enhancement: silent on any failure */ });

    function insertNav(prev, next, contentsHref) {
        var nav = document.createElement('nav');
        nav.className = 'booknav';
        nav.setAttribute('aria-label', 'Page navigation');

        function cell(cls, page, label) {
            if (!page) { var s = document.createElement('span'); s.className = 'booknav-' + cls; return s; }
            var a = document.createElement('a');
            a.className = 'booknav-' + cls;
            a.href = page.href;
            a.textContent = label;
            if (page.title) a.title = decode(page.title);
            return a;
        }

        nav.appendChild(cell('prev', prev, '← Previous'));
        var up = document.createElement('a');
        up.className = 'booknav-up';
        up.href = contentsHref;
        up.textContent = 'Contents';
        nav.appendChild(up);
        nav.appendChild(cell('next', next, 'Next →'));

        if (!document.getElementById('booknav-style')) {
            var st = document.createElement('style');
            st.id = 'booknav-style';
            st.textContent =
                '.booknav{display:flex;align-items:center;gap:1rem;max-width:60rem;' +
                'margin:2.5rem auto 1.5rem;padding:.75rem 1rem;border-top:1px solid #ccc;' +
                'font-family:sans-serif;font-size:.95rem}' +
                '.booknav a{text-decoration:none;white-space:nowrap}.booknav a:hover{text-decoration:underline}' +
                '.booknav-prev{flex:1 1 0;text-align:left}' +
                '.booknav-up{flex:0 0 auto;font-weight:600}' +
                '.booknav-next{flex:1 1 0;text-align:right}';
            document.head.appendChild(st);
        }

        var main = document.getElementById('main') || document.querySelector('main');
        if (main) main.insertAdjacentElement('afterend', nav);
        else document.body.appendChild(nav);
    }
})();
