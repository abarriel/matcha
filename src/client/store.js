import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import axios from 'axios';
// import { createLogger } from 'redux-logger';

import reducer from './reducers';
import { CONNECTED_USER } from './actions/users';

// const logger = createLogger({
//   collapsed: true,
//   predicate: (getState, action) => action.type !== CONNECTED_USER
// });

const asyncDispatchMiddleware = store => next => action => {
  let syncActivityFinished = false;
  let actionQueue = [];

  function flushQueue() {
    actionQueue.forEach(a => store.dispatch(a)); // flush queue
    actionQueue = [];
  }

  function asyncDispatch(asyncAction) {
    actionQueue = actionQueue.concat([asyncAction]);

    if (syncActivityFinished) {
      flushQueue();
    }
  }
  const actionWithAsyncDispatch =
      Object.assign({}, action, { asyncDispatch });
  next(actionWithAsyncDispatch);
  syncActivityFinished = true;
  flushQueue();
};

const SocketIoMiddleware = io => store => next => action => {
  next(action);
};

const configureStore = (initialState, io) =>
  createStore(
      reducer(io),
      initialState,
      applyMiddleware(thunk, asyncDispatchMiddleware, SocketIoMiddleware(io)),
    );

export default configureStore;
