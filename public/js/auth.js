function getToken() {
  return localStorage.getItem("token");
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
}

function authHeader() {
  return {
    Authorization: 'Bearer ' + getToken()
  };
}

function checkAuth() {
  if (!getToken()) {
    logout();
  }
}
