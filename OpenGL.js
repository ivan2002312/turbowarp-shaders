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
      this.timerMode = 'manual';
      this.startTimestamp = 0;
      this.vertexSource = 'attribute vec2 aPosition; varying vec2 vTexCoord; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); vTexCoord = aPosition * 0.5 + 0.5; }';
      this.fragmentSource = 'precision mediump float; varying vec2 vTexCoord; uniform float uTime; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5); }';
      this.isActive = false;
      this.sceneTexture = null;
      this.animationFrame = null;
      this.width = 480;
      this.height = 360;
      this.sceneAccessible = false;
      
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
        id: 'openglshaders',
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
                defaultValue: 'precision mediump float; varying vec2 vTexCoord; uniform float uTime; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5); }'
              }
            }
          },
          '---',
          {
            opcode: 'loadFragFile',
            blockType: Scratch.BlockType.COMMAND,
            text: 'загрузить .frag файл'
          },
          '---',
          {
            opcode: 'compileProgram',
            blockType: Scratch.BlockType.COMMAND,
            text: 'скомпилировать программу'
          },
          '---',
          {
            opcode: 'useTimer',
            blockType: Scratch.BlockType.COMMAND,
            text: 'использовать таймер проекта'
          },
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
          '---',
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
            text: 'лог'
          }
        ]
      };
    }

    loadFragFile() {
      if (!this.ready) {
        this.shaderLog = 'Инициализируйте сначала';
        return;
      }
      
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.frag,.glsl,.txt';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.fragmentSource = ev.target.result;
          this.shaderLog = 'Загружен: ' + file.name;
        };
        reader.readAsText(file);
      };
      
      input.click();
    }

    initGL() {
      if (this.ready) return;

      try {
        const stageCanvas = Scratch.renderer.canvas;
        if (!stageCanvas) {
          this.shaderLog = 'Сцена не найдена';
          return;
        }

        this.width = stageCanvas.width;
        this.height = stageCanvas.height;

        const parent = stageCanvas.parentElement || document.body;
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'shader-overlay';
        
        const oldCanvas = document.getElementById('shader-overlay');
        if (oldCanvas) oldCanvas.remove();
        
        // ВАЖНО: высокий z-index и красный фон для проверки
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
        
        parent.style.position = 'relative';
        parent.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl', {
          alpha: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true
        }) || this.canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true
        });

        if (!gl) {
          this.shaderLog = 'WebGL не поддерживается';
          return;
        }

        this.gl = gl;
        
        this.sceneTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
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
        this.shaderLog = 'Инициализируйте сначала';
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
        this.shaderLog = 'Vertex error: ' + gl.getShaderInfoLog(vs);
        gl.deleteShader(vs);
        return;
      }

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, this.fragmentSource);
      gl.compileShader(fs);

      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        this.shaderLog = 'Fragment error: ' + gl.getShaderInfoLog(fs);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this.shaderLog = 'Link error: ' + gl.getProgramInfoLog(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteProgram(program);
        return;
      }

      gl.deleteShader(vs);
      gl.deleteShader(fs);
      this.program = program;
      this.shaderLog = 'Скомпилировано';
    }

    useTimer() {
      this.timerMode = 'auto';
      this.startTimestamp = Date.now();
      this.shaderLog = 'Таймер запущен';
    }

    setTime(args) {
      this.timerMode = 'manual';
      this.currentTime = parseFloat(args.T) || 0;
    }

    draw() {
      if (!this.ready || !this.program || !this.gl || !this.canvas) {
        console.log('Не готово:', { ready: this.ready, program: !!this.program, gl: !!this.gl, canvas: !!this.canvas });
        return;
      }

      const gl = this.gl;
      const stageCanvas = Scratch.renderer.canvas;
      if (!stageCanvas) return;

      const width = this.width;
      const height = this.height;

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }

      this.canvas.style.display = 'block';
      this.isActive = true;

      // Время
      if (this.timerMode === 'auto') {
        this.currentTime = (Date.now() - this.startTimestamp) / 1000.0;
      }

      gl.useProgram(this.program);

      const timeLoc = gl.getUniformLocation(this.program, 'uTime');
      if (timeLoc) gl.uniform1f(timeLoc, this.currentTime);

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
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
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
      this.draw();
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
