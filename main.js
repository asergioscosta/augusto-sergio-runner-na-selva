const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let lastTime = 0;
let score = 0, lives = 3, gameOver = false;
const scoreEl = document.getElementById('score'), livesEl = document.getElementById('lives');

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d'].includes(e.key)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

const SPRITE_SRC = 'assets/spritesheet.png';

const COLS = 10;
const ROWS = 3;
const FRAME_W = 75;
const FRAME_H = 50;

const spriteImg = new Image();
spriteImg.src = SPRITE_SRC;

const frames = [];
for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) frames.push({sx:c*FRAME_W, sy:r*FRAME_H});

const RUN_FRAMES = [10, 11, 12, 13, 14, 15, 16, 17];


class Layer { 
    constructor(speed, color) { this.speed = speed; this.x = 0; this.color = color; } 
    update(dt) { this.x = (this.x - this.speed*dt) % W; } 
    draw(ctx) { ctx.fillStyle = this.color; ctx.fillRect(this.x,0,W,H-80); ctx.fillRect(this.x+W,0,W,H-80); } 
}

class Player { 
    constructor(x,y){ 
        this.w=70; 
        this.h=70; 
        this.x=x; 
        this.y=y;

        this.vy=0; this.onGround=false;
        this.gravity=2400; this.jumpForce=-700;
        
        this.animFrames = RUN_FRAMES;
        this.animIndex = 0;
        this.frameTimer = 0; this.frameInterval = 80; // ms
    }
    update(dt){
        this.vy += this.gravity*dt; this.y += this.vy*dt;
        const groundY = H-80;
        if (this.y + this.h >= groundY) { 
            this.y = groundY - this.h; 
            this.vy = 0; 
            this.onGround = true; 
        } else this.onGround = false;

        if ((keys['ArrowUp']||keys['w']) && this.onGround) { this.vy = this.jumpForce; this.onGround = false; }
        
        this.frameTimer += dt*1000;
        if (this.frameTimer >= this.frameInterval){ this.frameTimer = 0; this.animIndex = (this.animIndex+1) % this.animFrames.length; }
    }
    draw(ctx){
        const fi = this.animFrames[this.animIndex];
        const sx = frames[fi].sx, sy = frames[fi].sy;
        ctx.drawImage(spriteImg, sx, sy, FRAME_W, FRAME_H, this.x, this.y, this.w, this.h);
    }
    getAABB(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
}

class Bullet { constructor(x,y,vx){ this.x=x; this.y=y; this.vx=vx; this.w=12; this.h=6; this.active=true; } update(dt){ this.x += this.vx*dt; if (this.x>W+50||this.x<-50) this.active=false; } draw(ctx){ ctx.fillStyle='yellow'; ctx.fillRect(this.x,this.y,this.w,this.h); } getAABB(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; } }
class Enemy { constructor(x,y,vx){ this.x=x; this.y=y; this.vx=vx; this.w=48; this.h=48; this.active=true; } update(dt){ this.x += this.vx*dt; if (this.x < -100) this.active=false; } draw(ctx){ ctx.fillStyle='red'; ctx.fillRect(this.x,this.y,this.w,this.h); } getAABB(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; } }

function aabb(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

let layers = [], player, bullets = [], enemies = [];
let spawnTimer = 0, spawnInterval = 1.6;
let lastShot = 0, shotCooldown = 0.35;

function init(){ 
    layers = [ new Layer(20,'#b3e6ff'), new Layer(60,'#98e0a3'), new Layer(180,'#4ea74c') ]; 
    
    const playerInitialY = H - 80 - 70; 
    player = new Player(120, playerInitialY); 

    bullets=[]; enemies=[]; score=0; lives=3; gameOver=false; lastTime = performance.now(); 
    requestAnimationFrame(loop); 
}

function tryShoot(timeNow){ if ((keys[' '] || keys['Spacebar'] || keys['Space']) && (timeNow - lastShot) > shotCooldown){ lastShot = timeNow; bullets.push(new Bullet(player.x + player.w, player.y + player.h/2 - 3, 800)); } }

function update(dt){ 
    if (gameOver) return; 

    layers.forEach(l=>l.update(dt)); 
    player.update(dt); 
    tryShoot(performance.now()/1000); 
    
    bullets.forEach(b=>b.update(dt)); 
    enemies.forEach(e=>e.update(dt)); 
    
    bullets.forEach(b=>{ 
        enemies.forEach(e=>{ 
            if (b.active && e.active && aabb(b.getAABB(), e.getAABB())){ 
                b.active=false; e.active=false; score += 10; 
            } 
        }); 
    }); 

    enemies.forEach(e=>{ 
        if (e.active && aabb(player.getAABB(), e.getAABB())){ 
            e.active=false; 
            lives -= 1; 
            player.x -= 10; 
            if (lives <=0) gameOver = true; 
        } 
    }); 
    
    bullets = bullets.filter(b=>b.active); 
    enemies = enemies.filter(e=>e.active); 

    spawnTimer += dt; 
    if (spawnTimer >= spawnInterval){ 
        spawnTimer = 0; 
        const enemyH = 48;
        const ey = H - 80 - enemyH; 
        const ex = W + 50; 
        const evx = -220 - Math.random()*120;
        enemies.push(new Enemy(ex, ey, evx)); 
    } 

    scoreEl.textContent = `Score: ${score}`; 
    livesEl.textContent = `Vidas: ${lives}`; 
}

function draw(){ 
    ctx.clearRect(0,0,W,H); 
    layers.forEach(l=>l.draw(ctx)); 
    
    ctx.fillStyle = '#2b6b2b'; 
    ctx.fillRect(0, H-80, W, 80); 
    
    player.draw(ctx); 
    bullets.forEach(b=>b.draw(ctx)); 
    enemies.forEach(e=>e.draw(ctx)); 

    if (gameOver){ 
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; 
        ctx.fillRect(0,0,W,H); 
        ctx.fillStyle = '#fff'; 
        ctx.font = '48px sans-serif'; 
        ctx.textAlign = 'center'; 
        ctx.fillText('GAME OVER', W/2, H/2 - 20); 
        ctx.font = '22px sans-serif'; 
        ctx.fillText(`Score: ${score}`, W/2, H/2 + 20); 
    } 
}

function loop(now){ 
    const dt = (now - lastTime)/1000; 
    lastTime = now; 
    update(dt); 
    draw(); 
    requestAnimationFrame(loop); 
}

spriteImg.onload = () => { init(); };
spriteImg.onerror = () => { console.error('Erro ao carregar spritesheet:', SPRITE_SRC); init(); };