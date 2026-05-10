(function () {
  'use strict';

  var REPO_API = 'https://api.github.com/repos/aiteam-itera/autonomia';

  var list = document.querySelector('[data-feed-list]');
  if (!list) return;
  var fallbackEl = document.querySelector('[data-feed-fallback]');
  var fallbackMsgEl = fallbackEl && fallbackEl.querySelector('[data-feed-fallback-msg]');

  function relativeTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var ms = Date.now() - t;
    var min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    var d = Math.round(h / 24);
    if (d < 30) return 'hace ' + d + ' d';
    var mo = Math.round(d / 30);
    if (mo < 12) return 'hace ' + mo + (mo === 1 ? ' mes' : ' meses');
    var y = Math.round(mo / 12);
    return 'hace ' + y + (y === 1 ? ' año' : ' años');
  }

  function fetchJson(path) {
    return fetch(REPO_API + path, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error('GitHub API ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    });
  }

  function runLabel(run) {
    if (run.status !== 'completed') {
      return run.status === 'in_progress' ? 'en curso' : (run.status || 'pendiente');
    }
    if (run.conclusion === 'success') return 'OK';
    if (run.conclusion === 'failure') return 'falló';
    if (run.conclusion === 'cancelled') return 'cancelado';
    return run.conclusion || 'completado';
  }

  function badgeTone(run) {
    if (run.status !== 'completed') return 'neutral';
    if (run.conclusion === 'success') return 'ok';
    if (run.conclusion === 'failure') return 'err';
    return 'neutral';
  }

  function el(tag, opts, children) {
    var node = document.createElement(tag);
    opts = opts || {};
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.href) node.href = opts.href;
    if (opts.dateTime) node.dateTime = opts.dateTime;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (k) {
        node.setAttribute(k, opts.attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }

  function buildItem(item) {
    var li = el('li', { class: 'feed__item feed__item--' + item.kind });

    var icon = el('span', {
      class: 'feed__kind',
      text: item.icon,
      attrs: { 'aria-hidden': 'true' },
    });

    var line = el('p', { class: 'feed__line' });
    if (item.lead) {
      line.appendChild(el('code', { text: item.lead }));
      line.appendChild(document.createTextNode(' '));
    }
    line.appendChild(document.createTextNode(item.text));
    if (item.badge) {
      line.appendChild(document.createTextNode(' '));
      line.appendChild(
        el('strong', {
          text: item.badge,
          class: 'feed__badge feed__badge--' + (item.badgeTone || 'neutral'),
        })
      );
    }

    var meta = el('p', { class: 'feed__meta' });
    meta.appendChild(document.createTextNode(item.author));
    meta.appendChild(document.createTextNode(' · '));
    meta.appendChild(
      el('time', { text: relativeTime(item.iso), dateTime: item.iso || '' })
    );
    if (item.link) {
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(
        el('a', {
          text: item.linkLabel || 'abrir',
          href: item.link,
          attrs: { rel: 'noopener', target: '_blank' },
        })
      );
    }

    var body = el('div', { class: 'feed__body' }, [line, meta]);
    li.appendChild(icon);
    li.appendChild(body);
    return li;
  }

  function renderItems(items) {
    list.innerHTML = '';
    list.setAttribute('aria-busy', 'false');
    items.forEach(function (it) {
      list.appendChild(buildItem(it));
    });
  }

  function showFallback(message) {
    list.innerHTML = '';
    list.setAttribute('aria-busy', 'false');
    if (!fallbackEl) return;
    if (message && fallbackMsgEl) fallbackMsgEl.textContent = message;
    fallbackEl.hidden = false;
  }

  Promise.allSettled([
    fetchJson('/commits/main'),
    fetchJson('/actions/runs?per_page=20&branch=main'),
  ])
    .then(function (results) {
      var commitRes = results[0];
      var runsRes = results[1];

      if (commitRes.status === 'rejected' && runsRes.status === 'rejected') {
        var status = (commitRes.reason && commitRes.reason.status) ||
          (runsRes.reason && runsRes.reason.status);
        showFallback(
          status === 403
            ? 'GitHub ha rate-limiteado esta sesión. Mira el historial completo en GitHub:'
            : 'No pudimos cargar los últimos eventos, mira el historial en GitHub:'
        );
        return;
      }

      var items = [];

      if (commitRes.status === 'fulfilled') {
        var c = commitRes.value;
        var sha = (c.sha || '').slice(0, 7);
        var msg = ((c.commit && c.commit.message) || '').split('\n')[0];
        var name =
          (c.commit && c.commit.author && c.commit.author.name) ||
          (c.author && c.author.login) ||
          'agente';
        var iso =
          (c.commit && c.commit.author && c.commit.author.date) ||
          (c.commit && c.commit.committer && c.commit.committer.date) ||
          '';
        items.push({
          kind: 'commit',
          icon: '◇',
          lead: sha,
          text: msg || 'commit sin título',
          author: name,
          iso: iso,
          link: c.html_url,
          linkLabel: 'ver commit',
        });
      }

      if (runsRes.status === 'fulfilled') {
        var runs = (runsRes.value && runsRes.value.workflow_runs) || [];
        var deploy = runs.find(function (r) {
          return /deploy/i.test(r.name || '');
        });
        var validate = runs.find(function (r) {
          return /validate/i.test(r.name || '');
        });

        if (deploy) {
          items.push({
            kind: 'deploy',
            icon: '▲',
            text: 'Deploy a IONOS —',
            badge: runLabel(deploy),
            badgeTone: badgeTone(deploy),
            author: (deploy.actor && deploy.actor.login) || 'agente',
            iso: deploy.updated_at || deploy.created_at || '',
            link: deploy.html_url,
            linkLabel: 'ver run',
          });
        }

        if (validate) {
          items.push({
            kind: 'validate',
            icon: '◉',
            text: 'Validación visual —',
            badge: runLabel(validate),
            badgeTone: badgeTone(validate),
            author: (validate.actor && validate.actor.login) || 'agente',
            iso: validate.updated_at || validate.created_at || '',
            link: validate.html_url,
            linkLabel: 'screenshot + meta',
          });
        }
      }

      if (items.length === 0) {
        showFallback('No pudimos cargar los últimos eventos, mira el historial en GitHub:');
        return;
      }

      items.sort(function (a, b) {
        return (new Date(b.iso).getTime() || 0) - (new Date(a.iso).getTime() || 0);
      });
      renderItems(items);
    })
    .catch(function () {
      showFallback('No pudimos cargar los últimos eventos, mira el historial en GitHub:');
    });
})();
