module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var Koa = __webpack_require__(1);
	var app = new Koa();
	var router = __webpack_require__(2)();
	var bodyParser = __webpack_require__(3)();
	var imageGenerator = __webpack_require__(4);
	// const stopLabelGenerator = require('./stopLabelGenerator');
	
	router.post('/generateImage', function (ctx) {
	  return new Promise(function (resolve) {
	    return imageGenerator(function (_ref) {
	      var data = _ref.data;
	
	      ctx.status = 200; // eslint-disable-line no-param-reassign
	      ctx.type = 'image/png'; // eslint-disable-line no-param-reassign
	      ctx.body = data; // eslint-disable-line no-param-reassign
	      resolve();
	    }, ctx.request.body);
	  });
	});
	
	// router.post('/generateStopLabels', ctx =>
	//   new Promise((resolve) =>
	//     stopLabelGenerator(
	//       ({ data }) => {
	//         ctx.status = 200; // eslint-disable-line no-param-reassign
	//         ctx.type = 'application/html'; // eslint-disable-line no-param-reassign
	//         ctx.body = data; // eslint-disable-line no-param-reassign
	//         resolve();
	//       },
	//       ctx.request.body
	//     )
	//   )
	// );
	
	app.use(bodyParser).use(router.routes()).use(router.allowedMethods()).listen(4000);

/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = require("koa");

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = require("koa-router");

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = require("koa-bodyparser");

/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = require("hsl-map-generator-core");

/***/ }
/******/ ]);
//# sourceMappingURL=hsl-map-generator-server.js.map