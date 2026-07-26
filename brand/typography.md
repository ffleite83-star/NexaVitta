# Tipografia

**Manrope** — fonte de interface. Usada em todo o corpo de texto, navegação e UI. Pesos 400–800.

**Playfair Display** (itálico) — reservada para uma única ênfase por seção: a frase que carrega o sentimento central daquele trecho. Nunca usar em blocos longos de texto nem em UI funcional (botões, navegação, formulários).

## Regra prática

Se uma frase precisa "respirar" e carregar emoção, ela pode ganhar Playfair itálico. Se é informação, instrução ou interface, é sempre Manrope.

Carregamento via `next/font/google` em `app/layout.tsx`, exposta como variáveis CSS e mapeada em `tailwind.config.ts` (`font-sans`, `font-serif`).
