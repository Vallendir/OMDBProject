'use strict';

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

module.exports = function (kbnServer, server, config) {
  var _ = require('lodash');
  var fs = require('fs');
  var Boom = require('boom');
  var Hapi = require('hapi');
  var parse = require('url').parse;
  var format = require('url').format;

  var getDefaultRoute = require('./getDefaultRoute');

  server = kbnServer.server = new Hapi.Server();

  var shortUrlLookup = require('./short_url_lookup')(server);

  // Create a new connection
  var connectionOptions = {
    host: config.get('server.host'),
    port: config.get('server.port'),
    state: {
      strictHeader: false
    },
    routes: {
      cors: config.get('server.cors'),
      payload: {
        maxBytes: config.get('server.maxPayloadBytes')
      }
    }
  };

  // enable tls if ssl key and cert are defined
  if (config.get('server.ssl.key') && config.get('server.ssl.cert')) {
    connectionOptions.tls = {
      key: fs.readFileSync(config.get('server.ssl.key')),
      cert: fs.readFileSync(config.get('server.ssl.cert')),
      // The default ciphers in node 0.12.x include insecure ciphers, so until
      // we enforce a more recent version of node, we craft our own list
      // @see https://github.com/nodejs/node/blob/master/src/node_constants.h#L8-L28
      ciphers: ['ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-AES256-GCM-SHA384', 'DHE-RSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-SHA256', 'DHE-RSA-AES128-SHA256', 'ECDHE-RSA-AES256-SHA384', 'DHE-RSA-AES256-SHA384', 'ECDHE-RSA-AES256-SHA256', 'DHE-RSA-AES256-SHA256', 'HIGH', '!aNULL', '!eNULL', '!EXPORT', '!DES', '!RC4', '!MD5', '!PSK', '!SRP', '!CAMELLIA'].join(':'),
      // We use the server's cipher order rather than the client's to prevent
      // the BEAST attack
      honorCipherOrder: true
    };
  }

  server.connection(connectionOptions);

  // provide a simple way to expose static directories
  server.decorate('server', 'exposeStaticDir', function (routePath, dirPath) {
    this.route({
      path: routePath,
      method: 'GET',
      handler: {
        directory: {
          path: dirPath,
          listing: true,
          lookupCompressed: true
        }
      },
      config: { auth: false }
    });
  });

  // provide a simple way to expose static files
  server.decorate('server', 'exposeStaticFile', function (routePath, filePath) {
    this.route({
      path: routePath,
      method: 'GET',
      handler: {
        file: filePath
      },
      config: { auth: false }
    });
  });

  // helper for creating view managers for servers
  server.decorate('server', 'setupViews', function (path, engines) {
    this.views({
      path: path,
      isCached: config.get('optimize.viewCaching'),
      engines: _.assign({ jade: require('jade') }, engines || {})
    });
  });

  server.decorate('server', 'redirectToSlash', function (route) {
    this.route({
      path: route,
      method: 'GET',
      handler: function handler(req, reply) {
        return reply.redirect(format({
          search: req.url.search,
          pathname: req.url.pathname + '/'
        }));
      }
    });
  });

  // attach the app name to the server, so we can be sure we are actually talking to kibana
  server.ext('onPreResponse', function (req, reply) {
    var response = req.response;

    if (response.isBoom) {
      response.output.headers['kbn-name'] = kbnServer.name;
      response.output.headers['kbn-version'] = kbnServer.version;
    } else {
      response.header('kbn-name', kbnServer.name);
      response.header('kbn-version', kbnServer.version);
    }

    return reply['continue']();
  });

  server.route({
    path: '/',
    method: 'GET',
    handler: function handler(req, reply) {
      return reply.view('rootRedirect', {
        hashRoute: config.get('server.basePath') + '/app/kibana',
        defaultRoute: getDefaultRoute(kbnServer)
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/{p*}',
    handler: function handler(req, reply) {
      var path = req.path;
      if (path === '/' || path.charAt(path.length - 1) !== '/') {
        return reply(Boom.notFound());
      }

      return reply.redirect(format({
        search: req.url.search,
        pathname: path.slice(0, -1)
      })).permanent(true);
    }
  });

  server.route({
    method: 'GET',
    path: '/goto/{urlId}',
    handler: function handler(request, reply) {
      var url;
      return _regeneratorRuntime.async(function handler$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {
          case 0:
            context$2$0.prev = 0;
            context$2$0.next = 3;
            return _regeneratorRuntime.awrap(shortUrlLookup.getUrl(request.params.urlId));

          case 3:
            url = context$2$0.sent;

            reply().redirect(config.get('server.basePath') + url);
            context$2$0.next = 10;
            break;

          case 7:
            context$2$0.prev = 7;
            context$2$0.t0 = context$2$0['catch'](0);

            reply(context$2$0.t0);

          case 10:
          case 'end':
            return context$2$0.stop();
        }
      }, null, this, [[0, 7]]);
    }
  });

  server.route({
    method: 'POST',
    path: '/shorten',
    handler: function handler(request, reply) {
      var urlId;
      return _regeneratorRuntime.async(function handler$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {
          case 0:
            context$2$0.prev = 0;
            context$2$0.next = 3;
            return _regeneratorRuntime.awrap(shortUrlLookup.generateUrlId(request.payload.url));

          case 3:
            urlId = context$2$0.sent;

            reply(urlId);
            context$2$0.next = 10;
            break;

          case 7:
            context$2$0.prev = 7;
            context$2$0.t0 = context$2$0['catch'](0);

            reply(context$2$0.t0);

          case 10:
          case 'end':
            return context$2$0.stop();
        }
      }, null, this, [[0, 7]]);
    }
  });

  return kbnServer.mixin(require('./xsrf'));
};
