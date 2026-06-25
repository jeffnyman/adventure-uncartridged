export const audit = (...args: readonly unknown[]): void => {
  if (import.meta.env.PROD) {
    console.log("[AUDIT]", ...args);
  }
};
