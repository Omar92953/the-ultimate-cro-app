/*
 * The Ultimate CRO App — <ucro-cross-sell> and <ucro-upsell>.
 * Every element sets itself up in connectedCallback and undoes it in disconnectedCallback,
 * because the theme editor (and some themes on variant change) replace sections wholesale.
 */
(function () {
  var U = window.UCRO;
  if (!U) return;

  function showError(el, message) {
    var box = el.querySelector('.ucro__error');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  /* ---------------------------------------------------------------- Cross-sell -- */
  if (!customElements.get('ucro-cross-sell')) {
    customElements.define('ucro-cross-sell', class extends HTMLElement {
      connectedCallback() {
        this.list = this.querySelector('.ucro-cross__list');
        this.button = this.querySelector('.ucro-cross__add');
        this.label = this.querySelector('.ucro-cross__label');
        this.base = this.dataset.label || '';
        U.decorate(this);

        this.onChange = (e) => {
          var select = e.target.closest && e.target.closest('select.ucro-offer__variant');
          if (select) {
            var opt = select.options[select.selectedIndex];
            var row = select.closest('.ucro-offer');
            var price = row.querySelector('[data-ucro-price]');
            var was = row.querySelector('[data-ucro-was]');
            if (price && opt.dataset.price) price.textContent = opt.dataset.price;
            if (was && opt.dataset.was) was.textContent = opt.dataset.was;
          }
          this.refresh();
        };
        this.onClick = (e) => {
          if (e.target.closest('.ucro-cross__add')) this.submit();
        };
        this.addEventListener('change', this.onChange);
        this.addEventListener('click', this.onClick);

        if (this.dataset.mode === 'recommend') this.loadRecommendations();
        this.refresh();
      }

      disconnectedCallback() {
        this.removeEventListener('change', this.onChange);
        this.removeEventListener('click', this.onClick);
      }

      loadRecommendations() {
        var id = this.dataset.productId;
        var limit = Number(this.dataset.limit) || 4;
        this.hidden = true;
        U.recommendations(id, 'complementary', limit)
          .then((list) => (list.length ? list : U.recommendations(id, 'related', limit)))
          .then((list) => {
            var fmt = this.dataset.moneyFormat;
            var checked = this.dataset.checked === 'true';
            list.filter((p) => p.available && String(p.id) !== id).forEach((p) => {
              this.list.appendChild(this.row(p, fmt, checked));
            });
            if (this.list.children.length) {
              this.hidden = false;
              U.decorate(this);
              this.refresh();
            }
          });
      }

      // Builds the same markup as snippets/ucro-offer-row.liquid (no discount: no rule matched).
      row(p, fmt, checked) {
        var li = document.createElement('li');
        li.className = 'ucro-offer';
        var variants = (p.variants || []).filter((v) => v.available);
        var first = variants[0] || p.variants[0];
        var image = p.featured_image
          ? '<img src="' + U.img(p.featured_image, 240) + '" alt="" loading="lazy" width="72" height="72">'
          : '';
        li.innerHTML =
          '<label class="ucro-offer__row"><input type="checkbox" class="ucro-offer__check"><span class="ucro-offer__box" aria-hidden="true"></span>' +
          '<span class="ucro-offer__img">' + image + '</span><span class="ucro-offer__body"><a class="ucro-offer__title"></a>' +
          '<span class="ucro-offer__prices"><span class="ucro-offer__price" data-ucro-price></span></span></span></label>';
        li.querySelector('.ucro-offer__check').checked = checked;
        var link = li.querySelector('.ucro-offer__title');
        link.textContent = p.title;
        link.href = p.url;
        li.querySelector('[data-ucro-price]').textContent = U.money(first.price, fmt);
        li.querySelector('img') && (li.querySelector('img').alt = p.title);
        if (variants.length > 1) {
          var select = document.createElement('select');
          select.className = 'ucro-offer__variant ucro-select';
          select.setAttribute('aria-label', p.title);
          variants.forEach((v) => {
            var o = document.createElement('option');
            o.value = v.id;
            o.textContent = v.title;
            o.dataset.price = U.money(v.price, fmt);
            select.appendChild(o);
          });
          li.appendChild(select);
        } else {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.className = 'ucro-offer__variant';
          hidden.value = first.id;
          li.appendChild(hidden);
        }
        return li;
      }

      picked(withRows) {
        var items = [];
        this.querySelectorAll('.ucro-offer').forEach((row) => {
          var box = row.querySelector('.ucro-offer__check');
          var v = row.querySelector('.ucro-offer__variant');
          if (box && box.checked && v && v.value) {
            items.push(withRows ? { item: { id: Number(v.value), quantity: 1 }, row: row } : { id: Number(v.value), quantity: 1 });
          }
        });
        return items;
      }

      refresh() {
        if (!this.button) return;
        var n = this.picked().length;
        this.button.disabled = n === 0 || !!this.busy;
        this.label.textContent = n > 0 ? this.base + ' (' + n + ')' : this.base;
      }

      submit() {
        var items = this.picked();
        if (!items.length || this.busy) return;
        this.busy = true;
        this.button.classList.add('loading', 'ucro-is-busy');
        this.refresh();
        showError(this, '');
        var rows = this.picked(true);
        U.add(items)
          .then(() => rows.forEach((r) => (r.row.querySelector('.ucro-offer__check').checked = false)))
          .catch((err) => {
            // Shopify rejects the whole request if one item can't be added (e.g. just sold out).
            // Add the rest one by one, untick what worked, and name what didn't.
            if (rows.length < 2) throw err;
            var failed = [];
            return rows
              .reduce((chain, r) => chain.then(() =>
                U.add([r.item])
                  .then(() => (r.row.querySelector('.ucro-offer__check').checked = false))
                  .catch(() => failed.push(r.row.querySelector('.ucro-offer__title').textContent.trim()))
              ), Promise.resolve())
              .then(() => {
                if (!failed.length) return;
                var reason = (err && err.message !== 'error' && err.message) || this.dataset.error;
                // Shopify's message usually names the product already; don't say it twice.
                throw new Error(failed.length === 1 && reason.indexOf(failed[0]) > -1 ? reason : failed.join(', ') + ': ' + reason);
              });
          })
          .catch((err) => showError(this, (err && err.message !== 'error' && err.message) || this.dataset.error))
          .finally(() => {
            this.busy = false;
            this.button.classList.remove('loading', 'ucro-is-busy');
            this.refresh();
          });
      }
    });
  }

  /* ------------------------------------------------------------------- Upsell -- */
  // Two types: "quantity" (Buy 1/2/3, optionally a size picker per item) and "variant"
  // (tiers are values of one option; picking one switches the theme's own variant picker).
  if (!customElements.get('ucro-upsell')) {
    customElements.define('ucro-upsell', class extends HTMLElement {
      connectedCallback() {
        try {
          this.data = JSON.parse(this.querySelector('[data-ucro-prices]').textContent);
        } catch (e) {
          return;
        }
        this.type = this.data.type === 'variant' ? 'variant' : 'quantity';
        this.tiers = Array.prototype.slice.call(this.querySelectorAll('.ucro-tier'));
        this.form = U.productForm(this);
        this.variantId = this.dataset.variantId;
        this.own = this.querySelector('.ucro-upsell__add');
        this.useOwn = this.dataset.ownButton === 'true' || !this.form;
        this.perItem = this.dataset.perItem === 'true' && Array.isArray(this.data.items) && this.data.items.length > 1;
        if (this.own) this.own.hidden = !this.useOwn;
        this.selectedQty = 1;
        if (this.type === 'variant') this.indexVariants();
        U.decorate(this);

        this.onClick = (e) => {
          var tier = e.target.closest('.ucro-tier');
          if (tier && !tier.disabled) this.choose(tier);
          if (e.target.closest('.ucro-upsell__add')) this.addOwn();
        };
        this.addEventListener('click', this.onClick);

        // The shopper may also change the quantity box or variant directly.
        this.onDocChange = (e) => {
          if (e.target.closest && e.target.closest('.ucro-tier__items')) return;
          setTimeout(() => this.sync(), 60);
        };
        document.addEventListener('change', this.onDocChange);
        if (window.subscribe && window.PUB_SUB_EVENTS) {
          this.unsubscribe = window.subscribe(window.PUB_SUB_EVENTS.variantChange, () => setTimeout(() => this.sync(), 0));
        }
        // Themes differ in how they announce a variant change; a light poll catches the rest.
        this.poll = setInterval(() => document.visibilityState === 'visible' && this.sync(), 700);

        // Per-item sizes: the theme's Add to cart must add each chosen size, not N of one.
        if (this.perItem && this.form && !this.useOwn) {
          this.guard = (e) => {
            if (this.selectedQty < 2 || !this.isOurSubmit(e)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            this.addItems(null);
          };
          document.addEventListener('submit', this.guard, true);
          document.addEventListener('click', this.guard, true);
        }

        this.render();
        this.highlight();
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        document.removeEventListener('change', this.onDocChange);
        if (this.unsubscribe) this.unsubscribe();
        clearInterval(this.poll);
        if (this.guard) {
          document.removeEventListener('submit', this.guard, true);
          document.removeEventListener('click', this.guard, true);
        }
      }

      isOurSubmit(e) {
        var form = this.form;
        if (e.type === 'submit') return e.target === form;
        var btn = e.target.closest && e.target.closest('[type="submit"], [name="add"]');
        return !!btn && !btn.closest('.ucro') && (btn.closest('form') === form || btn.getAttribute('form') === form.getAttribute('id'));
      }

      field(name) {
        if (!this.form) return null;
        var el = this.form.elements.namedItem(name);
        if (el && typeof el.length === 'number' && !el.tagName) el = el[0];
        return el || null;
      }

      quantityInput() {
        var input = this.field('quantity');
        if (input || !this.form) return input;
        // The theme has no quantity field: add a hidden one to its form.
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'quantity';
        input.value = '1';
        this.form.appendChild(input);
        return input;
      }

      /* ---- size-upgrade tiers ---- */
      indexVariants() {
        this.byId = {};
        (this.data.vs || []).forEach((v) => (this.byId[String(v.id)] = v));
      }

      // The variant for tier `t` that keeps the current variant's other options.
      variantFor(t) {
        var cur = this.byId[this.variantId];
        var list = this.data.vs || [];
        return (cur && list.find((v) => v.t === t && v.k === cur.k)) || list.find((v) => v.t === t && v.av) || list.find((v) => v.t === t);
      }

      selectVariant(tier) {
        var value = String(tier.dataset.value || '').trim().toLowerCase();
        var target = this.variantFor(Number(tier.dataset.index));
        var scope = (this.form && this.form.closest('.shopify-section')) || document;
        // 1) the theme's own option buttons (radios / pills) — keeps its price, images and URL in sync
        var radio = Array.prototype.find.call(scope.querySelectorAll('input[type="radio"]'), (r) =>
          String(r.value).trim().toLowerCase() === value && !r.closest('.ucro'));
        if (radio) {
          if (!radio.checked) {
            var label = radio.id && scope.querySelector('label[for="' + radio.id + '"]');
            (label || radio).click();
            if (!radio.checked) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          return;
        }
        // 2) option dropdowns
        var select = Array.prototype.find.call(scope.querySelectorAll('select'), (sel) =>
          !sel.closest('.ucro') && Array.prototype.some.call(sel.options, (o) => String(o.value).trim().toLowerCase() === value));
        if (select) {
          var opt = Array.prototype.find.call(select.options, (o) => String(o.value).trim().toLowerCase() === value);
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }
        // 3) no visible picker: set the variant on the form directly
        var id = this.field('id');
        if (id && target) {
          id.value = String(target.id);
          id.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      sync() {
        var id = this.field('id');
        if (id && id.value && id.value !== this.variantId) {
          this.variantId = id.value;
          this.render();
        }
        this.highlight();
      }

      choose(tier) {
        if (this.type === 'variant') {
          this.selectVariant(tier);
          setTimeout(() => this.sync(), 120);
          return;
        }
        this.selectedQty = Number(tier.dataset.qty) || 1;
        if (!this.useOwn) {
          var input = this.quantityInput();
          if (input) {
            input.value = String(this.selectedQty);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        this.highlight();
      }

      highlight() {
        var selected;
        if (this.type === 'variant') {
          var cur = this.byId[this.variantId];
          selected = (t) => !!cur && Number(t.dataset.index) === cur.t;
        } else {
          var current = this.selectedQty;
          if (!this.useOwn) {
            var input = this.field('quantity');
            if (input) current = parseInt(input.value, 10) || 1;
          }
          this.selectedQty = current;
          selected = (t) => Number(t.dataset.qty) === current;
        }
        this.tiers.forEach((t) => {
          var on = selected(t);
          t.setAttribute('aria-checked', on ? 'true' : 'false');
          t.classList.toggle('is-selected', on);
        });
        if (this.perItem) this.renderItems();
      }

      render() {
        if (this.type === 'variant') {
          this.tiers.forEach((t) => {
            var v = this.variantFor(Number(t.dataset.index));
            if (!v) return;
            t.dataset.variant = v.id;
            var total = t.querySelector('.ucro-tier__total');
            var was = t.querySelector('.ucro-was');
            if (total) total.textContent = v.total;
            if (was) was.textContent = v.was;
            t.disabled = !v.av;
          });
          return;
        }
        var v = (this.data.q || {})[this.variantId];
        if (!v) return;
        this.tiers.forEach((t) => {
          var p = v.t[Number(t.dataset.index)];
          if (!p) return;
          var total = t.querySelector('.ucro-tier__total');
          var was = t.querySelector('.ucro-was');
          if (total) total.textContent = p.total;
          if (was) was.textContent = p.was;
          t.disabled = !v.av;
        });
        if (this.own) this.own.disabled = !v.av;
      }

      /* ---- quantity tiers: one size picker per item ---- */
      renderItems() {
        this.querySelectorAll('.ucro-tier__items').forEach((box) => {
          var tier = box.parentElement.querySelector('.ucro-tier');
          var on = tier.classList.contains('is-selected');
          var n = Number(tier.dataset.qty) || 1;
          box.hidden = !on;
          if (!on) return;
          if (box.children.length === n) return;
          box.innerHTML = '';
          for (var i = 0; i < n; i++) {
            var row = document.createElement('label');
            row.className = 'ucro-item';
            var name = document.createElement('span');
            name.className = 'ucro-item__n';
            name.textContent = String(this.dataset.itemLabel || '#[n]').replace('[n]', i + 1);
            var sel = document.createElement('select');
            sel.className = 'ucro-select ucro-item__select';
            sel.setAttribute('aria-label', name.textContent);
            this.data.items.forEach((v) => {
              var o = document.createElement('option');
              o.value = v.id;
              o.textContent = v.t;
              sel.appendChild(o);
            });
            if (this.data.items.some((v) => String(v.id) === String(this.variantId))) sel.value = this.variantId;
            row.appendChild(name);
            row.appendChild(sel);
            box.appendChild(row);
          }
        });
      }

      pickedItems() {
        var box = Array.prototype.find.call(this.querySelectorAll('.ucro-tier__items'), (b) => !b.hidden);
        if (!box) return null;
        var counts = {};
        box.querySelectorAll('select').forEach((s) => (counts[s.value] = (counts[s.value] || 0) + 1));
        return Object.keys(counts).map((id) => ({ id: Number(id), quantity: counts[id] }));
      }

      addItems(button) {
        if (this.busy) return;
        var items = (this.perItem && this.selectedQty > 1 && this.pickedItems()) ||
          [{ id: Number(this.variantId), quantity: this.selectedQty }];
        this.busy = true;
        if (button) button.classList.add('loading', 'ucro-is-busy');
        showError(this, '');
        U.add(items)
          .catch((err) => showError(this, (err && err.message !== 'error' && err.message) || this.dataset.error))
          .finally(() => {
            this.busy = false;
            if (button) button.classList.remove('loading', 'ucro-is-busy');
          });
      }

      addOwn() {
        this.addItems(this.own);
      }
    });
  }
})();
