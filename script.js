/* ==========================================================================
   UNDERTALE PORTFOLIO - FAITHFUL UNDERTALE BATTLE CONTROLLER & ENGINE
   ========================================================================== */

import { 
  auth, 
  db, 
  googleProvider, 
  firebaseInitialized, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. WEB AUDIO API SYNTHESIZER
  // ==========================================
  let audioEnabled = true;
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type = 'square', duration = 0.08, gainVal = 0.05) {
    if (!audioEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function playBlipSound() { playTone(180 + Math.random() * 40, 'square', 0.04, 0.03); }
  function playSelectSound() { playTone(440, 'square', 0.06, 0.06); }
  function playHitSound() { playTone(100, 'sawtooth', 0.15, 0.12); }
  function playSlashSound() { playTone(650, 'sawtooth', 0.12, 0.1); }
  function playHealSound() {
    [300, 400, 500, 600].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.1, 0.06), i * 50));
  }
  function playSaveSound() {
    [261.63, 329.63, 392.00, 523.25].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.15, 0.08), i * 80));
  }
  function playVictorySound() {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.2, 0.08), i * 100));
  }

  // Audio Toggle
  const audioBtn = document.getElementById('btn-audio');
  const audioStatus = document.getElementById('audio-status');
  const audioIcon = document.getElementById('audio-icon');

  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      audioStatus.textContent = audioEnabled ? 'SFX: ON' : 'SFX: OFF';
      audioIcon.textContent = audioEnabled ? 'volume_up' : 'volume_off';
      if (audioEnabled) playSelectSound();
    });
  }


  // ==========================================
  // 2. DYNAMIC POPUPS & EASTER EGGS
  // ==========================================
  const popupDialog = document.getElementById('ut-popup-dialog');
  const popupText = document.getElementById('popup-text');
  const closePopup = document.getElementById('close-popup');

  function showPopup(msg) {
    if (popupText && popupDialog) {
      popupText.textContent = msg;
      popupDialog.classList.remove('hidden');
      playSaveSound();
    }
  }

  if (closePopup && popupDialog) {
    closePopup.addEventListener('click', () => {
      popupDialog.classList.add('hidden');
    });
  }

  const brandTrigger = document.getElementById('brand-trigger');
  if (brandTrigger) {
    brandTrigger.addEventListener('click', () => {
      showPopup('* HENRIK BISPO.EXE — LV 99. "Encher-se de DETERMINAÇÃO é o melhor algoritmo."');
    });
  }

  const avatarClicker = document.getElementById('avatar-clicker');
  if (avatarClicker) {
    avatarClicker.addEventListener('click', () => {
      showPopup('* É o Henrik. Ele parece focado em resolver problemas de IA e automação!');
    });
  }

  const btnInteractHero = document.getElementById('btn-interact-hero');
  if (btnInteractHero) {
    btnInteractHero.addEventListener('click', () => {
      showPopup('* Conselho do Henrik: "Códigos limpos geram menos bugs na vida real!"');
    });
  }

  const savePointTrigger = document.getElementById('save-point-trigger');
  if (savePointTrigger) {
    savePointTrigger.addEventListener('click', () => {
      showPopup('* (Seu progresso e determinação foram salvos com sucesso! 🌟)');
    });
  }

  const timelineCards = document.querySelectorAll('.ut-timeline-card');
  timelineCards.forEach(card => {
    card.addEventListener('click', () => {
      const msg = card.getAttribute('data-dialog');
      if (msg) showPopup(msg);
    });
  });


  // ==========================================
  // 3. FAITHFUL UNDERTALE BATTLE CONTROLLER
  // ==========================================
  const battleModal = document.getElementById('battle-modal');
  const btnBattleMode = document.getElementById('btn-battle-mode');
  const btnCloseBattle = document.getElementById('btn-close-battle');

  // Panes
  const paneDialog = document.getElementById('pane-dialog');
  const paneFight = document.getElementById('pane-fight');
  const paneSubmenu = document.getElementById('pane-submenu');
  const paneDodge = document.getElementById('pane-dodge');

  // Text / Speech
  const battleDialogText = document.getElementById('battle-dialog-text');
  const enemySpeechBubble = document.getElementById('enemy-speech-bubble');
  const enemyHpFill = document.getElementById('enemy-hp');
  const enemySprite = document.getElementById('enemy-sprite');
  const enemySliceEffect = document.getElementById('enemy-slice-effect');
  const enemyDamageFloat = document.getElementById('enemy-damage-float');

  // HP Stats
  const playerHpText = document.getElementById('b-hp');
  const playerHpFill = document.getElementById('player-battle-hp');
  const hudHpVal = document.getElementById('hud-hp-val');
  const hudHpFill = document.getElementById('hud-hp-fill');

  // Action Buttons
  const battleBtns = [
    document.getElementById('b-btn-fight'),
    document.getElementById('b-btn-act'),
    document.getElementById('b-btn-item'),
    document.getElementById('b-btn-mercy')
  ];

  // Controller State Variables
  let enemyHp = 100;
  let playerHp = 99;
  let activeBtnIndex = 0; // 0: FIGHT, 1: ACT, 2: ITEM, 3: MERCY
  let currentState = 'DIALOG'; // 'DIALOG' | 'FIGHT_BAR' | 'SUBMENU' | 'DODGE'
  let isMercyReady = false;

  // Target Gauge variables
  const fightGauge = document.getElementById('fight-gauge');
  const fightBarCursor = document.getElementById('fight-bar-cursor');
  let cursorX = 0;
  let cursorSpeed = 3.5;
  let cursorDir = 1;
  let targetAnimFrame = null;

  // Dodge Arena variables
  const soulArena = document.getElementById('soul-arena');
  const dodgeSoul = document.getElementById('dodge-soul');
  const dodgeTimerVal = document.getElementById('dodge-timer-val');

  let soulPos = { x: 70, y: 45 };
  let activeKeys = {};
  let dodgeTimeLeft = 5.0;
  let dodgeAnimFrame = null;
  let dodgeSpawnTimer = null;
  let dodgeCountdownTimer = null;

  function setPane(paneName) {
    [paneDialog, paneFight, paneSubmenu, paneDodge].forEach(p => {
      if (p) p.classList.add('hidden');
    });
    if (paneName === 'DIALOG' && paneDialog) paneDialog.classList.remove('hidden');
    if (paneName === 'FIGHT' && paneFight) paneFight.classList.remove('hidden');
    if (paneName === 'SUBMENU' && paneSubmenu) paneSubmenu.classList.remove('hidden');
    if (paneName === 'DODGE' && paneDodge) paneDodge.classList.remove('hidden');
  }

  function setActiveButton(index) {
    activeBtnIndex = index;
    battleBtns.forEach((btn, i) => {
      if (btn) {
        if (i === index) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
    playBlipSound();
  }

  function updateHpBars() {
    if (playerHpText) playerHpText.textContent = playerHp;
    if (playerHpFill) playerHpFill.style.width = `${(playerHp / 99) * 100}%`;
    if (hudHpVal) hudHpVal.textContent = playerHp;
    if (hudHpFill) hudHpFill.style.width = `${(playerHp / 99) * 100}%`;
  }

  function resetBattle() {
    enemyHp = 100;
    playerHp = 99;
    isMercyReady = false;
    if (enemyHpFill) enemyHpFill.style.width = '100%';
    if (enemySprite) enemySprite.textContent = '👾';
    if (enemySpeechBubble) enemySpeechBubble.textContent = '* Mostre-me seu código!';
    updateHpBars();
    setActiveButton(0);
    setPane('DIALOG');
    if (battleDialogText) {
      battleDialogText.innerHTML = '* Um recrutador tech exige ver seus projetos! O que Henrik fará?';
    }
  }

  // Open & Close Battle Modal
  if (btnBattleMode && battleModal) {
    btnBattleMode.addEventListener('click', () => {
      resetBattle();
      battleModal.classList.remove('hidden');
      playSaveSound();
    });
  }

  if (btnCloseBattle && battleModal) {
    btnCloseBattle.addEventListener('click', () => {
      battleModal.classList.add('hidden');
      stopDodgePhase();
      if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);
    });
  }

  // Button Clicks
  battleBtns.forEach((btn, index) => {
    if (!btn) return;
    btn.addEventListener('mouseenter', () => setActiveButton(index));
    btn.addEventListener('click', () => {
      setActiveButton(index);
      handleButtonSelect(index);
    });
  });

  function handleButtonSelect(index) {
    playSelectSound();

    if (index === 0) {
      // FIGHT
      startFightTarget();
    } else if (index === 1) {
      // ACT
      openSubmenuOptions([
        {
          label: '* CHECAR REQUISITOS',
          action: () => {
            setPane('DIALOG');
            if (battleDialogText) battleDialogText.innerHTML = '* HENRIK - ATK 99 DEF 99. "Especialista em IA, Python, C# e Mecatrônica."';
            if (enemySpeechBubble) enemySpeechBubble.textContent = '* Um perfil técnico de peso!';
            setTimeout(startDodgePhase, 2000);
          }
        },
        {
          label: '* EXPLICAR CLEAN CODE',
          action: () => {
            setPane('DIALOG');
            isMercyReady = true;
            if (battleDialogText) battleDialogText.innerHTML = '* Henrik explicou sua disciplina com código limpo. O recrutador adorou!';
            if (enemySpeechBubble) enemySpeechBubble.textContent = '* Código limpo e legível é tudo!';
            setTimeout(startDodgePhase, 2000);
          }
        },
        {
          label: '* MOSTRAR MARATONA C',
          action: () => {
            setPane('DIALOG');
            if (battleDialogText) battleDialogText.innerHTML = '* Henrik contou da 2ª etapa na Maratona Interfatecs com a equipe PHP.atos!';
            if (enemySpeechBubble) enemySpeechBubble.textContent = '* Resolução sob pressão impecável!';
            setTimeout(startDodgePhase, 2000);
          }
        },
        {
          label: '* EXIBIR DASHBOARDS BI',
          action: () => {
            setPane('DIALOG');
            if (battleDialogText) battleDialogText.innerHTML = '* Henrik apresentou seus Dashboards de RNC e Finanças. Métricas precisas!';
            if (enemySpeechBubble) enemySpeechBubble.textContent = '* Análise de dados impecável!';
            setTimeout(startDodgePhase, 2000);
          }
        }
      ]);
    } else if (index === 2) {
      // ITEM
      openSubmenuOptions([
        {
          label: '* CAFÉ DEV (+30 HP)',
          action: () => {
            playHealSound();
            playerHp = Math.min(99, playerHp + 30);
            updateHpBars();
            setPane('DIALOG');
            if (battleDialogText) battleDialogText.innerHTML = '* Henrik tomou um Café Dev quentinho! Recuperou 30 HP!';
            setTimeout(startDodgePhase, 1800);
          }
        },
        {
          label: '* ENERGÉTICO I.A (+50 HP)',
          action: () => {
            playHealSound();
            playerHp = Math.min(99, playerHp + 50);
            updateHpBars();
            setPane('DIALOG');
            if (battleDialogText) battleDialogText.innerHTML = '* Henrik tomou Energético I.A! Foco aumentado!';
            setTimeout(startDodgePhase, 1800);
          }
        }
      ]);
    } else if (index === 3) {
      // MERCY
      openSubmenuOptions([
        {
          label: isMercyReady ? '* CONTRATAR (HIRE ❤️)' : '* POUPAR (SPARE)',
          action: () => {
            if (isMercyReady) {
              playVictorySound();
              setPane('DIALOG');
              if (battleDialogText) battleDialogText.innerHTML = '<span class="text-green">* RECRUTADOR CONTRATOU HENRIK! PROPOSTA ACEITA! ❤️</span>';
              setTimeout(() => {
                battleModal.classList.add('hidden');
                const contatoSec = document.getElementById('contato');
                if (contatoSec) contatoSec.scrollIntoView({ behavior: 'smooth' });
              }, 2200);
            } else {
              setPane('DIALOG');
              if (battleDialogText) battleDialogText.innerHTML = '* O recrutador ainda quer ver mais do seu código! Use o menu ACT!';
              setTimeout(startDodgePhase, 1800);
            }
          }
        }
      ]);
    }
  }


  // ------------------------------------------
  // A. FIGHT TARGET TIMING BAR
  // ------------------------------------------
  function startFightTarget() {
    setPane('FIGHT');
    currentState = 'FIGHT_BAR';
    cursorX = 0;
    cursorDir = 1;

    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);

    function loopTarget() {
      cursorX += cursorDir * cursorSpeed;
      if (cursorX >= 95) { cursorX = 95; cursorDir = -1; }
      if (cursorX <= 0) { cursorX = 0; cursorDir = 1; }

      if (fightBarCursor) fightBarCursor.style.left = `${cursorX}%`;
      targetAnimFrame = requestAnimationFrame(loopTarget);
    }
    targetAnimFrame = requestAnimationFrame(loopTarget);
  }

  function executeAttack() {
    if (currentState !== 'FIGHT_BAR') return;
    currentState = 'DIALOG';
    if (targetAnimFrame) cancelAnimationFrame(targetAnimFrame);

    playSlashSound();

    // Slice animation on sprite
    if (enemySliceEffect) {
      enemySliceEffect.classList.remove('hidden');
      setTimeout(() => enemySliceEffect.classList.add('hidden'), 300);
    }

    // Damage based on distance to 50% center
    let dist = Math.abs(cursorX - 45);
    let damage = Math.max(15, Math.round(50 - dist * 0.9));

    if (dist < 8) {
      damage = 50; // CRITICAL
    }

    // Show floating damage
    if (enemyDamageFloat) {
      enemyDamageFloat.textContent = `-${damage}`;
      enemyDamageFloat.classList.remove('hidden');
      setTimeout(() => enemyDamageFloat.classList.add('hidden'), 800);
    }

    enemyHp = Math.max(0, enemyHp - damage);
    if (enemyHpFill) enemyHpFill.style.width = `${enemyHp}%`;

    if (enemyHp <= 30) isMercyReady = true;

    setPane('DIALOG');
    if (battleDialogText) {
      battleDialogText.innerHTML = dist < 8 
        ? '<span class="text-yellow">* ATAQUE PERFEITO!! 50 DE DANO!</span>' 
        : `* Ataque causou ${damage} de dano ao recrutador.`;
    }

    if (enemyHp === 0) {
      setTimeout(() => {
        if (battleDialogText) battleDialogText.innerHTML = '<span class="text-green">* VITÓRIA! O recrutador aceitou todas as condições!</span>';
        playVictorySound();
      }, 1500);
    } else {
      setTimeout(startDodgePhase, 1800);
    }
  }

  if (fightGauge) {
    fightGauge.addEventListener('click', executeAttack);
  }


  // ------------------------------------------
  // B. SUBMENU OPTIONS LOADER
  // ------------------------------------------
  const submenuOptionsList = document.getElementById('submenu-options-list');

  function openSubmenuOptions(options) {
    setPane('SUBMENU');
    currentState = 'SUBMENU';
    if (!submenuOptionsList) return;
    submenuOptionsList.innerHTML = '';

    options.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'submenu-opt';
      div.innerHTML = `<span>❤️</span> <span>${opt.label}</span>`;
      div.addEventListener('click', () => {
        playSelectSound();
        opt.action();
      });
      submenuOptionsList.appendChild(div);
    });
  }


  // ------------------------------------------
  // C. BULLET HELL DODGE ARENA (TURNO ENEMY)
  // ------------------------------------------
  function startDodgePhase() {
    setPane('DODGE');
    currentState = 'DODGE';
    if (enemySpeechBubble) enemySpeechBubble.textContent = '* Esquive das falhas!';

    // Reset Soul
    soulPos = { x: 72, y: 45 };
    if (dodgeSoul) {
      dodgeSoul.style.left = `${soulPos.x}px`;
      dodgeSoul.style.top = `${soulPos.y}px`;
    }

    // Clear old projectiles
    if (soulArena) {
      const oldBullets = soulArena.querySelectorAll('.bullet-item');
      oldBullets.forEach(b => b.remove());
    }

    dodgeTimeLeft = 5.0;
    if (dodgeTimerVal) dodgeTimerVal.textContent = '5.0';

    // Bullet Spawner
    const symbols = ['🐞', '❌', '⏰', '⚠️'];
    
    stopDodgePhase(); // Clear existing loops if any

    dodgeSpawnTimer = setInterval(() => {
      if (!soulArena || currentState !== 'DODGE') return;
      const b = document.createElement('div');
      b.className = 'bullet-item';
      b.textContent = symbols[Math.floor(Math.random() * symbols.length)];

      const spawnTop = Math.random() < 0.5;
      let bx = spawnTop ? Math.random() * 140 : 145;
      let by = spawnTop ? 0 : Math.random() * 90;
      let vx = spawnTop ? (Math.random() - 0.5) * 2.5 : -2.5;
      let vy = spawnTop ? 2.5 : (Math.random() - 0.5) * 2.5;

      b.style.left = `${bx}px`;
      b.style.top = `${by}px`;
      soulArena.appendChild(b);

      const bMove = setInterval(() => {
        if (currentState !== 'DODGE') {
          b.remove();
          clearInterval(bMove);
          return;
        }

        bx += vx;
        by += vy;
        b.style.left = `${bx}px`;
        b.style.top = `${by}px`;

        // Collision Check
        const dx = bx - soulPos.x;
        const dy = by - soulPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 14) {
          b.remove();
          clearInterval(bMove);
          playHitSound();
          playerHp = Math.max(0, playerHp - 15);
          updateHpBars();

          if (battleModal) {
            battleModal.classList.add('hit-flash', 'shake');
            setTimeout(() => battleModal.classList.remove('hit-flash', 'shake'), 300);
          }
        }

        if (bx < -20 || bx > 170 || by < -20 || by > 130) {
          b.remove();
          clearInterval(bMove);
        }
      }, 30);

    }, 500);

    // Soul Smooth Move Loop
    function moveSoulLoop() {
      if (currentState !== 'DODGE') return;
      const speed = 2.8;

      if (activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['W']) soulPos.y = Math.max(0, soulPos.y - speed);
      if (activeKeys['ArrowDown'] || activeKeys['s'] || activeKeys['S']) soulPos.y = Math.min(94, soulPos.y + speed);
      if (activeKeys['ArrowLeft'] || activeKeys['a'] || activeKeys['A']) soulPos.x = Math.max(0, soulPos.x - speed);
      if (activeKeys['ArrowRight'] || activeKeys['d'] || activeKeys['D']) soulPos.x = Math.min(144, soulPos.x + speed);

      if (dodgeSoul) {
        dodgeSoul.style.left = `${soulPos.x}px`;
        dodgeSoul.style.top = `${soulPos.y}px`;
      }

      dodgeAnimFrame = requestAnimationFrame(moveSoulLoop);
    }
    dodgeAnimFrame = requestAnimationFrame(moveSoulLoop);

    // Timer Countdown
    dodgeCountdownTimer = setInterval(() => {
      dodgeTimeLeft -= 0.1;
      if (dodgeTimerVal) dodgeTimerVal.textContent = Math.max(0, dodgeTimeLeft).toFixed(1);

      if (dodgeTimeLeft <= 0) {
        stopDodgePhase();
        setPane('DIALOG');
        currentState = 'DIALOG';
        if (battleDialogText) battleDialogText.innerHTML = '* Você esquivou com maestria! Seu turno!';
      }
    }, 100);
  }

  function stopDodgePhase() {
    if (dodgeSpawnTimer) clearInterval(dodgeSpawnTimer);
    if (dodgeCountdownTimer) clearInterval(dodgeCountdownTimer);
    if (dodgeAnimFrame) cancelAnimationFrame(dodgeAnimFrame);
  }

  // Keyboard Listeners
  window.addEventListener('keydown', (e) => {
    activeKeys[e.key] = true;

    if (battleModal && !battleModal.classList.contains('hidden')) {
      if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      // Attack Trigger with Space/Enter in FIGHT_BAR mode
      if ((e.code === 'Space' || e.code === 'Enter') && currentState === 'FIGHT_BAR') {
        executeAttack();
      }

      // Left/Right Navigation in Main Menu
      if (currentState === 'DIALOG') {
        if (e.key === 'ArrowRight') setActiveButton((activeBtnIndex + 1) % 4);
        if (e.key === 'ArrowLeft') setActiveButton((activeBtnIndex + 3) % 4);
        if (e.code === 'Enter' || e.code === 'Space' || e.key === 'z' || e.key === 'Z') {
          handleButtonSelect(activeBtnIndex);
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    activeKeys[e.key] = false;
  });

  // Mouse Drag Soul inside Arena
  if (soulArena) {
    soulArena.addEventListener('mousemove', (e) => {
      if (currentState !== 'DODGE') return;
      const rect = soulArena.getBoundingClientRect();
      soulPos.x = Math.max(0, Math.min(144, e.clientX - rect.left - 8));
      soulPos.y = Math.max(0, Math.min(94, e.clientY - rect.top - 8));
      if (dodgeSoul) {
        dodgeSoul.style.left = `${soulPos.x}px`;
        dodgeSoul.style.top = `${soulPos.y}px`;
      }
    });
  }


  // ==========================================
  // 4. FORM HANDLER
  // ==========================================
  const contactForm = document.getElementById('ut-contact-form');
  const contactStatus = document.getElementById('contact-status');
  const btnTriggerForm = document.getElementById('btn-trigger-form');

  if (btnTriggerForm) {
    btnTriggerForm.addEventListener('click', () => {
      const nameInput = document.getElementById('form-name');
      if (nameInput) nameInput.focus();
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      playSaveSound();
      
      const name = document.getElementById('form-name').value;
      if (contactStatus) {
        contactStatus.innerHTML = `<span class="text-green">* Mensagem transmitida com sucesso! Obrigado, ${name}.</span>`;
      }
      contactForm.reset();
    });
  }


  // ==========================================
  // 5. DYNAMIC PROJECTS ENGINE & FIREBASE ADMIN (GOOGLE AUTH + 2FA)
  // ==========================================
  
  // Lista Padrão de Projetos (Fallback se o Firebase não estiver configurado)
  const defaultProjects = [
    {
      id: 'default-1',
      icon: '🏆',
      title: 'INTERFATECS - Maratona C',
      description: '* Participante do Interfatecs (Maratona de Programação) com a equipe PHP.atos. Classificação e avanço até a 2ª etapa nacional exercitando algoritmos avançados e raciocínio lógico em Linguagem C.',
      tags: ['LINGUAGEM C', 'MARATONA', 'LÓGICA'],
      highlight: false
    },
    {
      id: 'default-2',
      icon: '💅',
      title: 'Carolunhas Landing Page',
      description: '* Landing Page desenvolvida para um empreendimento de beleza, expandindo a presença digital da cliente e otimizando a captação e agendamento de clientes online.',
      tags: ['WEB DESIGN', 'FIREBASE HOSTING'],
      link: 'https://carolunhas.onrender.com',
      highlight: true
    },
    {
      id: 'default-3',
      icon: '🏛️',
      title: 'Patrimonial Management System',
      description: '* Projeto acadêmico na FATEC focado no desenvolvimento de um sistema de gestão de patrimônio. Atuação direta na documentação técnica, modelagem e estrutura de requisitos em C#.',
      tags: ['C#', 'DOCUMENTAÇÃO', 'FATEC'],
      highlight: false
    },
    {
      id: 'default-4',
      icon: '🤝',
      title: 'HAVANA - Gestão Social',
      description: '* Plataforma desenvolvida no Projeto Integrador para inclusão de jovens de escolas públicas em oficinas de esporte e cultura, com módulo de cadastro e gerador de carteirinhas de estudantes.',
      tags: ['IMPACTO SOCIAL', 'CADASTRO', 'I.D'],
      highlight: false
    }
  ];

  let currentProjects = [...defaultProjects];
  const projectsGrid = document.querySelector('.ut-projects-grid');
  const adminProjectsList = document.getElementById('admin-projects-list');

  // Função para renderizar os projetos no Grid do Portfólio
  function renderProjects(projects) {
    if (!projectsGrid) return;
    projectsGrid.innerHTML = '';

    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = `ut-box project-card ${p.highlight ? 'highlight-border' : ''}`;
      
      const tagsHtml = p.tags && Array.isArray(p.tags) 
        ? p.tags.map(t => `<span class="tag">${t.trim()}</span>`).join(' ') 
        : '';

      const linkHtml = p.link ? `
        <a href="${p.link}" target="_blank" rel="noopener noreferrer" class="ut-link-btn">
          🔗 Visitar Site
        </a>
      ` : '';

      card.innerHTML = `
        <div class="project-header">
          <span class="project-icon">${p.icon || '🚀'}</span>
          <h3>${p.title}</h3>
        </div>
        <p class="project-body">${p.description}</p>
        <div class="project-footer space-between">
          <div class="tag-list">${tagsHtml}</div>
          ${linkHtml}
        </div>
      `;

      projectsGrid.appendChild(card);
    });
  }

  // Função para renderizar a lista no Painel de Admin (com botão de exclusão)
  function renderAdminProjectsList(projects) {
    if (!adminProjectsList) return;
    adminProjectsList.innerHTML = '';

    if (projects.length === 0) {
      adminProjectsList.innerHTML = '<p class="admin-intro-text">* Nenhum projeto cadastrado.</p>';
      return;
    }

    projects.forEach(p => {
      const item = document.createElement('div');
      item.className = 'admin-project-item';
      item.innerHTML = `
        <div class="admin-project-item-info">
          <h4>${p.icon || '🚀'} ${p.title}</h4>
          <p>${p.description ? p.description.substring(0, 70) + '...' : ''}</p>
        </div>
        <button class="btn-delete-project" data-id="${p.id}">
          🗑️ EXCLUIR
        </button>
      `;

      const deleteBtn = item.querySelector('.btn-delete-project');
      deleteBtn.addEventListener('click', () => handleDeleteProject(p.id, p.title));

      adminProjectsList.appendChild(item);
    });
  }

  // Inicializar escuta em tempo real do Firebase Firestore
  if (firebaseInitialized && db) {
    try {
      const projetosRef = collection(db, 'projetos');
      onSnapshot(projetosRef, (snapshot) => {
        const fetchedProjects = [];
        snapshot.forEach((docSnap) => {
          fetchedProjects.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (fetchedProjects.length > 0) {
          currentProjects = fetchedProjects;
        } else {
          currentProjects = [...defaultProjects];
        }

        renderProjects(currentProjects);
        renderAdminProjectsList(currentProjects);
      }, (err) => {
        console.error("Erro no Firestore Listener:", err);
        renderProjects(defaultProjects);
        renderAdminProjectsList(defaultProjects);
      });
    } catch (e) {
      renderProjects(defaultProjects);
    }
  } else {
    // Caso o Firebase não esteja configurado, renderiza os projetos padrão
    renderProjects(defaultProjects);
  }

  // --- LÓGICA DO MODAL ADMIN & AUTENTICAÇÃO GOOGLE 2FA ---
  const btnOpenAdmin = document.getElementById('btn-open-admin');
  const btnCloseAdmin = document.getElementById('btn-close-admin');
  const adminModal = document.getElementById('admin-modal');

  const stepLogin = document.getElementById('admin-step-login');
  const step2FA = document.getElementById('admin-step-2fa');
  const stepPanel = document.getElementById('admin-step-panel');

  const btnGoogleLogin = document.getElementById('btn-google-login');
  const btnVerify2FA = document.getElementById('btn-verify-2fa');
  const btnLogoutAdmin = document.getElementById('btn-logout-admin');

  const input2FAPin = document.getElementById('admin-2fa-pin');
  const userEmailDisplay = document.getElementById('user-email-display');
  const adminUserName = document.getElementById('admin-user-name');
  const adminStatusMsg = document.getElementById('admin-status-msg');
  const formAddProject = document.getElementById('form-add-project');

  let authenticatedUser = null;
  let is2FAPassed = false;
  // PIN de segurança padrão de 2 Etapas (Pode ser alterado)
  const ADMIN_2FA_PIN = "123456";

  function setAdminStep(step) {
    if (stepLogin) stepLogin.classList.add('hidden');
    if (step2FA) step2FA.classList.add('hidden');
    if (stepPanel) stepPanel.classList.add('hidden');

    if (step === 1 && stepLogin) stepLogin.classList.remove('hidden');
    if (step === 2 && step2FA) step2FA.classList.remove('hidden');
    if (step === 3 && stepPanel) stepPanel.classList.remove('hidden');
  }

  function setAdminStatus(msg, type = 'normal') {
    if (!adminStatusMsg) return;
    if (type === 'error') {
      adminStatusMsg.innerHTML = `<span class="text-red">* ${msg}</span>`;
    } else if (type === 'success') {
      adminStatusMsg.innerHTML = `<span class="text-green">* ${msg}</span>`;
    } else {
      adminStatusMsg.innerHTML = `<span class="text-yellow">* ${msg}</span>`;
    }
  }

  if (btnOpenAdmin && adminModal) {
    btnOpenAdmin.addEventListener('click', () => {
      adminModal.classList.remove('hidden');
      playSaveSound();

      if (!firebaseInitialized) {
        setAdminStatus("Aviso: Configure suas credenciais em firebase-config.js para salvar na nuvem.", "error");
      }
    });
  }

  if (btnCloseAdmin && adminModal) {
    btnCloseAdmin.addEventListener('click', () => {
      adminModal.classList.add('hidden');
    });
  }

  // Monitorar Estado de Autenticação no Firebase
  if (firebaseInitialized && auth) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        authenticatedUser = user;
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        if (adminUserName) adminUserName.textContent = user.displayName || user.email;

        if (is2FAPassed) {
          setAdminStep(3);
          renderAdminProjectsList(currentProjects);
        } else {
          setAdminStep(2);
          setAdminStatus("Etapa 1 concluída (Google Auth). Insira seu PIN 2FA.", "success");
        }
      } else {
        authenticatedUser = null;
        is2FAPassed = false;
        setAdminStep(1);
        setAdminStatus("Aguardando login com a conta Google...", "normal");
      }
    });
  }

  // 1. Google Sign-In
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      if (!firebaseInitialized || !auth || !googleProvider) {
        // Modo Simulação/Modo Sem Firebase
        authenticatedUser = { email: "admin@henrikbispo.com", displayName: "Henrik Bispo" };
        if (userEmailDisplay) userEmailDisplay.textContent = authenticatedUser.email;
        if (adminUserName) adminUserName.textContent = authenticatedUser.displayName;
        setAdminStep(2);
        setAdminStatus("Modo Simulação: Faça a verificação 2FA (PIN padrão: 123456)", "yellow");
        return;
      }

      try {
        setAdminStatus("Abrindo popup do Google...", "yellow");
        await signInWithPopup(auth, googleProvider);
        playSelectSound();
      } catch (err) {
        console.error("Erro no Google Auth:", err);
        setAdminStatus(`Erro no login Google: ${err.message}`, "error");
      }
    });
  }

  // 2. Verificação de Duas Etapas (2FA PIN)
  if (btnVerify2FA) {
    btnVerify2FA.addEventListener('click', () => {
      const pinValue = input2FAPin ? input2FAPin.value.trim() : '';

      if (pinValue === ADMIN_2FA_PIN) {
        is2FAPassed = true;
        playSaveSound();
        setAdminStep(3);
        setAdminStatus("Autenticação de 2 Etapas bem-sucedida! Bem-vindo.", "success");
        renderAdminProjectsList(currentProjects);
      } else {
        playHitSound();
        setAdminStatus("PIN de 2 Etapas incorreto! Tente novamente.", "error");
      }
    });
  }

  // Logout
  if (btnLogoutAdmin) {
    btnLogoutAdmin.addEventListener('click', async () => {
      if (firebaseInitialized && auth) {
        await signOut(auth);
      }
      authenticatedUser = null;
      is2FAPassed = false;
      if (input2FAPin) input2FAPin.value = '';
      setAdminStep(1);
      setAdminStatus("Sessão encerrada.", "normal");
    });
  }

  // Adicionar Novo Projeto
  if (formAddProject) {
    formAddProject.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!is2FAPassed) {
        setAdminStatus("Acesso negado. Conclua a autenticação 2FA.", "error");
        return;
      }

      const title = document.getElementById('p-title').value.trim();
      const icon = document.getElementById('p-icon').value.trim() || '🚀';
      const description = document.getElementById('p-desc').value.trim();
      const tagsString = document.getElementById('p-tags').value.trim();
      const link = document.getElementById('p-link').value.trim();

      const tagsArray = tagsString ? tagsString.split(',').map(t => t.trim()) : [];

      const newProject = {
        title,
        icon,
        description: `* ${description}`,
        tags: tagsArray,
        link: link || null,
        highlight: false,
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      try {
        if (firebaseInitialized && db) {
          setAdminStatus("Salvando projeto no Firebase...", "yellow");
          await addDoc(collection(db, "projetos"), newProject);
          setAdminStatus("Projeto adicionado com sucesso ao Firestore!", "success");
        } else {
          // Fallback Local
          const localProject = { id: `local-${Date.now()}`, ...newProject };
          currentProjects.unshift(localProject);
          renderProjects(currentProjects);
          renderAdminProjectsList(currentProjects);
          setAdminStatus("Projeto adicionado localmente! (Configure firebase-config.js para sincronizar)", "success");
        }

        playSaveSound();
        formAddProject.reset();
      } catch (err) {
        console.error("Erro ao salvar projeto:", err);
        setAdminStatus(`Erro ao salvar: ${err.message}`, "error");
      }
    });
  }

  // Função para deletar um projeto
  async function handleDeleteProject(id, title) {
    if (!confirm(`Deseja realmente remover o projeto "${title}"?`)) return;

    try {
      if (firebaseInitialized && db && !id.startsWith('default-') && !id.startsWith('local-')) {
        setAdminStatus("Removendo projeto do Firebase...", "yellow");
        await deleteDoc(doc(db, "projetos", id));
        setAdminStatus(`Projeto "${title}" removido do Firestore!`, "success");
      } else {
        // Fallback Local
        currentProjects = currentProjects.filter(p => p.id !== id);
        renderProjects(currentProjects);
        renderAdminProjectsList(currentProjects);
        setAdminStatus(`Projeto "${title}" removido!`, "success");
      }
      playHitSound();
    } catch (err) {
      console.error("Erro ao remover projeto:", err);
      setAdminStatus(`Erro ao remover: ${err.message}`, "error");
    }
  }

});
