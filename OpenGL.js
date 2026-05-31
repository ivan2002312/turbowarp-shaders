// Name: OpenGL Шейдеры
// ID: openglshadersreset
// Description: OpenGL шейдеры с автосбросом при остановке игры
// By: User

(function (Scratch) {
  "use strict";

  class OpenGLShaders {
    constructor() {
      this.gl = null;
      this.canvas = null;
      this.program = null;
      this.ready = false;
      this.shaderLog = '';
      this.currentTime = 0;
      this.vertexSource = '';
      this.fragmentSource = '';
      this.isActive = false;
    }

    getInfo() {
      return {
        id: 'openglshadersreset',
        name: 'OpenGL Шейдеры',
        color1: '#4A90D9',
        color2: '#3570B0',
        color3: '#2A5A90',
        blocks: [
          {
            opcode: 'initGL',
            blockType: Scratch.BlockType.COMMAND,
            text: 'инициализировать OpenGL'
          },
          '---',
          {
            opcode: 'setVertexShader',
            blockType: Scratch.BlockType.COMMAND,
            text: 'вершинный шейдер [SOURCE]',
            arguments: {
              SOURCE: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'attribute vec2 aPosition; varying vec2 vTexCoord; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); vTexCoord = aPosition * 0.5 + 0.5; }'
              }
            }
          },
          {
            opcode: 'setFragmentShader',
            blockType: Scratch.BlockType.COMMAND,
            text: 'фрагментный шейдер [SOURCE]',
            arguments: {
              SOURCE: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: 'precision mediump float; varying vec2 vTexCoord; uniform float uTime; void main() { gl_FragColor = vec4(vTexCoord.x, vTexCoord.y, 0.5, 1.0); }'
              }
            }
          },
          '---',
          {
            opcode: 'compileProgram',
            blockType: Scratch.BlockType.COMMAND,
            text: 'скомпилировать программу'
          },
          '---',
          {
            opcode: 'setTime',
            blockType: Scratch.BlockType.COMMAND,
            text: 'установить время [T]',
            arguments: {
              T: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0
              }
            }
          },
          {
            opcode: 'draw',
            blockType: Scratch.BlockType.COMMAND,
            text: 'нарисовать шейдер'
          },
          {
            opcode: 'hide',
            blockType: Scratch.BlockType.COMMAND,
            text: 'спрятать шейдер'
          },
          '---',
          {
            opcode: 'getLog',
            blockType: Scratch.BlockType.REPORTER,
            text: 'лог компиляции'
          }
        ]
      };
    }

    initGL() {
      if (this.ready) return;

      try {
        const stageCanvas = Scratch.renderer.canvas;
        if (!stageCanvas) {
          console.error('Сцена не найдена');
          return;
        }

        const parent = stageCanvas.parentElement;
        if (!parent) {
          console.error('Родитель не найден');
          return;
        }

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;display:none;';
        
        parent.style.position = 'relative';
        parent.appendChild(this.canvas);

        const glOptions = {
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          antialias: false,
          depth: false,
          stencil: false
        };

        this.gl = this.canvas.getContext('webgl', glOptions) || 
                  this.canvas.getContext('experimental-webgl', glOptions);

        if (!this.gl) {
          console.error('WebGL не поддерживается');
          return;
        }

        const gl = this.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        this.ready = true;
        this.shaderLog = 'OpenGL готов';
        console.log('OpenGL инициализирован');
      } catch (e) {
        console.error('Ошибка:', e);
        this.shaderLog = 'Ошибка: ' + e.message;
      }
    }

    setVertexShader(args) {
      if (!this.ready) this.initGL();
      this.vertexSource = args.SOURCE;
    }

    setFragmentShader(args) {
      if (!this.ready) this.initGL();
      this.fragmentSource = args.SOURCE;
    }

    compileProgram() {
      if (!this.ready || !this.gl) {
        this.shaderLog = 'Сначала инициализируйте OpenGL';
        return;
      }
      
      if (!this.vertexSource || !this.fragmentSource) {
        this.shaderLog = 'Укажите оба шейдера';
        return;
      }

      const gl = this.gl;

      if (this.program) {
        gl.deleteProgram(this.program);
        this.program = null;
      }

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, this.vertexSource);
      gl.compileShader(vs);

      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        this.shaderLog = 'Ошибка вершинного шейдера: ' + gl.getShaderInfoLog(vs);
        console.error(this.shaderLog);
        gl.deleteShader(vs);
        return;
      }

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, this.fragmentSource);
      gl.compileShader(fs);

      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        this.shaderLog = 'Ошибка фрагментного шейдера: ' + gl.getShaderInfoLog(fs);
        console.error(this.shaderLog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this.shaderLog = 'Ошибка линковки: ' + gl.getProgramInfoLog(program);
        console.error(this.shaderLog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
        return;
      }

      gl.deleteShader(vs);
      gl.deleteShader(fs);

      this.program = program;
      this.shaderLog = 'Программа скомпилирована успешно';
      console.log(this.shaderLog);
    }

    setTime(args) {
      this.currentTime = parseFloat(args.T) || 0;
    }

    draw() {
      if (!this.ready || !this.program || !this.gl || !this.canvas) return;

      const gl = this.gl;
      const stageCanvas = Scratch.renderer.canvas;
      if (!stageCanvas) return;

      const width = stageCanvas.width;
      const height = stageCanvas.height;

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      const rect = stageCanvas.getBoundingClientRect();
      this.canvas.style.display = 'block';
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.isActive = true;

      gl.useProgram(this.program);

      const timeLoc = gl.getUniformLocation(this.program, 'uTime');
      if (timeLoc !== null) {
        gl.uniform1f(timeLoc, this.currentTime);
      }

      const vertices = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const posLoc = gl.getAttribLocation(this.program, 'aPosition');
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }

      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.deleteBuffer(buffer);
    }

    hide() {
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
      this.isActive = false;
    }

    getLog() {
      return this.shaderLog || 'Нет логов';
    }
  }

  Scratch.extensions.register(new OpenGLShaders());
})(Scratch);
