const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

const SERVER_URL = 'https://gbserver-livrasand3864-uaxx2qjp.leapcell.dev';
const TOKEN_PATH = path.join(os.homedir(), '.gitbrancher', 'token');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    }
  } catch (error) {
    console.error('Error leyendo token:', error.message);
  }
  return null;
}

function setToken(token) {
  ensureDir(path.dirname(TOKEN_PATH));
  fs.writeFileSync(TOKEN_PATH, token, 'utf8');
}

function clearToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH);
  }
}

async function isLoggedIn() {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await axios.get(`${SERVER_URL}/api/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.valid === true;
  } catch (error) {
    return false;
  }
}

async function register(email, password) {
  try {
    const response = await axios.post(`${SERVER_URL}/register`, { email, password }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    return { success: true, message: 'Registro exitoso. Ahora puedes iniciar sesión.' };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || 'Error en registro' };
  }
}

async function login(email, password) {
  try {
    const response = await axios.post(`${SERVER_URL}/login`, { email, password }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    });
    if (response.data.token) {
      setToken(response.data.token);
      return { success: true, message: 'Inicio de sesión exitoso.' };
    }
    return { success: false, message: 'No se recibió token del servidor' };
  } catch (error) {
    return { success: false, message: error.response?.data?.error || 'Error en login' };
  }
}

async function logout() {
  clearToken();
  return { success: true, message: 'Sesión cerrada.' };
}

async function getCredits() {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await axios.get(`${SERVER_URL}/api/credits`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

async function consumeCredits(amount) {
  const token = getToken();
  if (!token) return { success: false, reason: 'not_logged_in' };

  try {
    const response = await axios.post(`${SERVER_URL}/api/ai/consume`, { amount }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 402) {
      return { success: false, reason: 'insufficient_credits' };
    }
    return { success: false, reason: 'error' };
  }
}

module.exports = {
  getToken,
  setToken,
  clearToken,
  isLoggedIn,
  register,
  login,
  logout,
  getCredits,
  consumeCredits
};
