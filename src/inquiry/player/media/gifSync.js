import { decompressFrame, parseGIF } from "gifuct-js";

/**
 * Plays several GIFs on one clock: they start together, each holds its last
 * frame when done, and all start again once the longest has finished.
 * Browsers give no control over an <img> GIF, so frames are drawn on canvases.
 */

// Browsers show very short GIF frame delays as 100 ms; do the same
const MIN_DELAY = 20;
const SHORT_DELAY = 100;
// A longer gap between animation frames means the tab was hidden: don't jump ahead
const MAX_STEP = 250;

/**
 * A GIF from its address: { width, height, gct, frames, duration }. Frames
 * stay compressed until drawn, so memory is about the file's size rather than
 * every frame's pixels.
 */
export async function loadGif(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`GIF ${response.status}`);
  const gif = parseGIF(await response.arrayBuffer());
  let end = 0;
  const frames = gif.frames
    .filter((f) => f.image)
    .map((raw) => {
      const gce = raw.gce || { delay: 10, extras: {} };
      const ms = (gce.delay || 10) * 10;
      const frame = {
        raw,
        start: end,
        disposalType: gce.extras ? gce.extras.disposal : 0,
        dims: {
          left: raw.image.descriptor.left,
          top: raw.image.descriptor.top,
          width: raw.image.descriptor.width,
          height: raw.image.descriptor.height,
        },
      };
      end += ms < MIN_DELAY ? SHORT_DELAY : ms;
      return frame;
    });
  if (!frames.length) throw new Error("GIF has no frames");
  return {
    width: gif.lsd.width,
    height: gif.lsd.height,
    gct: gif.gct,
    frames,
    duration: end,
  };
}

/** Draws one GIF's frames in order onto a canvas, keeping GIF disposal rules. */
class GifPainter {
  constructor(canvas, gif) {
    this.gif = gif;
    canvas.width = gif.width;
    canvas.height = gif.height;
    this.ctx = canvas.getContext("2d");
    this.patch = document.createElement("canvas");
    this.patchCtx = this.patch.getContext("2d");
    this.reset();
  }

  /**
   * A frame's pixels. The first frame is kept, since every restart draws all
   * the GIFs' first frames at once; the others are unpacked when drawn.
   */
  pixels(i) {
    if (i === 0 && this.first) return this.first;
    const frame = this.gif.frames[i];
    const { patch } = decompressFrame(frame.raw, this.gif.gct, true);
    const image = new ImageData(patch, frame.dims.width, frame.dims.height);
    if (i === 0) this.first = image;
    return image;
  }

  reset() {
    this.ctx.clearRect(0, 0, this.gif.width, this.gif.height);
    this.next = 0; // index of the next frame to draw
    this.restore = null;
  }

  /** Draws every frame due by time t (ms since the start). */
  advance(t) {
    const { frames } = this.gif;
    while (this.next < frames.length && frames[this.next].start <= t) {
      this.draw(this.next);
      this.next += 1;
    }
  }

  draw(i) {
    const { frames } = this.gif;
    const ctx = this.ctx;
    // Undo the previous frame as its disposal says
    const prev = frames[i - 1];
    if (prev) {
      const { left, top, width, height } = prev.dims;
      if (prev.disposalType === 2) ctx.clearRect(left, top, width, height);
      else if (prev.disposalType === 3 && this.restore) {
        ctx.putImageData(this.restore, left, top);
      }
    }
    const frame = frames[i];
    const { left, top, width, height } = frame.dims;
    if (frame.disposalType === 3) {
      this.restore = ctx.getImageData(left, top, width, height);
    }
    if (this.patch.width !== width || this.patch.height !== height) {
      this.patch.width = width;
      this.patch.height = height;
    }
    this.patchCtx.putImageData(this.pixels(i), 0, 0);
    // drawImage keeps transparent pixels see-through, as a GIF does
    ctx.drawImage(this.patch, left, top);
  }
}

/** One clock for a set of GIF canvases. */
export class GifClock {
  constructor(pairs) {
    // pairs: [{ canvas, gif }]
    this.painters = pairs.map(({ canvas, gif }) => new GifPainter(canvas, gif));
    this.cycle = Math.max(...pairs.map(({ gif }) => gif.duration));
    this.frame = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    this.stop();
    this.elapsed = 0;
    this.last = null;
    this.painters.forEach((p) => {
      p.reset();
      p.advance(0);
    });
    this.frame = requestAnimationFrame(this.tick);
  }

  tick(now) {
    if (this.last !== null) {
      this.elapsed += Math.min(now - this.last, MAX_STEP);
    }
    this.last = now;
    if (this.elapsed >= this.cycle) {
      // The longest has finished: everyone starts again together
      this.elapsed = 0;
      this.painters.forEach((p) => p.reset());
    }
    // Shorter GIFs stop at their last frame and wait
    this.painters.forEach((p) => p.advance(this.elapsed));
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
