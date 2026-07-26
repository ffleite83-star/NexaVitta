# Movimento

Framer Motion é usado com intenção narrativa, nunca como decoração. Regra: se uma animação não reforça a ideia de "passo a passo", ela não deveria existir.

## Padrão de referência: `components/Trajectory.tsx`

- A curva se desenha (`pathLength` 0 → 1) em vez de simplesmente aparecer — a trajetória é traçada, não revelada.
- Os três pontos (começar, conhecer, continuar) surgem em sequência com atraso (`delay`), reforçando progressão temporal, nunca simultânea.
- Easing suave (`easeInOut`), sem bounce ou exagero — consistente com o tom calmo da marca.

## Regras gerais

- Nunca animar para chamar atenção ou criar urgência.
- Preferir transições de opacidade e posição sutis a zooms ou rotações chamativas.
- Respeitar `prefers-reduced-motion` conforme o produto crescer além do Brand Book.
