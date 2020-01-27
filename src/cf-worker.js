"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var mime_types_1 = require("mime-types");
function checkPassthrough(request, options) {
    return (options.disablePaywall ||
        !isHtml(request) ||
        isAllowedCrawler(request, options));
}
exports.checkPassthrough = checkPassthrough;
function checkDebugSendPaywall(request, options) {
    var debugSendPaywall = getCookie(request, options.debugSendPaywallCookie);
    return debugSendPaywall === 'true';
}
exports.checkDebugSendPaywall = checkDebugSendPaywall;
function getCookie(request, name) {
    var result = null;
    var cookieString = request.headers.get('Cookie');
    if (cookieString) {
        var cookies = cookieString.split(';');
        cookies.forEach(function (cookie) {
            var cookieName = cookie.split('=')[0].trim();
            if (cookieName === name) {
                result = cookie.split('=')[1];
            }
        });
    }
    return result;
}
exports.getCookie = getCookie;
function fetchPaywall(event, defaultHandler, options) {
    return __awaiter(this, void 0, void 0, function () {
        var request, mapRequestToPaywall, pwRequest;
        return __generator(this, function (_a) {
            request = event.request;
            if (options.isWorkersStatic) {
                mapRequestToPaywall = makeMapRequestToPaywall(options);
                return [2 /*return*/, defaultHandler(event, { mapRequestToAsset: mapRequestToPaywall })];
            }
            else {
                pwRequest = paywallRequestRewrite(request, options);
                return [2 /*return*/, defaultHandler(event, pwRequest)];
            }
            return [2 /*return*/];
        });
    });
}
exports.fetchPaywall = fetchPaywall;
function getPaywallUrl(urlString, options) {
    var url = new URL(urlString);
    url.pathname = options.paywallPrefix + url.pathname;
    return url.toString();
}
exports.getPaywallUrl = getPaywallUrl;
// TODO (abiro) match based on IP instead of UA
function isAllowedCrawler(request, options) {
    var headers = request.headers;
    var userAgent = headers.get('User-Agent') || '';
    var crawlers = options.allowedCrawlers.join('|');
    var crawlerRegex = new RegExp(crawlers, 'gi');
    return crawlerRegex.test(userAgent);
}
exports.isAllowedCrawler = isAllowedCrawler;
function isHtml(request) {
    var mimeType = mime_types_1["default"].lookup(request.url);
    // If there is no mime type, assume it's html
    // (eg. example.com/foo will be considered html).
    return !mimeType || mimeType === 'text/html';
}
exports.isHtml = isHtml;
function makeMapRequestToPaywall(options) {
    return __awaiter(this, void 0, void 0, function () {
        var mapRequestToAsset;
        return __generator(this, function (_a) {
            mapRequestToAsset = function (req) { return req; };
            return [2 /*return*/, function (request) {
                    var pwRequest = paywallRequestRewrite(request, options);
                    return mapRequestToAsset(pwRequest);
                }];
        });
    });
}
exports.makeMapRequestToPaywall = makeMapRequestToPaywall;
function paywallRequestRewrite(request, options) {
    var pwUrl = getPaywallUrl(request.url, options);
    return new Request(pwUrl, request);
}
exports.paywallRequestRewrite = paywallRequestRewrite;
/**
 * Handle paywall logic for request.
 * @param event The fetch event.
 * @param defaultHandler The handler to use if access is allowed.
 * @param options The paywall middleware options.
 */
function handlePaywall(event, defaultHandler, options) {
    return __awaiter(this, void 0, void 0, function () {
        var request;
        return __generator(this, function (_a) {
            request = event.request;
            if (checkPassthrough(request, options)) {
                return [2 /*return*/, defaultHandler(event)];
            }
            if (checkDebugSendPaywall(request, options)) {
                return [2 /*return*/, fetchPaywall(event, defaultHandler, options)];
            }
            return [2 /*return*/, defaultHandler(event)];
        });
    });
}
exports.handlePaywall = handlePaywall;
