class TokenService {
  setAccessToken(token) {
    sessionStorage.setItem("token", JSON.stringify(token));
  }
  getAccessToken() {
    const token = JSON.parse(sessionStorage.getItem("token"));
    if (token) {
      return token;
    } else {
      return undefined;
    }
  }
}

export default new TokenService();
