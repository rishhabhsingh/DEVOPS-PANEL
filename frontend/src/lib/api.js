import axios from 'axios';

// All API calls go through this instance
// baseURL points to our Express backend
// withCredentials means cookies are sent automatically
const api = axios.create({
  baseURL: 'http://localhost:4000',
  withCredentials: true
});

export default api;