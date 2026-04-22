function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

function authHeader() {
  return {
    Authorization: 'Bearer ' + getToken()
  };
}

function checkAuth() {
  const token = getToken();

  if (!token) {
    logout();
    return;
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    const exp = payload.exp * 1000;
    if (Date.now() > exp) {
      logout();
    }
  } catch {
    logout();
  }
}
