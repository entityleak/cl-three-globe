import { ShaderChunk } from 'three';

export const dashedLineShaders = () => ({
  uniforms: {
    // dash param defaults, all relative to full length
    dashOffset: { value: 0 },
    dashSize: { value: 1 },
    gapSize: { value: 0 },
    dashTranslate: { value: 0 } // used for animating the dash
  },
  vertexShader: `
    ${ShaderChunk.common}
    ${ShaderChunk.logdepthbuf_pars_vertex}
  
    uniform float dashTranslate; 

    attribute vec4 color;
    varying vec4 vColor;
    
    attribute float relDistance;
    varying float vRelDistance;

    void main() {
      // pass through colors and distances
      vColor = color;
      vRelDistance = relDistance + dashTranslate;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  
      ${ShaderChunk.logdepthbuf_vertex}
    }
  `,
  fragmentShader: `
    ${ShaderChunk.logdepthbuf_pars_fragment}

    uniform float dashOffset; 
    uniform float dashSize;
    uniform float gapSize; 
    
    varying vec4 vColor;
    varying float vRelDistance;
    
    void main() {
      // ignore pixels in the gap
      if (vRelDistance < dashOffset) discard;
      if (mod(vRelDistance - dashOffset, dashSize + gapSize) > dashSize) discard;
    
      // set px color: [r, g, b, a], interpolated between vertices 
      gl_FragColor = vColor; 
  
      ${ShaderChunk.logdepthbuf_fragment}
    }
  `
});

export const invisibleUndergroundShader = ({ vertexColors = false } = {}) => ({
  uniforms: {
    color: { type: 'vec4' },
    surfaceRadius: { type: 'float', value: 0 },
  },
  vertexShader: `
    attribute vec4 color;
    attribute float surfaceRadius;
    
    varying vec3 vPos;
    varying vec4 vColor;
    varying float vSurfaceRadius;

    void main() {
      // pass through position, color & surfaceRadius
      vPos = position;
      vColor = color;
      vSurfaceRadius = surfaceRadius;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec4 color; 
    uniform float surfaceRadius;
    
    varying vec3 vPos;
    varying vec4 vColor;
    varying float vSurfaceRadius;
    
    void main() {
      // ignore pixels underground
      if (length(vPos) < max(surfaceRadius, vSurfaceRadius)) discard;
      
      gl_FragColor = ${vertexColors ? 'vColor' : 'color'};
    }
  `
});

export const invisibleUndergroundShaderExtend = shader => {
  shader.uniforms.surfaceRadius = { type: 'float', value: 0 };
  shader.vertexShader = ('attribute float surfaceRadius;\nvarying float vSurfaceRadius;\nvarying vec3 vPos;\n' + shader.vertexShader)
    .replace('void main() {', [
      'void main() {',
      'vSurfaceRadius = surfaceRadius;',
      'vPos = position;'
    ].join('\n'));

  shader.fragmentShader = ('uniform float surfaceRadius;\nvarying float vSurfaceRadius;\nvarying vec3 vPos;\n' + shader.fragmentShader)
    .replace('void main() {', [
      'void main() {',
      'if (length(vPos) < max(surfaceRadius, vSurfaceRadius)) discard;'
    ].join('\n'));

  return shader;
};

export const setRadiusShaderExtend = shader => {
  shader.vertexShader = `
    attribute float r;
    
    const float PI = 3.1415926535897932384626433832795;
    float toRad(in float a) {
      return a * PI / 180.0;
    }
    
    vec3 Polar2Cartesian(in vec3 c) { // [lat, lng, r]
      float phi = toRad(90.0 - c.x);
      float theta = toRad(90.0 - c.y);
      float r = c.z;
      return vec3( // x,y,z
        r * sin(phi) * cos(theta),
        r * cos(phi),
        r * sin(phi) * sin(theta)
      );
    }
    
    vec2 Cartesian2Polar(in vec3 p) {
      float r = sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      float phi = acos(p.y / r);
      float theta = atan(p.z, p.x);
      return vec2( // lat,lng
        90.0 - phi * 180.0 / PI,
        90.0 - theta * 180.0 / PI - (theta < -PI / 2.0 ? 360.0 : 0.0)
      );
    }
    ${shader.vertexShader.replace('}', `                  
        vec3 pos = Polar2Cartesian(vec3(Cartesian2Polar(position), r));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `)}
  `;

  return shader;
}

//

export const applyShaderExtensionToMaterial = (material, extensionFn) => {
  material.onBeforeCompile = shader => {
    material.userData.shader = extensionFn(shader);
  };
  return material;
};

export const setExtendedMaterialUniforms = (material, uniformsFn = u => u) => {
  if (material.userData.shader) {
    uniformsFn(material.userData.shader.uniforms);
  } else {
    const curFn = material.onBeforeCompile;
    material.onBeforeCompile = shader => {
      curFn(shader);
      uniformsFn(shader.uniforms);
    };
  }
}

export const halftoneShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: null },
    pixelSize: { value: 6.0 },
    shape: { value: 1.0 }, // 0 = circle, 1 = square, 2 = diamond
    rotationAngle: { value: 0.785398 }, // 45 degrees in radians
    greyscale: { value: false },
    blending: { value: 1.0 },
    disable: { value: false }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    uniform float shape;
    uniform float rotationAngle;
    uniform bool greyscale;
    uniform float blending;
    uniform bool disable;

    varying vec2 vUv;

    float luma(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    vec2 rotate(vec2 v, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      mat2 m = mat2(c, -s, s, c);
      return m * v;
    }

    float circle(vec2 coord, float radius) {
      return 1.0 - smoothstep(radius - 0.1, radius + 0.1, length(coord));
    }

    float square(vec2 coord, float size) {
      vec2 d = abs(coord) - vec2(size);
      return 1.0 - smoothstep(-0.1, 0.1, max(d.x, d.y));
    }

    float diamond(vec2 coord, float size) {
      float d = abs(coord.x) + abs(coord.y) - size;
      return 1.0 - smoothstep(-0.1, 0.1, d);
    }

    void main() {
      if (disable) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 coord = vUv * resolution;
      vec2 rotatedCoord = rotate(coord, rotationAngle);

      vec2 grid = floor(rotatedCoord / pixelSize) * pixelSize;
      vec2 cellCenter = grid + pixelSize * 0.5;
      vec2 cellCoord = (rotatedCoord - cellCenter) / (pixelSize * 0.5);

      vec2 sampleCoord = rotate(cellCenter, -rotationAngle) / resolution;
      sampleCoord = clamp(sampleCoord, 0.0, 1.0);

      vec4 tex = texture2D(tDiffuse, sampleCoord);
      float intensity = greyscale ? luma(tex.rgb) : (tex.r + tex.g + tex.b) / 3.0;

      float dotSize = intensity * 0.8 + 0.1;
      float mask;

      if (shape < 0.5) {
        mask = circle(cellCoord, dotSize);
      } else if (shape < 1.5) {
        mask = square(cellCoord, dotSize);
      } else {
        mask = diamond(cellCoord, dotSize);
      }

      vec3 halftoneColor = tex.rgb * mask;
      vec3 finalColor = mix(tex.rgb, halftoneColor, blending);

      gl_FragColor = vec4(finalColor, tex.a);
    }
  `
};