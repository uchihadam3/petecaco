// ============================================================
//  PETECAÇO — dados do jogo: quadra, adversários, torneios, skins
// ============================================================

export const COURT = {
  halfW: 3.75,      // largura 7,5 m
  halfL: 7.5,       // comprimento 15 m
  netH: 2.43,       // altura da rede
  netDepth: 0.85,   // altura da malha
  postX: 4.3,
};

export const ARENAS = {
  praca: { id: 'praca', name: 'Praça do Bairro', desc: 'Fim de tarde, cheiro de pipoca e torcida da vizinhança.', surface: 'hard' },
  praia: { id: 'praia', name: 'Praia do Pôr do Sol', desc: 'Areia quente, mar ao fundo e o sol se pondo atrás da rede.', surface: 'sand' },
  ginasio: { id: 'ginasio', name: 'Arena Petecaço', desc: 'Ginásio lotado, luzes de estádio e telão gigante.', surface: 'wood' },
};

// stats 0..1
// speed: velocidade de deslocamento | reaction: tempo de reação | accuracy: precisão
// power: força | consistency: erra pouco | judgment: deixa passar bola fora
// aggression: gosta de cortar | tricky: varia curta/balão
export const OPPONENTS = [
  {
    id: 'juca', name: 'Tio Juca', nick: 'O Aposentado', tier: 0, stars: 1, arena: 'praca',
    quote: 'Na minha época a peteca era de palha, garoto!',
    look: { skin: '#e0ac7e', hair: 'bald', hairColor: '#d8d8d8', shirt: '#f1c40f', shorts: '#2c3e50', shoes: '#ecf0f1', mustache: true, belly: 1.25, height: 0.96 },
    stats: { speed: 0.22, reaction: 0.25, accuracy: 0.35, power: 0.25, consistency: 0.45, judgment: 0.05, aggression: 0.1, tricky: 0.25 },
    lines: {
      win: ['Ainda tenho lenha pra queimar!', 'Aprende com o tio!', 'Essa foi de ouro!'],
      lose: ['Ai, minha coluna...', 'Peraí que eu tô aquecendo!', 'Sorte de principiante!'],
      matchWin: ['O tio ainda manda na praça!'], matchLose: ['Muito bem, garoto! Vai longe!'],
    },
  },
  {
    id: 'pedrinho', name: 'Pedrinho', nick: 'Pivete Elétrico', tier: 0, stars: 1.5, arena: 'praca',
    quote: 'Eu corro mais que você, duvido!',
    look: { skin: '#a8714a', hair: 'cap', hairColor: '#1a1a1a', capColor: '#e74c3c', shirt: '#3498db', shorts: '#ecf0f1', shoes: '#e74c3c', height: 0.82 },
    stats: { speed: 0.62, reaction: 0.4, accuracy: 0.3, power: 0.32, consistency: 0.35, judgment: 0.1, aggression: 0.55, tricky: 0.3 },
    lines: {
      win: ['TOMA!!', 'Rápido demais pra você!', 'Hahaha!'],
      lose: ['Não valeu!', 'Eu tava amarrando o tênis!', 'Ah, para!'],
      matchWin: ['Vou contar pra escola toda!'], matchLose: ['Revanche! Revanche!'],
    },
  },
  {
    id: 'lucia', name: 'Dona Lúcia', nick: 'A Vizinha Sabida', tier: 0, stars: 2, arena: 'praca',
    quote: 'Peteca é jeito, meu bem, não é força.',
    look: { skin: '#f0c8a0', hair: 'bun', hairColor: '#8e8e8e', shirt: '#e84393', shorts: '#6c5ce7', shoes: '#ffffff', glasses: true, height: 0.92 },
    stats: { speed: 0.36, reaction: 0.45, accuracy: 0.55, power: 0.25, consistency: 0.65, judgment: 0.35, aggression: 0.1, tricky: 0.7 },
    lines: {
      win: ['Deixadinha da vovó!', 'Jeitinho, meu bem.', 'Hihi!'],
      lose: ['Ora, ora...', 'Boa, menino!', 'Vou fazer um bolo pra esquecer essa.'],
      matchWin: ['Volte quando quiser, tem café!'], matchLose: ['Que talento! Leva um pedaço de bolo.'],
    },
  },
  {
    id: 'marcao', name: 'Marcão', nick: 'Braço de Ferro', tier: 1, stars: 2.5, arena: 'praia',
    quote: 'Eu não jogo peteca. Eu ARREMESSO peteca.',
    look: { skin: '#c68642', hair: 'buzz', hairColor: '#111', shirt: '#2d3436', shorts: '#d63031', shoes: '#2d3436', headband: '#d63031', belly: 1.1, width: 1.22, height: 1.06 },
    stats: { speed: 0.42, reaction: 0.5, accuracy: 0.5, power: 0.85, consistency: 0.58, judgment: 0.3, aggression: 0.85, tricky: 0.2 },
    lines: {
      win: ['PANCADA!', 'Sentiu o peso?', 'Academia, parceiro!'],
      lose: ['Grrr...', 'Isso não vai se repetir.', 'Sorte.'],
      matchWin: ['Volta quando tiver músculo!'], matchLose: ['Respeito. Você é bom.'],
    },
  },
  {
    id: 'jessica', name: 'Jéssica', nick: 'Furacão', tier: 1, stars: 3, arena: 'praia',
    quote: 'Pisca e eu já tô do outro lado da quadra.',
    look: { skin: '#8d5524', hair: 'ponytail', hairColor: '#2b1a10', shirt: '#00b894', shorts: '#2d3436', shoes: '#fdcb6e', headband: '#fdcb6e', height: 1.0 },
    stats: { speed: 0.78, reaction: 0.62, accuracy: 0.6, power: 0.55, consistency: 0.62, judgment: 0.45, aggression: 0.5, tricky: 0.45 },
    lines: {
      win: ['Vushhh!', 'Furacão passou!', 'Cedo demais pra comemorar, hein?'],
      lose: ['Essa eu deixei.', 'Boa! Mas não acostuma.', 'Uff!'],
      matchWin: ['Quem sabe na próxima!'], matchLose: ['Você é rápido! Gostei!'],
    },
  },
  {
    id: 'bene', name: 'Seu Benê', nick: 'O Professor', tier: 1, stars: 3.5, arena: 'praia',
    quote: 'Física, meu jovem. Ângulo e paciência.',
    look: { skin: '#5d3a1a', hair: 'short', hairColor: '#cfcfcf', shirt: '#ffffff', shorts: '#0984e3', shoes: '#0984e3', glasses: true, beard: true, height: 1.0 },
    stats: { speed: 0.48, reaction: 0.6, accuracy: 0.82, power: 0.45, consistency: 0.8, judgment: 0.7, aggression: 0.3, tricky: 0.88 },
    lines: {
      win: ['Elementar.', 'Calculado.', 'Ângulo de 37 graus, meu jovem.'],
      lose: ['Interessante...', 'Muito bem executado.', 'Anotado.'],
      matchWin: ['Estude a trajetória e volte.'], matchLose: ['O aluno superou o mestre!'],
    },
  },
  {
    id: 'carla', name: 'Carla', nick: 'A Muralha', tier: 2, stars: 4, arena: 'ginasio',
    quote: 'Pode bater. Vai voltar. Sempre volta.',
    look: { skin: '#f3d1b0', hair: 'long', hairColor: '#c0392b', shirt: '#6c5ce7', shorts: '#2d3436', shoes: '#ffffff', headband: '#ffffff', height: 1.02 },
    stats: { speed: 0.82, reaction: 0.82, accuracy: 0.74, power: 0.5, consistency: 0.9, judgment: 0.85, aggression: 0.35, tricky: 0.55 },
    lines: {
      win: ['Voltou de novo.', 'Muralha!', 'Paciência é tudo.'],
      lose: ['Boa bola.', 'Hmm. Atravessou.', 'Respeito.'],
      matchWin: ['A muralha não cai.'], matchLose: ['Você derrubou a muralha!'],
    },
  },
  {
    id: 'thiago', name: 'Thiago', nick: 'Trovão', tier: 2, stars: 4.5, arena: 'ginasio',
    quote: 'Ouviu esse barulho? Era minha cortada.',
    look: { skin: '#c68642', hair: 'mohawk', hairColor: '#f1c40f', shirt: '#0c0c0c', shorts: '#f1c40f', shoes: '#f1c40f', headband: '#f1c40f', width: 1.1, height: 1.05 },
    stats: { speed: 0.78, reaction: 0.75, accuracy: 0.74, power: 1.0, consistency: 0.78, judgment: 0.6, aggression: 0.95, tricky: 0.35 },
    lines: {
      win: ['TROVÃÃÃO!', 'Bum!', 'Nem viu, né?'],
      lose: ['Tá bom, tá bom.', 'Uma de sorte.', 'Agora eu fiquei bravo.'],
      matchWin: ['O trovão sempre vem depois do raio!'], matchLose: ['Que jogo! Você é brabo.'],
    },
  },
  {
    id: 'ze', name: 'Mestre Zé', nick: 'O Campeão', tier: 2, stars: 5, arena: 'ginasio',
    quote: 'Trinta anos de quadra. Mostra o que você tem.',
    look: { skin: '#7a4a24', hair: 'short', hairColor: '#e0e0e0', shirt: '#009c3b', shorts: '#002776', shoes: '#ffdf00', headband: '#ffdf00', beard: true, height: 1.0 },
    stats: { speed: 0.88, reaction: 0.88, accuracy: 0.88, power: 0.85, consistency: 0.9, judgment: 0.9, aggression: 0.7, tricky: 0.8 },
    lines: {
      win: ['Ainda não.', 'Concentra.', 'Leia a peteca.'],
      lose: ['Isso! Agora sim.', 'Bonito.', 'Esse é o caminho.'],
      matchWin: ['Volte mais forte. Eu espero.'], matchLose: ['O título agora é seu, campeão.'],
    },
  },
  {
    id: 'iara', name: 'Iara', nick: 'Mão de Ouro', tier: 3, stars: 5, arena: 'ginasio', secret: true,
    quote: 'Dizem que ninguém nunca fez um ponto em mim. Dizem.',
    look: { skin: '#b07a4f', hair: 'ponytail', hairColor: '#f5d76e', shirt: '#ffd700', shorts: '#111111', shoes: '#ffd700', headband: '#111111', golden: true, height: 1.03 },
    stats: { speed: 0.96, reaction: 0.95, accuracy: 0.94, power: 0.92, consistency: 0.95, judgment: 0.95, aggression: 0.75, tricky: 0.9 },
    lines: {
      win: ['Dourado.', 'Perfeito.', '...'],
      lose: ['Ninguém fazia isso há anos.', 'Interessante.', 'Hmm!'],
      matchWin: ['Lendas não caem fácil.'], matchLose: ['Uma nova lenda nasceu hoje.'],
    },
  },
];

export const FILLER_NAMES = [
  'Zeca Peteca', 'Rosinha', 'Bruno Bala', 'Kátia K.', 'Dudu Dedão', 'Marina', 'Gilmar', 'Toninho',
  'Lara Laser', 'Fabão', 'Nina Ninja', 'Vovô Chico', 'Duda', 'Caio Cometa', 'Priscila', 'Serginho',
];

export const TOURNAMENTS = [
  {
    id: 'iniciante', name: 'Copa Iniciante', short: 'Iniciante', arena: 'praca', icon: '🥉', color: '#cd7f32',
    desc: 'O torneio da praça. Perfeito pra pegar o jeito.',
    opponents: ['juca', 'pedrinho', 'lucia'], reward: { xp: 600, coins: 200 },
  },
  {
    id: 'amador', name: 'Circuito Amador', short: 'Amador', arena: 'praia', icon: '🥈', color: '#c0c0c0',
    desc: 'Na areia, contra gente que treina todo fim de semana.',
    opponents: ['marcao', 'jessica', 'bene'], reward: { xp: 1200, coins: 450 },
  },
  {
    id: 'profissional', name: 'Liga Profissional', short: 'Profissional', arena: 'ginasio', icon: '🥇', color: '#ffd700',
    desc: 'Ginásio lotado. Só os melhores do país.',
    opponents: ['carla', 'thiago', 'ze'], reward: { xp: 2500, coins: 1000 },
  },
];

export const ROUND_NAMES = ['Quartas de final', 'Semifinal', 'Grande Final'];

// formato das partidas: [sets para vencer, pontos por set]
export const FORMATS = {
  rapida: { label: 'Rápida — 1 set de 11', setsToWin: 1, points: 11 },
  padrao: { label: 'Padrão — melhor de 3 sets de 7', setsToWin: 2, points: 7 },
  longa: { label: 'Oficial — melhor de 3 sets de 12', setsToWin: 2, points: 12 },
};

export const SKINS = [
  { id: 'classica', name: 'Clássica', price: 0, base: '#c0392b', feathers: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'], trail: '#ffffff' },
  { id: 'brasil', name: 'Brasil', price: 250, base: '#002776', feathers: ['#009c3b', '#ffdf00', '#009c3b', '#ffdf00'], trail: '#ffdf00' },
  { id: 'carnaval', name: 'Carnaval', price: 400, base: '#8e44ad', feathers: ['#e84393', '#fdcb6e', '#00cec9', '#a29bfe'], trail: '#fd79a8' },
  { id: 'fogo', name: 'Fogo', price: 600, base: '#2d3436', feathers: ['#ff3c00', '#ff9f1a', '#ff3c00', '#ff9f1a'], trail: '#ff7b00' },
  { id: 'oceano', name: 'Oceano', price: 600, base: '#0c2461', feathers: ['#0abde3', '#48dbfb', '#c8f7ff', '#48dbfb'], trail: '#48dbfb' },
  { id: 'neon', name: 'Neon', price: 900, base: '#111111', feathers: ['#39ff14', '#ff00e6', '#39ff14', '#ff00e6'], trail: '#39ff14', glow: true },
  { id: 'arara', name: 'Arara', price: 1200, base: '#f9ca24', feathers: ['#e74c3c', '#3498db', '#f1c40f', '#27ae60'], trail: '#e74c3c' },
  { id: 'ouro', name: 'Ouro Lendário', price: 0, unlock: 'iara', base: '#b8860b', feathers: ['#ffd700', '#fff3a0', '#ffd700', '#fff3a0'], trail: '#ffd700', glow: true },
];

export const WRISTBANDS = [
  { id: 'branca', name: 'Branca', price: 0, color: '#f5f6fa' },
  { id: 'verde', name: 'Verde', price: 100, color: '#00b894' },
  { id: 'vermelha', name: 'Vermelha', price: 100, color: '#e74c3c' },
  { id: 'azul', name: 'Azul', price: 100, color: '#0984e3' },
  { id: 'rosa', name: 'Rosa', price: 150, color: '#fd79a8' },
  { id: 'preta', name: 'Preta', price: 150, color: '#222222' },
  { id: 'dourada', name: 'Dourada', price: 800, color: '#ffd700' },
];

export const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏅', name: 'Primeira Vitória', desc: 'Vença sua primeira partida.' },
  { id: 'perfect10', icon: '✨', name: 'Mão Calibrada', desc: '10 batidas PERFEITAS numa partida.' },
  { id: 'rally20', icon: '🔁', name: 'Rali Infinito', desc: 'Faça um rali de 20 batidas.' },
  { id: 'rally40', icon: '♾️', name: 'Ninguém Erra', desc: 'Faça um rali de 40 batidas.' },
  { id: 'smash25', icon: '⚡', name: 'Cortador', desc: 'Faça 25 cortadas no total.' },
  { id: 'fire', icon: '🔥', name: 'Em Chamas', desc: 'Entre no modo EM CHAMAS (3 perfeitas seguidas).' },
  { id: 'ace', icon: '🎯', name: 'Ace!', desc: 'Faça um ponto direto de saque.' },
  { id: 'shutout', icon: '🧱', name: 'Pneu!', desc: 'Vença um set sem sofrer pontos.' },
  { id: 'comeback', icon: '💪', name: 'Virada Histórica', desc: 'Vença um set estando 4 pontos atrás.' },
  { id: 'cup_iniciante', icon: '🥉', name: 'Campeão da Praça', desc: 'Vença a Copa Iniciante.' },
  { id: 'cup_amador', icon: '🥈', name: 'Rei da Areia', desc: 'Vença o Circuito Amador.' },
  { id: 'cup_profissional', icon: '🥇', name: 'Profissional', desc: 'Vença a Liga Profissional.' },
  { id: 'beat_ze', icon: '👑', name: 'Superou o Mestre', desc: 'Derrote o Mestre Zé.' },
  { id: 'beat_iara', icon: '🌟', name: 'Lenda Viva', desc: 'Derrote Iara, a Mão de Ouro.' },
  { id: 'streak3', icon: '📈', name: 'Embalado', desc: 'Vença 3 partidas seguidas.' },
  { id: 'level10', icon: '🎖️', name: 'Veterano', desc: 'Chegue ao nível 10.' },
];

export function xpForLevel(level) { return 250 + (level - 1) * 150; }

export function getOpponent(id) { return OPPONENTS.find(o => o.id === id); }
