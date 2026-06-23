const vertexSource = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

void main() {
  gl_Position = a_position;
}`;

const fragmentSource = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_type;
uniform float u_pxSize;
uniform float u_speed;

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5
);

const int bayer8x8[64] = int[64](
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(mod(uv, float(size)));
  int index = pos.y * size + pos.x;

  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}

void main() {
  float t = u_speed * u_time;
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv -= .5;

  float pxSize = u_pxSize;
  vec2 pxSizeUv = gl_FragCoord.xy;
  pxSizeUv -= .5 * u_resolution;
  pxSizeUv /= pxSize;
  vec2 pixelizedUv = floor(pxSizeUv) * pxSize / u_resolution.xy;
  pixelizedUv += .5;
  pixelizedUv -= .5;

  vec2 shape_uv = pixelizedUv * 4.;
  float drift = sin(.22 * shape_uv.x + .7 * t) * .18;
  float broadWave = sin(.72 * shape_uv.x - 1.35 * t + drift) * .5;
  float smallWave = sin(1.65 * shape_uv.x + .72 * t + sin(.36 * shape_uv.x)) * .2;
  float swell = sin(.18 * shape_uv.x - .22 * t) * .22;
  float wave = broadWave + smallWave + swell;
  float shape = 1. - smoothstep(-.92, .92, shape_uv.y + wave);

  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(uv * u_resolution), shape);
    } break;
    case 2:
      dithering = getBayerValue(pxSizeUv, 2);
      break;
    case 3:
      dithering = getBayerValue(pxSizeUv, 4);
      break;
    default:
      dithering = getBayerValue(pxSizeUv, 8);
      break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  fragColor = vec4(color, opacity);
}`;

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      height: 260px;
      background: linear-gradient(
        to bottom,
        var(--wave-shader-background, #ffffff),
        var(--wave-shader-color, #c6e4e1)
      );
      overflow: hidden;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
  <canvas part="canvas" aria-hidden="true"></canvas>
`;

const defaults = {
  color: "#c6e4e1",
  backgroundColor: "#ffffff",
  dither: 4,
  pixelSize: 6,
  speed: 0.32
};

class WaveShaderTransition extends HTMLElement {
  static observedAttributes = ["color", "background-color", "dither", "pixel-size", "speed", "height"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(template.content.cloneNode(true));
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.frameId = 0;
    this.resizeObserver = null;
    this.glState = null;
  }

  connectedCallback() {
    this.applyHostStyles();
    this.init();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.frameId = requestAnimationFrame((now) => this.render(now));
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
  }

  attributeChangedCallback() {
    this.applyHostStyles();
  }

  applyHostStyles() {
    const height = this.getAttribute("height");
    const color = this.getAttribute("color") || defaults.color;
    const backgroundColor = this.getAttribute("background-color") || defaults.backgroundColor;

    this.style.setProperty("--wave-shader-color", color);
    this.style.setProperty("--wave-shader-background", backgroundColor);

    if (height) {
      this.style.height = height;
    }
  }

  init() {
    if (this.glState) return;

    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: true });
    if (!gl) {
      this.setAttribute("data-webgl", "unsupported");
      return;
    }

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }

      return shader;
    };

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.glState = {
      gl,
      program,
      vao,
      uniforms: {
        time: gl.getUniformLocation(program, "u_time"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        colorBack: gl.getUniformLocation(program, "u_colorBack"),
        colorFront: gl.getUniformLocation(program, "u_colorFront"),
        type: gl.getUniformLocation(program, "u_type"),
        pxSize: gl.getUniformLocation(program, "u_pxSize"),
        speed: gl.getUniformLocation(program, "u_speed")
      }
    };
  }

  resize() {
    if (!this.glState) return;

    const { gl } = this.glState;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
  }

  render(now) {
    if (!this.glState) return;

    const { gl, program, vao, uniforms } = this.glState;
    const colorFront = parseColor(this.getAttribute("color"), defaults.color);
    const colorBack = parseColor(this.getAttribute("background-color"), defaults.backgroundColor);

    this.resize();
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform1f(uniforms.time, now * 0.001);
    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform4f(uniforms.colorBack, colorBack[0], colorBack[1], colorBack[2], 1.0);
    gl.uniform4f(uniforms.colorFront, colorFront[0], colorFront[1], colorFront[2], 1.0);
    gl.uniform1f(uniforms.type, readNumber(this, "dither", defaults.dither));
    gl.uniform1f(uniforms.pxSize, readNumber(this, "pixel-size", defaults.pixelSize));
    gl.uniform1f(uniforms.speed, readNumber(this, "speed", defaults.speed));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.frameId = requestAnimationFrame((nextNow) => this.render(nextNow));
  }
}

function readNumber(element, attribute, fallback) {
  const value = Number(element.getAttribute(attribute));
  return Number.isFinite(value) ? value : fallback;
}

function parseColor(value, fallback) {
  const normalized = String(value || fallback).trim();

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const r = normalized[1] + normalized[1];
    const g = normalized[2] + normalized[2];
    const b = normalized[3] + normalized[3];
    return [r, g, b].map((part) => parseInt(part, 16) / 255);
  }

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return [
      parseInt(normalized.slice(1, 3), 16) / 255,
      parseInt(normalized.slice(3, 5), 16) / 255,
      parseInt(normalized.slice(5, 7), 16) / 255
    ];
  }

  if (normalized !== fallback) {
    return parseColor(fallback, fallback);
  }

  return [0.776, 0.894, 0.882];
}

if (!customElements.get("wave-shader-transition")) {
  customElements.define("wave-shader-transition", WaveShaderTransition);
}
