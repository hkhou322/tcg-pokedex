/* TCG Pokédex — vanilla live card browser (pokemontcg.io v2) */
(function () {
  "use strict";

  var API = "https://api.pokemontcg.io/v2";
  var API_KEY = (((document.querySelector('meta[name="poketcg-api-key"]') || {}).content) || "").trim();
  var PAGE_SIZE = 10;
  var reqId = 0; // guards against out-of-order responses (typing race)

  var state = {
    page: 1,
    pageSize: PAGE_SIZE,
    search: "",
    type: "",
    setId: "",
    cards: [],
    totalCount: null,
    loading: false,
    hasMore: false,
    controller: null,
    filtersLoaded: false
  };

  var el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    el.grid = document.getElementById("card-grid");
    el.search = document.getElementById("search");
    el.typeFilter = document.getElementById("type-filter");
    el.setFilter = document.getElementById("set-filter");
    el.count = document.getElementById("result-count");
    el.loadMore = document.getElementById("load-more");
    el.modal = document.getElementById("card-modal");
    el.modalBody = document.getElementById("modal-body");

    el.search.addEventListener("input", debounce(function () {
      state.search = el.search.value.trim();
      reload();
    }, 350));
    el.typeFilter.addEventListener("change", function () {
      state.type = el.typeFilter.value;
      reload();
    });
    el.setFilter.addEventListener("change", function () {
      state.setId = el.setFilter.value;
      reload();
    });
    el.loadMore.addEventListener("click", function () { fetchCards(false); });

    el.modal.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute("data-close")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });

    reload();
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function buildQuery() {
    var parts = [];
    if (state.search) parts.push("name:" + state.search + "*");
    if (state.type) parts.push("types:" + state.type);
    if (state.setId) parts.push("set.id:" + state.setId);
    return parts.join(" ");
  }

  function loadFilters() {
    fetchJSON(API + "/types")
      .then(function (types) {
        types.data.forEach(function (t) {
          el.typeFilter.appendChild(option(t, t));
        });
      })
      .catch(function () { /* non-fatal */ });

    fetchJSON(API + "/sets?orderBy=-releaseDate&pageSize=60")
      .then(function (sets) {
        (sets.data || []).forEach(function (s) {
          el.setFilter.appendChild(option(s.id, s.name));
        });
      })
      .catch(function () { /* non-fatal */ });
  }

  function option(value, label) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  }

  function reload() {
    state.page = 1;
    state.cards = [];
    el.grid.innerHTML = '<div class="state">Loading cards…</div>';
    fetchCards(true);
  }

  function fetchCards(reset) {
    if (state.loading) return;
    state.loading = true;
    updateLoadMore(); // shows "Loading…" + disables button during the (slow) fetch
    if (reset) showSkeletons();

    var myId = ++reqId; // only the newest request may mutate the grid

    if (state.controller) state.controller.abort();
    state.controller = new AbortController();

    var params = new URLSearchParams();
    params.set("pageSize", state.pageSize);
    params.set("page", state.page);
    var q = buildQuery();
    if (q) params.set("q", q);

    fetchJSON(API + "/cards?" + params.toString(), state.controller.signal)
      .then(function (data) {
        if (myId !== reqId) return; // a newer query superseded this one
        var cards = data.data || [];
        if (state.page === 1) state.cards = [];
        state.cards = state.cards.concat(cards);
        state.totalCount = (typeof data.totalCount === "number") ? data.totalCount : null;
        state.hasMore = cards.length === state.pageSize;
        state.page += 1;
        render(cards, state.page === 2);
        updateCount();
        updateLoadMore();
        // Populate the type/set filters only after the first batch returns,
        // so the initial /cards request isn't throttled by /types + /sets.
        if (!state.filtersLoaded) {
          state.filtersLoaded = true;
          loadFilters();
        }
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (myId !== reqId) return; // ignore errors from a stale request
        if (state.page === 1) {
          showError(err && err.message ? err.message : "Failed to load cards.");
        } else {
          // Non-destructive: keep existing cards, let the user retry the next page.
          state.loading = false;
          updateLoadMore();
        }
      })
      .then(function () {
        if (myId === reqId) state.loading = false;
        hideSkeletons();
        updateLoadMore();
      });
  }

  function fetchJSON(url, signal) {
    var opts = { headers: {} };
    if (API_KEY) opts.headers["X-Api-Key"] = API_KEY;
    if (signal) opts.signal = signal;
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function showSkeletons() {
    var html = "";
    for (var i = 0; i < PAGE_SIZE; i++) {
      html += '<div class="card skeleton"><div class="card-img"></div><div class="card-meta"></div></div>';
    }
    el.grid.innerHTML = html;
  }
  function hideSkeletons() {
    var sk = el.grid.querySelectorAll(".skeleton");
    if (sk.length && state.cards.length) {
      el.grid.innerHTML = "";
      render(state.cards, true);
    }
  }

  function render(cards, replaceAll) {
    if (replaceAll) el.grid.innerHTML = "";
    if (!cards.length && !state.cards.length) {
      el.grid.innerHTML = '<div class="state">No cards match your filters.</div>';
      return;
    }
    cards.forEach(function (card) {
      el.grid.appendChild(cardElement(card));
    });
  }

  function cardElement(card) {
    var div = document.createElement("div");
    var typeClass = (card.types || []).map(function (t) { return "type-" + t.toLowerCase(); }).join(" ");
    div.className = "card" + (typeClass ? " " + typeClass : "");
    var img = (card.images && card.images.small) || "";
    var types = (card.types || []).map(function (t) {
      return '<span class="chip t type-' + t.toLowerCase() + '">' + escapeHtml(t) + "</span>";
    }).join("");
    var hp = card.hp ? '<span class="chip hp">HP ' + escapeHtml(card.hp) + "</span>" : "";
    var setName = (card.set && card.set.name) ? card.set.name : "";
    var num = card.number ? " #" + card.number : "";

    div.innerHTML =
      '<div class="card-img">' +
        (img
          ? '<img loading="lazy" src="' + img + '" alt="' + escapeHtml(card.name) + '" onerror="this.parentNode.innerHTML=\'<div class=&quot;ph&quot;>No image</div>\'">'
          : '<div class="ph">No image</div>') +
      "</div>" +
      '<div class="card-meta">' +
        '<div class="card-name">' + escapeHtml(card.name) + "</div>" +
        '<div class="card-sub">' + hp + types +
          (setName ? '<span class="chip">' + escapeHtml(setName) + escapeHtml(num) + "</span>" : "") +
        "</div>" +
      "</div>";

    div.addEventListener("click", function () { openModal(card); });
    return div;
  }

  function openModal(card) {
    var img = (card.images && (card.images.large || card.images.small)) || "";
    var types = (card.types || []).map(function (t) {
      return '<span class="chip t type-' + t.toLowerCase() + '">' + escapeHtml(t) + "</span>";
    }).join("");
    var hp = card.hp ? '<span class="chip hp">HP ' + escapeHtml(card.hp) + "</span>" : "";
    var rarity = card.rarity ? '<span class="chip">' + escapeHtml(card.rarity) + "</span>" : "";
    var setName = (card.set && card.set.name) ? card.set.name : "Unknown set";
    var series = (card.set && card.set.series) ? " · " + card.set.series : "";

    var abilities = (card.abilities || []).map(function (a) {
      return '<div class="atk"><div class="name">' + escapeHtml(a.name) +
        (a.type ? ' <span class="cost">(' + escapeHtml(a.type) + ")</span>" : "") +
        "</div><div>" + escapeHtml(a.text || "") + "</div></div>";
    }).join("");

    var attacks = (card.attacks || []).map(function (a) {
      var cost = (a.cost || []).join("");
      return '<div class="atk"><div class="name">' + escapeHtml(a.name) +
        (cost ? ' <span class="cost">[' + escapeHtml(cost) + "]</span>" : "") +
        (a.damage ? ' <span class="cost">' + escapeHtml(a.damage) + "</span>" : "") +
        "</div><div>" + escapeHtml(a.text || "") + "</div></div>";
    }).join("");

    var extras = [];
    (card.weaknesses || []).forEach(function (w) {
      extras.push("Weakness: " + w.type + (w.value ? " " + w.value : ""));
    });
    (card.resistances || []).forEach(function (r) {
      extras.push("Resistance: " + r.type + (r.value ? " " + r.value : ""));
    });
    if (card.retreatCost !== undefined && card.retreatCost !== null) {
      extras.push("Retreat: " + card.retreatCost);
    }

    el.modalBody.innerHTML =
      '<div class="modal-img">' +
        (img ? '<img src="' + img + '" alt="' + escapeHtml(card.name) + '" onerror="this.parentNode.innerHTML=\'<div class=&quot;ph&quot;>No image</div>\'">' : '<div class="ph">No image</div>') +
      "</div>" +
      '<div class="modal-info">' +
        "<h2 id=\"modal-title\">" + escapeHtml(card.name) + "</h2>" +
        '<div class="modal-sub">' + escapeHtml(setName) + escapeHtml(series) + (card.number ? escapeHtml(" #" + card.number) : "") + "</div>" +
        '<div class="modal-attrs">' + hp + types + rarity + "</div>" +
        (abilities ? '<div class="modal-section"><h3>Abilities</h3>' + abilities + "</div>" : "") +
        (attacks ? '<div class="modal-section"><h3>Attacks</h3>' + attacks + "</div>" : "") +
        (extras.length ? '<div class="modal-section"><h3>Defense</h3><div class="modal-attrs">' +
            extras.map(function (e) { return '<span class="chip">' + escapeHtml(e) + "</span>"; }).join("") +
          "</div></div>" : "") +
        (card.flavorText ? '<div class="modal-flav">' + escapeHtml(card.flavorText) + "</div>" : "") +
      "</div>";

    el.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    el.modal.hidden = true;
    el.modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  function updateCount() {
    var shown = state.cards.length;
    if (state.totalCount !== null && (state.search || state.type || state.setId)) {
      el.count.textContent = "Showing " + shown + " of " + state.totalCount;
    } else {
      el.count.textContent = shown ? shown + " cards" : "";
    }
  }

  function updateLoadMore() {
    if (!el.loadMore) return;
    if (state.loading) {
      el.loadMore.disabled = true;
      el.loadMore.textContent = "Loading…";
      el.loadMore.hidden = false;
    } else {
      el.loadMore.textContent = state.hasMore ? "Load more" : "No more cards";
      el.loadMore.disabled = !state.hasMore;
      el.loadMore.hidden = !state.hasMore;
    }
  }

  function showError(msg) {
    el.grid.innerHTML = '<div class="state error">Something went wrong: ' +
      escapeHtml(msg) + '.<br><button class="load-more" onclick="location.reload()">Retry</button></div>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
