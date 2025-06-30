export const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
