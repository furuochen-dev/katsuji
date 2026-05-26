/** @registry 各模块挂载点，bundle 后仅保留一个 IIFE */
var KatsujiInternal = {
  global: typeof window !== 'undefined' ? window : this,
};
