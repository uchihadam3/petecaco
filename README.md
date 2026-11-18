# 🏸 PETECAÇO — Peteca 3D em primeira pessoa

Jogo de peteca 3D em primeira pessoa feito pra ser jogado no navegador, no **PC e no celular**. Sempre um contra um: você na sua quadra e um adversário (NPC) do outro lado da rede.

## ▶️ Jogar

**https://uchihadam3.github.io/petecaco/**

Não precisa instalar nada. No celular, jogue com o aparelho deitado.

## 🎮 O que tem no jogo

- **Primeira pessoa de verdade**: mãos animadas que vão até a peteca na hora da batida, com *hitstop*, tremida de câmera, partículas de pena, som de tapa e torcida.
- **Física da peteca**: arrasto forte das penas, a base vira pra frente durante o voo e a peteca tomba ao cair. Ela pode bater na rede ou passar raspando na fita.
- **Sistema de tempo**: aperte um pouco antes da peteca chegar. O jogo escolhe o melhor instante dentro de uma janela curta. Com o tempo certo sai uma batida **PERFEITA**, e 3 perfeitas seguidas deixam você **EM CHAMAS 🔥**, com golpes mais rápidos e mais precisos.
- **Golpes**: BATER (vira **CORTADA** automática quando a peteca está alta), BALÃO, CURTINHA, pulo e arrancada.
- **10 adversários** com personalidade, falas e estilo próprio:
  - Iniciante: Tio Juca, Pedrinho, Dona Lúcia
  - Amador: Marcão, Jéssica "Furacão", Seu Benê
  - Profissional: Carla "Muralha", Thiago "Trovão", Mestre Zé
  - Lenda secreta: desbloqueada quando você vence a Liga Profissional
- **3 torneios** com chave de 8 (quartas, semi e final): Copa Iniciante 🥉, Circuito Amador 🥈 e Liga Profissional 🥇.
- **3 cenários**: Praça do Bairro, Praia do Pôr do Sol e Arena Petecaço (ginásio lotado com telão).
- **Progressão**: XP, níveis, moedas, 16 conquistas, petecas e munhequeiras pra comprar, estatísticas e recordes.
- **Modo treino** com rali infinito.

## ⌨️ Controles

| Ação | PC | Celular |
|---|---|---|
| Mover | W A S D | Joystick (lado esquerdo) |
| Olhar / mirar | Mouse | Arrastar (lado direito) |
| Bater / cortar | Clique esquerdo | BATER |
| Balão | Clique direito | BALÃO |
| Curtinha | E / botão do meio | CURTA |
| Pular | Espaço | PULAR |
| Arrancada | Shift | ⚡ |
| Pausa | P / Esc | ⏸ |

A mira segue a direção do seu olhar. O **anel verde** mostra onde o seu golpe vai cair (vermelho = fora) e o **anel amarelo** mostra onde a peteca do adversário vai cair.

## 🛠️ Tecnologia

- JavaScript puro (ES modules) + [three.js](https://threejs.org) r160, que já vem dentro do repositório em `lib/`
- Todo o áudio é sintetizado com WebAudio, inclusive o samba do menu
- Os cenários, personagens e texturas são gerados por código, sem nenhum arquivo de imagem ou modelo externo
- O progresso fica salvo no `localStorage`

Pra rodar localmente:

```bash
python3 -m http.server 8080
```

Depois abra http://localhost:8080
