/** 浏览器环境（打包为 IIFE 时在 window 下运行） */
export const win = typeof window !== 'undefined' ? window : null;
export const doc = typeof document !== 'undefined' ? document : null;

export function getDocument(node) {
  if (node && node.ownerDocument) return node.ownerDocument;
  return doc;
}

export function defaultRoot(root) {
  return root || doc?.body || null;
}
