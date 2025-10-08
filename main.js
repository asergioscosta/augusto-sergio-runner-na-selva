/* main.js — Runner 2D completo
   - Pools, paralaxe, motion-blur, trail, spritesheet, gameOver + reset
   - Coloque spritesheet.png (500x500, 8x3) no mesmo diretório ou ajuste SPRITESHEET_SRC
*/

/* =========================
   Configurações iniciais
   ========================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

let lastTime = 0;
let running = true;
let gameOver = false;
let score = 0;

/* =========================
   Spritesheet (500x500, 8x3)
   - ajustável caso seu arquivo tenha outro nome/pasta
   ========================= */
const SPRITESHEET_SRC = 'spritesheet.png';
const SPRITE_COLS = 8;
const SPRITE_ROWS = 3;
let spriteImg = new Image();
let SPRITE_CELL_W = 0, SPRITE_CELL_H = 0;
let spritesReady = false;
spriteImg.src = SPRITESHEET_SRC;
spriteImg.onload = () => {
    SPRITE_CELL_W = spriteImg.width / SPRITE_COLS;
    SPRITE_CELL_H = spriteImg.height / SPRITE_ROWS;
    spritesReady = true;
};

/* =========================
   Entrada (teclado)
   - space dispara; Enter/R reinicia se gameOver
   ========================= */
const keys = {};
window.addEventListener('keydown', (e) => {
    const k = normalizeKey(e.key);
    keys[k] = true;

    // Disparo imediato ao apertar Espaço (usar e.key para garantir)
    if (e.key === ' ' || e.code === 'Space') {
        if (player) player.shoot();
        e.preventDefault();
    }

    // Reiniciar quando em game over
    if (gameOver && (e.key === 'Enter' || e.key.toLowerCase() === 'r')) {
        resetGame();
    }
});
window.addEventListener('keyup', (e) => {
    const k = normalizeKey(e.key);
    keys[k] = false;
});
function normalizeKey(raw) {
    if (raw === ' ') return ' ';
    return raw.length === 1 ? raw.toLowerCase() : raw;
}

/* =========================
   Parallax (melhorado)
   ========================= */
class ParallaxLayer {
    constructor(speedMultiplier, drawFn, options = {}) {
        this.offset = options.phase || 0;
        this.speedMultiplier = speedMultiplier;
        this.drawFn = drawFn;
        this.offsetY = options.offsetY || 0;
    }
    update(dt, baseSpeed = 140) {
        this.offset = (this.offset + baseSpeed * this.speedMultiplier * (dt / 1000)) % (GAME_WIDTH + 500);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(0, this.offsetY);
        this.drawFn(ctx, this.offset);
        ctx.restore();
    }
}

/* Camadas de exemplo (formas simples) */
function drawFar(ctx, offset) {
    ctx.fillStyle = '#072217';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = '#0b534b';
    for (let x = -offset; x < GAME_WIDTH + 300; x += 240) {
        ctx.beginPath();
        ctx.ellipse(x + 120, GAME_HEIGHT - 260, 180, 130, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawMid(ctx, offset) {
    ctx.fillStyle = '#0a6b4f';
    for (let x = -offset * 0.6; x < GAME_WIDTH + 200; x += 160) {
        const rx = (x % (GAME_WIDTH + 160));
        ctx.fillRect(rx - 20, GAME_HEIGHT - 260, 32, 120);
        ctx.beginPath();
        ctx.moveTo(rx - 80, GAME_HEIGHT - 260);
        ctx.lineTo(rx + 10, GAME_HEIGHT - 340);
        ctx.lineTo(rx + 100, GAME_HEIGHT - 260);
        ctx.fill();
    }
}
function drawNear(ctx, offset) {
    ctx.fillStyle = '#14563d';
    for (let x = -offset * 1.2; x < GAME_WIDTH + 80; x += 80) {
        const px = (x % (GAME_WIDTH + 80));
        ctx.beginPath();
        ctx.ellipse(px + 10, GAME_HEIGHT - 60 + Math.sin(px / 30) * 6, 60, 30, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

const layers = [
    new ParallaxLayer(0.12, drawFar, { offsetY: -40, phase: 0 }),
    new ParallaxLayer(0.45, drawMid, { offsetY: -10, phase: 80 }),
    new ParallaxLayer(1.1, drawNear, { offsetY: 10, phase: 160 })
];
const PARALLAX_BASE_SPEED = 160;

/* =========================
   Simple object pool
   ========================= */
class SimplePool {
    constructor(factory) {
        this.pool = [];
        this.factory = factory;
    }
    acquire(...args) {
        const obj = this.pool.pop();
        if (obj) {
            if (typeof obj.reset === 'function') obj.reset(...args);
            return obj;
        }
        return this.factory(...args);
    }
    release(obj) {
        if (typeof obj.onRelease === 'function') obj.onRelease();
        this.pool.push(obj);
    }
}

/* =========================
   Entidades
   ========================= */
class Entity {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.vx = 0; this.vy = 0;
        this.remove = false;
    }
    update(dt) { }
    draw(ctx) { }
}

/* Bullet */
class Bullet extends Entity {
    constructor(x, y, w, h, speed, dir = 1) {
        super(x, y, w, h);
        this.vx = speed * dir;
        this.color = '#fff1c6';
    }
    reset(x, y, w, h, speed, dir = 1) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.vx = speed * dir; this.vy = 0; this.remove = false;
    }
    onRelease() { }
    update(dt) {
        this.x += this.vx * (dt / 1000);
        if (this.x < -80 || this.x > GAME_WIDTH + 80) this.remove = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    }
}

/* Enemy */
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 48, 48);
        this.vx = -120;
        this.color = '#c84b4b';
    }
    reset(x, y) {
        this.x = x; this.y = y; this.w = 48; this.h = 48;
        this.vx = -120; this.vy = 0; this.remove = false;
    }
    onRelease() { }
    update(dt) {
        this.x += this.vx * (dt / 1000);
        if (this.x + this.w < -120) this.remove = true;
    }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    }
}

/* Player (com animação via spritesheet simples e trail) */
class Player extends Entity {
    constructor(x, y) {
        super(x, y, 64, 64); // dimensionei para 64x64 como padrão (ajuste se quiser)
        this.speed = 260;
        this.jumpSpeed = -520;
        this.onGround = false;

        // disparo
        this.shootCooldown = 0;
        this.shootRate = 220; // ms
        this.dir = 1;

        // trail
        this.trail = [];
        this.trailMax = 6;
        this.trailStep = 60;
        this.trailTimer = 0;

        // knockback
        this.isKnocked = false;
        this.knockTimer = 0;
        this.knockDuration = 280;

        // animação spritesheet
        this.anim = {
            state: 'run',
            rowIndex: 1,
            frameIndex: 0,
            frameTimer: 0,
            frameInterval: 80
        };
    }

    update(dt) {
        // knockback reduz controle
        if (this.isKnocked) {
            this.knockTimer -= dt;
            if (this.knockTimer <= 0) {
                this.isKnocked = false;
                this.knockTimer = 0;
            }
        }

        // física
        const GRAV = 1800;
        this.vy += GRAV * (dt / 1000);

        // controles horizontais (se não knockado)
        let moveX = 0;
        if (!this.isKnocked) {
            if (keys.a || keys.arrowleft) moveX -= 1;
            if (keys.d || keys.arrowright) moveX += 1;
        }
        this.vx = moveX * this.speed;

        // pulo
        if ((keys.w || keys.arrowup) && this.onGround && !this.isKnocked) {
            this.vy = this.jumpSpeed;
            this.onGround = false;
        }

        // integração
        this.x += this.vx * (dt / 1000);
        this.y += this.vy * (dt / 1000);

        // chão
        const groundY = GAME_HEIGHT - 80;
        if (this.y + this.h >= groundY) {
            this.y = groundY - this.h;
            this.vy = 0;
            this.onGround = true;
        }

        this.x = Math.max(8, Math.min(GAME_WIDTH - this.w - 8, this.x));

        // cooldown de tiro
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // trail sampling
        this.trailTimer += dt;
        if (this.trailTimer >= this.trailStep) {
            this.trailTimer -= this.trailStep;
            this.trail.unshift({ x: this.x, y: this.y });
            if (this.trail.length > this.trailMax) this.trail.pop();
        }

        // animação: decide estado
        if (Math.abs(this.vx) < 1 && this.onGround) this._setAnimState('idle');
        else this._setAnimState('run');

        // avançar frame
        this.anim.frameTimer += dt;
        if (this.anim.frameTimer >= this.anim.frameInterval) {
            this.anim.frameTimer -= this.anim.frameInterval;
            this.anim.frameIndex = (this.anim.frameIndex + 1) % SPRITE_COLS;
        }
    }

    draw(ctx) {
        // trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = 0.5 * (1 - i / this.trail.length);
            ctx.save();
            ctx.globalAlpha = alpha;
            // se tiver sprites, opcional: desenhar sprite com alpha; aqui desenhamos box para performance
            if (spritesReady) {
                const col = this.anim.frameIndex % SPRITE_COLS;
                const row = this.anim.rowIndex;
                const sx = col * SPRITE_CELL_W;
                const sy = row * SPRITE_CELL_H;
                const sw = SPRITE_CELL_W;
                const sh = SPRITE_CELL_H;
                // desenhar em tamanho do player
                ctx.drawImage(spriteImg, sx, sy, sw, sh, t.x, t.y, this.w, this.h);
            } else {
                ctx.fillStyle = '#ffd86b';
                ctx.fillRect(t.x, t.y, this.w, this.h);
            }
            ctx.restore();
        }

        // jogador (sprite se pronto)
        if (spritesReady) {
            const col = this.anim.frameIndex % SPRITE_COLS;
            const row = this.anim.rowIndex;
            const sx = col * SPRITE_CELL_W;
            const sy = row * SPRITE_CELL_H;
            const sw = SPRITE_CELL_W;
            const sh = SPRITE_CELL_H;
            const dx = this.x;
            const dy = this.y;
            const dw = this.w;
            const dh = this.h;
            ctx.drawImage(spriteImg, sx, sy, sw, sh, dx, dy, dw, dh);
        } else {
            ctx.save();
            ctx.fillStyle = '#ffd86b';
            ctx.fillRect(this.x, this.y, this.w, this.h);
            ctx.restore();
        }
    }

    shoot() {
        if (this.shootCooldown > 0) return;
        this.shootCooldown = this.shootRate;
        const bx = (this.dir === 1) ? this.x + this.w : this.x - 12;
        const by = this.y + this.h / 2 - 6;
        const bw = 12, bh = 12;
        const speed = 700;
        const dir = this.dir;
        const b = bulletPool.acquire(bx, by, bw, bh, speed, dir);
        bullets.push(b);
    }

    applyKnockback() {
        this.vx = -360;
        this.vy = -280;
        this.isKnocked = true;
        this.knockTimer = this.knockDuration;
    }

    _setAnimState(name) {
        if (this.anim.state === name) return;
        this.anim.state = name;
        this.anim.rowIndex = name === 'idle' ? 0 : 1; // idle -> row 0, run -> row 1
        this.anim.frameIndex = 0;
        this.anim.frameTimer = 0;
    }
}

/* =========================
   Pools e coleções
   ========================= */
const bulletPool = new SimplePool((x, y, w, h, speed, dir) => new Bullet(x, y, w, h, speed, dir));
const enemyPool = new SimplePool((x, y) => new Enemy(x, y));

const player = new Player(120, GAME_HEIGHT - 200);
const enemies = [];
const bullets = [];

/* =========================
   Spawn de inimigos
   ========================= */
let enemySpawnTimer = 0;
function spawnEnemy() {
    const y = GAME_HEIGHT - 80 - 48;
    const x = GAME_WIDTH + Math.random() * 300;
    const e = enemyPool.acquire(x, y);
    enemies.push(e);
}

/* =========================
   Screen flash
   ========================= */
const screenFlash = {
    timer: 0,
    duration: 0,
    trigger(ms = 100) {
        this.duration = ms;
        this.timer = ms;
    },
    update(dt) {
        if (this.timer > 0) this.timer = Math.max(0, this.timer - dt);
    },
    draw(ctx) {
        if (this.timer <= 0) return;
        const t = this.timer / Math.max(1, this.duration);
        ctx.save();
        ctx.globalAlpha = 0.7 * t;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }
};

/* =========================
   Colisão AABB
   ========================= */
function aabbIntersect(a, b) {
    return a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y;
}

/* =========================
   Atualizações separadas
   ========================= */
function processInput() { /* placeholder para polled input / gamepad */ }

function updateEntities(dt) {
    // paralaxe
    layers.forEach(l => l.update(dt, PARALLAX_BASE_SPEED));

    // player
    player.update(dt);

    // enemies/bullets com culling
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.x + e.w < -200) { e.remove = true; continue; }
        e.update(dt);
    }
    for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (b.x < -80 || b.x > GAME_WIDTH + 80) { b.remove = true; continue; }
        b.update(dt);
    }
}

function handleCollisions() {
    // bullets x enemies
    for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        if (b.remove) continue;
        for (let j = 0; j < enemies.length; j++) {
            const e = enemies[j];
            if (e.remove) continue;
            if (aabbIntersect(b, e)) {
                b.remove = true;
                e.remove = true;
                score += 10;
                break;
            }
        }
    }

    // player x enemies -> GAME OVER
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.remove) continue;
        if (aabbIntersect(player, e)) {
            e.remove = true;
            score = Math.max(0, score - 20);
            screenFlash.trigger(160);
            gameOver = true;
            running = false;
            break;
        }
    }
}

function cleanupEntities() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].remove) {
            enemyPool.release(enemies[i]);
            enemies.splice(i, 1);
        }
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].remove) {
            bulletPool.release(bullets[i]);
            bullets.splice(i, 1);
        }
    }
}

/* main update */
function update(dt) {
    if (!running) {
        // mesmo pausado, atualiza timers visuais (flash) para UX
        screenFlash.update(dt);
        return;
    }

    processInput();
    updateEntities(dt);

    // spawn controlado
    enemySpawnTimer -= dt;
    if (enemySpawnTimer <= 0) {
        spawnEnemy();
        enemySpawnTimer = 700 + Math.random() * 1300;
    }

    handleCollisions();
    cleanupEntities();
    screenFlash.update(dt);

    scoreEl.textContent = score;
}

/* =========================
   Draw / Render
   ========================= */
function drawHUD(ctx) {
    const text = `Score: ${score}`;
    ctx.save();
    ctx.font = '700 18px Inter, Roboto, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(text, 20, 34);
    ctx.fillStyle = '#f8ffd9';
    ctx.fillText(text, 20, 34);
    ctx.restore();
}

function draw() {
    // motion blur falso (overlay)
    ctx.fillStyle = 'rgba(5,10,8,0.14)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // camadas
    layers.forEach(l => l.draw(ctx));

    // chão
    ctx.save();
    ctx.fillStyle = '#2b5b3b';
    ctx.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);
    ctx.restore();

    // entidades (culling simples no draw)
    player.draw(ctx);
    for (const e of enemies) {
        if (e.x + e.w >= -20 && e.x <= GAME_WIDTH + 20) e.draw(ctx);
    }
    for (const b of bullets) {
        if (b.x + b.w >= -20 && b.x <= GAME_WIDTH + 20) b.draw(ctx);
    }

    // HUD
    drawHUD(ctx);

    // flash
    screenFlash.draw(ctx);

    // overlay Game Over
    if (gameOver) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '700 42px Inter, Roboto, sans-serif';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        ctx.font = '500 18px Inter, Roboto, sans-serif';
        ctx.fillText('Pressione Enter ou R para reiniciar', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
        ctx.restore();
    }
}

/* =========================
   Loop principal
   ========================= */
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

/* =========================
   Reset / Restart
   ========================= */
function resetGame() {
    // reciclar inimigos e balas
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemyPool.release(enemies[i]);
        enemies.splice(i, 1);
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
        bulletPool.release(bullets[i]);
        bullets.splice(i, 1);
    }

    // reset player
    player.x = 120;
    player.y = GAME_HEIGHT - 200;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.isKnocked = false;
    player.trail = [];
    player.shootCooldown = 0;
    player.anim.frameIndex = 0;

    // flags e scores
    score = 0;
    enemySpawnTimer = 0;
    gameOver = false;
    running = true;
}

/* =========================
   Inicia
   ========================= */
requestAnimationFrame(gameLoop);
canvas.addEventListener('click', () => spawnEnemy());

/* FIM do main.js */
