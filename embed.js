(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

//
// TODO
//
// Clean up this ugly implementation
//

'use strict';

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

var lucifyEmbed = function lucifyEmbed(id, url) {

  var thisScript = document.getElementById(id);

  // prepare iframe
  var iframe = document.createElement('iframe');
  iframe.width = "100%";
  iframe.scrolling = "no";
  iframe.frameBorder = 0;
  iframe.id = "lucify-" + guid();

  iframe.src = url;

  // append iframe after script tag
  var parent = thisScript.parentElement;
  parent.insertBefore(iframe, thisScript.nextSibling);

  iFrameResize({ log: false }, '#' + iframe.id);
};

window.lucifyEmbed = lucifyEmbed;

/*
 * File: iframeResizer.js
 * Desc: Force iframes to size to content.
 * Requires: iframeResizer.contentWindow.js to be loaded into the target frame.
 * Doc: https://github.com/davidjbradshaw/iframe-resizer
 * Author: David J. Bradshaw - dave@bradshaw.net
 * Contributor: Jure Mav - jure.mav@gmail.com
 * Contributor: Reed Dadoune - reed@dadoune.com
 */
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvdnNhYXJpbmVuL1JlcG9zL2NoaWxkLXJlZnVnZWVzL25vZGVfbW9kdWxlcy9sdWNpZnktY29tcG9uZW50LWJ1aWxkZXIvc3JjL2pzL2VtYmVkLmpzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7QUNPQSxZQUFZLENBQUM7O0FBQWIsU0FBUyxJQUFJLEdBQUc7QUFDZCxXQUFTLEVBQUUsR0FBRztBQUNaLFdBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUEsR0FBSSxPQUFPLENBQUMsQ0FDN0MsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUNaLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUNqQjtBQUNELFNBQU8sRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxHQUFHLEdBQ2hELEVBQUUsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQztDQUNuQzs7QUFHRCxJQUFJLFdBQVcsR0FBRyxTQUFkLFdBQVcsQ0FBWSxFQUFFLEVBQUUsR0FBRyxFQUFFOztBQUVsQyxNQUFJLFVBQVUsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDOzs7QUFHN0MsTUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM5QyxRQUFNLENBQUMsS0FBSyxHQUFDLE1BQU0sQ0FBQztBQUNwQixRQUFNLENBQUMsU0FBUyxHQUFDLElBQUksQ0FBQztBQUN0QixRQUFNLENBQUMsV0FBVyxHQUFDLENBQUMsQ0FBQztBQUNyQixRQUFNLENBQUMsRUFBRSxHQUFHLFNBQVMsR0FBRyxJQUFJLEVBQUUs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QUFBLENBQUUsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlxuLy9cbi8vIFRPRE9cbi8vXG4vLyBDbGVhbiB1cCB0aGlzIHVnbHkgaW1wbGVtZW50YXRpb25cbi8vIFxuXG5mdW5jdGlvbiBndWlkKCkge1xuICBmdW5jdGlvbiBzNCgpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgIC50b1N0cmluZygxNilcbiAgICAgIC5zdWJzdHJpbmcoMSk7XG4gIH1cbiAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG59XG5cblxudmFyIGx1Y2lmeUVtYmVkID0gZnVuY3Rpb24oaWQsIHVybCkge1xuXG4gIHZhciB0aGlzU2NyaXB0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuXG4gIC8vIHByZXBhcmUgaWZyYW1lXG4gIHZhciBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgaWZyYW1lLndpZHRoPVwiMTAwJVwiO1xuICBpZnJhbWUuc2Nyb2xsaW5nPVwibm9cIjtcbiAgaWZyYW1lLmZyYW1lQm9yZGVyPTA7XG4gIGlmcmFtZS5pZCA9IFwibHVjaWZ5LVwiICsgZ3VpZCgpO1xuXG4gIGlmcmFtZS5zcmMgPSB1cmw7XG5cbiAgLy8gYXBwZW5kIGlmcmFtZSBhZnRlciBzY3JpcHQgdGFnXG4gIHZhciBwYXJlbnQgPSB0aGlzU2NyaXB0LnBhcmVudEVsZW1lbnQ7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUoaWZyYW1lLCB0aGlzU2NyaXB0Lm5leHRTaWJsaW5nKTtcblxuICBpRnJhbWVSZXNpemUoe2xvZzpmYWxzZX0sICcjJyArIGlmcmFtZS5pZCk7XG59XG5cblxud2luZG93Lmx1Y2lmeUVtYmVkID0gbHVjaWZ5RW1iZWQ7XG5cblxuLypcbiAqIEZpbGU6IGlmcmFtZVJlc2l6ZXIuanNcbiAqIERlc2M6IEZvcmNlIGlmcmFtZXMgdG8gc2l6ZSB0byBjb250ZW50LlxuICogUmVxdWlyZXM6IGlmcmFtZVJlc2l6ZXIuY29udGVudFdpbmRvdy5qcyB0byBiZSBsb2FkZWQgaW50byB0aGUgdGFyZ2V0IGZyYW1lLlxuICogRG9jOiBodHRwczovL2dpdGh1Yi5jb20vZGF2aWRqYnJhZHNoYXcvaWZyYW1lLXJlc2l6ZXJcbiAqIEF1dGhvcjogRGF2aWQgSi4gQnJhZHNoYXcgLSBkYXZlQGJyYWRzaGF3Lm5ldFxuICogQ29udHJpYnV0b3I6IEp1cmUgTWF2IC0ganVyZS5tYXZAZ21haWwuY29tXG4gKiBDb250cmlidXRvcjogUmVlZCBEYWRvdW5lIC0gcmVlZEBkYWRvdW5lLmNvbVxuICovXG47KGZ1bmN0aW9uKHdpbmRvdykge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyXG4gICAgY291bnQgICAgICAgICAgICAgICAgID0gMCxcbiAgICBsb2dFbmFibGVkICAgICAgICAgICAgPSBmYWxzZSxcbiAgICBtc2dIZWFkZXIgICAgICAgICAgICAgPSAnbWVzc2FnZScsXG4gICAgbXNnSGVhZGVyTGVuICAgICAgICAgID0gbXNnSGVhZGVyLmxlbmd0aCxcbiAgICBtc2dJZCAgICAgICAgICAgICAgICAgPSAnW2lGcmFtZVNpemVyXScsIC8vTXVzdCBtYXRjaCBpZnJhbWUgbXNnIElEXG4gICAgbXNnSWRMZW4gICAgICAgICAgICAgID0gbXNnSWQubGVuZ3RoLFxuICAgIHBhZ2VQb3NpdGlvbiAgICAgICAgICA9IG51bGwsXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcbiAgICByZXNldFJlcXVpcmVkTWV0aG9kcyAgPSB7bWF4OjEsc2Nyb2xsOjEsYm9keVNjcm9sbDoxLGRvY3VtZW50RWxlbWVudFNjcm9sbDoxfSxcbiAgICBzZXR0aW5ncyAgICAgICAgICAgICAgPSB7fSxcbiAgICB0aW1lciAgICAgICAgICAgICAgICAgPSBudWxsLFxuXG4gICAgZGVmYXVsdHMgICAgICAgICAgICAgID0ge1xuICAgICAgYXV0b1Jlc2l6ZSAgICAgICAgICAgICAgICA6IHRydWUsXG4gICAgICBib2R5QmFja2dyb3VuZCAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIGJvZHlNYXJnaW4gICAgICAgICAgICAgICAgOiBudWxsLFxuICAgICAgYm9keU1hcmdpblYxICAgICAgICAgICAgICA6IDgsXG4gICAgICBib2R5UGFkZGluZyAgICAgICAgICAgICAgIDogbnVsbCxcbiAgICAgIGNoZWNrT3JpZ2luICAgICAgICAgICAgICAgOiB0cnVlLFxuICAgICAgZW5hYmxlSW5QYWdlTGlua3MgICAgICAgICA6IGZhbHNlLFxuICAgICAgZW5hYmxlUHVibGljTWV0aG9kcyAgICAgICA6IGZhbHNlLFxuICAgICAgaGVpZ2h0Q2FsY3VsYXRpb25NZXRob2QgICA6ICdvZmZzZXQnLFxuICAgICAgaW50ZXJ2YWwgICAgICAgICAgICAgICAgICA6IDMyLFxuICAgICAgbG9nICAgICAgICAgICAgICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgbWF4SGVpZ2h0ICAgICAgICAgICAgICAgICA6IEluZmluaXR5LFxuICAgICAgbWF4V2lkdGggICAgICAgICAgICAgICAgICA6IEluZmluaXR5LFxuICAgICAgbWluSGVpZ2h0ICAgICAgICAgICAgICAgICA6IDAsXG4gICAgICBtaW5XaWR0aCAgICAgICAgICAgICAgICAgIDogMCxcbiAgICAgIHJlc2l6ZUZyb20gICAgICAgICAgICAgICAgOiAncGFyZW50JyxcbiAgICAgIHNjcm9sbGluZyAgICAgICAgICAgICAgICAgOiBmYWxzZSxcbiAgICAgIHNpemVIZWlnaHQgICAgICAgICAgICAgICAgOiB0cnVlLFxuICAgICAgc2l6ZVdpZHRoICAgICAgICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgdG9sZXJhbmNlICAgICAgICAgICAgICAgICA6IDAsXG4gICAgICBjbG9zZWRDYWxsYmFjayAgICAgICAgICAgIDogZnVuY3Rpb24oKXt9LFxuICAgICAgaW5pdENhbGxiYWNrICAgICAgICAgICAgICA6IGZ1bmN0aW9uKCl7fSxcbiAgICAgIG1lc3NhZ2VDYWxsYmFjayAgICAgICAgICAgOiBmdW5jdGlvbigpe30sXG4gICAgICByZXNpemVkQ2FsbGJhY2sgICAgICAgICAgIDogZnVuY3Rpb24oKXt9LFxuICAgICAgc2Nyb2xsQ2FsbGJhY2sgICAgICAgICAgICA6IGZ1bmN0aW9uKCl7cmV0dXJuIHRydWU7fVxuICAgIH07XG5cbiAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcihvYmosZXZ0LGZ1bmMpe1xuICAgIGlmICgnYWRkRXZlbnRMaXN0ZW5lcicgaW4gd2luZG93KXtcbiAgICAgIG9iai5hZGRFdmVudExpc3RlbmVyKGV2dCxmdW5jLCBmYWxzZSk7XG4gICAgfSBlbHNlIGlmICgnYXR0YWNoRXZlbnQnIGluIHdpbmRvdyl7Ly9JRVxuICAgICAgb2JqLmF0dGFjaEV2ZW50KCdvbicrZXZ0LGZ1bmMpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldHVwUmVxdWVzdEFuaW1hdGlvbkZyYW1lKCl7XG4gICAgdmFyXG4gICAgICB2ZW5kb3JzID0gWydtb3onLCAnd2Via2l0JywgJ28nLCAnbXMnXSxcbiAgICAgIHg7XG5cbiAgICAvLyBSZW1vdmUgdmVuZG9yIHByZWZpeGluZyBpZiBwcmVmaXhlZCBhbmQgYnJlYWsgZWFybHkgaWYgbm90XG4gICAgZm9yICh4ID0gMDsgeCA8IHZlbmRvcnMubGVuZ3RoICYmICFyZXF1ZXN0QW5pbWF0aW9uRnJhbWU7IHggKz0gMSkge1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbeF0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG4gICAgfVxuXG4gICAgaWYgKCEocmVxdWVzdEFuaW1hdGlvbkZyYW1lKSl7XG4gICAgICBsb2coJyBSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgbm90IHN1cHBvcnRlZCcpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE15SUQoKXtcbiAgICB2YXIgcmV0U3RyID0gJ0hvc3QgcGFnZSc7XG5cbiAgICBpZiAod2luZG93LnRvcCE9PXdpbmRvdy5zZWxmKXtcbiAgICAgIGlmICh3aW5kb3cucGFyZW50SUZyYW1lKXtcbiAgICAgICAgcmV0U3RyID0gd2luZG93LnBhcmVudElGcmFtZS5nZXRJZCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0U3RyID0gJ05lc3RlZCBob3N0IHBhZ2UnO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXRTdHI7XG4gIH1cblxuICBmdW5jdGlvbiBmb3JtYXRMb2dNc2cobXNnKXtcbiAgICByZXR1cm4gbXNnSWQgKyAnWycgKyBnZXRNeUlEKCkgKyAnXScgKyBtc2c7XG4gIH1cblxuICBmdW5jdGlvbiBsb2cobXNnKXtcbiAgICBpZiAobG9nRW5hYmxlZCAmJiAoJ29iamVjdCcgPT09IHR5cGVvZiB3aW5kb3cuY29uc29sZSkpe1xuICAgICAgY29uc29sZS5sb2coZm9ybWF0TG9nTXNnKG1zZykpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdhcm4obXNnKXtcbiAgICBpZiAoJ29iamVjdCcgPT09IHR5cGVvZiB3aW5kb3cuY29uc29sZSl7XG4gICAgICBjb25zb2xlLndhcm4oZm9ybWF0TG9nTXNnKG1zZykpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGlGcmFtZUxpc3RlbmVyKGV2ZW50KXtcbiAgICBmdW5jdGlvbiByZXNpemVJRnJhbWUoKXtcbiAgICAgIGZ1bmN0aW9uIHJlc2l6ZSgpe1xuICAgICAgICBzZXRTaXplKG1lc3NhZ2VEYXRhKTtcbiAgICAgICAgc2V0UGFnZVBvc2l0aW9uKCk7XG4gICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5yZXNpemVkQ2FsbGJhY2sobWVzc2FnZURhdGEpO1xuICAgICAgfVxuXG4gICAgICBlbnN1cmVJblJhbmdlKCdIZWlnaHQnKTtcbiAgICAgIGVuc3VyZUluUmFuZ2UoJ1dpZHRoJyk7XG5cbiAgICAgIHN5bmNSZXNpemUocmVzaXplLG1lc3NhZ2VEYXRhLCdyZXNldFBhZ2UnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbG9zZUlGcmFtZShpZnJhbWUpe1xuICAgICAgdmFyIGlmcmFtZUlkID0gaWZyYW1lLmlkO1xuXG4gICAgICBsb2coJyBSZW1vdmluZyBpRnJhbWU6ICcraWZyYW1lSWQpO1xuICAgICAgaWZyYW1lLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoaWZyYW1lKTtcbiAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5jbG9zZWRDYWxsYmFjayhpZnJhbWVJZCk7XG4gICAgICBkZWxldGUgc2V0dGluZ3NbaWZyYW1lSWRdO1xuICAgICAgbG9nKCcgLS0nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzTXNnKCl7XG4gICAgICB2YXIgZGF0YSA9IG1zZy5zdWJzdHIobXNnSWRMZW4pLnNwbGl0KCc6Jyk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlmcmFtZTogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoZGF0YVswXSksXG4gICAgICAgIGlkOiAgICAgZGF0YVswXSxcbiAgICAgICAgaGVpZ2h0OiBkYXRhWzFdLFxuICAgICAgICB3aWR0aDogIGRhdGFbMl0sXG4gICAgICAgIHR5cGU6ICAgZGF0YVszXVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbnN1cmVJblJhbmdlKERpbWVuc2lvbil7XG4gICAgICB2YXJcbiAgICAgICAgbWF4ICA9IE51bWJlcihzZXR0aW5nc1tpZnJhbWVJZF1bJ21heCcrRGltZW5zaW9uXSksXG4gICAgICAgIG1pbiAgPSBOdW1iZXIoc2V0dGluZ3NbaWZyYW1lSWRdWydtaW4nK0RpbWVuc2lvbl0pLFxuICAgICAgICBkaW1lbnNpb24gPSBEaW1lbnNpb24udG9Mb3dlckNhc2UoKSxcbiAgICAgICAgc2l6ZSA9IE51bWJlcihtZXNzYWdlRGF0YVtkaW1lbnNpb25dKTtcblxuICAgICAgaWYgKG1pbj5tYXgpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZhbHVlIGZvciBtaW4nK0RpbWVuc2lvbisnIGNhbiBub3QgYmUgZ3JlYXRlciB0aGFuIG1heCcrRGltZW5zaW9uKTtcbiAgICAgIH1cblxuICAgICAgbG9nKCcgQ2hlY2tpbmcgJytkaW1lbnNpb24rJyBpcyBpbiByYW5nZSAnK21pbisnLScrbWF4KTtcblxuICAgICAgaWYgKHNpemU8bWluKSB7XG4gICAgICAgIHNpemU9bWluO1xuICAgICAgICBsb2coJyBTZXQgJytkaW1lbnNpb24rJyB0byBtaW4gdmFsdWUnKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNpemU+bWF4KSB7XG4gICAgICAgIHNpemU9bWF4O1xuICAgICAgICBsb2coJyBTZXQgJytkaW1lbnNpb24rJyB0byBtYXggdmFsdWUnKTtcbiAgICAgIH1cblxuICAgICAgbWVzc2FnZURhdGFbZGltZW5zaW9uXT0nJytzaXplO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gaXNNZXNzYWdlRnJvbUlGcmFtZSgpe1xuICAgICAgZnVuY3Rpb24gY2hlY2tBbGxvd2VkT3JpZ2luKCl7XG4gICAgICAgIGZ1bmN0aW9uIGNoZWNrTGlzdCgpe1xuICAgICAgICAgIGxvZygnIENoZWNraW5nIGNvbm5lY3Rpb24gaXMgZnJvbSBhbGxvd2VkIGxpc3Qgb2Ygb3JpZ2luczogJyArIGNoZWNrT3JpZ2luKTtcbiAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2hlY2tPcmlnaW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjaGVja09yaWdpbltpXSA9PT0gb3JpZ2luKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjaGVja1NpbmdsZSgpe1xuICAgICAgICAgIGxvZygnIENoZWNraW5nIGNvbm5lY3Rpb24gaXMgZnJvbTogJytyZW1vdGVIb3N0KTtcbiAgICAgICAgICByZXR1cm4gb3JpZ2luID09PSByZW1vdGVIb3N0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoZWNrT3JpZ2luLmNvbnN0cnVjdG9yID09PSBBcnJheSA/IGNoZWNrTGlzdCgpIDogY2hlY2tTaW5nbGUoKTtcbiAgICAgIH1cblxuICAgICAgdmFyXG4gICAgICAgIG9yaWdpbiAgICAgID0gZXZlbnQub3JpZ2luLFxuICAgICAgICBjaGVja09yaWdpbiA9IHNldHRpbmdzW2lmcmFtZUlkXS5jaGVja09yaWdpbixcbiAgICAgICAgcmVtb3RlSG9zdCAgPSBtZXNzYWdlRGF0YS5pZnJhbWUuc3JjLnNwbGl0KCcvJykuc2xpY2UoMCwzKS5qb2luKCcvJyk7XG5cbiAgICAgIGlmIChjaGVja09yaWdpbikge1xuICAgICAgICBpZiAoKCcnK29yaWdpbiAhPT0gJ251bGwnKSAmJiAhY2hlY2tBbGxvd2VkT3JpZ2luKCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnVW5leHBlY3RlZCBtZXNzYWdlIHJlY2VpdmVkIGZyb206ICcgKyBvcmlnaW4gK1xuICAgICAgICAgICAgJyBmb3IgJyArIG1lc3NhZ2VEYXRhLmlmcmFtZS5pZCArXG4gICAgICAgICAgICAnLiBNZXNzYWdlIHdhczogJyArIGV2ZW50LmRhdGEgK1xuICAgICAgICAgICAgJy4gVGhpcyBlcnJvciBjYW4gYmUgZGlzYWJsZWQgYnkgc2V0dGluZyB0aGUgY2hlY2tPcmlnaW46IGZhbHNlIG9wdGlvbiBvciBieSBwcm92aWRpbmcgb2YgYXJyYXkgb2YgdHJ1c3RlZCBkb21haW5zLidcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzTWVzc2FnZUZvclVzKCl7XG4gICAgICByZXR1cm4gbXNnSWQgPT09ICgnJyArIG1zZykuc3Vic3RyKDAsbXNnSWRMZW4pOyAvLycnK1Byb3RlY3RzIGFnYWluc3Qgbm9uLXN0cmluZyBtc2dcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc01lc3NhZ2VGcm9tTWV0YVBhcmVudCgpe1xuICAgICAgLy9UZXN0IGlmIHRoaXMgbWVzc2FnZSBpcyBmcm9tIGEgcGFyZW50IGFib3ZlIHVzLiBUaGlzIGlzIGFuIHVnbHkgdGVzdCwgaG93ZXZlciwgdXBkYXRpbmdcbiAgICAgIC8vdGhlIG1lc3NhZ2UgZm9ybWF0IHdvdWxkIGJyZWFrIGJhY2t3YXJkcyBjb21wYXRpYml0eS5cbiAgICAgIHZhciByZXRDb2RlID0gbWVzc2FnZURhdGEudHlwZSBpbiB7J3RydWUnOjEsJ2ZhbHNlJzoxLCd1bmRlZmluZWQnOjF9O1xuXG4gICAgICBpZiAocmV0Q29kZSl7XG4gICAgICAgIGxvZygnIElnbm9yaW5nIGluaXQgbWVzc2FnZSBmcm9tIG1ldGEgcGFyZW50IHBhZ2UnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJldENvZGU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0TXNnQm9keShvZmZzZXQpe1xuICAgICAgcmV0dXJuIG1zZy5zdWJzdHIobXNnLmluZGV4T2YoJzonKSttc2dIZWFkZXJMZW4rb2Zmc2V0KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmb3J3YXJkTXNnRnJvbUlGcmFtZShtc2dCb2R5KXtcbiAgICAgIGxvZygnIE1lc3NhZ2VDYWxsYmFjayBwYXNzZWQ6IHtpZnJhbWU6ICcrIG1lc3NhZ2VEYXRhLmlmcmFtZS5pZCArICcsIG1lc3NhZ2U6ICcgKyBtc2dCb2R5ICsgJ30nKTtcbiAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5tZXNzYWdlQ2FsbGJhY2soe1xuICAgICAgICBpZnJhbWU6IG1lc3NhZ2VEYXRhLmlmcmFtZSxcbiAgICAgICAgbWVzc2FnZTogSlNPTi5wYXJzZShtc2dCb2R5KVxuICAgICAgfSk7XG4gICAgICBsb2coJyAtLScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNoZWNrSUZyYW1lRXhpc3RzKCl7XG4gICAgICBpZiAobnVsbCA9PT0gbWVzc2FnZURhdGEuaWZyYW1lKSB7XG4gICAgICAgIHdhcm4oJyBJRnJhbWUgKCcrbWVzc2FnZURhdGEuaWQrJykgbm90IGZvdW5kJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEVsZW1lbnRQb3NpdGlvbih0YXJnZXQpe1xuICAgICAgdmFyXG4gICAgICAgIGlGcmFtZVBvc2l0aW9uID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICBnZXRQYWdlUG9zaXRpb24oKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogcGFyc2VJbnQoaUZyYW1lUG9zaXRpb24ubGVmdCwgMTApICsgcGFyc2VJbnQocGFnZVBvc2l0aW9uLngsIDEwKSxcbiAgICAgICAgeTogcGFyc2VJbnQoaUZyYW1lUG9zaXRpb24udG9wLCAxMCkgICsgcGFyc2VJbnQocGFnZVBvc2l0aW9uLnksIDEwKVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzY3JvbGxSZXF1ZXN0RnJvbUNoaWxkKGFkZE9mZnNldCl7XG4gICAgICBmdW5jdGlvbiByZXBvc2l0aW9uKCl7XG4gICAgICAgIHBhZ2VQb3NpdGlvbiA9IG5ld1Bvc2l0aW9uO1xuXG4gICAgICAgIHNjcm9sbFRvKCk7XG5cbiAgICAgICAgbG9nKCcgLS0nKTtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2FsY09mZnNldCgpe1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHg6IE51bWJlcihtZXNzYWdlRGF0YS53aWR0aCkgKyBvZmZzZXQueCxcbiAgICAgICAgICB5OiBOdW1iZXIobWVzc2FnZURhdGEuaGVpZ2h0KSArIG9mZnNldC55XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHZhclxuICAgICAgICBvZmZzZXQgPSBhZGRPZmZzZXQgPyBnZXRFbGVtZW50UG9zaXRpb24obWVzc2FnZURhdGEuaWZyYW1lKSA6IHt4OjAseTowfSxcbiAgICAgICAgbmV3UG9zaXRpb24gPSBjYWxjT2Zmc2V0KCk7XG5cbiAgICAgIGxvZygnIFJlcG9zaXRpb24gcmVxdWVzdGVkIGZyb20gaUZyYW1lIChvZmZzZXQgeDonK29mZnNldC54KycgeTonK29mZnNldC55KycpJyk7XG5cbiAgICAgIGlmKHdpbmRvdy50b3AhPT13aW5kb3cuc2VsZil7XG4gICAgICAgIGlmICh3aW5kb3cucGFyZW50SUZyYW1lKXtcbiAgICAgICAgICBpZiAoYWRkT2Zmc2V0KXtcbiAgICAgICAgICAgIHdpbmRvdy5wYXJlbnRJRnJhbWUuc2Nyb2xsVG9PZmZzZXQobmV3UG9zaXRpb24ueCxuZXdQb3NpdGlvbi55KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2luZG93LnBhcmVudElGcmFtZS5zY3JvbGxUbyhtZXNzYWdlRGF0YS53aWR0aCxtZXNzYWdlRGF0YS5oZWlnaHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3YXJuKCcgVW5hYmxlIHRvIHNjcm9sbCB0byByZXF1ZXN0ZWQgcG9zaXRpb24sIHdpbmRvdy5wYXJlbnRJRnJhbWUgbm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcG9zaXRpb24oKTtcbiAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNjcm9sbFRvKCl7XG4gICAgICBpZiAoZmFsc2UgIT09IHNldHRpbmdzW2lmcmFtZUlkXS5zY3JvbGxDYWxsYmFjayhwYWdlUG9zaXRpb24pKXtcbiAgICAgICAgc2V0UGFnZVBvc2l0aW9uKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmluZFRhcmdldChsb2NhdGlvbil7XG4gICAgICBmdW5jdGlvbiBqdW1wVG9UYXJnZXQodGFyZ2V0KXtcbiAgICAgICAgdmFyIGp1bXBQb3NpdGlvbiA9IGdldEVsZW1lbnRQb3NpdGlvbih0YXJnZXQpO1xuXG4gICAgICAgIGxvZygnIE1vdmluZyB0byBpbiBwYWdlIGxpbmsgKCMnK2hhc2grJykgYXQgeDogJytqdW1wUG9zaXRpb24ueCsnIHk6ICcranVtcFBvc2l0aW9uLnkpO1xuICAgICAgICBwYWdlUG9zaXRpb24gPSB7XG4gICAgICAgICAgeDoganVtcFBvc2l0aW9uLngsXG4gICAgICAgICAgeToganVtcFBvc2l0aW9uLnlcbiAgICAgICAgfTtcblxuICAgICAgICBzY3JvbGxUbygpO1xuICAgICAgICBsb2coJyAtLScpO1xuICAgICAgfVxuXG4gICAgICB2YXJcbiAgICAgICAgaGFzaCAgICAgPSBsb2NhdGlvbi5zcGxpdCgnIycpWzFdIHx8ICcnLFxuICAgICAgICBoYXNoRGF0YSA9IGRlY29kZVVSSUNvbXBvbmVudChoYXNoKSxcbiAgICAgICAgdGFyZ2V0ICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChoYXNoRGF0YSkgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoaGFzaERhdGEpWzBdO1xuXG4gICAgICBpZih3aW5kb3cudG9wIT09d2luZG93LnNlbGYpe1xuICAgICAgICBpZiAod2luZG93LnBhcmVudElGcmFtZSl7XG4gICAgICAgICAgd2luZG93LnBhcmVudElGcmFtZS5tb3ZlVG9BbmNob3IoaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nKCcgSW4gcGFnZSBsaW5rICMnK2hhc2grJyBub3QgZm91bmQgYW5kIHdpbmRvdy5wYXJlbnRJRnJhbWUgbm90IGZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0KXtcbiAgICAgICAganVtcFRvVGFyZ2V0KHRhcmdldCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2coJyBJbiBwYWdlIGxpbmsgIycraGFzaCsnIG5vdCBmb3VuZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFjdGlvbk1zZygpe1xuICAgICAgc3dpdGNoKG1lc3NhZ2VEYXRhLnR5cGUpe1xuICAgICAgICBjYXNlICdjbG9zZSc6XG4gICAgICAgICAgY2xvc2VJRnJhbWUobWVzc2FnZURhdGEuaWZyYW1lKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbWVzc2FnZSc6XG4gICAgICAgICAgZm9yd2FyZE1zZ0Zyb21JRnJhbWUoZ2V0TXNnQm9keSg2KSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3Njcm9sbFRvJzpcbiAgICAgICAgICBzY3JvbGxSZXF1ZXN0RnJvbUNoaWxkKGZhbHNlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc2Nyb2xsVG9PZmZzZXQnOlxuICAgICAgICAgIHNjcm9sbFJlcXVlc3RGcm9tQ2hpbGQodHJ1ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2luUGFnZUxpbmsnOlxuICAgICAgICAgIGZpbmRUYXJnZXQoZ2V0TXNnQm9keSg5KSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3Jlc2V0JzpcbiAgICAgICAgICByZXNldElGcmFtZShtZXNzYWdlRGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgIHJlc2l6ZUlGcmFtZSgpO1xuICAgICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5pbml0Q2FsbGJhY2sobWVzc2FnZURhdGEuaWZyYW1lKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXNpemVJRnJhbWUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYXNTZXR0aW5ncyhpZnJhbWVJZCl7XG4gICAgICB2YXIgcmV0Qm9vbCA9IHRydWU7XG5cbiAgICAgIGlmICghc2V0dGluZ3NbaWZyYW1lSWRdKXtcbiAgICAgICAgcmV0Qm9vbCA9IGZhbHNlO1xuICAgICAgICB3YXJuKG1lc3NhZ2VEYXRhLnR5cGUgKyAnIE5vIHNldHRpbmdzIGZvciAnICsgaWZyYW1lSWQgKyAnLiBNZXNzYWdlIHdhczogJyArIG1zZyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXRCb29sO1xuICAgIH1cblxuICAgIHZhclxuICAgICAgbXNnID0gZXZlbnQuZGF0YSxcbiAgICAgIG1lc3NhZ2VEYXRhID0ge30sXG4gICAgICBpZnJhbWVJZCA9IG51bGw7XG5cbiAgICBpZiAoaXNNZXNzYWdlRm9yVXMoKSl7XG4gICAgICBtZXNzYWdlRGF0YSA9IHByb2Nlc3NNc2coKTtcbiAgICAgIGlmcmFtZUlkICAgID0gbWVzc2FnZURhdGEuaWQ7XG5cbiAgICAgIGlmICghaXNNZXNzYWdlRnJvbU1ldGFQYXJlbnQoKSAmJiBoYXNTZXR0aW5ncyhpZnJhbWVJZCkpe1xuICAgICAgICBsb2dFbmFibGVkICA9IHNldHRpbmdzW2lmcmFtZUlkXS5sb2c7XG4gICAgICAgIGxvZygnIFJlY2VpdmVkOiAnK21zZyk7XG5cbiAgICAgICAgaWYgKCBjaGVja0lGcmFtZUV4aXN0cygpICYmIGlzTWVzc2FnZUZyb21JRnJhbWUoKSApe1xuICAgICAgICAgIHNldHRpbmdzW2lmcmFtZUlkXS5maXJzdFJ1biA9IGZhbHNlO1xuICAgICAgICAgIGFjdGlvbk1zZygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBmdW5jdGlvbiBnZXRQYWdlUG9zaXRpb24gKCl7XG4gICAgaWYobnVsbCA9PT0gcGFnZVBvc2l0aW9uKXtcbiAgICAgIHBhZ2VQb3NpdGlvbiA9IHtcbiAgICAgICAgeDogKHdpbmRvdy5wYWdlWE9mZnNldCAhPT0gdW5kZWZpbmVkKSA/IHdpbmRvdy5wYWdlWE9mZnNldCA6IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0LFxuICAgICAgICB5OiAod2luZG93LnBhZ2VZT2Zmc2V0ICE9PSB1bmRlZmluZWQpID8gd2luZG93LnBhZ2VZT2Zmc2V0IDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcFxuICAgICAgfTtcbiAgICAgIGxvZygnIEdldCBwYWdlIHBvc2l0aW9uOiAnK3BhZ2VQb3NpdGlvbi54KycsJytwYWdlUG9zaXRpb24ueSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0UGFnZVBvc2l0aW9uKCl7XG4gICAgaWYobnVsbCAhPT0gcGFnZVBvc2l0aW9uKXtcbiAgICAgIHdpbmRvdy5zY3JvbGxUbyhwYWdlUG9zaXRpb24ueCxwYWdlUG9zaXRpb24ueSk7XG4gICAgICBsb2coJyBTZXQgcGFnZSBwb3NpdGlvbjogJytwYWdlUG9zaXRpb24ueCsnLCcrcGFnZVBvc2l0aW9uLnkpO1xuICAgICAgcGFnZVBvc2l0aW9uID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXNldElGcmFtZShtZXNzYWdlRGF0YSl7XG4gICAgZnVuY3Rpb24gcmVzZXQoKXtcbiAgICAgIHNldFNpemUobWVzc2FnZURhdGEpO1xuICAgICAgdHJpZ2dlcigncmVzZXQnLCdyZXNldCcsbWVzc2FnZURhdGEuaWZyYW1lLG1lc3NhZ2VEYXRhLmlkKTtcbiAgICB9XG5cbiAgICBsb2coJyBTaXplIHJlc2V0IHJlcXVlc3RlZCBieSAnKygnaW5pdCc9PT1tZXNzYWdlRGF0YS50eXBlPydob3N0IHBhZ2UnOidpRnJhbWUnKSk7XG4gICAgZ2V0UGFnZVBvc2l0aW9uKCk7XG4gICAgc3luY1Jlc2l6ZShyZXNldCxtZXNzYWdlRGF0YSwnaW5pdCcpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0U2l6ZShtZXNzYWdlRGF0YSl7XG4gICAgZnVuY3Rpb24gc2V0RGltZW5zaW9uKGRpbWVuc2lvbil7XG4gICAgICBtZXNzYWdlRGF0YS5pZnJhbWUuc3R5bGVbZGltZW5zaW9uXSA9IG1lc3NhZ2VEYXRhW2RpbWVuc2lvbl0gKyAncHgnO1xuICAgICAgbG9nKFxuICAgICAgICAnIElGcmFtZSAoJyArIGlmcmFtZUlkICtcbiAgICAgICAgJykgJyArIGRpbWVuc2lvbiArXG4gICAgICAgICcgc2V0IHRvICcgKyBtZXNzYWdlRGF0YVtkaW1lbnNpb25dICsgJ3B4J1xuICAgICAgKTtcbiAgICB9XG4gICAgdmFyIGlmcmFtZUlkID0gbWVzc2FnZURhdGEuaWZyYW1lLmlkO1xuICAgIGlmKCBzZXR0aW5nc1tpZnJhbWVJZF0uc2l6ZUhlaWdodCkgeyBzZXREaW1lbnNpb24oJ2hlaWdodCcpOyB9XG4gICAgaWYoIHNldHRpbmdzW2lmcmFtZUlkXS5zaXplV2lkdGggKSB7IHNldERpbWVuc2lvbignd2lkdGgnKTsgfVxuICB9XG5cbiAgZnVuY3Rpb24gc3luY1Jlc2l6ZShmdW5jLG1lc3NhZ2VEYXRhLGRvTm90U3luYyl7XG4gICAgaWYoZG9Ob3RTeW5jIT09bWVzc2FnZURhdGEudHlwZSAmJiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUpe1xuICAgICAgbG9nKCcgUmVxdWVzdGluZyBhbmltYXRpb24gZnJhbWUnKTtcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnVuYygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHRyaWdnZXIoY2FsbGVlTXNnLG1zZyxpZnJhbWUsaWQpe1xuICAgIGlmKGlmcmFtZSAmJiBpZnJhbWUuY29udGVudFdpbmRvdyl7XG4gICAgICBsb2coJ1snICsgY2FsbGVlTXNnICsgJ10gU2VuZGluZyBtc2cgdG8gaWZyYW1lICgnK21zZysnKScpO1xuICAgICAgaWZyYW1lLmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoIG1zZ0lkICsgbXNnLCAnKicgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2FybignWycgKyBjYWxsZWVNc2cgKyAnXSBJRnJhbWUgbm90IGZvdW5kJyk7XG4gICAgICBpZihzZXR0aW5nc1tpZF0pIHtcbiAgICAgICAgZGVsZXRlIHNldHRpbmdzW2lkXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIGZ1bmN0aW9uIHNldHVwSUZyYW1lKG9wdGlvbnMpe1xuICAgIGZ1bmN0aW9uIHNldExpbWl0cygpe1xuICAgICAgZnVuY3Rpb24gYWRkU3R5bGUoc3R5bGUpe1xuICAgICAgICBpZiAoKEluZmluaXR5ICE9PSBzZXR0aW5nc1tpZnJhbWVJZF1bc3R5bGVdKSAmJiAoMCAhPT0gc2V0dGluZ3NbaWZyYW1lSWRdW3N0eWxlXSkpe1xuICAgICAgICAgIGlmcmFtZS5zdHlsZVtzdHlsZV0gPSBzZXR0aW5nc1tpZnJhbWVJZF1bc3R5bGVdICsgJ3B4JztcbiAgICAgICAgICBsb2coJyBTZXQgJytzdHlsZSsnID0gJytzZXR0aW5nc1tpZnJhbWVJZF1bc3R5bGVdKydweCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGFkZFN0eWxlKCdtYXhIZWlnaHQnKTtcbiAgICAgIGFkZFN0eWxlKCdtaW5IZWlnaHQnKTtcbiAgICAgIGFkZFN0eWxlKCdtYXhXaWR0aCcpO1xuICAgICAgYWRkU3R5bGUoJ21pbldpZHRoJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZW5zdXJlSGFzSWQoaWZyYW1lSWQpe1xuICAgICAgaWYgKCcnPT09aWZyYW1lSWQpe1xuICAgICAgICBpZnJhbWUuaWQgPSBpZnJhbWVJZCA9ICdpRnJhbWVSZXNpemVyJyArIGNvdW50Kys7XG4gICAgICAgIGxvZ0VuYWJsZWQgPSAob3B0aW9ucyB8fCB7fSkubG9nO1xuICAgICAgICBsb2coJyBBZGRlZCBtaXNzaW5nIGlmcmFtZSBJRDogJysgaWZyYW1lSWQgKycgKCcgKyBpZnJhbWUuc3JjICsgJyknKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGlmcmFtZUlkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldFNjcm9sbGluZygpe1xuICAgICAgbG9nKCcgSUZyYW1lIHNjcm9sbGluZyAnICsgKHNldHRpbmdzW2lmcmFtZUlkXS5zY3JvbGxpbmcgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnKSArICcgZm9yICcgKyBpZnJhbWVJZCk7XG4gICAgICBpZnJhbWUuc3R5bGUub3ZlcmZsb3cgPSBmYWxzZSA9PT0gc2V0dGluZ3NbaWZyYW1lSWRdLnNjcm9sbGluZyA/ICdoaWRkZW4nIDogJ2F1dG8nO1xuICAgICAgaWZyYW1lLnNjcm9sbGluZyAgICAgID0gZmFsc2UgPT09IHNldHRpbmdzW2lmcmFtZUlkXS5zY3JvbGxpbmcgPyAnbm8nIDogJ3llcyc7XG4gICAgfVxuXG4gICAgLy9UaGUgVjEgaUZyYW1lIHNjcmlwdCBleHBlY3RzIGFuIGludCwgd2hlcmUgYXMgaW4gVjIgZXhwZWN0cyBhIENTU1xuICAgIC8vc3RyaW5nIHZhbHVlIHN1Y2ggYXMgJzFweCAzZW0nLCBzbyBpZiB3ZSBoYXZlIGFuIGludCBmb3IgVjIsIHNldCBWMT1WMlxuICAgIC8vYW5kIHRoZW4gY29udmVydCBWMiB0byBhIHN0cmluZyBQWCB2YWx1ZS5cbiAgICBmdW5jdGlvbiBzZXR1cEJvZHlNYXJnaW5WYWx1ZXMoKXtcbiAgICAgIGlmICgoJ251bWJlcic9PT10eXBlb2Yoc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW4pKSB8fCAoJzAnPT09c2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW4pKXtcbiAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdLmJvZHlNYXJnaW5WMSA9IHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luO1xuICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbiAgID0gJycgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbiArICdweCc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlT3V0Z29pbmdNc2coKXtcbiAgICAgIHJldHVybiBpZnJhbWVJZCArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5TWFyZ2luVjEgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uc2l6ZVdpZHRoICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmxvZyArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5pbnRlcnZhbCArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5lbmFibGVQdWJsaWNNZXRob2RzICtcbiAgICAgICAgJzonICsgc2V0dGluZ3NbaWZyYW1lSWRdLmF1dG9SZXNpemUgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uYm9keU1hcmdpbiArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5oZWlnaHRDYWxjdWxhdGlvbk1ldGhvZCArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5QmFja2dyb3VuZCArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS5ib2R5UGFkZGluZyArXG4gICAgICAgICc6JyArIHNldHRpbmdzW2lmcmFtZUlkXS50b2xlcmFuY2UgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0uZW5hYmxlSW5QYWdlTGlua3MgK1xuICAgICAgICAnOicgKyBzZXR0aW5nc1tpZnJhbWVJZF0ucmVzaXplRnJvbTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0KG1zZyl7XG4gICAgICAvL1dlIGhhdmUgdG8gY2FsbCB0cmlnZ2VyIHR3aWNlLCBhcyB3ZSBjYW4gbm90IGJlIHN1cmUgaWYgYWxsXG4gICAgICAvL2lmcmFtZXMgaGF2ZSBjb21wbGV0ZWQgbG9hZGluZyB3aGVuIHRoaXMgY29kZSBydW5zLiBUaGVcbiAgICAgIC8vZXZlbnQgbGlzdGVuZXIgYWxzbyBjYXRjaGVzIHRoZSBwYWdlIGNoYW5naW5nIGluIHRoZSBpRnJhbWUuXG4gICAgICBhZGRFdmVudExpc3RlbmVyKGlmcmFtZSwnbG9hZCcsZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGZyID0gc2V0dGluZ3NbaWZyYW1lSWRdLmZpcnN0UnVuOyAgIC8vIFJlZHVjZSBzY29wZSBvZiB2YXIgdG8gZnVuY3Rpb24sIGJlY2F1c2UgSUU4J3MgSlMgZXhlY3V0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnRleHQgc3RhY2sgaXMgYm9ya2VkIGFuZCB0aGlzIHZhbHVlIGdldHMgZXh0ZXJuYWxseVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjaGFuZ2VkIG1pZHdheSB0aHJvdWdoIHJ1bm5pbmcgdGhpcyBmdW5jdGlvbi5cbiAgICAgICAgdHJpZ2dlcignaUZyYW1lLm9ubG9hZCcsbXNnLGlmcmFtZSk7XG4gICAgICAgIGlmICghZnIgJiYgc2V0dGluZ3NbaWZyYW1lSWRdLmhlaWdodENhbGN1bGF0aW9uTWV0aG9kIGluIHJlc2V0UmVxdWlyZWRNZXRob2RzKXtcbiAgICAgICAgICByZXNldElGcmFtZSh7XG4gICAgICAgICAgICBpZnJhbWU6aWZyYW1lLFxuICAgICAgICAgICAgaGVpZ2h0OjAsXG4gICAgICAgICAgICB3aWR0aDowLFxuICAgICAgICAgICAgdHlwZTonaW5pdCdcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0cmlnZ2VyKCdpbml0Jyxtc2csaWZyYW1lKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja09wdGlvbnMob3B0aW9ucyl7XG4gICAgICBpZiAoJ29iamVjdCcgIT09IHR5cGVvZiBvcHRpb25zKXtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignT3B0aW9ucyBpcyBub3QgYW4gb2JqZWN0LicpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2Nlc3NPcHRpb25zKG9wdGlvbnMpe1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICBzZXR0aW5nc1tpZnJhbWVJZF0gPSB7XG4gICAgICAgIGZpcnN0UnVuOiB0cnVlXG4gICAgICB9O1xuXG4gICAgICBjaGVja09wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgIGZvciAodmFyIG9wdGlvbiBpbiBkZWZhdWx0cykge1xuICAgICAgICBpZiAoZGVmYXVsdHMuaGFzT3duUHJvcGVydHkob3B0aW9uKSl7XG4gICAgICAgICAgc2V0dGluZ3NbaWZyYW1lSWRdW29wdGlvbl0gPSBvcHRpb25zLmhhc093blByb3BlcnR5KG9wdGlvbikgPyBvcHRpb25zW29wdGlvbl0gOiBkZWZhdWx0c1tvcHRpb25dO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ0VuYWJsZWQgPSBzZXR0aW5nc1tpZnJhbWVJZF0ubG9nO1xuICAgIH1cblxuICAgIHZhclxuICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgIGlmcmFtZSAgID0gdGhpcyxcbiAgICAgIGlmcmFtZUlkID0gZW5zdXJlSGFzSWQoaWZyYW1lLmlkKTtcblxuICAgIHByb2Nlc3NPcHRpb25zKG9wdGlvbnMpO1xuICAgIHNldFNjcm9sbGluZygpO1xuICAgIHNldExpbWl0cygpO1xuICAgIHNldHVwQm9keU1hcmdpblZhbHVlcygpO1xuICAgIGluaXQoY3JlYXRlT3V0Z29pbmdNc2coKSk7XG4gIH1cblxuICBmdW5jdGlvbiB0aHJvdHRsZShmbix0aW1lKXtcbiAgICBpZiAobnVsbCA9PT0gdGltZXIpe1xuICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgIHRpbWVyID0gbnVsbDtcbiAgICAgICAgZm4oKTtcbiAgICAgIH0sIHRpbWUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdpblJlc2l6ZSgpe1xuICAgIGZ1bmN0aW9uIGlzSUZyYW1lUmVzaXplRW5hYmxlZChpZnJhbWVJZCkge1xuICAgICAgcmV0dXJuICAncGFyZW50JyA9PT0gc2V0dGluZ3NbaWZyYW1lSWRdLnJlc2l6ZUZyb20gJiZcbiAgICAgICAgICBzZXR0aW5nc1tpZnJhbWVJZF0uYXV0b1Jlc2l6ZSAmJlxuICAgICAgICAgICFzZXR0aW5nc1tpZnJhbWVJZF0uZmlyc3RSdW47XG4gICAgfVxuXG4gICAgdGhyb3R0bGUoZnVuY3Rpb24oKXtcbiAgICAgIGZvciAodmFyIGlmcmFtZUlkIGluIHNldHRpbmdzKXtcbiAgICAgICAgaWYoaXNJRnJhbWVSZXNpemVFbmFibGVkKGlmcmFtZUlkKSl7XG4gICAgICAgICAgdHJpZ2dlcignV2luZG93IHJlc2l6ZScsJ3Jlc2l6ZScsZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWZyYW1lSWQpLGlmcmFtZUlkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sNjYpO1xuICB9XG5cbiAgZnVuY3Rpb24gZmFjdG9yeSgpe1xuICAgIGZ1bmN0aW9uIGluaXQoZWxlbWVudCwgb3B0aW9ucyl7XG4gICAgICBpZighZWxlbWVudC50YWdOYW1lKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdCBpcyBub3QgYSB2YWxpZCBET00gZWxlbWVudCcpO1xuICAgICAgfSBlbHNlIGlmICgnSUZSQU1FJyAhPT0gZWxlbWVudC50YWdOYW1lLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgPElGUkFNRT4gdGFnLCBmb3VuZCA8JytlbGVtZW50LnRhZ05hbWUrJz4uJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXR1cElGcmFtZS5jYWxsKGVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwUmVxdWVzdEFuaW1hdGlvbkZyYW1lKCk7XG4gICAgYWRkRXZlbnRMaXN0ZW5lcih3aW5kb3csJ21lc3NhZ2UnLGlGcmFtZUxpc3RlbmVyKTtcbiAgICBhZGRFdmVudExpc3RlbmVyKHdpbmRvdywncmVzaXplJywgd2luUmVzaXplKTtcblxuICAgIHJldHVybiBmdW5jdGlvbiBpRnJhbWVSZXNpemVGKG9wdGlvbnMsdGFyZ2V0KXtcbiAgICAgIHN3aXRjaCAodHlwZW9mKHRhcmdldCkpe1xuICAgICAgY2FzZSAndW5kZWZpbmVkJzpcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHRhcmdldCB8fCAnaWZyYW1lJyApLCBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICAgIGluaXQoZWxlbWVudCwgb3B0aW9ucyk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgIGluaXQodGFyZ2V0LCBvcHRpb25zKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmV4cGVjdGVkIGRhdGEgdHlwZSAoJyt0eXBlb2YodGFyZ2V0KSsnKS4nKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSlF1ZXJ5UHVibGljTWV0aG9kKCQpe1xuICAgICQuZm4uaUZyYW1lUmVzaXplID0gZnVuY3Rpb24gJGlGcmFtZVJlc2l6ZUYob3B0aW9ucykge1xuICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyKCdpZnJhbWUnKS5lYWNoKGZ1bmN0aW9uIChpbmRleCwgZWxlbWVudCkge1xuICAgICAgICBzZXR1cElGcmFtZS5jYWxsKGVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgfSkuZW5kKCk7XG4gICAgfTtcbiAgfVxuXG4gIHdpbmRvdy5pRnJhbWVSZXNpemUgPSBmYWN0b3J5KCk7XG5cbiAgLy8gaWYgKHdpbmRvdy5qUXVlcnkpIHsgY3JlYXRlSlF1ZXJ5UHVibGljTWV0aG9kKGpRdWVyeSk7IH1cblxuICAvLyBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gIC8vICAgZGVmaW5lKFtdLGZhY3RvcnkpO1xuICAvLyB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gJ29iamVjdCcpIHsgLy9Ob2RlIGZvciBicm93c2VyZnlcbiAgLy8gICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgLy8gfSBlbHNlIHtcbiAgLy8gICB3aW5kb3cuaUZyYW1lUmVzaXplID0gd2luZG93LmlGcmFtZVJlc2l6ZSB8fCBmYWN0b3J5KCk7XG4gIC8vIH1cblxufSkod2luZG93IHx8IHt9KTtcblxuXG5cbiJdfQ==
