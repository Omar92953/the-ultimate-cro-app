/*
 * CRO Toolbox — <ucro-bundle>, the mix-and-match bundle builder.
 *
 * "merge" mode (normal): each pick is added as its own cart line with the hidden property
 *   "_bundle": "<bundle product id>:<group>:<step index>"
 * and the cro-bundles Cart Transform checks the group and merges it into the bundle at the bundle
 * price (each item's stock goes down). Keep both sides in sync (also ucro-bundle-tray.js).
 * "line" mode (custom installs without Cart Transforms): one bundle product line with the picks as
 * readable properties.
 */
(function () {
  var U = window.UCRO;
  if (!U || customElements.get('ucro-bundle')) return;

  function fill(text, map) {
    return String(text || '').replace(/\[(\w+)\]/g, function (m, k) { return k in map ? map[k] : m; });
  }

  customElements.define('ucro-bundle', class extends HTMLElement {
    connectedCallback() {
      this.fmt = this.dataset.moneyFormat;
      this.dup = this.dataset.dup === 'true';
      this.steps = Array.prototype.slice.call(this.querySelectorAll('.ucro-bundle__step')).map((el) => ({
        el: el,
        min: Number(el.dataset.min) || 0,
        max: Number(el.dataset.max) || 1,
        label: el.dataset.label,
        picks: [] // { card, id, title, cents }
      }));
      this.button = this.querySelector('.ucro-bundle__add');
      this.storeKey = 'ucro-bundle-' + this.dataset.key;
      this.form = this.dataset.themeButton === 'true' ? U.productForm(this) : null;
      U.decorate(this);

      this.onClick = (e) => {
        var card = e.target.closest('.ucro-bundle__card');
        if (e.target.closest('.ucro-bundle__add')) return this.submit();
        if (!card) return;
        var step = this.stepOf(card);
        if (e.target.closest('.ucro-bundle__plus')) return this.pick(step, card, true);
        if (e.target.closest('.ucro-bundle__minus')) return this.unpick(step, card);
        if (e.target.closest('.ucro-bundle__pick')) {
          if (!this.dup && this.countOf(step, card)) return this.unpick(step, card);
          return this.pick(step, card, false);
        }
      };
      this.onChange = (e) => {
        var select = e.target.closest && e.target.closest('select.ucro-bundle__variant');
        if (!select) return;
        var opt = select.options[select.selectedIndex];
        var card = select.closest('.ucro-bundle__card');
        var price = card.querySelector('[data-ucro-price]');
        if (price && opt.dataset.price) price.textContent = opt.dataset.price;
        // A pick keeps the variant it was made with; changing the menu re-picks it.
        var step = this.stepOf(card);
        var n = this.countOf(step, card);
        if (n) {
          step.picks = step.picks.filter((p) => p.card !== card);
          for (var i = 0; i < n; i++) this.pick(step, card, true);
        }
      };
      this.addEventListener('click', this.onClick);
      this.addEventListener('change', this.onChange);

      if (this.form) this.useThemeButton();
      this.restore();
      this.render();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('change', this.onChange);
      if (this.guard) {
        document.removeEventListener('submit', this.guard, true);
        document.removeEventListener('click', this.guard, true);
      }
      if (this.hiddenBox) this.hiddenBox.remove();
    }

    stepOf(card) {
      var el = card.closest('.ucro-bundle__step');
      return this.steps.find((s) => s.el === el);
    }

    countOf(step, card) {
      return step.picks.filter((p) => p.card === card).length;
    }

    variantOf(card) {
      var v = card.querySelector('.ucro-bundle__variant');
      var opt = v && v.tagName === 'SELECT' ? v.options[v.selectedIndex] : v;
      if (!opt || opt.disabled) return null;
      var vt = opt.dataset.title;
      return { id: String(v.value), cents: Number(opt.dataset.cents) || 0, title: card.dataset.title + (vt ? ' (' + vt + ')' : '') };
    }

    pick(step, card, adding) {
      var v = this.variantOf(card);
      if (!v) return;
      if (step.picks.length >= step.max) {
        if (step.max === 1 && !adding) step.picks = [];
        else return this.flash(step);
      }
      step.picks.push({ card: card, id: v.id, cents: v.cents, title: v.title });
      this.render();
    }

    unpick(step, card) {
      for (var i = step.picks.length - 1; i >= 0; i--) {
        if (step.picks[i].card === card) {
          step.picks.splice(i, 1);
          break;
        }
      }
      this.render();
    }

    flash(step) {
      var c = step.el.querySelector('.ucro-bundle__count');
      if (!c) return;
      c.classList.remove('is-full');
      void c.offsetWidth;
      c.classList.add('is-full');
    }

    remaining() {
      return this.steps.reduce((sum, s) => sum + Math.max(0, s.min - s.picks.length), 0);
    }

    total() {
      return this.steps.reduce((sum, s) => sum + s.picks.length, 0);
    }

    complete() {
      return this.remaining() === 0 && this.total() > 0;
    }

    render() {
      this.steps.forEach((s) => {
        var count = s.el.querySelector('[data-count]');
        if (count) count.textContent = String(s.picks.length);
        s.el.querySelectorAll('.ucro-bundle__card').forEach((card) => {
          var n = this.countOf(s, card);
          card.classList.toggle('is-picked', n > 0);
          var pickBtn = card.querySelector('.ucro-bundle__pick');
          if (pickBtn) {
            pickBtn.setAttribute('aria-pressed', n > 0 ? 'true' : 'false');
            pickBtn.textContent = n > 0 && !this.dup ? this.dataset.tPicked : this.dataset.tPick;
            pickBtn.hidden = this.dup && n > 0;
          }
          ['.ucro-bundle__minus', '.ucro-bundle__plus', '.ucro-bundle__qty'].forEach((sel) => {
            var el = card.querySelector(sel);
            if (el) el.hidden = n === 0;
          });
          var qty = card.querySelector('.ucro-bundle__qty');
          if (qty) qty.textContent = String(n);
        });
      });

      var remaining = this.remaining();
      var ready = this.complete();
      if (this.button) {
        this.button.disabled = !ready || !!this.busy;
        this.button.textContent = ready || this.total() === 0 && remaining === 0
          ? this.dataset.tButton
          : fill(this.dataset.tRemaining, { remaining: remaining });
      }

      var list = this.querySelector('[data-picks]');
      if (list) {
        list.innerHTML = '';
        this.steps.forEach((s) => this.grouped(s).forEach((g) => {
          var li = document.createElement('li');
          li.textContent = g.title + (g.qty > 1 ? ' ×' + g.qty : '');
          list.appendChild(li);
        }));
      }
      var value = this.steps.reduce((sum, s) => sum + s.picks.reduce((t, p) => t + p.cents, 0), 0);
      var price = Number(this.dataset.price) || 0;
      var valueEl = this.querySelector('[data-value]');
      var saveEl = this.querySelector('[data-save]');
      var saving = value - price;
      if (valueEl) valueEl.textContent = ready && saving > 0 ? fill(this.dataset.tValue, { amount: U.money(value, this.fmt) }) : '';
      if (saveEl) {
        saveEl.hidden = !(ready && saving > 0);
        saveEl.textContent = fill(this.dataset.tSave, { amount: U.money(saving, this.fmt), percent: value ? Math.round((saving / value) * 100) : 0 });
      }

      this.syncForm();
      this.save();
    }

    grouped(step) {
      var out = [];
      step.picks.forEach((p) => {
        var g = out.find((x) => x.id === p.id);
        if (g) g.qty++;
        else out.push({ id: p.id, title: p.title, qty: 1 });
      });
      return out;
    }

    /** The cart lines to add: the picks (merge mode) or the bundle product with the picks listed (line mode). */
    items() {
      if (this.dataset.mode === 'line') return [{ id: Number(this.dataset.variantId), quantity: 1, properties: this.properties() }];
      var group = Math.random().toString(36).slice(2, 10);
      var bundle = this.dataset.bundle;
      var items = [];
      this.steps.forEach((s, i) => s.picks.forEach((p) => items.push({ id: Number(p.id), quantity: 1, properties: { _bundle: bundle + ':' + group + ':' + i } })));
      return items;
    }

    properties() {
      var props = {};
      this.steps.forEach((s) => {
        if (!s.picks.length) return;
        var key = s.label || 'Items';
        while (props[key]) key += ' ';
        props[key] = this.grouped(s).map((g) => g.title + (g.qty > 1 ? ' ×' + g.qty : '')).join(', ');
      });
      return props;
    }

    submit() {
      if (!this.complete() || this.busy) return;
      this.busy = true;
      this.button.classList.add('loading', 'ucro-is-busy');
      this.error('');
      U.add(this.items())
        .then(() => {
          this.steps.forEach((s) => (s.picks = []));
          this.clearSaved();
        })
        .catch((err) => this.error((err && err.message !== 'error' && err.message) || this.dataset.error))
        .finally(() => {
          this.busy = false;
          this.button.classList.remove('loading', 'ucro-is-busy');
          this.render();
        });
    }

    error(message) {
      var box = this.querySelector('.ucro__error');
      if (!box) return;
      box.textContent = message || '';
      box.hidden = !message;
    }

    /* ---- "Use my theme's Add to cart button" ------------------------------------ */
    useThemeButton() {
      if (this.button) this.button.hidden = true;
      // Express checkout buttons post the bare product and would skip the picks.
      this.form.querySelectorAll('.shopify-payment-button, [data-shopify="payment-button"]').forEach((el) => (el.hidden = true));
      var section = this.form.closest('.shopify-section') || document;
      section.querySelectorAll('.shopify-payment-button').forEach((el) => (el.style.display = 'none'));

      // Picks travel as hidden inputs inside the theme's form, which every theme serialises.
      this.hiddenBox = document.createElement('div');
      this.hiddenBox.hidden = true;
      this.form.appendChild(this.hiddenBox);

      // Refuse incomplete bundles before the theme's own listeners run (capture phase).
      this.guard = (e) => {
        var form = this.form;
        var isSubmit = e.type === 'submit' ? e.target === form
          : !!(e.target.closest && e.target.closest('[type="submit"]') && (e.target.closest('form') === form || e.target.closest('[type="submit"]').getAttribute('form') === form.getAttribute('id')));
        if (!isSubmit) return;
        if (this.complete() && this.dataset.mode === 'line') return; // the theme's form carries the picks
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.complete()) return this.submit(); // merge mode: the picks go in as their own lines
        this.error(this.dataset.tIncomplete);
        this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      document.addEventListener('submit', this.guard, true);
      document.addEventListener('click', this.guard, true);
    }

    syncForm() {
      if (!this.hiddenBox || this.dataset.mode !== 'line') return;
      this.hiddenBox.innerHTML = '';
      if (!this.complete()) return;
      var props = this.properties();
      Object.keys(props).forEach((k) => {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'properties[' + k + ']';
        input.value = props[k];
        this.hiddenBox.appendChild(input);
      });
    }

    /* ---- Keep picks when the shopper navigates away and back ------------------- */
    save() {
      try {
        sessionStorage.setItem(this.storeKey, JSON.stringify(this.steps.map((s) => s.picks.map((p) => p.id))));
      } catch (e) {
        // storage unavailable (private mode): picks just are not remembered
      }
    }

    clearSaved() {
      try {
        sessionStorage.removeItem(this.storeKey);
      } catch (e) {
        // storage unavailable (private mode): picks just are not remembered
      }
    }

    restore() {
      var saved;
      try {
        saved = JSON.parse(sessionStorage.getItem(this.storeKey) || 'null');
      } catch (e) {
        // storage unavailable (private mode): picks just are not remembered
      }
      if (!Array.isArray(saved)) return;
      saved.forEach((ids, i) => {
        var step = this.steps[i];
        if (!step || !Array.isArray(ids)) return;
        ids.forEach((id) => {
          var card = Array.prototype.find.call(step.el.querySelectorAll('.ucro-bundle__card'), (c) => {
            var v = c.querySelector('.ucro-bundle__variant');
            if (!v) return false;
            if (v.tagName !== 'SELECT') return v.value === String(id);
            var opt = Array.prototype.find.call(v.options, (o) => o.value === String(id) && !o.disabled);
            if (opt) v.value = opt.value;
            return !!opt;
          });
          if (card && step.picks.length < step.max) {
            var v = this.variantOf(card);
            if (v && (this.dup || !this.countOf(step, card))) step.picks.push({ card: card, id: v.id, cents: v.cents, title: v.title });
          }
        });
      });
    }
  });
})();
