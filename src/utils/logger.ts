export const audit = (...args: readonly unknown[]) => {
  if (import.meta.env.PROD) {
    console.log("[AUDIT]", ...args);
  }
};
