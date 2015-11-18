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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvdnNhYXJpbmVuL1JlcG9zL2x1Y2lmeS11bmRlcmFnZS1yZWZ1Z2Vlcy9ub2RlX21vZHVsZXMvbHVjaWZ5LWNvbXBvbmVudC1idWlsZGVyL3NyYy9qcy9yZXNpemUuanN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7OztBQ1VBLFlBQVksQ0FBQzs7QUFBYixDQUFDLENBQUMsVUFBUyxNQUFNLEVBQUU7QUFDakIsY0FBWSxDQUFDOztBQUViLE1BQ0UsS0FBSyxHQUFtQixDQUFDO01BQ3pCLFVBQVUsR0FBYyxLQUFLO01BQzdCLFNBQVMsR0FBZSxTQUFTO01BQ2pDLFlBQVksR0FBWSxTQUFTLENBQUMsTUFBTTtNQUN4QyxLQUFLLEdBQW1CLGVBQWU7OztBQUN2QyxVQUFRLEdBQWdCLEtBQUssQ0FBQyxNQUFNO01BQ3BDLFlBQVksR0FBWSxJQUFJO01BQzVCLHFCQUFxQixHQUFHLE1BQU0sQ0FBQyxxQkFBcUI7TUFDcEQsb0JBQW9CLEdBQUksRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUMsVUFBVSxFQUFDLENBQUMsRUFBQyxxQkFBcUIsRUFBQyxDQUFDLEVBQUM7TUFDN0UsUUFBUSxHQUFnQixFQUFFO01BQzFCLEtBQUssR0FBbUIsSUFBSTtNQUU1QixRQUFRLEdBQWdCO0FBQ3RCLGNBQVUsRUFBa0IsSUFBSTtBQUNoQyxrQkFBYyxFQUFjLElBQUk7QUFDaEMsY0FBVSxFQUFrQixJQUFJO0FBQ2hDLGdCQUFZLEVBQWdCLENBQUM7QUFDN0IsZUFBVyxFQUFpQixJQUFJO0FBQ2hDLGVBQVcsRUFBaUIsSUFBSTtBQUNoQyxxQkFBaUIsRUFBVyxLQUFLO0FBQ2pDLHVCQUFtQixFQUFTLEtBQUs7QUFDakMsMkJBQXVCLEVBQUssUUFBUTtBQUNwQyxZQUFRLEVBQW9CLEVBQUU7QUFDOUIsT0FBRyxFQUF5QixLQUFLO0FBQ2pD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cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXG4vKlxuICogRmlsZTogaWZyYW1lUmVzaXplci5qc1xuICogRGVzYzogRm9yY2UgaWZyYW1lcyB0byBzaXplIHRvIGNvbnRlbnQuXG4gKiBSZXF1aXJlczogaWZyYW1lUmVzaXplci5jb250ZW50V2luZG93LmpzIHRvIGJlIGxvYWRlZCBpbnRvIHRoZSB0YXJnZXQgZnJhbWUuXG4gKiBEb2M6IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXZpZGpicmFkc2hhdy9pZnJhbWUtcmVzaXplclxuICogQXV0aG9yOiBEYXZpZCBKLiBCcmFkc2hhdyAtIGRhdmVAYnJhZHNoYXcubmV0XG4gKiBDb250cmlidXRvcjogSnVyZSBNYXYgLSBqdXJlLm1hdkBnbWFpbC5jb21cbiAqIENvbnRyaWJ1dG9yOiBSZWVkIERhZG91bmUgLSByZWVkQGRhZG91bmUuY29tXG4gKi9cbjsoZnVuY3Rpb24od2luZG93KSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXJcbiAgICBjb3VudCAgICAgICAgICAgICAgICAgPSAwLFxuICAgIGxvZ0VuYWJsZWQgICAgICAgICAgICA9IGZhbHNlLFxuICAgIG1zZ0hlYWRlciAgICAgICAgICAgICA9ICdtZXNzYWdlJyxcbiAgICBtc2dIZWFkZXJMZW4gICAgICAgICAgPSBtc2dIZWFkZXIubGVuZ3RoLFxuICAgIG1zZ0lkICAgICAgICAgICAgICAgICA9ICdbaUZyYW1lU2l6ZXJdJywgLy9NdXN0IG1hdGNoIGlmcmFtZSBtc2cgSURcbiAgICBtc2dJZExlbiAgICAgICAgICAgICAgPSBtc2dJZC5sZW5ndGgsXG4gICAgcGFnZVBvc2l0aW9uICAgICAgICAgID0gbnVsbCxcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lLFxuICAgIHJlc2V0UmVxdWlyZWRNZXRob2RzICA9IHttYXg6MSxzY3JvbGw6MSxib2R5U2Nyb2xsOjEsZG9jdW1lbnRFbGVtZW50U2Nyb2xsOjF9LFxuICAgIHNldHRpbmdzICAgICAgICAgICAgICA9IHt9LFxuICAgIHRpbWVyICAgICAgICAgICAgICAgICA9IG51bGwsXG5cbiAgICBkZWZhdWx0cyAgICAgICAgICAgICAgPSB7XG4gICAgICBhdXRvUmVzaXplICAgICAgICAgICAgICAgIDogdHJ1ZSxcbiAgICAgIGJvZHlCYWNrZ3JvdW5kICAgICAgICAgICAgOiBudWxsLFxuICAgICAgYm9keU1hcmdpbiAgICAgICAgICAgICAgICA6IG51bGwsXG4gICAgICBib2R5TWFyZ2luVjEgICAgICAgICAgICAgIDogOCxcbiAgICAgIGJvZHlQYWRkaW5nICAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgY2hlY2tPcmlnaW4gICAgICAgICAgICAgICA6IHRydWUsXG4gICAgICBlbmFibGVJblBhZ2VMaW5rcyAgICAgICAgIDogZmFsc2UsXG4gICAgICBlbmFibGVQdWJsaWNNZXRob2RzICAgICAgIDogZmFsc2UsXG4gICAgICBoZWlnaHRDYWxjdWxhdGlvbk1ldGhvZCAgIDogJ29mZnNldCcsXG4gICAgICBpbnRlcnZhbCAgICAgICAgICAgICAgICAgIDogMzIsXG4gICAgICBsb2cgICAgICAgICAgICAgICAgICAgICAgIDogZmFsc2UsXG4gICAgICBtYXhIZWlnaHQgICAgICAgICAgICAgICAgIDogSW5maW5pdHksXG4gICAgICBtYXhXaWR0aCAgICAgICAgICAgICAgICAgIDogSW5maW5pdHksXG4gICAgICBtaW5IZWlnaHQgICAgICAgICAgICAgICAgIDogMCxcbiAgICAgIG1pbldpZHRoICAgICAgICAgICAgICAgICAgOiAwLFxuICAgICAgcmVzaXplRnJvbSAgICAgICAgICAgICAgICA6ICdwYXJlbnQnLFxuICAgICAgc2Nyb2xsaW5nICAgICAgICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgc2l6ZUhlaWdodCAgICAgICAgICAgICAgICA6IHRydWUsXG4gICAgICBzaXplV2lkdGggICAgICAgICAgICAgICAgIDogZmFsc2UsXG4gICAgICB0b2xlcmFuY2UgICAgICAgICAgICAgICAgIDogMCxcbiAgICAgIGNsb3NlZENhbGxiYWNrICAgICAgICAgICAgOiBmdW5jdGlvbigpe30sXG4gICAgICBpbml0Q2FsbGJhY2sgICAgICAgICAgICAgIDogZnVuY3Rpb24oKXt9LFxuICAgICAgbWVzc2FnZUNhbGxiYWNrICAgICAgICAgICA6IGZ1bmN0aW9uKCl7fSxcbiAgICAgIHJlc2l6ZWRDYWxsYmFjayAgICAgICAgICAgOiBmdW5jdGlvbigpe30sXG4gICAgICBzY3JvbGxDYWxsYmFjayAgICAgICAgICAgIDogZnVuY3Rpb24oKXtyZXR1cm4gdHJ1ZTt9XG4gICAgfTtcblxuICBmdW5jdGlvbiBhZGRFdmVudExpc3RlbmVyKG9iaixldnQsZnVuYyl7XG4gICAgaWYgKCdhZGRFdmVudExpc3RlbmVyJyBpbiB3aW5kb3cpe1xuICAgICAgb2JqLmFkZEV2ZW50TGlzdGVuZXIoZXZ0LGZ1bmMsIGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKCdhdHRhY2hFdmVudCcgaW4gd2luZG93KXsvL0lFXG4gICAgICBvYmouYXR0YWNoRXZlbnQoJ29uJytldnQsZnVuYyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0dXBSZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKXtcbiAgICB2YXJcbiAgICAgIHZlbmRvcnMgPSBbJ21veicsICd3ZWJraXQnLCAnbycsICdtcyddLFxuICAgICAgeDtcblxuICAgIC8vIFJlbW92ZSB2ZW5kb3IgcHJlZml4aW5nIGlmIHByZWZpeGVkIGFuZCBicmVhayBlYXJseSBpZiBub3RcbiAgICBmb3IgKHggPSAwOyB4IDwgdmVuZG9ycy5sZW5ndGggJiYgIXJlcXVlc3RBbmltYXRpb25GcmFtZTsgeCArPSAxKSB7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1t4XSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICB9XG5cbiAgICBpZiAoIShyZXF1ZXN0QW5pbWF0aW9uRnJhbWUpKXtcbiAgICAgIGxvZygnIFJlcXVlc3RBbmltYXRpb25GcmFtZSBub3Qgc3VwcG9ydGVkJyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TXlJRCgpe1xuICAgIHZhciByZXRTdHIgPSAnSG9zdCBwYWdlJztcblxuICAgIGlmICh3aW5kb3cudG9wIT09d2luZG93LnNlbGYpe1xuICAgICAgaWYgKHdpbmRvdy5wYXJlbnRJRnJhbWUpe1xuICAgICAgICByZXRTdHIgPSB3aW5kb3cucGFyZW50SUZyYW1lLmdldElkKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXRTdHIgPSAnTmVzdGVkIGhvc3QgcGFnZSc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldFN0cjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvcm1hdExvZ01zZyhtc2cpe1xuICAgIHJldHVybiBtc2dJZCArICdbJyArIGdldE15SUQoKSArICddJyArIG1zZztcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvZyhtc2cpe1xuICAgIGlmIChsb2dFbmFibGVkICYmICgnb2JqZWN0JyA9PT0gdHlwZW9mIHdpbmRvdy5jb25zb2xlKSl7XG4gICAgICBjb25zb2xlLmxvZyhmb3JtYXRMb2dNc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd2Fybihtc2cpe1xuICAgIGlmICgnb2JqZWN0JyA9PT0gdHlwZW9mIHdpbmRvdy5jb25zb2xlKXtcbiAgICAgIGNvbnNvbGUud2Fybihmb3JtYXRMb2dNc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaUZyYW1lTGlzdGVuZXIoZXZlbnQpe1xuICAgIGZ1bmN0aW9uIHJlc2l6ZUlGcmFtZSgpe1xuICAgICAgZnVuY3Rpb24gcmVzaXplKCl7XG4gICAgICAgIHNldFNpemUobWVzc2FnZURhdGEpO1xuICAgICAgICBzZXRQYWdlUG9zaXRpb24oKTtcbiAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLnJlc2l6ZWRDYWxsYmFjayhtZXNzYWdlRGF0YSk7XG4gICAgICB9XG5cbiAgICAgIGVuc3VyZUluUmFuZ2UoJ0hlaWdodCcpO1xuICAgICAgZW5zdXJlSW5SYW5nZSgnV2lkdGgnKTtcblxuICAgICAgc3luY1Jlc2l6ZShyZXNpemUsbWVzc2FnZURhdGEsJ3Jlc2V0UGFnZScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsb3NlSUZyYW1lKGlmcmFtZSl7XG4gICAgICB2YXIgaWZyYW1lSWQgPSBpZnJhbWUuaWQ7XG5cbiAgICAgIGxvZygnIFJlbW92aW5nIGlGcmFtZTogJytpZnJhbWVJZCk7XG4gICAgICBpZnJhbWUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmNsb3NlZENhbGxiYWNrKGlmcmFtZUlkKTtcbiAgICAgIGRlbGV0ZSBzZXR0aW5nc1tpZnJhbWVJZF07XG4gICAgICBsb2coJyAtLScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2Nlc3NNc2coKXtcbiAgICAgIHZhciBkYXRhID0gbXNnLnN1YnN0cihtc2dJZExlbikuc3BsaXQoJzonKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWZyYW1lOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChkYXRhWzBdKSxcbiAgICAgICAgaWQ6ICAgICBkYXRhWzBdLFxuICAgICAgICBoZWlnaHQ6IGRhdGFbMV0sXG4gICAgICAgIHdpZHRoOiAgZGF0YVsyXSxcbiAgICAgICAgdHlwZTogICBkYXRhWzNdXG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuc3VyZUluUmFuZ2UoRGltZW5zaW9uKXtcbiAgICAgIHZhclxuICAgICAgICBtYXggID0gTnVtYmVyKHNldHRpbmdzW2lmcmFtZUlkXVsnbWF4JytEaW1lbnNpb25dKSxcbiAgICAgICAgbWluICA9IE51bWJlcihzZXR0aW5nc1tpZnJhbWVJZF1bJ21pbicrRGltZW5zaW9uXSksXG4gICAgICAgIGRpbWVuc2lvbiA9IERpbWVuc2lvbi50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBzaXplID0gTnVtYmVyKG1lc3NhZ2VEYXRhW2RpbWVuc2lvbl0pO1xuXG4gICAgICBpZiAobWluPm1heCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVmFsdWUgZm9yIG1pbicrRGltZW5zaW9uKycgY2FuIG5vdCBiZSBncmVhdGVyIHRoYW4gbWF4JytEaW1lbnNpb24pO1xuICAgICAgfVxuXG4gICAgICBsb2coJyBDaGVja2luZyAnK2RpbWVuc2lvbisnIGlzIGluIHJhbmdlICcrbWluKyctJyttYXgpO1xuXG4gICAgICBpZiAoc2l6ZTxtaW4pIHtcbiAgICAgICAgc2l6ZT1taW47XG4gICAgICAgIGxvZygnIFNldCAnK2RpbWVuc2lvbisnIHRvIG1pbiB2YWx1ZScpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2l6ZT5tYXgpIHtcbiAgICAgICAgc2l6ZT1tYXg7XG4gICAgICAgIGxvZygnIFNldCAnK2RpbWVuc2lvbisnIHRvIG1heCB2YWx1ZScpO1xuICAgICAgfVxuXG4gICAgICBtZXNzYWdlRGF0YVtkaW1lbnNpb25dPScnK3NpemU7XG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBpc01lc3NhZ2VGcm9tSUZyYW1lKCl7XG4gICAgICBmdW5jdGlvbiBjaGVja0FsbG93ZWRPcmlnaW4oKXtcbiAgICAgICAgZnVuY3Rpb24gY2hlY2tMaXN0KCl7XG4gICAgICAgICAgbG9nKCcgQ2hlY2tpbmcgY29ubmVjdGlvbiBpcyBmcm9tIGFsbG93ZWQgbGlzdCBvZiBvcmlnaW5zOiAnICsgY2hlY2tPcmlnaW4pO1xuICAgICAgICAgIHZhciBpO1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGVja09yaWdpbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoZWNrT3JpZ2luW2ldID09PSBvcmlnaW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrU2luZ2xlKCl7XG4gICAgICAgICAgbG9nKCcgQ2hlY2tpbmcgY29ubmVjdGlvbiBpcyBmcm9tOiAnK3JlbW90ZUhvc3QpO1xuICAgICAgICAgIHJldHVybiBvcmlnaW4gPT09IHJlbW90ZUhvc3Q7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hlY2tPcmlnaW4uY29uc3RydWN0b3IgPT09IEFycmF5ID8gY2hlY2tMaXN0KCkgOiBjaGVja1NpbmdsZSgpO1xuICAgICAgfVxuXG4gICAgICB2YXJcbiAgICAgICAgb3JpZ2luICAgICAgPSBldmVudC5vcmlnaW4sXG4gICAgICAgIGNoZWNrT3JpZ2luID0gc2V0dGluZ3NbaWZyYW1lSWRdLmNoZWNrT3JpZ2luLFxuICAgICAgICByZW1vdGVIb3N0ICA9IG1lc3NhZ2VEYXRhLmlmcmFtZS5zcmMuc3BsaXQoJy8nKS5zbGljZSgwLDMpLmpvaW4oJy8nKTtcblxuICAgICAgaWYgKGNoZWNrT3JpZ2luKSB7XG4gICAgICAgIGlmICgoJycrb3JpZ2luICE9PSAnbnVsbCcpICYmICFjaGVja0FsbG93ZWRPcmlnaW4oKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdVbmV4cGVjdGVkIG1lc3NhZ2UgcmVjZWl2ZWQgZnJvbTogJyArIG9yaWdpbiArXG4gICAgICAgICAgICAnIGZvciAnICsgbWVzc2FnZURhdGEuaWZyYW1lLmlkICtcbiAgICAgICAgICAgICcuIE1lc3NhZ2Ugd2FzOiAnICsgZXZlbnQuZGF0YSArXG4gICAgICAgICAgICAnLiBUaGlzIGVycm9yIGNhbiBiZSBkaXNhYmxlZCBieSBzZXR0aW5nIHRoZSBjaGVja09yaWdpbjogZmFsc2Ugb3B0aW9uIG9yIGJ5IHByb3ZpZGluZyBvZiBhcnJheSBvZiB0cnVzdGVkIGRvbWFpbnMuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNNZXNzYWdlRm9yVXMoKXtcbiAgICAgIHJldHVybiBtc2dJZCA9PT0gKCcnICsgbXNnKS5zdWJzdHIoMCxtc2dJZExlbik7IC8vJycrUHJvdGVjdHMgYWdhaW5zdCBub24tc3RyaW5nIG1zZ1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzTWVzc2FnZUZyb21NZXRhUGFyZW50KCl7XG4gICAgICAvL1Rlc3QgaWYgdGhpcyBtZXNzYWdlIGlzIGZyb20gYSBwYXJlbnQgYWJvdmUgdXMuIFRoaXMgaXMgYW4gdWdseSB0ZXN0LCBob3dldmVyLCB1cGRhdGluZ1xuICAgICAgLy90aGUgbWVzc2FnZSBmb3JtYXQgd291bGQgYnJlYWsgYmFja3dhcmRzIGNvbXBhdGliaXR5LlxuICAgICAgdmFyIHJldENvZGUgPSBtZXNzYWdlRGF0YS50eXBlIGluIHsndHJ1ZSc6MSwnZmFsc2UnOjEsJ3VuZGVmaW5lZCc6MX07XG5cbiAgICAgIGlmIChyZXRDb2RlKXtcbiAgICAgICAgbG9nKCcgSWdub3JpbmcgaW5pdCBtZXNzYWdlIGZyb20gbWV0YSBwYXJlbnQgcGFnZScpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmV0Q29kZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRNc2dCb2R5KG9mZnNldCl7XG4gICAgICByZXR1cm4gbXNnLnN1YnN0cihtc2cuaW5kZXhPZignOicpK21zZ0hlYWRlckxlbitvZmZzZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZvcndhcmRNc2dGcm9tSUZyYW1lKG1zZ0JvZHkpe1xuICAgICAgbG9nKCcgTWVzc2FnZUNhbGxiYWNrIHBhc3NlZDoge2lmcmFtZTogJysgbWVzc2FnZURhdGEuaWZyYW1lLmlkICsgJywgbWVzc2FnZTogJyArIG1zZ0JvZHkgKyAnfScpO1xuICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLm1lc3NhZ2VDYWxsYmFjayh7XG4gICAgICAgIGlmcmFtZTogbWVzc2FnZURhdGEuaWZyYW1lLFxuICAgICAgICBtZXNzYWdlOiBKU09OLnBhcnNlKG1zZ0JvZHkpXG4gICAgICB9KTtcbiAgICAgIGxvZygnIC0tJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2hlY2tJRnJhbWVFeGlzdHMoKXtcbiAgICAgIGlmIChudWxsID09PSBtZXNzYWdlRGF0YS5pZnJhbWUpIHtcbiAgICAgICAgd2FybignIElGcmFtZSAoJyttZXNzYWdlRGF0YS5pZCsnKSBub3QgZm91bmQnKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0RWxlbWVudFBvc2l0aW9uKHRhcmdldCl7XG4gICAgICB2YXJcbiAgICAgICAgaUZyYW1lUG9zaXRpb24gPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgIGdldFBhZ2VQb3NpdGlvbigpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBwYXJzZUludChpRnJhbWVQb3NpdGlvbi5sZWZ0LCAxMCkgKyBwYXJzZUludChwYWdlUG9zaXRpb24ueCwgMTApLFxuICAgICAgICB5OiBwYXJzZUludChpRnJhbWVQb3NpdGlvbi50b3AsIDEwKSAgKyBwYXJzZUludChwYWdlUG9zaXRpb24ueSwgMTApXG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbFJlcXVlc3RGcm9tQ2hpbGQoYWRkT2Zmc2V0KXtcbiAgICAgIGZ1bmN0aW9uIHJlcG9zaXRpb24oKXtcbiAgICAgICAgcGFnZVBvc2l0aW9uID0gbmV3UG9zaXRpb247XG5cbiAgICAgICAgc2Nyb2xsVG8oKTtcblxuICAgICAgICBsb2coJyAtLScpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjYWxjT2Zmc2V0KCl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgeDogTnVtYmVyKG1lc3NhZ2VEYXRhLndpZHRoKSArIG9mZnNldC54LFxuICAgICAgICAgIHk6IE51bWJlcihtZXNzYWdlRGF0YS5oZWlnaHQpICsgb2Zmc2V0LnlcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgdmFyXG4gICAgICAgIG9mZnNldCA9IGFkZE9mZnNldCA/IGdldEVsZW1lbnRQb3NpdGlvbihtZXNzYWdlRGF0YS5pZnJhbWUpIDoge3g6MCx5OjB9LFxuICAgICAgICBuZXdQb3NpdGlvbiA9IGNhbGNPZmZzZXQoKTtcblxuICAgICAgbG9nKCcgUmVwb3NpdGlvbiByZXF1ZXN0ZWQgZnJvbSBpRnJhbWUgKG9mZnNldCB4Oicrb2Zmc2V0LngrJyB5Oicrb2Zmc2V0LnkrJyknKTtcblxuICAgICAgaWYod2luZG93LnRvcCE9PXdpbmRvdy5zZWxmKXtcbiAgICAgICAgaWYgKHdpbmRvdy5wYXJlbnRJRnJhbWUpe1xuICAgICAgICAgIGlmIChhZGRPZmZzZXQpe1xuICAgICAgICAgICAgd2luZG93LnBhcmVudElGcmFtZS5zY3JvbGxUb09mZnNldChuZXdQb3NpdGlvbi54LG5ld1Bvc2l0aW9uLnkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aW5kb3cucGFyZW50SUZyYW1lLnNjcm9sbFRvKG1lc3NhZ2VEYXRhLndpZHRoLG1lc3NhZ2VEYXRhLmhlaWdodCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdhcm4oJyBVbmFibGUgdG8gc2Nyb2xsIHRvIHJlcXVlc3RlZCBwb3NpdGlvbiwgd2luZG93LnBhcmVudElGcmFtZSBub3QgZm91bmQnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVwb3NpdGlvbigpO1xuICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2Nyb2xsVG8oKXtcbiAgICAgIGlmIChmYWxzZSAhPT0gc2V0dGluZ3NbaWZyYW1lSWRdLnNjcm9sbENhbGxiYWNrKHBhZ2VQb3NpdGlvbikpe1xuICAgICAgICBzZXRQYWdlUG9zaXRpb24oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaW5kVGFyZ2V0KGxvY2F0aW9uKXtcbiAgICAgIGZ1bmN0aW9uIGp1bXBUb1RhcmdldCh0YXJnZXQpe1xuICAgICAgICB2YXIganVtcFBvc2l0aW9uID0gZ2V0RWxlbWVudFBvc2l0aW9uKHRhcmdldCk7XG5cbiAgICAgICAgbG9nKCcgTW92aW5nIHRvIGluIHBhZ2UgbGluayAoIycraGFzaCsnKSBhdCB4OiAnK2p1bXBQb3NpdGlvbi54KycgeTogJytqdW1wUG9zaXRpb24ueSk7XG4gICAgICAgIHBhZ2VQb3NpdGlvbiA9IHtcbiAgICAgICAgICB4OiBqdW1wUG9zaXRpb24ueCxcbiAgICAgICAgICB5OiBqdW1wUG9zaXRpb24ueVxuICAgICAgICB9O1xuXG4gICAgICAgIHNjcm9sbFRvKCk7XG4gICAgICAgIGxvZygnIC0tJyk7XG4gICAgICB9XG5cbiAgICAgIHZhclxuICAgICAgICBoYXNoICAgICA9IGxvY2F0aW9uLnNwbGl0KCcjJylbMV0gfHwgJycsXG4gICAgICAgIGhhc2hEYXRhID0gZGVjb2RlVVJJQ29tcG9uZW50KGhhc2gpLFxuICAgICAgICB0YXJnZXQgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGhhc2hEYXRhKSB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5TmFtZShoYXNoRGF0YSlbMF07XG5cbiAgICAgIGlmKHdpbmRvdy50b3AhPT13aW5kb3cuc2VsZil7XG4gICAgICAgIGlmICh3aW5kb3cucGFyZW50SUZyYW1lKXtcbiAgICAgICAgICB3aW5kb3cucGFyZW50SUZyYW1lLm1vdmVUb0FuY2hvcihoYXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2coJyBJbiBwYWdlIGxpbmsgIycraGFzaCsnIG5vdCBmb3VuZCBhbmQgd2luZG93LnBhcmVudElGcmFtZSBub3QgZm91bmQnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0YXJnZXQpe1xuICAgICAgICBqdW1wVG9UYXJnZXQodGFyZ2V0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZygnIEluIHBhZ2UgbGluayAjJytoYXNoKycgbm90IGZvdW5kJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWN0aW9uTXNnKCl7XG4gICAgICBzd2l0Y2gobWVzc2FnZURhdGEudHlwZSl7XG4gICAgICAgIGNhc2UgJ2Nsb3NlJzpcbiAgICAgICAgICBjbG9zZUlGcmFtZShtZXNzYWdlRGF0YS5pZnJhbWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdtZXNzYWdlJzpcbiAgICAgICAgICBmb3J3YXJkTXNnRnJvbUlGcmFtZShnZXRNc2dCb2R5KDYpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2Nyb2xsVG8nOlxuICAgICAgICAgIHNjcm9sbFJlcXVlc3RGcm9tQ2hpbGQoZmFsc2UpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzY3JvbGxUb09mZnNldCc6XG4gICAgICAgICAgc2Nyb2xsUmVxdWVzdEZyb21DaGlsZCh0cnVlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaW5QYWdlTGluayc6XG4gICAgICAgICAgZmluZFRhcmdldChnZXRNc2dCb2R5KDkpKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAncmVzZXQnOlxuICAgICAgICAgIHJlc2V0SUZyYW1lKG1lc3NhZ2VEYXRhKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgICAgcmVzaXplSUZyYW1lKCk7XG4gICAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmluaXRDYWxsYmFjayhtZXNzYWdlRGF0YS5pZnJhbWUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJlc2l6ZUlGcmFtZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhc1NldHRpbmdzKGlmcmFtZUlkKXtcbiAgICAgIHZhciByZXRCb29sID0gdHJ1ZTtcblxuICAgICAgaWYgKCFzZXR0aW5nc1tpZnJhbWVJZF0pe1xuICAgICAgICByZXRCb29sID0gZmFsc2U7XG4gICAgICAgIHdhcm4obWVzc2FnZURhdGEudHlwZSArICcgTm8gc2V0dGluZ3MgZm9yICcgKyBpZnJhbWVJZCArICcuIE1lc3NhZ2Ugd2FzOiAnICsgbXNnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJldEJvb2w7XG4gICAgfVxuXG4gICAgdmFyXG4gICAgICBtc2cgPSBldmVudC5kYXRhLFxuICAgICAgbWVzc2FnZURhdGEgPSB7fSxcbiAgICAgIGlmcmFtZUlkID0gbnVsbDtcblxuICAgIGlmIChpc01lc3NhZ2VGb3JVcygpKXtcbiAgICAgIG1lc3NhZ2VEYXRhID0gcHJvY2Vzc01zZygpO1xuICAgICAgaWZyYW1lSWQgICAgPSBtZXNzYWdlRGF0YS5pZDtcblxuICAgICAgaWYgKCFpc01lc3NhZ2VGcm9tTWV0YVBhcmVudCgpICYmIGhhc1NldHRpbmdzKGlmcmFtZUlkKSl7XG4gICAgICAgIGxvZ0VuYWJsZWQgID0gc2V0dGluZ3NbaWZyYW1lSWRdLmxvZztcbiAgICAgICAgbG9nKCcgUmVjZWl2ZWQ6ICcrbXNnKTtcblxuICAgICAgICBpZiAoIGNoZWNrSUZyYW1lRXhpc3RzKCkgJiYgaXNNZXNzYWdlRnJvbUlGcmFtZSgpICl7XG4gICAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmZpcnN0UnVuID0gZmFsc2U7XG4gICAgICAgICAgYWN0aW9uTXNnKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIGdldFBhZ2VQb3NpdGlvbiAoKXtcbiAgICBpZihudWxsID09PSBwYWdlUG9zaXRpb24pe1xuICAgICAgcGFnZVBvc2l0aW9uID0ge1xuICAgICAgICB4OiAod2luZG93LnBhZ2VYT2Zmc2V0ICE9PSB1bmRlZmluZWQpID8gd2luZG93LnBhZ2VYT2Zmc2V0IDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQsXG4gICAgICAgIHk6ICh3aW5kb3cucGFnZVlPZmZzZXQgIT09IHVuZGVmaW5lZCkgPyB3aW5kb3cucGFnZVlPZmZzZXQgOiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wXG4gICAgICB9O1xuICAgICAgbG9nKCcgR2V0IHBhZ2UgcG9zaXRpb246ICcrcGFnZVBvc2l0aW9uLngrJywnK3BhZ2VQb3NpdGlvbi55KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzZXRQYWdlUG9zaXRpb24oKXtcbiAgICBpZihudWxsICE9PSBwYWdlUG9zaXRpb24pe1xuICAgICAgd2luZG93LnNjcm9sbFRvKHBhZ2VQb3NpdGlvbi54LHBhZ2VQb3NpdGlvbi55KTtcbiAgICAgIGxvZygnIFNldCBwYWdlIHBvc2l0aW9uOiAnK3BhZ2VQb3NpdGlvbi54KycsJytwYWdlUG9zaXRpb24ueSk7XG4gICAgICBwYWdlUG9zaXRpb24gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc2V0SUZyYW1lKG1lc3NhZ2VEYXRhKXtcbiAgICBmdW5jdGlvbiByZXNldCgpe1xuICAgICAgc2V0U2l6ZShtZXNzYWdlRGF0YSk7XG4gICAgICB0cmlnZ2VyKCdyZXNldCcsJ3Jlc2V0JyxtZXNzYWdlRGF0YS5pZnJhbWUsbWVzc2FnZURhdGEuaWQpO1xuICAgIH1cblxuICAgIGxvZygnIFNpemUgcmVzZXQgcmVxdWVzdGVkIGJ5ICcrKCdpbml0Jz09PW1lc3NhZ2VEYXRhLnR5cGU/J2hvc3QgcGFnZSc6J2lGcmFtZScpKTtcbiAgICBnZXRQYWdlUG9zaXRpb24oKTtcbiAgICBzeW5jUmVzaXplKHJlc2V0LG1lc3NhZ2VEYXRhLCdpbml0Jyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRTaXplKG1lc3NhZ2VEYXRhKXtcbiAgICBmdW5jdGlvbiBzZXREaW1lbnNpb24oZGltZW5zaW9uKXtcbiAgICAgIG1lc3NhZ2VEYXRhLmlmcmFtZS5zdHlsZVtkaW1lbnNpb25dID0gbWVzc2FnZURhdGFbZGltZW5zaW9uXSArICdweCc7XG4gICAgICBsb2coXG4gICAgICAgICcgSUZyYW1lICgnICsgaWZyYW1lSWQgK1xuICAgICAgICAnKSAnICsgZGltZW5zaW9uICtcbiAgICAgICAgJyBzZXQgdG8gJyArIG1lc3NhZ2VEYXRhW2RpbWVuc2lvbl0gKyAncHgnXG4gICAgICApO1xuICAgIH1cbiAgICB2YXIgaWZyYW1lSWQgPSBtZXNzYWdlRGF0YS5pZnJhbWUuaWQ7XG4gICAgaWYoIHNldHRpbmdzW2lmcmFtZUlkXS5zaXplSGVpZ2h0KSB7IHNldERpbWVuc2lvbignaGVpZ2h0Jyk7IH1cbiAgICBpZiggc2V0dGluZ3NbaWZyYW1lSWRdLnNpemVXaWR0aCApIHsgc2V0RGltZW5zaW9uKCd3aWR0aCcpOyB9XG4gIH1cblxuICBmdW5jdGlvbiBzeW5jUmVzaXplKGZ1bmMsbWVzc2FnZURhdGEsZG9Ob3RTeW5jKXtcbiAgICBpZihkb05vdFN5bmMhPT1tZXNzYWdlRGF0YS50eXBlICYmIHJlcXVlc3RBbmltYXRpb25GcmFtZSl7XG4gICAgICBsb2coJyBSZXF1ZXN0aW5nIGFuaW1hdGlvbiBmcmFtZScpO1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmdW5jKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdHJpZ2dlcihjYWxsZWVNc2csbXNnLGlmcmFtZSxpZCl7XG4gICAgaWYoaWZyYW1lICYmIGlmcmFtZS5jb250ZW50V2luZG93KXtcbiAgICAgIGxvZygnWycgKyBjYWxsZWVNc2cgKyAnXSBTZW5kaW5nIG1zZyB0byBpZnJhbWUgKCcrbXNnKycpJyk7XG4gICAgICBpZnJhbWUuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZSggbXNnSWQgKyBtc2csICcqJyApO1xuICAgIH0gZWxzZSB7XG4gICAgICB3YXJuKCdbJyArIGNhbGxlZU1zZyArICddIElGcmFtZSBub3QgZm91bmQnKTtcbiAgICAgIGlmKHNldHRpbmdzW2lkXSkge1xuICAgICAgICBkZWxldGUgc2V0dGluZ3NbaWRdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgZnVuY3Rpb24gc2V0dXBJRnJhbWUob3B0aW9ucyl7XG4gICAgZnVuY3Rpb24gc2V0TGltaXRzKCl7XG4gICAgICBmdW5jdGlvbiBhZGRTdHlsZShzdHlsZSl7XG4gICAgICAgIGlmICgoSW5maW5pdHkgIT09IHNldHRpbmdzW2lmcmFtZUlkXVtzdHlsZV0pICYmICgwICE9PSBzZXR0aW5nc1tpZnJhbWVJZF1bc3R5bGVdKSl7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlW3N0eWxlXSA9IHNldHRpbmdzW2lmcmFtZUlkXVtzdHlsZV0gKyAncHgnO1xuICAgICAgICAgIGxvZygnIFNldCAnK3N0eWxlKycgPSAnK3NldHRpbmdzW2lmcmFtZUlkXVtzdHlsZV0rJ3B4Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgYWRkU3R5bGUoJ21heEhlaWdodCcpO1xuICAgICAgYWRkU3R5bGUoJ21pbkhlaWdodCcpO1xuICAgICAgYWRkU3R5bGUoJ21heFdpZHRoJyk7XG4gICAgICBhZGRTdHlsZSgnbWluV2lkdGgnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbnN1cmVIYXNJZChpZnJhbWVJZCl7XG4gICAgICBpZiAoJyc9PT1pZnJhbWVJZCl7XG4gICAgICAgIGlmcmFtZS5pZCA9IGlmcmFtZUlkID0gJ2lGcmFtZVJlc2l6ZXInICsgY291bnQrKztcbiAgICAgICAgbG9nRW5hYmxlZCA9IChvcHRpb25zIHx8IHt9KS5sb2c7XG4gICAgICAgIGxvZygnIEFkZGVkIG1pc3NpbmcgaWZyYW1lIElEOiAnKyBpZnJhbWVJZCArJyAoJyArIGlmcmFtZS5zcmMgKyAnKScpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gaWZyYW1lSWQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0U2Nyb2xsaW5nKCl7XG4gICAgICBsb2coJyBJRnJhbWUgc2Nyb2xsaW5nICcgKyAoc2V0dGluZ3NbaWZyYW1lSWRdLnNjcm9sbGluZyA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCcpICsgJyBmb3IgJyArIGlmcmFtZUlkKTtcbiAgICAgIGlmcmFtZS5zdHlsZS5vdmVyZmxvdyA9IGZhbHNlID09PSBzZXR0aW5nc1tpZnJhbWVJZF0uc2Nyb2xsaW5nID8gJ2hpZGRlbicgOiAnYXV0byc7XG4gICAgICBpZnJhbWUuc2Nyb2xsaW5nICAgICAgPSBmYWxzZSA9PT0gc2V0dGluZ3NbaWZyYW1lSWRdLnNjcm9sbGluZyA/ICdubycgOiAneWVzJztcbiAgICB9XG5cbiAgICAvL1RoZSBWMSBpRnJhbWUgc2NyaXB0IGV4cGVjdHMgYW4gaW50LCB3aGVyZSBhcyBpbiBWMiBleHBlY3RzIGEgQ1NTXG4gICAgLy9zdHJpbmcgdmFsdWUgc3VjaCBhcyAnMXB4IDNlbScsIHNvIGlmIHdlIGhhdmUgYW4gaW50IGZvciBWMiwgc2V0IFYxPVYyXG4gICAgLy9hbmQgdGhlbiBjb252ZXJ0IFYyIHRvIGEgc3RyaW5nIFBYIHZhbHVlLlxuICAgIGZ1bmN0aW9uIHNldHVwQm9keU1hcmdpblZhbHVlcygpe1xuICAgICAgaWYgKCgnbnVtYmVyJz09PXR5cGVvZihzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbikpIHx8ICgnMCc9PT1zZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbikpe1xuICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpblYxID0gc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW47XG4gICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luICAgPSAnJyArIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luICsgJ3B4JztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVPdXRnb2luZ01zZygpe1xuICAgICAgcmV0dXJuIGlmcmFtZUlkICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW5WMSArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5zaXplV2lkdGggK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0ubG9nICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmludGVydmFsICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmVuYWJsZVB1YmxpY01ldGhvZHMgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYXV0b1Jlc2l6ZSArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmhlaWdodENhbGN1bGF0aW9uTWV0aG9kICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlCYWNrZ3JvdW5kICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlQYWRkaW5nICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLnRvbGVyYW5jZSArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5lbmFibGVJblBhZ2VMaW5rcyArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5yZXNpemVGcm9tO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGluaXQobXNnKXtcbiAgICAgIC8vV2UgaGF2ZSB0byBjYWxsIHRyaWdnZXIgdHdpY2UsIGFzIHdlIGNhbiBub3QgYmUgc3VyZSBpZiBhbGxcbiAgICAgIC8vaWZyYW1lcyBoYXZlIGNvbXBsZXRlZCBsb2FkaW5nIHdoZW4gdGhpcyBjb2RlIHJ1bnMuIFRoZVxuICAgICAgLy9ldmVudCBsaXN0ZW5lciBhbHNvIGNhdGNoZXMgdGhlIHBhZ2UgY2hhbmdpbmcgaW4gdGhlIGlGcmFtZS5cbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIoaWZyYW1lLCdsb2FkJyxmdW5jdGlvbigpe1xuICAgICAgICB2YXIgZnIgPSBzZXR0aW5nc1tpZnJhbWVJZF0uZmlyc3RSdW47ICAgLy8gUmVkdWNlIHNjb3BlIG9mIHZhciB0byBmdW5jdGlvbiwgYmVjYXVzZSBJRTgncyBKUyBleGVjdXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29udGV4dCBzdGFjayBpcyBib3JrZWQgYW5kIHRoaXMgdmFsdWUgZ2V0cyBleHRlcm5hbGx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoYW5nZWQgbWlkd2F5IHRocm91Z2ggcnVubmluZyB0aGlzIGZ1bmN0aW9uLlxuICAgICAgICB0cmlnZ2VyKCdpRnJhbWUub25sb2FkJyxtc2csaWZyYW1lKTtcbiAgICAgICAgaWYgKCFmciAmJiBzZXR0aW5nc1tpZnJhbWVJZF0uaGVpZ2h0Q2FsY3VsYXRpb25NZXRob2QgaW4gcmVzZXRSZXF1aXJlZE1ldGhvZHMpe1xuICAgICAgICAgIHJlc2V0SUZyYW1lKHtcbiAgICAgICAgICAgIGlmcmFtZTppZnJhbWUsXG4gICAgICAgICAgICBoZWlnaHQ6MCxcbiAgICAgICAgICAgIHdpZHRoOjAsXG4gICAgICAgICAgICB0eXBlOidpbml0J1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRyaWdnZXIoJ2luaXQnLG1zZyxpZnJhbWUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNoZWNrT3B0aW9ucyhvcHRpb25zKXtcbiAgICAgIGlmICgnb2JqZWN0JyAhPT0gdHlwZW9mIG9wdGlvbnMpe1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdPcHRpb25zIGlzIG5vdCBhbiBvYmplY3QuJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9ucyl7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIHNldHRpbmdzW2lmcmFtZUlkXSA9IHtcbiAgICAgICAgZmlyc3RSdW46IHRydWVcbiAgICAgIH07XG5cbiAgICAgIGNoZWNrT3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgZm9yICh2YXIgb3B0aW9uIGluIGRlZmF1bHRzKSB7XG4gICAgICAgIGlmIChkZWZhdWx0cy5oYXNPd25Qcm9wZXJ0eShvcHRpb24pKXtcbiAgICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF1bb3B0aW9uXSA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkob3B0aW9uKSA/IG9wdGlvbnNbb3B0aW9uXSA6IGRlZmF1bHRzW29wdGlvbl07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbG9nRW5hYmxlZCA9IHNldHRpbmdzW2lmcmFtZUlkXS5sb2c7XG4gICAgfVxuXG4gICAgdmFyXG4gICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgaWZyYW1lICAgPSB0aGlzLFxuICAgICAgaWZyYW1lSWQgPSBlbnN1cmVIYXNJZChpZnJhbWUuaWQpO1xuXG4gICAgcHJvY2Vzc09wdGlvbnMob3B0aW9ucyk7XG4gICAgc2V0U2Nyb2xsaW5nKCk7XG4gICAgc2V0TGltaXRzKCk7XG4gICAgc2V0dXBCb2R5TWFyZ2luVmFsdWVzKCk7XG4gICAgaW5pdChjcmVhdGVPdXRnb2luZ01zZygpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRocm90dGxlKGZuLHRpbWUpe1xuICAgIGlmIChudWxsID09PSB0aW1lcil7XG4gICAgICB0aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgdGltZXIgPSBudWxsO1xuICAgICAgICBmbigpO1xuICAgICAgfSwgdGltZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd2luUmVzaXplKCl7XG4gICAgZnVuY3Rpb24gaXNJRnJhbWVSZXNpemVFbmFibGVkKGlmcmFtZUlkKSB7XG4gICAgICByZXR1cm4gICdwYXJlbnQnID09PSBzZXR0aW5nc1tpZnJhbWVJZF0ucmVzaXplRnJvbSAmJlxuICAgICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5hdXRvUmVzaXplICYmXG4gICAgICAgICAgIXNldHRpbmdzW2lmcmFtZUlkXS5maXJzdFJ1bjtcbiAgICB9XG5cbiAgICB0aHJvdHRsZShmdW5jdGlvbigpe1xuICAgICAgZm9yICh2YXIgaWZyYW1lSWQgaW4gc2V0dGluZ3Mpe1xuICAgICAgICBpZihpc0lGcmFtZVJlc2l6ZUVuYWJsZWQoaWZyYW1lSWQpKXtcbiAgICAgICAgICB0cmlnZ2VyKCdXaW5kb3cgcmVzaXplJywncmVzaXplJyxkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZnJhbWVJZCksaWZyYW1lSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSw2Nik7XG4gIH1cblxuICBmdW5jdGlvbiBmYWN0b3J5KCl7XG4gICAgZnVuY3Rpb24gaW5pdChlbGVtZW50LCBvcHRpb25zKXtcbiAgICAgIGlmKCFlbGVtZW50LnRhZ05hbWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0IGlzIG5vdCBhIHZhbGlkIERPTSBlbGVtZW50Jyk7XG4gICAgICB9IGVsc2UgaWYgKCdJRlJBTUUnICE9PSBlbGVtZW50LnRhZ05hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCA8SUZSQU1FPiB0YWcsIGZvdW5kIDwnK2VsZW1lbnQudGFnTmFtZSsnPi4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldHVwSUZyYW1lLmNhbGwoZWxlbWVudCwgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2V0dXBSZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKTtcbiAgICBhZGRFdmVudExpc3RlbmVyKHdpbmRvdywnbWVzc2FnZScsaUZyYW1lTGlzdGVuZXIpO1xuICAgIGFkZEV2ZW50TGlzdGVuZXIod2luZG93LCdyZXNpemUnLCB3aW5SZXNpemUpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGlGcmFtZVJlc2l6ZUYob3B0aW9ucyx0YXJnZXQpe1xuICAgICAgc3dpdGNoICh0eXBlb2YodGFyZ2V0KSl7XG4gICAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggdGFyZ2V0IHx8ICdpZnJhbWUnICksIGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgICAgaW5pdChlbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgICAgaW5pdCh0YXJnZXQsIG9wdGlvbnMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1VuZXhwZWN0ZWQgZGF0YSB0eXBlICgnK3R5cGVvZih0YXJnZXQpKycpLicpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVKUXVlcnlQdWJsaWNNZXRob2QoJCl7XG4gICAgJC5mbi5pRnJhbWVSZXNpemUgPSBmdW5jdGlvbiAkaUZyYW1lUmVzaXplRihvcHRpb25zKSB7XG4gICAgICByZXR1cm4gdGhpcy5maWx0ZXIoJ2lmcmFtZScpLmVhY2goZnVuY3Rpb24gKGluZGV4LCBlbGVtZW50KSB7XG4gICAgICAgIHNldHVwSUZyYW1lLmNhbGwoZWxlbWVudCwgb3B0aW9ucyk7XG4gICAgICB9KS5lbmQoKTtcbiAgICB9O1xuICB9XG5cbiAgd2luZG93LmlGcmFtZVJlc2l6ZSA9IGZhY3RvcnkoKTtcblxuICAvLyBpZiAod2luZG93LmpRdWVyeSkgeyBjcmVhdGVKUXVlcnlQdWJsaWNNZXRob2QoalF1ZXJ5KTsgfVxuXG4gIC8vIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgLy8gICBkZWZpbmUoW10sZmFjdG9yeSk7XG4gIC8vIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0JykgeyAvL05vZGUgZm9yIGJyb3dzZXJmeVxuICAvLyAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuICAvLyB9IGVsc2Uge1xuICAvLyAgIHdpbmRvdy5pRnJhbWVSZXNpemUgPSB3aW5kb3cuaUZyYW1lUmVzaXplIHx8IGZhY3RvcnkoKTtcbiAgLy8gfVxuXG59KSh3aW5kb3cgfHwge30pO1xuIl19
