'use strict';

const path = require('path');
const jsonfile = require('jsonfile');
const _ = require('underscore');
const Promise = require('bluebird');
const uuid = require('node-uuid');

const errors = require('lib/errors');
const Connection = require('lib/entities/connection');

const DB_CONNECTIONS = path.join(__dirname, '../../../', 'config/dbConnections.json');

/**
 * @class ConnectionRepository
 */
class ConnectionRepository {
  /**
   * @constructor ConnectionRepository
   */
  constructor() {}

  /**
   * @method create
   */
  create(options) {
    let _this = this;

    return new Promise((resolve, reject) => {
      if (!options) return reject(new errors.InternalServiceError('options is required'));

      let connections;
      let newConnection;

      options.id = uuid.v4(); //assign a unique id

      return _this.list()
        .then((_connections) => {
          connections = _connections;
          return createConnection(options, _connections);
        })
        .then((_connection) => {
          newConnection = _connection;
          connections.push(newConnection);
          return convertConnectionInstancesIntoConfig(connections);
        })
        .then(writeConfigFile)
        .then(() => {
          return new Promise((resolve1) => {
            return resolve1(newConnection);
          });
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * @method list
   */
  list() {
    return readConfigFile()
      .then(generateConnectionInstancesFromConfig);
  }

  /**
   * @method delete
   * @param {String} id - id of the connection to delete
   */
  delete(id) {
    var _this = this;

    return _this.list()
      .then((connections) => {
        return removeConnection(id, connections);
      })
      .then(convertConnectionInstancesIntoConfig)
      .then(writeConfigFile)
      .then(() => {
        return new Promise((resolve) => {
          return resolve(null);
        });
      });
  }
}

function readConfigFile() {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(DB_CONNECTIONS, (err, data) => {
      if (err && !(err.message && err.message === 'Unexpected end of input')) return reject(err);
      return resolve(data || []);
    });
  });
}

function writeConfigFile(data) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(DB_CONNECTIONS, data, (err, data) => {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}

function generateConnectionInstancesFromConfig(connectionConfigs) {
  return new Promise((resolve) => {
    return resolve(connectionConfigs.map(generateConnectionInstanceFromConfig));
  });
}

function generateConnectionInstanceFromConfig(connectionConfig) {
  var newConn = new Connection({
    id: connectionConfig.id || uuid.v4(),
    name: connectionConfig.name,
    host: connectionConfig.host,
    port: connectionConfig.port
  });

  _.each(connectionConfig.databases, (databaseConfig) => {
    newConn.addDatabase({
      id: databaseConfig.id || uuid.v4(),
      name: databaseConfig.name,
      host: connectionConfig.host,
      port: connectionConfig.port,
      auth: databaseConfig.auth
    });
  });

  return newConn;
}

function convertConnectionInstancesIntoConfig(connections) {
  return new Promise((resolve) => {
    return resolve(connections.map(convertConnectionInstanceIntoConfig));
  });
}

function convertConnectionInstanceIntoConfig(connection) {
  //unique id's are added to the entities to emulate
  //storing them in a real database that would assign unique ids
  //the app relies on the various entities to have unique ids so
  //until I change to storing these in something that assigns ids
  //we have to manually add them

  return {
    id: connection.id || uuid.v4(),
    name: connection.name,
    host: connection.host,
    port: connection.port,
    databases: connection.databases.map((database) => {
      var db = {
        name: database.name
      };

      if (database.auth) {
        db.auth = {
          id: database.id || uuid.v4(),
          username: database.auth.username,
          password: database.auth.password
        };
      }

      return db;
    })
  };
}

function createConnection(options) {
  return new Promise((resolve) => {
    var newConn = new Connection(options);
    newConn.addDatabase({
      id: uuid.v4(),
      name: options.databaseName,
      host: options.host,
      port: options.port,
      auth: options.auth
    });
    return resolve(newConn);
  });
}

function removeConnection(connectionId, connections) {
  return new Promise((resolve, reject) => {
    var foundConnection = _.findWhere(connections, {
      id: connectionId
    });

    if (foundConnection) {
      var index = connections.indexOf(foundConnection);
      connections.splice(index, 1);
    } else {
      return reject(new Error('Connection not found'));
    }

    return resolve(connections);
  });
}

/**
 * @exports
 */
module.exports = new ConnectionRepository();
