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
    if (params.pixelSize !== undefined) this.uniforms.pixelSize.value = params.pixelSize;
    if (params.shape !== undefined) this.uniforms.shape.value = params.shape;
    if (params.rotationAngle !== undefined) this.uniforms.rotationAngle.value = params.rotationAngle;
    if (params.greyscale !== undefined) this.uniforms.greyscale.value = params.greyscale;
    if (params.blending !== undefined) this.uniforms.blending.value = params.blending;
    if (params.disable !== undefined) this.uniforms.disable.value = params.disable;
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