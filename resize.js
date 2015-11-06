(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/*
 * File: iframeResizer.js
 * Desc: Force iframes to size to content.
 * Requires: iframeResizer.contentWindow.js to be loaded into the target frame.
 * Doc: https://github.com/davidjbradshaw/iframe-resizer
 * Author: David J. Bradshaw - dave@bradshaw.net
 * Contributor: Jure Mav - jure.mav@gmail.com
 * Contributor: Reed Dadoune - reed@dadoune.com
 */
'use strict';

;(function (window) {
  'use strict';

  var count = 0,
      logEnabled = false,
      msgHeader = 'message',
      msgHeaderLen = msgHeader.length,
      msgId = '[iFrameSizer]',

  //Must match iframe msg ID
  msgIdLen = msgId.length,
      pagePosition = null,
      requestAnimationFrame = window.requestAnimationFrame,
      resetRequiredMethods = { max: 1, scroll: 1, bodyScroll: 1, documentElementScroll: 1 },
      settings = {},
      timer = null,
      defaults = {
    autoResize: true,
    bodyBackground: null,
    bodyMargin: null,
    bodyMarginV1: 8,
    bodyPadding: null,
    checkOrigin: true,
    enableInPageLinks: false,
    enablePublicMethods: false,
    heightCalculationMethod: 'offset',
    interval: 32,
    log: false,
    maxHeight: Infinity,
    maxWidth: Infinity,
    minHeight: 0,
    minWidth: 0,
    resizeFrom: 'parent',
    scrolling: false,
    sizeHeight: true,
    sizeWidth: false,
    tolerance: 0,
    closedCallback: function closedCallback() {},
    initCallback: function initCallback() {},
    messageCallback: function messageCallback() {},
    resizedCallback: function resizedCallback() {},
    scrollCallback: function scrollCallback() {
      return true;
    }
  };

  function addEventListener(obj, evt, func) {
    if ('addEventListener' in window) {
      obj.addEventListener(evt, func, false);
    } else if ('attachEvent' in window) {
      //IE
      obj.attachEvent('on' + evt, func);
    }
  }

  function setupRequestAnimationFrame() {
    var vendors = ['moz', 'webkit', 'o', 'ms'],
        x;

    // Remove vendor prefixing if prefixed and break early if not
    for (x = 0; x < vendors.length && !requestAnimationFrame; x += 1) {
      requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
    }

    if (!requestAnimationFrame) {
      log(' RequestAnimationFrame not supported');
    }
  }

  function getMyID() {
    var retStr = 'Host page';

    if (window.top !== window.self) {
      if (window.parentIFrame) {
        retStr = window.parentIFrame.getId();
      } else {
        retStr = 'Nested host page';
      }
    }

    return retStr;
  }

  function formatLogMsg(msg) {
    return msgId + '[' + getMyID() + ']' + msg;
  }

  function log(msg) {
    if (logEnabled && 'object' === typeof window.console) {
      console.log(formatLogMsg(msg));
    }
  }

  function warn(msg) {
    if ('object' === typeof window.console) {
      console.warn(formatLogMsg(msg));
    }
  }

  function iFrameListener(event) {
    function resizeIFrame() {
      function resize() {
        setSize(messageData);
        setPagePosition();
        settings[iframeId].resizedCallback(messageData);
      }

      ensureInRange('Height');
      ensureInRange('Width');

      syncResize(resize, messageData, 'resetPage');
    }

    function closeIFrame(iframe) {
      var iframeId = iframe.id;

      log(' Removing iFrame: ' + iframeId);
      iframe.parentNode.removeChild(iframe);
      settings[iframeId].closedCallback(iframeId);
      delete settings[iframeId];
      log(' --');
    }

    function processMsg() {
      var data = msg.substr(msgIdLen).split(':');

      return {
        iframe: document.getElementById(data[0]),
        id: data[0],
        height: data[1],
        width: data[2],
        type: data[3]
      };
    }

    function ensureInRange(Dimension) {
      var max = Number(settings[iframeId]['max' + Dimension]),
          min = Number(settings[iframeId]['min' + Dimension]),
          dimension = Dimension.toLowerCase(),
          size = Number(messageData[dimension]);

      if (min > max) {
        throw new Error('Value for min' + Dimension + ' can not be greater than max' + Dimension);
      }

      log(' Checking ' + dimension + ' is in range ' + min + '-' + max);

      if (size < min) {
        size = min;
        log(' Set ' + dimension + ' to min value');
      }

      if (size > max) {
        size = max;
        log(' Set ' + dimension + ' to max value');
      }

      messageData[dimension] = '' + size;
    }

    function isMessageFromIFrame() {
      function checkAllowedOrigin() {
        function checkList() {
          log(' Checking connection is from allowed list of origins: ' + checkOrigin);
          var i;
          for (i = 0; i < checkOrigin.length; i++) {
            if (checkOrigin[i] === origin) {
              return true;
            }
          }
          return false;
        }

        function checkSingle() {
          log(' Checking connection is from: ' + remoteHost);
          return origin === remoteHost;
        }

        return checkOrigin.constructor === Array ? checkList() : checkSingle();
      }

      var origin = event.origin,
          checkOrigin = settings[iframeId].checkOrigin,
          remoteHost = messageData.iframe.src.split('/').slice(0, 3).join('/');

      if (checkOrigin) {
        if ('' + origin !== 'null' && !checkAllowedOrigin()) {
          throw new Error('Unexpected message received from: ' + origin + ' for ' + messageData.iframe.id + '. Message was: ' + event.data + '. This error can be disabled by setting the checkOrigin: false option or by providing of array of trusted domains.');
        }
      }

      return true;
    }

    function isMessageForUs() {
      return msgId === ('' + msg).substr(0, msgIdLen); //''+Protects against non-string msg
    }

    function isMessageFromMetaParent() {
      //Test if this message is from a parent above us. This is an ugly test, however, updating
      //the message format would break backwards compatibity.
      var retCode = (messageData.type in { 'true': 1, 'false': 1, 'undefined': 1 });

      if (retCode) {
        log(' Ignoring init message from meta parent page');
      }

      return retCode;
    }

    function getMsgBody(offset) {
      return msg.substr(msg.indexOf(':') + msgHeaderLen + offset);
    }

    function forwardMsgFromIFrame(msgBody) {
      log(' MessageCallback passed: {iframe: ' + messageData.iframe.id + ', message: ' + msgBody + '}');
      settings[iframeId].messageCallback({
        iframe: messageData.iframe,
        message: JSON.parse(msgBody)
      });
      log(' --');
    }

    function checkIFrameExists() {
      if (null === messageData.iframe) {
        warn(' IFrame (' + messageData.id + ') not found');
        return false;
      }
      return true;
    }

    function getElementPosition(target) {
      var iFramePosition = target.getBoundingClientRect();

      getPagePosition();

      return {
        x: parseInt(iFramePosition.left, 10) + parseInt(pagePosition.x, 10),
        y: parseInt(iFramePosition.top, 10) + parseInt(pagePosition.y, 10)
      };
    }

    function scrollRequestFromChild(addOffset) {
      function reposition() {
        pagePosition = newPosition;

        scrollTo();

        log(' --');
      }

      function calcOffset() {
        return {
          x: Number(messageData.width) + offset.x,
          y: Number(messageData.height) + offset.y
        };
      }

      var offset = addOffset ? getElementPosition(messageData.iframe) : { x: 0, y: 0 },
          newPosition = calcOffset();

      log(' Reposition requested from iFrame (offset x:' + offset.x + ' y:' + offset.y + ')');

      if (window.top !== window.self) {
        if (window.parentIFrame) {
          if (addOffset) {
            window.parentIFrame.scrollToOffset(newPosition.x, newPosition.y);
          } else {
            window.parentIFrame.scrollTo(messageData.width, messageData.height);
          }
        } else {
          warn(' Unable to scroll to requested position, window.parentIFrame not found');
        }
      } else {
        reposition();
      }
    }

    function scrollTo() {
      if (false !== settings[iframeId].scrollCallback(pagePosition)) {
        setPagePosition();
      }
    }

    function findTarget(location) {
      function jumpToTarget(target) {
        var jumpPosition = getElementPosition(target);

        log(' Moving to in page link (#' + hash + ') at x: ' + jumpPosition.x + ' y: ' + jumpPosition.y);
        pagePosition = {
          x: jumpPosition.x,
          y: jumpPosition.y
        };

        scrollTo();
        log(' --');
      }

      var hash = location.split('#')[1] || '',
          hashData = decodeURIComponent(hash),
          target = document.getElementById(hashData) || document.getElementsByName(hashData)[0];

      if (window.top !== window.self) {
        if (window.parentIFrame) {
          window.parentIFrame.moveToAnchor(hash);
        } else {
          log(' In page link #' + hash + ' not found and window.parentIFrame not found');
        }
      } else if (target) {
        jumpToTarget(target);
      } else {
        log(' In page link #' + hash + ' not found');
      }
    }

    function actionMsg() {
      switch (messageData.type) {
        case 'close':
          closeIFrame(messageData.iframe);
          break;
        case 'message':
          forwardMsgFromIFrame(getMsgBody(6));
          break;
        case 'scrollTo':
          scrollRequestFromChild(false);
          break;
        case 'scrollToOffset':
          scrollRequestFromChild(true);
          break;
        case 'inPageLink':
          findTarget(getMsgBody(9));
          break;
        case 'reset':
          resetIFrame(messageData);
          break;
        case 'init':
          resizeIFrame();
          settings[iframeId].initCallback(messageData.iframe);
          break;
        default:
          resizeIFrame();
      }
    }

    function hasSettings(iframeId) {
      var retBool = true;

      if (!settings[iframeId]) {
        retBool = false;
        warn(messageData.type + ' No settings for ' + iframeId + '. Message was: ' + msg);
      }

      return retBool;
    }

    var msg = event.data,
        messageData = {},
        iframeId = null;

    if (isMessageForUs()) {
      messageData = processMsg();
      iframeId = messageData.id;

      if (!isMessageFromMetaParent() && hasSettings(iframeId)) {
        logEnabled = settings[iframeId].log;
        log(' Received: ' + msg);

        if (checkIFrameExists() && isMessageFromIFrame()) {
          settings[iframeId].firstRun = false;
          actionMsg();
        }
      }
    }
  }

  function getPagePosition() {
    if (null === pagePosition) {
      pagePosition = {
        x: window.pageXOffset !== undefined ? window.pageXOffset : document.documentElement.scrollLeft,
        y: window.pageYOffset !== undefined ? window.pageYOffset : document.documentElement.scrollTop
      };
      log(' Get page position: ' + pagePosition.x + ',' + pagePosition.y);
    }
  }

  function setPagePosition() {
    if (null !== pagePosition) {
      window.scrollTo(pagePosition.x, pagePosition.y);
      log(' Set page position: ' + pagePosition.x + ',' + pagePosition.y);
      pagePosition = null;
    }
  }

  function resetIFrame(messageData) {
    function reset() {
      setSize(messageData);
      trigger('reset', 'reset', messageData.iframe, messageData.id);
    }

    log(' Size reset requested by ' + ('init' === messageData.type ? 'host page' : 'iFrame'));
    getPagePosition();
    syncResize(reset, messageData, 'init');
  }

  function setSize(messageData) {
    function setDimension(dimension) {
      messageData.iframe.style[dimension] = messageData[dimension] + 'px';
      log(' IFrame (' + iframeId + ') ' + dimension + ' set to ' + messageData[dimension] + 'px');
    }
    var iframeId = messageData.iframe.id;
    if (settings[iframeId].sizeHeight) {
      setDimension('height');
    }
    if (settings[iframeId].sizeWidth) {
      setDimension('width');
    }
  }

  function syncResize(func, messageData, doNotSync) {
    if (doNotSync !== messageData.type && requestAnimationFrame) {
      log(' Requesting animation frame');
      requestAnimationFrame(func);
    } else {
      func();
    }
  }

  function trigger(calleeMsg, msg, iframe, id) {
    if (iframe && iframe.contentWindow) {
      log('[' + calleeMsg + '] Sending msg to iframe (' + msg + ')');
      iframe.contentWindow.postMessage(msgId + msg, '*');
    } else {
      warn('[' + calleeMsg + '] IFrame not found');
      if (settings[id]) {
        delete settings[id];
      }
    }
  }

  function setupIFrame(options) {
    function setLimits() {
      function addStyle(style) {
        if (Infinity !== settings[iframeId][style] && 0 !== settings[iframeId][style]) {
          iframe.style[style] = settings[iframeId][style] + 'px';
          log(' Set ' + style + ' = ' + settings[iframeId][style] + 'px');
        }
      }

      addStyle('maxHeight');
      addStyle('minHeight');
      addStyle('maxWidth');
      addStyle('minWidth');
    }

    function ensureHasId(iframeId) {
      if ('' === iframeId) {
        iframe.id = iframeId = 'iFrameResizer' + count++;
        logEnabled = (options || {}).log;
        log(' Added missing iframe ID: ' + iframeId + ' (' + iframe.src + ')');
      }

      return iframeId;
    }

    function setScrolling() {
      log(' IFrame scrolling ' + (settings[iframeId].scrolling ? 'enabled' : 'disabled') + ' for ' + iframeId);
      iframe.style.overflow = false === settings[iframeId].scrolling ? 'hidden' : 'auto';
      iframe.scrolling = false === settings[iframeId].scrolling ? 'no' : 'yes';
    }

    //The V1 iFrame script expects an int, where as in V2 expects a CSS
    //string value such as '1px 3em', so if we have an int for V2, set V1=V2
    //and then convert V2 to a string PX value.
    function setupBodyMarginValues() {
      if ('number' === typeof settings[iframeId].bodyMargin || '0' === settings[iframeId].bodyMargin) {
        settings[iframeId].bodyMarginV1 = settings[iframeId].bodyMargin;
        settings[iframeId].bodyMargin = '' + settings[iframeId].bodyMargin + 'px';
      }
    }

    function createOutgoingMsg() {
      return iframeId + ':' + settings[iframeId].bodyMarginV1 + ':' + settings[iframeId].sizeWidth + ':' + settings[iframeId].log + ':' + settings[iframeId].interval + ':' + settings[iframeId].enablePublicMethods + ':' + settings[iframeId].autoResize + ':' + settings[iframeId].bodyMargin + ':' + settings[iframeId].heightCalculationMethod + ':' + settings[iframeId].bodyBackground + ':' + settings[iframeId].bodyPadding + ':' + settings[iframeId].tolerance + ':' + settings[iframeId].enableInPageLinks + ':' + settings[iframeId].resizeFrom;
    }

    function init(msg) {
      //We have to call trigger twice, as we can not be sure if all
      //iframes have completed loading when this code runs. The
      //event listener also catches the page changing in the iFrame.
      addEventListener(iframe, 'load', function () {
        var fr = settings[iframeId].firstRun; // Reduce scope of var to function, because IE8's JS execution
        // context stack is borked and this value gets externally
        // changed midway through running this function.
        trigger('iFrame.onload', msg, iframe);
        if (!fr && settings[iframeId].heightCalculationMethod in resetRequiredMethods) {
          resetIFrame({
            iframe: iframe,
            height: 0,
            width: 0,
            type: 'init'
          });
        }
      });
      trigger('init', msg, iframe);
    }

    function checkOptions(options) {
      if ('object' !== typeof options) {
        throw new TypeError('Options is not an object.');
      }
    }

    function processOptions(options) {
      options = options || {};
      settings[iframeId] = {
        firstRun: true
      };

      checkOptions(options);

      for (var option in defaults) {
        if (defaults.hasOwnProperty(option)) {
          settings[iframeId][option] = options.hasOwnProperty(option) ? options[option] : defaults[option];
        }
      }

      logEnabled = settings[iframeId].log;
    }

    var
    /*jshint validthis:true */
    iframe = this,
        iframeId = ensureHasId(iframe.id);

    processOptions(options);
    setScrolling();
    setLimits();
    setupBodyMarginValues();
    init(createOutgoingMsg());
  }

  function throttle(fn, time) {
    if (null === timer) {
      timer = setTimeout(function () {
        timer = null;
        fn();
      }, time);
    }
  }

  function winResize() {
    function isIFrameResizeEnabled(iframeId) {
      return 'parent' === settings[iframeId].resizeFrom && settings[iframeId].autoResize && !settings[iframeId].firstRun;
    }

    throttle(function () {
      for (var iframeId in settings) {
        if (isIFrameResizeEnabled(iframeId)) {
          trigger('Window resize', 'resize', document.getElementById(iframeId), iframeId);
        }
      }
    }, 66);
  }

  function factory() {
    function init(element, options) {
      if (!element.tagName) {
        throw new TypeError('Object is not a valid DOM element');
      } else if ('IFRAME' !== element.tagName.toUpperCase()) {
        throw new TypeError('Expected <IFRAME> tag, found <' + element.tagName + '>.');
      } else {
        setupIFrame.call(element, options);
      }
    }

    setupRequestAnimationFrame();
    addEventListener(window, 'message', iFrameListener);
    addEventListener(window, 'resize', winResize);

    return function iFrameResizeF(options, target) {
      switch (typeof target) {
        case 'undefined':
        case 'string':
          Array.prototype.forEach.call(document.querySelectorAll(target || 'iframe'), function (element) {
            init(element, options);
          });
          break;
        case 'object':
          init(target, options);
          break;
        default:
          throw new TypeError('Unexpected data type (' + typeof target + ').');
      }
    };
  }

  function createJQueryPublicMethod($) {
    $.fn.iFrameResize = function $iFrameResizeF(options) {
      return this.filter('iframe').each(function (index, element) {
        setupIFrame.call(element, options);
      }).end();
    };
  }

  window.iFrameResize = factory();

  // if (window.jQuery) { createJQueryPublicMethod(jQuery); }

  // if (typeof define === 'function' && define.amd) {
  //   define([],factory);
  // } else if (typeof module === 'object' && typeof module.exports === 'object') { //Node for browserfy
  //   module.exports = factory();
  // } else {
  //   window.iFrameResize = window.iFrameResize || factory();
  // }
})(window || {});

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvdnNhYXJpbmVuL1JlcG9zL2NoaWxkLXJlZnVnZWVzL25vZGVfbW9kdWxlcy9sdWNpZnktY29tcG9uZW50LWJ1aWxkZXIvc3JjL2pzL3Jlc2l6ZS5qc3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7O0FDVUEsWUFBWSxDQUFDOztBQUFiLENBQUMsQ0FBQyxVQUFTLE1BQU0sRUFBRTtBQUNqQixjQUFZLENBQUM7O0FBRWIsTUFDRSxLQUFLLEdBQW1CLENBQUM7TUFDekIsVUFBVSxHQUFjLEtBQUs7TUFDN0IsU0FBUyxHQUFlLFNBQVM7TUFDakMsWUFBWSxHQUFZLFNBQVMsQ0FBQyxNQUFNO01BQ3hDLEtBQUssR0FBbUIsZUFBZTs7O0FBQ3ZDLFVBQVEsR0FBZ0IsS0FBSyxDQUFDLE1BQU07TUFDcEMsWUFBWSxHQUFZLElBQUk7TUFDNUIscUJBQXFCLEdBQUcsTUFBTSxDQUFDLHFCQUFxQjtNQUNwRCxvQkFBb0IsR0FBSSxFQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsTUFBTSxFQUFDLENBQUMsRUFBQyxVQUFVLEVBQUMsQ0FBQyxFQUFDLHFCQUFxQixFQUFDLENBQUMsRUFBQztNQUM3RSxRQUFRLEdBQWdCLEVBQUU7TUFDMUIsS0FBSyxHQUFtQixJQUFJO01BRTVCLFFBQVEsR0FBZ0I7QUFDdEIsY0FBVSxFQUFrQixJQUFJO0FBQ2hDLGtCQUFjLEVBQWMsSUFBSTtBQUNoQyxjQUFVLEVBQWtCLElBQUk7QUFDaEMsZ0JBQVksRUFBZ0IsQ0FBQztBQUM3QixlQUFXLEVBQWlCLElBQUk7QUFDaEMsZUFBVyxFQUFpQixJQUFJO0FBQ2hDLHFCQUFpQixFQUFXLEtBQUs7QUFDakMsdUJBQW1CLEVBQVMsS0FBSztBQUNqQywyQkFBdUIsRUFBSyxRQUFRO0FBQ3BDLFlBQVEsRUFBb0IsRUFBRTtBQUM5QixPQUFHLEVBQXlCLEtBQUs7QUFDakMsYUFBUyxFQUFt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Iiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbi8qXG4gKiBGaWxlOiBpZnJhbWVSZXNpemVyLmpzXG4gKiBEZXNjOiBGb3JjZSBpZnJhbWVzIHRvIHNpemUgdG8gY29udGVudC5cbiAqIFJlcXVpcmVzOiBpZnJhbWVSZXNpemVyLmNvbnRlbnRXaW5kb3cuanMgdG8gYmUgbG9hZGVkIGludG8gdGhlIHRhcmdldCBmcmFtZS5cbiAqIERvYzogaHR0cHM6Ly9naXRodWIuY29tL2RhdmlkamJyYWRzaGF3L2lmcmFtZS1yZXNpemVyXG4gKiBBdXRob3I6IERhdmlkIEouIEJyYWRzaGF3IC0gZGF2ZUBicmFkc2hhdy5uZXRcbiAqIENvbnRyaWJ1dG9yOiBKdXJlIE1hdiAtIGp1cmUubWF2QGdtYWlsLmNvbVxuICogQ29udHJpYnV0b3I6IFJlZWQgRGFkb3VuZSAtIHJlZWRAZGFkb3VuZS5jb21cbiAqL1xuOyhmdW5jdGlvbih3aW5kb3cpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhclxuICAgIGNvdW50ICAgICAgICAgICAgICAgICA9IDAsXG4gICAgbG9nRW5hYmxlZCAgICAgICAgICAgID0gZmFsc2UsXG4gICAgbXNnSGVhZGVyICAgICAgICAgICAgID0gJ21lc3NhZ2UnLFxuICAgIG1zZ0hlYWRlckxlbiAgICAgICAgICA9IG1zZ0hlYWRlci5sZW5ndGgsXG4gICAgbXNnSWQgICAgICAgICAgICAgICAgID0gJ1tpRnJhbWVTaXplcl0nLCAvL011c3QgbWF0Y2ggaWZyYW1lIG1zZyBJRFxuICAgIG1zZ0lkTGVuICAgICAgICAgICAgICA9IG1zZ0lkLmxlbmd0aCxcbiAgICBwYWdlUG9zaXRpb24gICAgICAgICAgPSBudWxsLFxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gICAgcmVzZXRSZXF1aXJlZE1ldGhvZHMgID0ge21heDoxLHNjcm9sbDoxLGJvZHlTY3JvbGw6MSxkb2N1bWVudEVsZW1lbnRTY3JvbGw6MX0sXG4gICAgc2V0dGluZ3MgICAgICAgICAgICAgID0ge30sXG4gICAgdGltZXIgICAgICAgICAgICAgICAgID0gbnVsbCxcblxuICAgIGRlZmF1bHRzICAgICAgICAgICAgICA9IHtcbiAgICAgIGF1dG9SZXNpemUgICAgICAgICAgICAgICAgOiB0cnVlLFxuICAgICAgYm9keUJhY2tncm91bmQgICAgICAgICAgICA6IG51bGwsXG4gICAgICBib2R5TWFyZ2luICAgICAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIGJvZHlNYXJnaW5WMSAgICAgICAgICAgICAgOiA4LFxuICAgICAgYm9keVBhZGRpbmcgICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICBjaGVja09yaWdpbiAgICAgICAgICAgICAgIDogdHJ1ZSxcbiAgICAgIGVuYWJsZUluUGFnZUxpbmtzICAgICAgICAgOiBmYWxzZSxcbiAgICAgIGVuYWJsZVB1YmxpY01ldGhvZHMgICAgICAgOiBmYWxzZSxcbiAgICAgIGhlaWdodENhbGN1bGF0aW9uTWV0aG9kICAgOiAnb2Zmc2V0JyxcbiAgICAgIGludGVydmFsICAgICAgICAgICAgICAgICAgOiAzMixcbiAgICAgIGxvZyAgICAgICAgICAgICAgICAgICAgICAgOiBmYWxzZSxcbiAgICAgIG1heEhlaWdodCAgICAgICAgICAgICAgICAgOiBJbmZpbml0eSxcbiAgICAgIG1heFdpZHRoICAgICAgICAgICAgICAgICAgOiBJbmZpbml0eSxcbiAgICAgIG1pbkhlaWdodCAgICAgICAgICAgICAgICAgOiAwLFxuICAgICAgbWluV2lkdGggICAgICAgICAgICAgICAgICA6IDAsXG4gICAgICByZXNpemVGcm9tICAgICAgICAgICAgICAgIDogJ3BhcmVudCcsXG4gICAgICBzY3JvbGxpbmcgICAgICAgICAgICAgICAgIDogZmFsc2UsXG4gICAgICBzaXplSGVpZ2h0ICAgICAgICAgICAgICAgIDogdHJ1ZSxcbiAgICAgIHNpemVXaWR0aCAgICAgICAgICAgICAgICAgOiBmYWxzZSxcbiAgICAgIHRvbGVyYW5jZSAgICAgICAgICAgICAgICAgOiAwLFxuICAgICAgY2xvc2VkQ2FsbGJhY2sgICAgICAgICAgICA6IGZ1bmN0aW9uKCl7fSxcbiAgICAgIGluaXRDYWxsYmFjayAgICAgICAgICAgICAgOiBmdW5jdGlvbigpe30sXG4gICAgICBtZXNzYWdlQ2FsbGJhY2sgICAgICAgICAgIDogZnVuY3Rpb24oKXt9LFxuICAgICAgcmVzaXplZENhbGxiYWNrICAgICAgICAgICA6IGZ1bmN0aW9uKCl7fSxcbiAgICAgIHNjcm9sbENhbGxiYWNrICAgICAgICAgICAgOiBmdW5jdGlvbigpe3JldHVybiB0cnVlO31cbiAgICB9O1xuXG4gIGZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXIob2JqLGV2dCxmdW5jKXtcbiAgICBpZiAoJ2FkZEV2ZW50TGlzdGVuZXInIGluIHdpbmRvdyl7XG4gICAgICBvYmouYWRkRXZlbnRMaXN0ZW5lcihldnQsZnVuYywgZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAoJ2F0dGFjaEV2ZW50JyBpbiB3aW5kb3cpey8vSUVcbiAgICAgIG9iai5hdHRhY2hFdmVudCgnb24nK2V2dCxmdW5jKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXR1cFJlcXVlc3RBbmltYXRpb25GcmFtZSgpe1xuICAgIHZhclxuICAgICAgdmVuZG9ycyA9IFsnbW96JywgJ3dlYmtpdCcsICdvJywgJ21zJ10sXG4gICAgICB4O1xuXG4gICAgLy8gUmVtb3ZlIHZlbmRvciBwcmVmaXhpbmcgaWYgcHJlZml4ZWQgYW5kIGJyZWFrIGVhcmx5IGlmIG5vdFxuICAgIGZvciAoeCA9IDA7IHggPCB2ZW5kb3JzLmxlbmd0aCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lOyB4ICs9IDEpIHtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW3hdICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgIH1cblxuICAgIGlmICghKHJlcXVlc3RBbmltYXRpb25GcmFtZSkpe1xuICAgICAgbG9nKCcgUmVxdWVzdEFuaW1hdGlvbkZyYW1lIG5vdCBzdXBwb3J0ZWQnKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRNeUlEKCl7XG4gICAgdmFyIHJldFN0ciA9ICdIb3N0IHBhZ2UnO1xuXG4gICAgaWYgKHdpbmRvdy50b3AhPT13aW5kb3cuc2VsZil7XG4gICAgICBpZiAod2luZG93LnBhcmVudElGcmFtZSl7XG4gICAgICAgIHJldFN0ciA9IHdpbmRvdy5wYXJlbnRJRnJhbWUuZ2V0SWQoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldFN0ciA9ICdOZXN0ZWQgaG9zdCBwYWdlJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0U3RyO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9ybWF0TG9nTXNnKG1zZyl7XG4gICAgcmV0dXJuIG1zZ0lkICsgJ1snICsgZ2V0TXlJRCgpICsgJ10nICsgbXNnO1xuICB9XG5cbiAgZnVuY3Rpb24gbG9nKG1zZyl7XG4gICAgaWYgKGxvZ0VuYWJsZWQgJiYgKCdvYmplY3QnID09PSB0eXBlb2Ygd2luZG93LmNvbnNvbGUpKXtcbiAgICAgIGNvbnNvbGUubG9nKGZvcm1hdExvZ01zZyhtc2cpKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3YXJuKG1zZyl7XG4gICAgaWYgKCdvYmplY3QnID09PSB0eXBlb2Ygd2luZG93LmNvbnNvbGUpe1xuICAgICAgY29uc29sZS53YXJuKGZvcm1hdExvZ01zZyhtc2cpKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpRnJhbWVMaXN0ZW5lcihldmVudCl7XG4gICAgZnVuY3Rpb24gcmVzaXplSUZyYW1lKCl7XG4gICAgICBmdW5jdGlvbiByZXNpemUoKXtcbiAgICAgICAgc2V0U2l6ZShtZXNzYWdlRGF0YSk7XG4gICAgICAgIHNldFBhZ2VQb3NpdGlvbigpO1xuICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0ucmVzaXplZENhbGxiYWNrKG1lc3NhZ2VEYXRhKTtcbiAgICAgIH1cblxuICAgICAgZW5zdXJlSW5SYW5nZSgnSGVpZ2h0Jyk7XG4gICAgICBlbnN1cmVJblJhbmdlKCdXaWR0aCcpO1xuXG4gICAgICBzeW5jUmVzaXplKHJlc2l6ZSxtZXNzYWdlRGF0YSwncmVzZXRQYWdlJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xvc2VJRnJhbWUoaWZyYW1lKXtcbiAgICAgIHZhciBpZnJhbWVJZCA9IGlmcmFtZS5pZDtcblxuICAgICAgbG9nKCcgUmVtb3ZpbmcgaUZyYW1lOiAnK2lmcmFtZUlkKTtcbiAgICAgIGlmcmFtZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uY2xvc2VkQ2FsbGJhY2soaWZyYW1lSWQpO1xuICAgICAgZGVsZXRlIHNldHRpbmdzW2lmcmFtZUlkXTtcbiAgICAgIGxvZygnIC0tJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJvY2Vzc01zZygpe1xuICAgICAgdmFyIGRhdGEgPSBtc2cuc3Vic3RyKG1zZ0lkTGVuKS5zcGxpdCgnOicpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBpZnJhbWU6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGRhdGFbMF0pLFxuICAgICAgICBpZDogICAgIGRhdGFbMF0sXG4gICAgICAgIGhlaWdodDogZGF0YVsxXSxcbiAgICAgICAgd2lkdGg6ICBkYXRhWzJdLFxuICAgICAgICB0eXBlOiAgIGRhdGFbM11cbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5zdXJlSW5SYW5nZShEaW1lbnNpb24pe1xuICAgICAgdmFyXG4gICAgICAgIG1heCAgPSBOdW1iZXIoc2V0dGluZ3NbaWZyYW1lSWRdWydtYXgnK0RpbWVuc2lvbl0pLFxuICAgICAgICBtaW4gID0gTnVtYmVyKHNldHRpbmdzW2lmcmFtZUlkXVsnbWluJytEaW1lbnNpb25dKSxcbiAgICAgICAgZGltZW5zaW9uID0gRGltZW5zaW9uLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIHNpemUgPSBOdW1iZXIobWVzc2FnZURhdGFbZGltZW5zaW9uXSk7XG5cbiAgICAgIGlmIChtaW4+bWF4KXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWYWx1ZSBmb3IgbWluJytEaW1lbnNpb24rJyBjYW4gbm90IGJlIGdyZWF0ZXIgdGhhbiBtYXgnK0RpbWVuc2lvbik7XG4gICAgICB9XG5cbiAgICAgIGxvZygnIENoZWNraW5nICcrZGltZW5zaW9uKycgaXMgaW4gcmFuZ2UgJyttaW4rJy0nK21heCk7XG5cbiAgICAgIGlmIChzaXplPG1pbikge1xuICAgICAgICBzaXplPW1pbjtcbiAgICAgICAgbG9nKCcgU2V0ICcrZGltZW5zaW9uKycgdG8gbWluIHZhbHVlJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzaXplPm1heCkge1xuICAgICAgICBzaXplPW1heDtcbiAgICAgICAgbG9nKCcgU2V0ICcrZGltZW5zaW9uKycgdG8gbWF4IHZhbHVlJyk7XG4gICAgICB9XG5cbiAgICAgIG1lc3NhZ2VEYXRhW2RpbWVuc2lvbl09Jycrc2l6ZTtcbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGlzTWVzc2FnZUZyb21JRnJhbWUoKXtcbiAgICAgIGZ1bmN0aW9uIGNoZWNrQWxsb3dlZE9yaWdpbigpe1xuICAgICAgICBmdW5jdGlvbiBjaGVja0xpc3QoKXtcbiAgICAgICAgICBsb2coJyBDaGVja2luZyBjb25uZWN0aW9uIGlzIGZyb20gYWxsb3dlZCBsaXN0IG9mIG9yaWdpbnM6ICcgKyBjaGVja09yaWdpbik7XG4gICAgICAgICAgdmFyIGk7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNoZWNrT3JpZ2luLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY2hlY2tPcmlnaW5baV0gPT09IG9yaWdpbikge1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2hlY2tTaW5nbGUoKXtcbiAgICAgICAgICBsb2coJyBDaGVja2luZyBjb25uZWN0aW9uIGlzIGZyb206ICcrcmVtb3RlSG9zdCk7XG4gICAgICAgICAgcmV0dXJuIG9yaWdpbiA9PT0gcmVtb3RlSG9zdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGVja09yaWdpbi5jb25zdHJ1Y3RvciA9PT0gQXJyYXkgPyBjaGVja0xpc3QoKSA6IGNoZWNrU2luZ2xlKCk7XG4gICAgICB9XG5cbiAgICAgIHZhclxuICAgICAgICBvcmlnaW4gICAgICA9IGV2ZW50Lm9yaWdpbixcbiAgICAgICAgY2hlY2tPcmlnaW4gPSBzZXR0aW5nc1tpZnJhbWVJZF0uY2hlY2tPcmlnaW4sXG4gICAgICAgIHJlbW90ZUhvc3QgID0gbWVzc2FnZURhdGEuaWZyYW1lLnNyYy5zcGxpdCgnLycpLnNsaWNlKDAsMykuam9pbignLycpO1xuXG4gICAgICBpZiAoY2hlY2tPcmlnaW4pIHtcbiAgICAgICAgaWYgKCgnJytvcmlnaW4gIT09ICdudWxsJykgJiYgIWNoZWNrQWxsb3dlZE9yaWdpbigpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ1VuZXhwZWN0ZWQgbWVzc2FnZSByZWNlaXZlZCBmcm9tOiAnICsgb3JpZ2luICtcbiAgICAgICAgICAgICcgZm9yICcgKyBtZXNzYWdlRGF0YS5pZnJhbWUuaWQgK1xuICAgICAgICAgICAgJy4gTWVzc2FnZSB3YXM6ICcgKyBldmVudC5kYXRhICtcbiAgICAgICAgICAgICcuIFRoaXMgZXJyb3IgY2FuIGJlIGRpc2FibGVkIGJ5IHNldHRpbmcgdGhlIGNoZWNrT3JpZ2luOiBmYWxzZSBvcHRpb24gb3IgYnkgcHJvdmlkaW5nIG9mIGFycmF5IG9mIHRydXN0ZWQgZG9tYWlucy4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc01lc3NhZ2VGb3JVcygpe1xuICAgICAgcmV0dXJuIG1zZ0lkID09PSAoJycgKyBtc2cpLnN1YnN0cigwLG1zZ0lkTGVuKTsgLy8nJytQcm90ZWN0cyBhZ2FpbnN0IG5vbi1zdHJpbmcgbXNnXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNNZXNzYWdlRnJvbU1ldGFQYXJlbnQoKXtcbiAgICAgIC8vVGVzdCBpZiB0aGlzIG1lc3NhZ2UgaXMgZnJvbSBhIHBhcmVudCBhYm92ZSB1cy4gVGhpcyBpcyBhbiB1Z2x5IHRlc3QsIGhvd2V2ZXIsIHVwZGF0aW5nXG4gICAgICAvL3RoZSBtZXNzYWdlIGZvcm1hdCB3b3VsZCBicmVhayBiYWNrd2FyZHMgY29tcGF0aWJpdHkuXG4gICAgICB2YXIgcmV0Q29kZSA9IG1lc3NhZ2VEYXRhLnR5cGUgaW4geyd0cnVlJzoxLCdmYWxzZSc6MSwndW5kZWZpbmVkJzoxfTtcblxuICAgICAgaWYgKHJldENvZGUpe1xuICAgICAgICBsb2coJyBJZ25vcmluZyBpbml0IG1lc3NhZ2UgZnJvbSBtZXRhIHBhcmVudCBwYWdlJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXRDb2RlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE1zZ0JvZHkob2Zmc2V0KXtcbiAgICAgIHJldHVybiBtc2cuc3Vic3RyKG1zZy5pbmRleE9mKCc6JykrbXNnSGVhZGVyTGVuK29mZnNldCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZm9yd2FyZE1zZ0Zyb21JRnJhbWUobXNnQm9keSl7XG4gICAgICBsb2coJyBNZXNzYWdlQ2FsbGJhY2sgcGFzc2VkOiB7aWZyYW1lOiAnKyBtZXNzYWdlRGF0YS5pZnJhbWUuaWQgKyAnLCBtZXNzYWdlOiAnICsgbXNnQm9keSArICd9Jyk7XG4gICAgICBzZXR0aW5nc1tpZnJhbWVJZF0ubWVzc2FnZUNhbGxiYWNrKHtcbiAgICAgICAgaWZyYW1lOiBtZXNzYWdlRGF0YS5pZnJhbWUsXG4gICAgICAgIG1lc3NhZ2U6IEpTT04ucGFyc2UobXNnQm9keSlcbiAgICAgIH0pO1xuICAgICAgbG9nKCcgLS0nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja0lGcmFtZUV4aXN0cygpe1xuICAgICAgaWYgKG51bGwgPT09IG1lc3NhZ2VEYXRhLmlmcmFtZSkge1xuICAgICAgICB3YXJuKCcgSUZyYW1lICgnK21lc3NhZ2VEYXRhLmlkKycpIG5vdCBmb3VuZCcpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRFbGVtZW50UG9zaXRpb24odGFyZ2V0KXtcbiAgICAgIHZhclxuICAgICAgICBpRnJhbWVQb3NpdGlvbiA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgZ2V0UGFnZVBvc2l0aW9uKCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHg6IHBhcnNlSW50KGlGcmFtZVBvc2l0aW9uLmxlZnQsIDEwKSArIHBhcnNlSW50KHBhZ2VQb3NpdGlvbi54LCAxMCksXG4gICAgICAgIHk6IHBhcnNlSW50KGlGcmFtZVBvc2l0aW9uLnRvcCwgMTApICArIHBhcnNlSW50KHBhZ2VQb3NpdGlvbi55LCAxMClcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2Nyb2xsUmVxdWVzdEZyb21DaGlsZChhZGRPZmZzZXQpe1xuICAgICAgZnVuY3Rpb24gcmVwb3NpdGlvbigpe1xuICAgICAgICBwYWdlUG9zaXRpb24gPSBuZXdQb3NpdGlvbjtcblxuICAgICAgICBzY3JvbGxUbygpO1xuXG4gICAgICAgIGxvZygnIC0tJyk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNhbGNPZmZzZXQoKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB4OiBOdW1iZXIobWVzc2FnZURhdGEud2lkdGgpICsgb2Zmc2V0LngsXG4gICAgICAgICAgeTogTnVtYmVyKG1lc3NhZ2VEYXRhLmhlaWdodCkgKyBvZmZzZXQueVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB2YXJcbiAgICAgICAgb2Zmc2V0ID0gYWRkT2Zmc2V0ID8gZ2V0RWxlbWVudFBvc2l0aW9uKG1lc3NhZ2VEYXRhLmlmcmFtZSkgOiB7eDowLHk6MH0sXG4gICAgICAgIG5ld1Bvc2l0aW9uID0gY2FsY09mZnNldCgpO1xuXG4gICAgICBsb2coJyBSZXBvc2l0aW9uIHJlcXVlc3RlZCBmcm9tIGlGcmFtZSAob2Zmc2V0IHg6JytvZmZzZXQueCsnIHk6JytvZmZzZXQueSsnKScpO1xuXG4gICAgICBpZih3aW5kb3cudG9wIT09d2luZG93LnNlbGYpe1xuICAgICAgICBpZiAod2luZG93LnBhcmVudElGcmFtZSl7XG4gICAgICAgICAgaWYgKGFkZE9mZnNldCl7XG4gICAgICAgICAgICB3aW5kb3cucGFyZW50SUZyYW1lLnNjcm9sbFRvT2Zmc2V0KG5ld1Bvc2l0aW9uLngsbmV3UG9zaXRpb24ueSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5wYXJlbnRJRnJhbWUuc2Nyb2xsVG8obWVzc2FnZURhdGEud2lkdGgsbWVzc2FnZURhdGEuaGVpZ2h0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2FybignIFVuYWJsZSB0byBzY3JvbGwgdG8gcmVxdWVzdGVkIHBvc2l0aW9uLCB3aW5kb3cucGFyZW50SUZyYW1lIG5vdCBmb3VuZCcpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXBvc2l0aW9uKCk7XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY3JvbGxUbygpe1xuICAgICAgaWYgKGZhbHNlICE9PSBzZXR0aW5nc1tpZnJhbWVJZF0uc2Nyb2xsQ2FsbGJhY2socGFnZVBvc2l0aW9uKSl7XG4gICAgICAgIHNldFBhZ2VQb3NpdGlvbigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbmRUYXJnZXQobG9jYXRpb24pe1xuICAgICAgZnVuY3Rpb24ganVtcFRvVGFyZ2V0KHRhcmdldCl7XG4gICAgICAgIHZhciBqdW1wUG9zaXRpb24gPSBnZXRFbGVtZW50UG9zaXRpb24odGFyZ2V0KTtcblxuICAgICAgICBsb2coJyBNb3ZpbmcgdG8gaW4gcGFnZSBsaW5rICgjJytoYXNoKycpIGF0IHg6ICcranVtcFBvc2l0aW9uLngrJyB5OiAnK2p1bXBQb3NpdGlvbi55KTtcbiAgICAgICAgcGFnZVBvc2l0aW9uID0ge1xuICAgICAgICAgIHg6IGp1bXBQb3NpdGlvbi54LFxuICAgICAgICAgIHk6IGp1bXBQb3NpdGlvbi55XG4gICAgICAgIH07XG5cbiAgICAgICAgc2Nyb2xsVG8oKTtcbiAgICAgICAgbG9nKCcgLS0nKTtcbiAgICAgIH1cblxuICAgICAgdmFyXG4gICAgICAgIGhhc2ggICAgID0gbG9jYXRpb24uc3BsaXQoJyMnKVsxXSB8fCAnJyxcbiAgICAgICAgaGFzaERhdGEgPSBkZWNvZGVVUklDb21wb25lbnQoaGFzaCksXG4gICAgICAgIHRhcmdldCAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaGFzaERhdGEpIHx8IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKGhhc2hEYXRhKVswXTtcblxuICAgICAgaWYod2luZG93LnRvcCE9PXdpbmRvdy5zZWxmKXtcbiAgICAgICAgaWYgKHdpbmRvdy5wYXJlbnRJRnJhbWUpe1xuICAgICAgICAgIHdpbmRvdy5wYXJlbnRJRnJhbWUubW92ZVRvQW5jaG9yKGhhc2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZygnIEluIHBhZ2UgbGluayAjJytoYXNoKycgbm90IGZvdW5kIGFuZCB3aW5kb3cucGFyZW50SUZyYW1lIG5vdCBmb3VuZCcpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRhcmdldCl7XG4gICAgICAgIGp1bXBUb1RhcmdldCh0YXJnZXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9nKCcgSW4gcGFnZSBsaW5rICMnK2hhc2grJyBub3QgZm91bmQnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhY3Rpb25Nc2coKXtcbiAgICAgIHN3aXRjaChtZXNzYWdlRGF0YS50eXBlKXtcbiAgICAgICAgY2FzZSAnY2xvc2UnOlxuICAgICAgICAgIGNsb3NlSUZyYW1lKG1lc3NhZ2VEYXRhLmlmcmFtZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ21lc3NhZ2UnOlxuICAgICAgICAgIGZvcndhcmRNc2dGcm9tSUZyYW1lKGdldE1zZ0JvZHkoNikpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzY3JvbGxUbyc6XG4gICAgICAgICAgc2Nyb2xsUmVxdWVzdEZyb21DaGlsZChmYWxzZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3Njcm9sbFRvT2Zmc2V0JzpcbiAgICAgICAgICBzY3JvbGxSZXF1ZXN0RnJvbUNoaWxkKHRydWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdpblBhZ2VMaW5rJzpcbiAgICAgICAgICBmaW5kVGFyZ2V0KGdldE1zZ0JvZHkoOSkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyZXNldCc6XG4gICAgICAgICAgcmVzZXRJRnJhbWUobWVzc2FnZURhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdpbml0JzpcbiAgICAgICAgICByZXNpemVJRnJhbWUoKTtcbiAgICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uaW5pdENhbGxiYWNrKG1lc3NhZ2VEYXRhLmlmcmFtZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmVzaXplSUZyYW1lKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFzU2V0dGluZ3MoaWZyYW1lSWQpe1xuICAgICAgdmFyIHJldEJvb2wgPSB0cnVlO1xuXG4gICAgICBpZiAoIXNldHRpbmdzW2lmcmFtZUlkXSl7XG4gICAgICAgIHJldEJvb2wgPSBmYWxzZTtcbiAgICAgICAgd2FybihtZXNzYWdlRGF0YS50eXBlICsgJyBObyBzZXR0aW5ncyBmb3IgJyArIGlmcmFtZUlkICsgJy4gTWVzc2FnZSB3YXM6ICcgKyBtc2cpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmV0Qm9vbDtcbiAgICB9XG5cbiAgICB2YXJcbiAgICAgIG1zZyA9IGV2ZW50LmRhdGEsXG4gICAgICBtZXNzYWdlRGF0YSA9IHt9LFxuICAgICAgaWZyYW1lSWQgPSBudWxsO1xuXG4gICAgaWYgKGlzTWVzc2FnZUZvclVzKCkpe1xuICAgICAgbWVzc2FnZURhdGEgPSBwcm9jZXNzTXNnKCk7XG4gICAgICBpZnJhbWVJZCAgICA9IG1lc3NhZ2VEYXRhLmlkO1xuXG4gICAgICBpZiAoIWlzTWVzc2FnZUZyb21NZXRhUGFyZW50KCkgJiYgaGFzU2V0dGluZ3MoaWZyYW1lSWQpKXtcbiAgICAgICAgbG9nRW5hYmxlZCAgPSBzZXR0aW5nc1tpZnJhbWVJZF0ubG9nO1xuICAgICAgICBsb2coJyBSZWNlaXZlZDogJyttc2cpO1xuXG4gICAgICAgIGlmICggY2hlY2tJRnJhbWVFeGlzdHMoKSAmJiBpc01lc3NhZ2VGcm9tSUZyYW1lKCkgKXtcbiAgICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uZmlyc3RSdW4gPSBmYWxzZTtcbiAgICAgICAgICBhY3Rpb25Nc2coKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgZnVuY3Rpb24gZ2V0UGFnZVBvc2l0aW9uICgpe1xuICAgIGlmKG51bGwgPT09IHBhZ2VQb3NpdGlvbil7XG4gICAgICBwYWdlUG9zaXRpb24gPSB7XG4gICAgICAgIHg6ICh3aW5kb3cucGFnZVhPZmZzZXQgIT09IHVuZGVmaW5lZCkgPyB3aW5kb3cucGFnZVhPZmZzZXQgOiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCxcbiAgICAgICAgeTogKHdpbmRvdy5wYWdlWU9mZnNldCAhPT0gdW5kZWZpbmVkKSA/IHdpbmRvdy5wYWdlWU9mZnNldCA6IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3BcbiAgICAgIH07XG4gICAgICBsb2coJyBHZXQgcGFnZSBwb3NpdGlvbjogJytwYWdlUG9zaXRpb24ueCsnLCcrcGFnZVBvc2l0aW9uLnkpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFBhZ2VQb3NpdGlvbigpe1xuICAgIGlmKG51bGwgIT09IHBhZ2VQb3NpdGlvbil7XG4gICAgICB3aW5kb3cuc2Nyb2xsVG8ocGFnZVBvc2l0aW9uLngscGFnZVBvc2l0aW9uLnkpO1xuICAgICAgbG9nKCcgU2V0IHBhZ2UgcG9zaXRpb246ICcrcGFnZVBvc2l0aW9uLngrJywnK3BhZ2VQb3NpdGlvbi55KTtcbiAgICAgIHBhZ2VQb3NpdGlvbiA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzZXRJRnJhbWUobWVzc2FnZURhdGEpe1xuICAgIGZ1bmN0aW9uIHJlc2V0KCl7XG4gICAgICBzZXRTaXplKG1lc3NhZ2VEYXRhKTtcbiAgICAgIHRyaWdnZXIoJ3Jlc2V0JywncmVzZXQnLG1lc3NhZ2VEYXRhLmlmcmFtZSxtZXNzYWdlRGF0YS5pZCk7XG4gICAgfVxuXG4gICAgbG9nKCcgU2l6ZSByZXNldCByZXF1ZXN0ZWQgYnkgJysoJ2luaXQnPT09bWVzc2FnZURhdGEudHlwZT8naG9zdCBwYWdlJzonaUZyYW1lJykpO1xuICAgIGdldFBhZ2VQb3NpdGlvbigpO1xuICAgIHN5bmNSZXNpemUocmVzZXQsbWVzc2FnZURhdGEsJ2luaXQnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFNpemUobWVzc2FnZURhdGEpe1xuICAgIGZ1bmN0aW9uIHNldERpbWVuc2lvbihkaW1lbnNpb24pe1xuICAgICAgbWVzc2FnZURhdGEuaWZyYW1lLnN0eWxlW2RpbWVuc2lvbl0gPSBtZXNzYWdlRGF0YVtkaW1lbnNpb25dICsgJ3B4JztcbiAgICAgIGxvZyhcbiAgICAgICAgJyBJRnJhbWUgKCcgKyBpZnJhbWVJZCArXG4gICAgICAgICcpICcgKyBkaW1lbnNpb24gK1xuICAgICAgICAnIHNldCB0byAnICsgbWVzc2FnZURhdGFbZGltZW5zaW9uXSArICdweCdcbiAgICAgICk7XG4gICAgfVxuICAgIHZhciBpZnJhbWVJZCA9IG1lc3NhZ2VEYXRhLmlmcmFtZS5pZDtcbiAgICBpZiggc2V0dGluZ3NbaWZyYW1lSWRdLnNpemVIZWlnaHQpIHsgc2V0RGltZW5zaW9uKCdoZWlnaHQnKTsgfVxuICAgIGlmKCBzZXR0aW5nc1tpZnJhbWVJZF0uc2l6ZVdpZHRoICkgeyBzZXREaW1lbnNpb24oJ3dpZHRoJyk7IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN5bmNSZXNpemUoZnVuYyxtZXNzYWdlRGF0YSxkb05vdFN5bmMpe1xuICAgIGlmKGRvTm90U3luYyE9PW1lc3NhZ2VEYXRhLnR5cGUgJiYgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKXtcbiAgICAgIGxvZygnIFJlcXVlc3RpbmcgYW5pbWF0aW9uIGZyYW1lJyk7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZ1bmMoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0cmlnZ2VyKGNhbGxlZU1zZyxtc2csaWZyYW1lLGlkKXtcbiAgICBpZihpZnJhbWUgJiYgaWZyYW1lLmNvbnRlbnRXaW5kb3cpe1xuICAgICAgbG9nKCdbJyArIGNhbGxlZU1zZyArICddIFNlbmRpbmcgbXNnIHRvIGlmcmFtZSAoJyttc2crJyknKTtcbiAgICAgIGlmcmFtZS5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKCBtc2dJZCArIG1zZywgJyonICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdhcm4oJ1snICsgY2FsbGVlTXNnICsgJ10gSUZyYW1lIG5vdCBmb3VuZCcpO1xuICAgICAgaWYoc2V0dGluZ3NbaWRdKSB7XG4gICAgICAgIGRlbGV0ZSBzZXR0aW5nc1tpZF07XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBmdW5jdGlvbiBzZXR1cElGcmFtZShvcHRpb25zKXtcbiAgICBmdW5jdGlvbiBzZXRMaW1pdHMoKXtcbiAgICAgIGZ1bmN0aW9uIGFkZFN0eWxlKHN0eWxlKXtcbiAgICAgICAgaWYgKChJbmZpbml0eSAhPT0gc2V0dGluZ3NbaWZyYW1lSWRdW3N0eWxlXSkgJiYgKDAgIT09IHNldHRpbmdzW2lmcmFtZUlkXVtzdHlsZV0pKXtcbiAgICAgICAgICBpZnJhbWUuc3R5bGVbc3R5bGVdID0gc2V0dGluZ3NbaWZyYW1lSWRdW3N0eWxlXSArICdweCc7XG4gICAgICAgICAgbG9nKCcgU2V0ICcrc3R5bGUrJyA9ICcrc2V0dGluZ3NbaWZyYW1lSWRdW3N0eWxlXSsncHgnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBhZGRTdHlsZSgnbWF4SGVpZ2h0Jyk7XG4gICAgICBhZGRTdHlsZSgnbWluSGVpZ2h0Jyk7XG4gICAgICBhZGRTdHlsZSgnbWF4V2lkdGgnKTtcbiAgICAgIGFkZFN0eWxlKCdtaW5XaWR0aCcpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuc3VyZUhhc0lkKGlmcmFtZUlkKXtcbiAgICAgIGlmICgnJz09PWlmcmFtZUlkKXtcbiAgICAgICAgaWZyYW1lLmlkID0gaWZyYW1lSWQgPSAnaUZyYW1lUmVzaXplcicgKyBjb3VudCsrO1xuICAgICAgICBsb2dFbmFibGVkID0gKG9wdGlvbnMgfHwge30pLmxvZztcbiAgICAgICAgbG9nKCcgQWRkZWQgbWlzc2luZyBpZnJhbWUgSUQ6ICcrIGlmcmFtZUlkICsnICgnICsgaWZyYW1lLnNyYyArICcpJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBpZnJhbWVJZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRTY3JvbGxpbmcoKXtcbiAgICAgIGxvZygnIElGcmFtZSBzY3JvbGxpbmcgJyArIChzZXR0aW5nc1tpZnJhbWVJZF0uc2Nyb2xsaW5nID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJykgKyAnIGZvciAnICsgaWZyYW1lSWQpO1xuICAgICAgaWZyYW1lLnN0eWxlLm92ZXJmbG93ID0gZmFsc2UgPT09IHNldHRpbmdzW2lmcmFtZUlkXS5zY3JvbGxpbmcgPyAnaGlkZGVuJyA6ICdhdXRvJztcbiAgICAgIGlmcmFtZS5zY3JvbGxpbmcgICAgICA9IGZhbHNlID09PSBzZXR0aW5nc1tpZnJhbWVJZF0uc2Nyb2xsaW5nID8gJ25vJyA6ICd5ZXMnO1xuICAgIH1cblxuICAgIC8vVGhlIFYxIGlGcmFtZSBzY3JpcHQgZXhwZWN0cyBhbiBpbnQsIHdoZXJlIGFzIGluIFYyIGV4cGVjdHMgYSBDU1NcbiAgICAvL3N0cmluZyB2YWx1ZSBzdWNoIGFzICcxcHggM2VtJywgc28gaWYgd2UgaGF2ZSBhbiBpbnQgZm9yIFYyLCBzZXQgVjE9VjJcbiAgICAvL2FuZCB0aGVuIGNvbnZlcnQgVjIgdG8gYSBzdHJpbmcgUFggdmFsdWUuXG4gICAgZnVuY3Rpb24gc2V0dXBCb2R5TWFyZ2luVmFsdWVzKCl7XG4gICAgICBpZiAoKCdudW1iZXInPT09dHlwZW9mKHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luKSkgfHwgKCcwJz09PXNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luKSl7XG4gICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luVjEgPSBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbjtcbiAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW4gICA9ICcnICsgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW4gKyAncHgnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZU91dGdvaW5nTXNnKCl7XG4gICAgICByZXR1cm4gaWZyYW1lSWQgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpblYxICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLnNpemVXaWR0aCArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5sb2cgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uaW50ZXJ2YWwgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uZW5hYmxlUHVibGljTWV0aG9kcyArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5hdXRvUmVzaXplICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW4gK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uaGVpZ2h0Q2FsY3VsYXRpb25NZXRob2QgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keUJhY2tncm91bmQgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keVBhZGRpbmcgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0udG9sZXJhbmNlICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmVuYWJsZUluUGFnZUxpbmtzICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLnJlc2l6ZUZyb207XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdChtc2cpe1xuICAgICAgLy9XZSBoYXZlIHRvIGNhbGwgdHJpZ2dlciB0d2ljZSwgYXMgd2UgY2FuIG5vdCBiZSBzdXJlIGlmIGFsbFxuICAgICAgLy9pZnJhbWVzIGhhdmUgY29tcGxldGVkIGxvYWRpbmcgd2hlbiB0aGlzIGNvZGUgcnVucy4gVGhlXG4gICAgICAvL2V2ZW50IGxpc3RlbmVyIGFsc28gY2F0Y2hlcyB0aGUgcGFnZSBjaGFuZ2luZyBpbiB0aGUgaUZyYW1lLlxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihpZnJhbWUsJ2xvYWQnLGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBmciA9IHNldHRpbmdzW2lmcmFtZUlkXS5maXJzdFJ1bjsgICAvLyBSZWR1Y2Ugc2NvcGUgb2YgdmFyIHRvIGZ1bmN0aW9uLCBiZWNhdXNlIElFOCdzIEpTIGV4ZWN1dGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjb250ZXh0IHN0YWNrIGlzIGJvcmtlZCBhbmQgdGhpcyB2YWx1ZSBnZXRzIGV4dGVybmFsbHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2hhbmdlZCBtaWR3YXkgdGhyb3VnaCBydW5uaW5nIHRoaXMgZnVuY3Rpb24uXG4gICAgICAgIHRyaWdnZXIoJ2lGcmFtZS5vbmxvYWQnLG1zZyxpZnJhbWUpO1xuICAgICAgICBpZiAoIWZyICYmIHNldHRpbmdzW2lmcmFtZUlkXS5oZWlnaHRDYWxjdWxhdGlvbk1ldGhvZCBpbiByZXNldFJlcXVpcmVkTWV0aG9kcyl7XG4gICAgICAgICAgcmVzZXRJRnJhbWUoe1xuICAgICAgICAgICAgaWZyYW1lOmlmcmFtZSxcbiAgICAgICAgICAgIGhlaWdodDowLFxuICAgICAgICAgICAgd2lkdGg6MCxcbiAgICAgICAgICAgIHR5cGU6J2luaXQnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdHJpZ2dlcignaW5pdCcsbXNnLGlmcmFtZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2tPcHRpb25zKG9wdGlvbnMpe1xuICAgICAgaWYgKCdvYmplY3QnICE9PSB0eXBlb2Ygb3B0aW9ucyl7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ09wdGlvbnMgaXMgbm90IGFuIG9iamVjdC4nKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzT3B0aW9ucyhvcHRpb25zKXtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdID0ge1xuICAgICAgICBmaXJzdFJ1bjogdHJ1ZVxuICAgICAgfTtcblxuICAgICAgY2hlY2tPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICBmb3IgKHZhciBvcHRpb24gaW4gZGVmYXVsdHMpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRzLmhhc093blByb3BlcnR5KG9wdGlvbikpe1xuICAgICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXVtvcHRpb25dID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShvcHRpb24pID8gb3B0aW9uc1tvcHRpb25dIDogZGVmYXVsdHNbb3B0aW9uXTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsb2dFbmFibGVkID0gc2V0dGluZ3NbaWZyYW1lSWRdLmxvZztcbiAgICB9XG5cbiAgICB2YXJcbiAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICBpZnJhbWUgICA9IHRoaXMsXG4gICAgICBpZnJhbWVJZCA9IGVuc3VyZUhhc0lkKGlmcmFtZS5pZCk7XG5cbiAgICBwcm9jZXNzT3B0aW9ucyhvcHRpb25zKTtcbiAgICBzZXRTY3JvbGxpbmcoKTtcbiAgICBzZXRMaW1pdHMoKTtcbiAgICBzZXR1cEJvZHlNYXJnaW5WYWx1ZXMoKTtcbiAgICBpbml0KGNyZWF0ZU91dGdvaW5nTXNnKCkpO1xuICB9XG5cbiAgZnVuY3Rpb24gdGhyb3R0bGUoZm4sdGltZSl7XG4gICAgaWYgKG51bGwgPT09IHRpbWVyKXtcbiAgICAgIHRpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICB0aW1lciA9IG51bGw7XG4gICAgICAgIGZuKCk7XG4gICAgICB9LCB0aW1lKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3aW5SZXNpemUoKXtcbiAgICBmdW5jdGlvbiBpc0lGcmFtZVJlc2l6ZUVuYWJsZWQoaWZyYW1lSWQpIHtcbiAgICAgIHJldHVybiAgJ3BhcmVudCcgPT09IHNldHRpbmdzW2lmcmFtZUlkXS5yZXNpemVGcm9tICYmXG4gICAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmF1dG9SZXNpemUgJiZcbiAgICAgICAgICAhc2V0dGluZ3NbaWZyYW1lSWRdLmZpcnN0UnVuO1xuICAgIH1cblxuICAgIHRocm90dGxlKGZ1bmN0aW9uKCl7XG4gICAgICBmb3IgKHZhciBpZnJhbWVJZCBpbiBzZXR0aW5ncyl7XG4gICAgICAgIGlmKGlzSUZyYW1lUmVzaXplRW5hYmxlZChpZnJhbWVJZCkpe1xuICAgICAgICAgIHRyaWdnZXIoJ1dpbmRvdyByZXNpemUnLCdyZXNpemUnLGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlmcmFtZUlkKSxpZnJhbWVJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LDY2KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZhY3RvcnkoKXtcbiAgICBmdW5jdGlvbiBpbml0KGVsZW1lbnQsIG9wdGlvbnMpe1xuICAgICAgaWYoIWVsZW1lbnQudGFnTmFtZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdPYmplY3QgaXMgbm90IGEgdmFsaWQgRE9NIGVsZW1lbnQnKTtcbiAgICAgIH0gZWxzZSBpZiAoJ0lGUkFNRScgIT09IGVsZW1lbnQudGFnTmFtZS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIDxJRlJBTUU+IHRhZywgZm91bmQgPCcrZWxlbWVudC50YWdOYW1lKyc+LicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0dXBJRnJhbWUuY2FsbChlbGVtZW50LCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZXR1cFJlcXVlc3RBbmltYXRpb25GcmFtZSgpO1xuICAgIGFkZEV2ZW50TGlzdGVuZXIod2luZG93LCdtZXNzYWdlJyxpRnJhbWVMaXN0ZW5lcik7XG4gICAgYWRkRXZlbnRMaXN0ZW5lcih3aW5kb3csJ3Jlc2l6ZScsIHdpblJlc2l6ZSk7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gaUZyYW1lUmVzaXplRihvcHRpb25zLHRhcmdldCl7XG4gICAgICBzd2l0Y2ggKHR5cGVvZih0YXJnZXQpKXtcbiAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCB0YXJnZXQgfHwgJ2lmcmFtZScgKSwgZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgICBpbml0KGVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICBpbml0KHRhcmdldCwgb3B0aW9ucyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5leHBlY3RlZCBkYXRhIHR5cGUgKCcrdHlwZW9mKHRhcmdldCkrJykuJyk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUpRdWVyeVB1YmxpY01ldGhvZCgkKXtcbiAgICAkLmZuLmlGcmFtZVJlc2l6ZSA9IGZ1bmN0aW9uICRpRnJhbWVSZXNpemVGKG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiB0aGlzLmZpbHRlcignaWZyYW1lJykuZWFjaChmdW5jdGlvbiAoaW5kZXgsIGVsZW1lbnQpIHtcbiAgICAgICAgc2V0dXBJRnJhbWUuY2FsbChlbGVtZW50LCBvcHRpb25zKTtcbiAgICAgIH0pLmVuZCgpO1xuICAgIH07XG4gIH1cblxuICB3aW5kb3cuaUZyYW1lUmVzaXplID0gZmFjdG9yeSgpO1xuXG4gIC8vIGlmICh3aW5kb3cualF1ZXJ5KSB7IGNyZWF0ZUpRdWVyeVB1YmxpY01ldGhvZChqUXVlcnkpOyB9XG5cbiAgLy8gaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAvLyAgIGRlZmluZShbXSxmYWN0b3J5KTtcbiAgLy8gfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09ICdvYmplY3QnKSB7IC8vTm9kZSBmb3IgYnJvd3NlcmZ5XG4gIC8vICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gIC8vIH0gZWxzZSB7XG4gIC8vICAgd2luZG93LmlGcmFtZVJlc2l6ZSA9IHdpbmRvdy5pRnJhbWVSZXNpemUgfHwgZmFjdG9yeSgpO1xuICAvLyB9XG5cbn0pKHdpbmRvdyB8fCB7fSk7XG4iXX0=
