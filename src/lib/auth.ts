import bcrypt from "bcryptjs";

export const generatePassword = (length = 8) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
};

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

export const setSession = (user: any) => {
  localStorage.setItem("bncc_session", JSON.stringify({
    ...user,
    expiry: Date.now() + 1000 * 60 * 60 * 2 // 2 hours
  }));
};

export const getSession = () => {
  const sessionStr = localStorage.getItem("bncc_session");
  if (!sessionStr) return null;
  
  const session = JSON.parse(sessionStr);
  if (Date.now() > session.expiry) {
    localStorage.removeItem("bncc_session");
    return null;
  }
  return session;
};

export const clearSession = () => {
  localStorage.removeItem("bncc_session");
};
