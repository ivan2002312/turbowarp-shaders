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
      this.sceneTexture = null;
      this.tempCanvas = null;
      this.tempCtx = null;
      this.animationFrame = null;
      
      if (Scratch.vm) {
        Scratch.vm.runtime.on('PROJECT_STOP_ALL', () => this.resetAll());
      }
    }

    resetAll() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
      if (this.gl) {
        if (this.sceneTexture) {
          this.gl.deleteTexture(this.sceneTexture);
          this.sceneTexture = null;
        }
      }
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
                defaultValue: 'precision mediump float; varying vec2 vTexCoord; uniform float uTime; uniform sampler2D uSampler; void main() { vec4 color = texture2D(uSampler, vTexCoord); gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
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
            opcode: 'startDraw',
            blockType: Scratch.BlockType.COMMAND,
            text: 'запустить непрерывное рисование'
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
          this.shaderLog = 'Сцена не найдена';
          return;
        }

        const parent = stageCanvas.parentElement || document.body;
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'shader-overlay';
        
        // Удаляем старый canvas если есть
        const oldCanvas = document.getElementById('shader-overlay');
        if (oldCanvas) oldCanvas.remove();
        
        this.canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1000;
          display: none;
        `;
        
        parent.style.position = 'relative';
        parent.appendChild(this.canvas);

        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });

        const glOptions = {
          alpha: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true,
          antialias: false
        };

        this.gl = this.canvas.getContext('webgl', glOptions) || 
                  this.canvas.getContext('experimental-webgl', glOptions);

        if (!this.gl) {
          this.shaderLog = 'WebGL не поддерживается';
          return;
        }

        this.ready = true;
        this.shaderLog = 'OpenGL готов';
      } catch (e) {
        this.shaderLog = 'Ошибка: ' + e.message;
      }
    }

    setVertexShader(args) {
      this.vertexSource = args.SOURCE;
    }

    setFragmentShader(args) {
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

      // Компиляция вершинного шейдера
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, this.vertexSource);
      gl.compileShader(vs);

      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(vs);
        this.shaderLog = 'Ошибка вершинного шейдера: ' + info;
        console.error(this.shaderLog);
        gl.deleteShader(vs);
        return;
      }

      // Компиляция фрагментного шейдера
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, this.fragmentSource);
      gl.compileShader(fs);

      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(fs);
        this.shaderLog = 'Ошибка фрагментного шейдера: ' + info;
        console.error(this.shaderLog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return;
      }

      // Линковка программы
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        this.shaderLog = 'Ошибка линковки: ' + info;
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

    captureScene() {
      const stageCanvas = Scratch.renderer.canvas;
      if (!stageCanvas) return false;

      const width = stageCanvas.width;
      const height = stageCanvas.height;

      if (this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
        this.tempCanvas.width = width;
        this.tempCanvas.height = height;
      }

      try {
        this.tempCtx.clearRect(0, 0, width, height);
        this.tempCtx.drawImage(stageCanvas, 0, 0, width, height);
        return true;
      } catch (e) {
        console.error('Ошибка захвата сцены:', e);
        return false;
      }
    }

    draw() {
      if (!this.ready || !this.program || !this.gl || !this.canvas) {
        console.log('Не готово:', { ready: this.ready, program: !!this.program, gl: !!this.gl, canvas: !!this.canvas });
        return;
      }

      const gl = this.gl;
      const stageCanvas = Scratch.renderer.canvas;
      if (!stageCanvas) return;

      // Захват сцены
      if (!this.captureScene()) return;

      const width = stageCanvas.width;
      const height = stageCanvas.height;

      // Обновление размеров canvas
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.canvas.style.display = 'block';
      this.isActive = true;

      // Создание/обновление текстуры
      if (!this.sceneTexture) {
        this.sceneTexture = gl.createTexture();
      }
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.tempCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Использование программы
      gl.useProgram(this.program);

      // Установка uniforms
      const timeLoc = gl.getUniformLocation(this.program, 'uTime');
      if (timeLoc !== null) gl.uniform1f(timeLoc, this.currentTime);

      const samplerLoc = gl.getUniformLocation(this.program, 'uSampler');
      if (samplerLoc !== null) gl.uniform1i(samplerLoc, 0);

      // Создание буфера вершин
      const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
      ]);
      
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      const posLoc = gl.getAttribLocation(this.program, 'aPosition');
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }

      // Отрисовка
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      // Очистка
      gl.deleteBuffer(buffer);
    }

    startDraw() {
      const drawLoop = () => {
        if (this.isActive) {
          this.draw();
          this.animationFrame = requestAnimationFrame(drawLoop);
        }
      };
      
      this.isActive = true;
      this.animationFrame = requestAnimationFrame(drawLoop);
    }

    hide() {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
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
