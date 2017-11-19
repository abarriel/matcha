import * as Axios from 'axios';

const matchaToken = localStorage.getItem('matchaToken');
console.log(matchaToken);
const axios = Axios.create({
  baseURL: 'http://127.0.0.1:3004/api/',
  timeout: 3000,
  headers: {'Authorization': "Bearer " + matchaToken},
})

export const reqAuth = () => axios({
  method: 'get',
  url: 'user',
});

export const reqLogin = (login, password) => axios.post('user/login', {
  login,
  password,
}).then(({ data, status }) => {
  if (status === 201)
    throw data;
  return data;
});

export const reqRegister= (user) => axios.post('user', {
  ...user,
}).then(({ data, status }) => {
  if (status === 201)
    throw data;
  return data;
});

// export const reqLostPassword = (data) => axios({
//   method: 'get',
//   url:'http://127.0.0.1:3004/lost_password',
//   data,
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

// export const reqResetPassword = (data) => axios({
//   method: 'post',
//   url:'http://127.0.0.1:3004/reset_password',
//   data,
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

// export const reqUpdateUser = (data) => axios({
//   method: 'put',
//   url:'http://127.0.0.1:3004/reset_password',
//   data,
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

// export const reqGetMe = (data) => axios({
//   method: 'get',
//   url:'http://127.0.0.1:3004/api/user',
//   data,
//   ...config(matchaToken)
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

// export const reqGetUser = ({ id }) => axios({
//   method: 'get',
//   url:`http://127.0.0.1:3004/api/user/${id}`,
//   data,
//   ...config(matchaToken)
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

// export const reqDeleteMe = () => axios({
//   method: 'get',
//   url:`http://127.0.0.1:3004/api/user`,
//   ...config(matchaToken)
// }).then(({ data, status }) => {
//   if (status === 201)
//     throw data;
//   return data;
// });

export const reqGetAll = () => axios({
  method: 'get',
  url:`user?id=all`,
}).then(({ data, status }) => {
  if (status === 201)
    throw data;
  return data;
});

// // export const reqAddImg = () =>