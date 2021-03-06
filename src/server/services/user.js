import R from 'ramda';
import bcrypt from 'bcrypt-as-promised';
import jwt from 'jsonwebtoken';
import geoip from 'geoip-lite';
import _ from 'lodash';

import mailer from '../../lib/mailer';
import User from '../models/User';
import Chat from '../models/Chat';
import Notif from '../models/Notif';

import { validateRegisterForm,
  validateLoginForm,
  checkIfConfirmedAndReturnUser,
  sendConfirmEmail,
  getIp,
  getLocalisation,
  checkIfNotBlocked,
  getInfoToUpdate } from './hooks/user';
import { schemaLogin } from '../../lib/validators';
import { checkAuth, getUserFromToken, checkToken } from './hooks/token';
import { getFilterAndSort, getFilterGeoAndInterest } from './hooks/location';
import { cleanUser } from '../function';

const service = {
  // CRUD
  async post(req, res) {
    const { db } = req.ctx;
    try {
      const user = { ...R.pick(req.registerInputName, req.body), ...req.user };
      const newUser = await bcrypt
      .hash(req.body.password, 10)
      .then(hashedPassword =>
        User.add.bind({ db })(R.assoc('password', hashedPassword, user)));
        req.user = newUser;
        await User.scoring.bind({ db })(req.user);
        sendConfirmEmail(newUser, req.ctx);
        res.json({ details: 'Succesfully register, please check your mail' });
      } catch (err) {
        req.Err('User already register');
      }
    },
    async put(req, res) {
    try {
      const { id } = req.user;
      const { infoToUpdate } = req;
      const { ctx: { db } } = req;
      const info = R.filter((single) => {
        if (typeof single === 'object' && single.length !== 0) return true;
        if (typeof single === 'string' && single !== '') return true;
        if (typeof single === 'boolean') return true;
        if (typeof single === 'number') return true;
      }, infoToUpdate);
      if (info.password) {
        info.password = await bcrypt.hash(info.password, 10);
      }
      if (info.blocked) await Notif.deleteAllNotif.bind({ db })(id, req.blockedClean);
      const user = await User.update.bind({ db })(info, Number(id));
      await User.scoring.bind({ db })(user);
      res.json({ details: 'Succesfully update your info', more: Object.keys(info) });
    } catch (err) {
      req.Err('Failed To upload your info');
    }
  },
  async delete(req, res) {
    try {
      const { ctx: { db }, user } = req;
      await User.delete.bind({ db })(Number(user.id));
      res.json({ details: 'Succesfully delete' });
    } catch (err) {
      req.Err('Failed to delete', req.user.login);
    }
  },
  async get(req, res, next) {
    const { ctx: { db }, user: { id, login } } = req;
    const { query: { id: idRequest } } = req;
    try {
      if (idRequest) {
        const _user = await User.load.bind({ db })(idRequest);
        const usersBlocked = _.filter([_user], (user) => !_.includes(user.blocked, id.toString()) && !_.includes(req.user.blocked, user.id.toString()));
        if (_.isEmpty(usersBlocked)) return req.Err('blocked');
        const socketIds = _user.socket_id;
        socketIds.forEach((socketId) => res.io.to(socketId).emit('notif', {date: new Date(), user_receive: idRequest, user_send: id, details: `${login} see you profile`, type: 'get' }));
        await Notif.add.bind({ db })(id, idRequest, `${login} see you profile`, 'get');
        req.userRequested = cleanUser(_user);
      } else {
        await User.update.bind({ db })({ connected: true, cotime: new Date() }, Number(id));
        return res.json({ details: cleanUser(req.user) });
      }
      next();
    } catch (err) {
      req.Err('Failed to get the user');
    }
  },

  // OTHER ACTIONS
  async getAll(req, res, next) {
    const { ctx: { db }, user: { id } } = req;
    try {
      const users = await User.getAll.bind({ db })(req.filterString, req.sortString);
      req.users = users.filter((item) => item.id !== id).map(v => cleanUser(v));
      next();
    } catch (err) {
      req.Err('Failed to get the user');
    }
  },
  async login(req, res) {
    try {
      const { password: inputPassword } = req.body;
      const { ctx: { config: { secretSentence, expiresIn }, db }, user } = req;
      await bcrypt.compare(inputPassword, user.password);
      const wasConnected = user.connected;
      const { connection: { remoteAddress } } = req;
      let ip = remoteAddress;
      if (ip === '127.0.0.1' || ip === '::1' || !ip) ip = '62.210.34.191';
      const geo = geoip.lookup(ip);
      const range = { latitude: geo.ll[0], longitude: geo.ll[1] };
      await User.update.bind({ db })({ connected: true, cotime: new Date(), ...range }, Number(user.id));
      if (!wasConnected) res.io.emit('userConnected', user.login);
      res.json({ matchaToken: jwt.sign({ sub: user.id }, secretSentence, { expiresIn }) });
    } catch (err) {
      const message = err.message === 'invalid' ? 'wrong password' : 'failed to auth';
      req.Err(message, err);
    }
  },
  async confirmEmail(req, res) {
    try {
      const {
        db,
        config: { urlClient },
      } = req.ctx;
      const { id } = req.user;
      const user = await User.update.bind({ db })({ confirmed: true }, Number(id));
      res.redirect(`${urlClient}?login=${user.login}`);
    } catch (err) {
      req.Err(err.message);
    }
  },
  async resetPassword(req, res) {
    try {
      const { password } = req.body;
      const { db } = req.ctx;
      if (password && !/^(?=.*[a-zA-Z])(?=.*\W)(?=.*[0-9]).{6,25}$/.test(password)) {
        return req.Err('WROONG FORMAT');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.update.bind({ db })({ password: hashedPassword }, req.tokenId);
      res.status = 200;
      res.json({ details: 'password has been updated!' });
    } catch (err) {
      req.Err('wrong format');
    }
  },
  async lostPassword(req, res) {
    const { config: { routes: { resetPassword }, urlClient }, db } = req.ctx;
    const { login } = req.query;
    try {
      const user = await User.getByLogin.bind({ db })(login);
      const token = jwt.sign({ sub: user.id }, user.password);
      mailer(
        user.email,
        'Reset Password - Matcha',
        `Registration Code: http://localhost:3000/reset?matchaToken=${token}`,
      );
      res.json({ details: 'Email sent thank you' });
    } catch (err) {
      req.Err(err);
    }
  },
  async getConnectedUser(req, res) {
    const { ctx: { db } } = req;
    try {
      const connectedUser = await User.getConnectedUser.bind({ db })();
      return res.json({ details: connectedUser.count });
    } catch (err) {
      req.Err('Failed to get connected user');
    }
  },
  async likeUser(req, res) {
    try {
      const { query: { id }, ctx: { db } } = req;
      const userSendLike = req.user.id.toString();
      const userReceiveLike = id;
      if (userSendLike === userReceiveLike) return req.Err('can \'t liked yourself');
      const { blocked, socket_id } = await User.load.bind({ db })(id);
      if (_.includes(blocked, userSendLike)) return req.Err('cant like because b');
      const isAlreadyLike = await Notif.getSome.bind({ db })(userSendLike, userReceiveLike, 'like');
      let detailsLike = '';
      let booleanLike = true;
      if (isAlreadyLike) {
        await Notif.deleteLike.bind({ db })(userSendLike, userReceiveLike);
        detailsLike = `${req.user.login} don't like you anymore`;
        booleanLike = false;
      } else {
        const isMutualLike = await Notif.getSome.bind({ db })(userReceiveLike, userSendLike, 'like');
        detailsLike = `${req.user.login} like your profile`;
        if (isMutualLike) detailsLike = `${req.user.login} like you back`;
        await Notif.add.bind({ db })(userSendLike, userReceiveLike, detailsLike, 'like');
        detailsLike = `${req.user.login} like your profile`;
      }
      const socketIds = socket_id;
      socketIds.forEach((socketId) => res.io.to(socketId).emit('notif', { date: new Date(), user_receive: userReceiveLike, user_send: userSendLike, details: detailsLike, type: 'like' }));
      return res.json({ details: booleanLike ? 'like' : 'unlike' });
    } catch (err) {
      req.Err('failed to like the user');
    }
  },
  async getLikeStatus(req, res) {
    try {
      const { query: { id }, ctx: { db } } = req;
      const userSendLike = req.user.id.toString();
      const userReceiveLike = id;
      const isLike = await Notif.getSome.bind({ db })(userSendLike, userReceiveLike, 'like');
      const isMutualLike = await Notif.ifMutualLike.bind({ db })(userSendLike, userReceiveLike);
      if (isLike) {
        return res.json({ details: 'like', isMutualLike });
      }
      return res.json({ details: 'unlike', isMutualLike });
    } catch (err) {
      req.Err('failed to like the user');
    }
  },
  async getNotifs(req, res) {
    try {
      const { ctx: { db }, user: { id } } = req;
      const notifs = await Notif.get.bind({ db })(Number(id));
      res.json({ details: notifs });
    } catch (err) {
      req.Err('failed to get notifs');
    }
  },
  async getUnseenNotifs(req, res) {
    try {
      const { ctx: { db }, user: { id } } = req;
      const notifs = await Notif.getUnseenNotifs.bind({ db })(Number(id));
      res.json({ details: notifs });
    } catch (err) {
      req.Err('failed to get notifs');
    }
  },
  async seenNotifs(req, res) {
    try {
      const { ctx: { db }, user: { id } } = req;
      await Notif.seen.bind({ db })(Number(id));
      res.json({ details: 'succes !' });
    } catch (err) {
      req.Err('failed to get notifs');
    }
  },
  async addMsg(req, res) {
    try {
      const { ctx: { db } } = req;
      const { msg, id } = req.body;
      const isMutualLike = await Notif.ifMutualLike.bind({ db })(req.user.id.toString(), id);
      if (_.isEmpty(msg) || !/^[a-zA-Z0-9 ?!'àèéêá]{1,150}$/i.test(msg)) return req.Err('try to send a bad msg');
      if (!isMutualLike) return req.Err('can\t send it');
      const messageAdded = await Chat.add.bind({ db })(Number(req.user.id), Number(id), msg);
      const { socket_id, login } = await User.load.bind({ db })(Number(id));
      await Notif.add.bind({ db })(Number(req.user.id), Number(id), `${req.user.login} send you a text`, 'chat');
      const socketIds = socket_id;
      socketIds.forEach((socketId) => res.io.to(socketId).emit('notif', { date: new Date(), user_receive: Number(id), user_send: Number(req.user.id), details: `${req.user.login} send you a text`, type: 'chat' }));
      socketIds.forEach((socketId) => res.io.to(socketId).emit('chat', messageAdded));
      res.json({ details: 'succes !' });
    } catch (err) {
      req.Err('failed to get send message');
    }
  },
  async getAllMessages(req, res) {
    try {

      const { ctx: { db } } = req;
      const { id } = req.query;
       if(!_.isNumber(Number(id)))
        return req.Err('failed to get message');
      const allConversation = await Chat.getAllConversation.bind({ db })(Number(req.user.id), Number(id));
      res.json({ details: allConversation });
    } catch (err) {
      req.Err('failed to get message');
    }
  },
};

const init = {
  name: 'user',
  service,
  before: {
    get: [checkAuth],
    getAll: [checkAuth, getFilterAndSort],
    post: [validateRegisterForm, getIp, getLocalisation],
    put: [checkAuth, getInfoToUpdate],
    delete: [checkAuth],
    likeUser: [checkAuth],
    getLikeStatus: [checkAuth],
    getNotifs: [checkAuth],
    getUnseenNotifs: [checkAuth],
    seenNotifs: [checkAuth],
    login: [validateLoginForm, checkIfConfirmedAndReturnUser],
    confirmEmail: [getUserFromToken],
    resetPassword: [checkToken],
    addMsg: [checkAuth],
    getAllMessages: [checkAuth],
  },
  after: {
    get: [checkIfNotBlocked],
    getAll: [getFilterGeoAndInterest, checkIfNotBlocked],
  },
};

export default init;
