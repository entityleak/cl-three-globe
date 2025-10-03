import {
  ShaderMaterial,
  UniformsUtils,
  Vector2
} from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { halftoneShader } from './shaders.js';

export class HalftonePass extends Pass {
  constructor(width, height, params = {}) {
    super();

    this.uniforms = UniformsUtils.clone(halftoneShader.uniforms);
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: halftoneShader.vertexShader,
      fragmentShader: halftoneShader.fragmentShader
    });

    this.fsQuad = new FullScreenQuad(this.material);

    this.setSize(width, height);
    this.setParams(params);
  }

  setSize(width, height) {
    this.uniforms.resolution.value = new Vector2(width, height);
  }

  setParams(params) {
    if (params.patternSize !== undefined) this.uniforms.patternSize.value = params.patternSize;
    if (params.threshold !== undefined) this.uniforms.threshold.value = params.threshold;
    if (params.contrast !== undefined) this.uniforms.contrast.value = params.contrast;
    if (params.exposure !== undefined) this.uniforms.exposure.value = params.exposure;
    if (params.invert !== undefined) this.uniforms.invert.value = params.invert;
    if (params.greyscale !== undefined) this.uniforms.greyscale.value = params.greyscale;
    if (params.blending !== undefined) this.uniforms.blending.value = params.blending;
    if (params.disable !== undefined) this.uniforms.disable.value = params.disable;
    if (params.usePatternTexture !== undefined) this.uniforms.usePatternTexture.value = params.usePatternTexture;
  }

  setPatternTexture(texture) {
    this.uniforms.tPattern.value = texture;
    this.uniforms.usePatternTexture.value = texture !== null;
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}