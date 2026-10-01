/*
 * The Ultimate CRO App — <ucro-video-carousel>.
 * Scroll-snap track (native swipe), arrow buttons, arrow keys. Videos load only when a slide
 * comes near the screen and play muted only while mostly visible. Space is reserved with
 * aspect-ratio in CSS, so nothing shifts when a video loads.
 */
(function () {
  var U = window.UCRO;
  if (!U || customElements.get('ucro-video-carousel')) return;

  customElements.define('ucro-video-carousel', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.ucro-vc__track');
      this.slides = Array.prototype.slice.call(this.querySelectorAll('.ucro-vc__slide'));
      this.videos = Array.prototype.slice.call(this.querySelectorAll('video'));
      this.current = this.querySelector('[data-current]');
      this.arrows = Array.prototype.slice.call(this.querySelectorAll('.ucro-vc__arrow'));
      this.autoplay = this.dataset.autoplay === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      U.decorate(this);

      this.onClick = (e) => {
        var arrow = e.target.closest('.ucro-vc__arrow');
        if (arrow) return this.go(Number(arrow.dataset.dir));
        var add = e.target.closest('button.ucro-vc__add');
        if (add) return this.add(add);
        var media = e.target.closest('[data-toggle-play]');
        var video = media && media.querySelector('video');
        if (video) {
          this.load(video);
          video.paused ? this.play(video) : video.pause();
          media.classList.toggle('is-playing', !video.paused);
        }
      };
      this.onKey = (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.go(e.key === 'ArrowRight' ? 1 : -1);
        }
      };
      this.onScroll = () => {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => this.update(), 60);
      };
      this.addEventListener('click', this.onClick);
      this.track.addEventListener('keydown', this.onKey);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });

      if ('IntersectionObserver' in window) {
        // 1) attach the video file when a slide is near the viewport
        this.loader = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.load(entry.target);
              this.loader.unobserve(entry.target);
            }
          });
        }, { root: null, rootMargin: '200px' });
        // 2) play only while mostly visible
        this.player = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            var v = entry.target;
            if (entry.isIntersecting && this.autoplay) this.play(v);
            else if (!entry.isIntersecting) v.pause();
          });
        }, { threshold: 0.6 });
        this.videos.forEach((v) => {
          this.loader.observe(v);
          this.player.observe(v);
        });
      } else {
        this.videos.forEach((v) => this.load(v));
      }

      if ('ResizeObserver' in window) {
        this.resizer = new ResizeObserver(() => this.update());
        this.resizer.observe(this.track);
      }
      this.update();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      if (this.track) {
        this.track.removeEventListener('keydown', this.onKey);
        this.track.removeEventListener('scroll', this.onScroll);
      }
      if (this.loader) this.loader.disconnect();
      if (this.player) this.player.disconnect();
      if (this.resizer) this.resizer.disconnect();
    }

    load(video) {
      if (!video.dataset.src || video.getAttribute('src')) return;
      video.src = video.dataset.src;
    }

    play(video) {
      this.load(video);
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }

    step() {
      var first = this.slides[0];
      if (!first) return 0;
      var gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      return first.getBoundingClientRect().width + gap;
    }

    index() {
      var s = this.step();
      return s ? Math.round(this.track.scrollLeft / s) : 0;
    }

    go(dir) {
      var s = this.step();
      var rtl = getComputedStyle(this).direction === 'rtl' ? -1 : 1;
      this.track.scrollBy({ left: dir * s * rtl, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    update() {
      var max = this.track.scrollWidth - this.track.clientWidth;
      var fits = max <= 1;
      var nav = this.querySelector('.ucro-vc__nav');
      if (nav) nav.hidden = fits;
      if (this.current) this.current.textContent = String(Math.min(this.slides.length, this.index() + 1));
      if (this.arrows.length === 2) {
        var x = Math.abs(this.track.scrollLeft);
        this.arrows[0].disabled = x <= 1;
        this.arrows[1].disabled = x >= max - 1;
      }
    }

    add(button) {
      if (button.disabled) return;
      button.disabled = true;
      button.classList.add('loading', 'ucro-is-busy');
      var box = this.querySelector('.ucro__error');
      if (box) box.hidden = true;
      U.add([{ id: Number(button.dataset.variant), quantity: 1 }])
        .catch((err) => {
          if (box) {
            box.textContent = (err && err.message !== 'error' && err.message) || this.dataset.error;
            box.hidden = false;
          }
        })
        .finally(() => {
          button.disabled = false;
          button.classList.remove('loading', 'ucro-is-busy');
        });
    }
  });
})();
