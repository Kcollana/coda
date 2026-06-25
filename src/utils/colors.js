const PALETTE = [
  '#e06c75', '#98c379', '#e5c07b', '#61afef',
  '#c678dd', '#56b6c2', '#d19a66', '#ff6b6b',
  '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
  '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3',
];

export function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
