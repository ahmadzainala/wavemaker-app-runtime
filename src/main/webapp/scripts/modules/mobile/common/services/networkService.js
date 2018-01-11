/*global WM,wm, _, XMLHttpRequest, localStorage, window*/
/*jslint sub: true */
(function () {
    'use strict';
    var IS_CONNECTED_KEY = "WM.NetworkService.isConnected",
        excludedList = [new RegExp('wmProperties.js')],
        originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open,
        originalXMLHttpRequestSend = XMLHttpRequest.prototype.send,
        networkState = {
            isConnecting : false,
            isConnected : localStorage.getItem(IS_CONNECTED_KEY) !== "false",
            isNetworkAvailable : true,
            isServiceAvailable : true
        };

    /**
     * If server is not connected and url does not match the unblock list of regular expressions,
     * then this function return true. Otherwise, return false.
     * @param url
     * @returns {boolean}
     */
    function blockUrl(url) {
        var block = !networkState.isConnected && _.startsWith(url, 'http');
        if (block) {
            block = !_.find(excludedList, function (regExp) {
                return regExp.test(url);
            });
        }
        return block;
    }
    // Intercept all XHR calls
    XMLHttpRequest.prototype.open = function (method, url) {
        if (blockUrl(url)) {
            //if the app is not connected, then all xhr calls will be blocked.
            this.blockedByWM = true;
        }
        return originalXMLHttpRequestOpen.apply(this, arguments);
    };

    // Intercept all XHR calls
    XMLHttpRequest.prototype.send = function () {
        if (this.blockedByWM) {
            //if the app is not connected, then all xhr calls will be blocked.
            this.status = 0;
            this.readyState = XMLHttpRequest.DONE;
            this.statusText = "BLOCKED";
            this.onLoad();
            return;
        }
        return originalXMLHttpRequestSend.apply(this, arguments);
    };
    /**
     * @ngdoc service
     * @name wm.modules.wmCommon.services.$NetworkService
     * @description
     * The 'wm.modules.wmCommon.services.$NetworkService' helps to manage connection between server and mobile app.
     * It can bring the app to offline or to online (provided server is available). This service will raise an event
     * (onNetworkStateChange) on root scope about the network state change.
     */
    wm.modules.wmCommon.services.NetworkService = [
        '$cordovaFileTransfer',
        '$cordovaNetwork',
        '$http',
        '$interval',
        '$q',
        '$rootScope',
        '$timeout',
        'ProjectService',
        function (
            $cordovaFileTransfer,
            $cordovaNetwork,
            $http,
            $interval,
            $q,
            $rootScope,
            $timeout,
            ProjectService
        ) {
            var AUTO_CONNECT_KEY = "WM.NetworkService.autoConnect",
                autoConnect = localStorage.getItem(AUTO_CONNECT_KEY) !== "false",
                originalDownload = $cordovaFileTransfer.download,
                baseURL;

            function setAutoConnect(flag) {
                autoConnect = flag;
                localStorage.setItem(AUTO_CONNECT_KEY, flag);
            }

            /**
             * Override download method to stop downloads via $cordovaFileTransfer when app is not connected
             * @returns {*}
             */
            $cordovaFileTransfer.download = function () {
                if (networkState.isConnected) {
                    return originalDownload.apply($cordovaFileTransfer, arguments);
                }
                return $q.return('Server is not connected.');
            };

            /**
             * Pings server
             * @returns {*} a promise that resolved with true, if server responds with valid status.
             * Otherwise, the promise is resolved with false.
             */
            function pingServer() {
                var defer = $q.defer();
                baseURL = baseURL || ProjectService.getDeployedUrl();
                if (baseURL && !_.endsWith(baseURL, '/')) {
                    baseURL += '/';
                } else {
                    baseURL = baseURL || '';
                }
                $http.get(baseURL + 'wmProperties.js?t=' + Date.now()).then(function () {
                    defer.resolve(true);
                }, function () {
                    defer.resolve(false);
                });
                return defer.promise;
            }

            /**
             * Pings server to check whether server is available. Based on ping response network state is modified.
             * @returns {*} a promise that resolved with true, if server responds with valid status.
             * Otherwise, the promise is resolved with false.
             */
            function isServiceAvailable() {
                return pingServer().then(function (response) {
                    networkState.isServiceAvailable = response;
                    return response;
                });
            }

            /**
             * Returns a promise that is resolved when server is available.
             * @returns {*}
             */
            function checkForServiceAvailiblity() {
                var defer = $q.defer(),
                    promise = $interval(function () {
                        isServiceAvailable().then(function (available) {
                            if (available) {
                                defer.resolve();
                                $interval.cancel(promise);
                            }
                        });
                    }, 5000);
                return defer.promise;
            }

            /**
             * Tries to connect to remote server. Network State will be changed based on the success of connection
             * operation and emits an event notifying the network state change.
             *
             * @param silent {boolean} if true and connection is successful, then no event is emitted. Otherwise,
             * events are emitted for network status change.
             * @returns {*} a promise
             */
            function connect(silentMode) {
                var d = $q.defer();
                isServiceAvailable().then(function () {
                    if (networkState.isServiceAvailable && autoConnect) {
                        networkState.isConnecting = true;
                        if (!silentMode) {
                            $rootScope.$emit('onNetworkStateChange', _.clone(networkState));
                        }
                        $timeout(function () {
                            networkState.isConnecting = false;
                            networkState.isConnected = true;
                            localStorage.setItem(IS_CONNECTED_KEY, true);
                            if (!silentMode) {
                                $rootScope.$emit('onNetworkStateChange', _.clone(networkState));
                            }
                            d.resolve(true);
                        }, 5000);
                    } else {
                        networkState.isConnecting = false;
                        networkState.isConnected = false;
                        localStorage.setItem(IS_CONNECTED_KEY, false);
                        d.reject();
                        $rootScope.$emit('onNetworkStateChange', _.clone(networkState));
                    }
                });
                return d.promise;
            }

            /**
             * Disconnects app from the remote server.
             * @returns {*}
             */
            function disconnect() {
                networkState.isConnected = false;
                networkState.connecting = false;
                $rootScope.$emit('onNetworkStateChange', _.clone(networkState));
                localStorage.setItem(IS_CONNECTED_KEY, networkState.isConnected);
                return $q.resolve(networkState.isConnected);
            }

            //On startup, try to connect
            if (window.cordova && window.Connection) {
                networkState.isNetworkAvailable = $cordovaNetwork.isOnline();
                connect(true);
            }

            /*
             * When the device comes online, check is the service is available. If the service is available and auto
             * connect flag is true, then app is automatically connected to remote server.
             */
            $rootScope.$on('$cordovaNetwork:online', function () {
                networkState.isNetworkAvailable = true;
                connect();
            });

            /*
             *When device goes offline, then change the network state and emit that notifies about network state change.
             */
            $rootScope.$on('$cordovaNetwork:offline', function () {
                networkState.isNetworkAvailable = false;
                networkState.isServiceAvailable = false;
                disconnect();
            });

            $rootScope.$on('onNetworkStateChange', function (event, data) {
                /**
                 * If network is available and server is not available,then
                 * try to connect when server is available.
                 */
                if (data.isNetworkAvailable && !data.isServiceAvailable) {
                    checkForServiceAvailiblity().then(function () {
                        connect();
                    });
                }
            });

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#disableAutoConnect
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * When the auto connect is enabled, then app is automatically connected  whenever server is available.
             * Every time when app goes offline, auto connect is enabled. Before app coming to online, one can disable
             * the auto connection flow using this method.
             */
            this.disableAutoConnect = function () {
                setAutoConnect(false);
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#isConnecting
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * Returns true if app is trying to connect to server. Otherwise, returns false.
             *
             * @returns {boolean} Returns true if app is trying to connect to server. Otherwise, returns false.
             */
            this.isConnecting = function () {
                return networkState.isConnecting;
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#isConnected
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * Returns true, if app is connected to server. Otherwise, returns false.
             *
             * @returns {boolean} Returns true, if app is connected to server. Otherwise, returns false.
             */
            this.isConnected = function () {
                return networkState.isConnected;
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#isAvailable
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * If pingServer is true, then it returns a promise that will be resolved with boolean based on service availability
             * check.If pingServer is false, returns a boolean value based on the last known service availability.
             *
             * @returns {boolean} if pingServer is true, then a promise is returned. Otherwise, a boolean value.
             */
            this.isAvailable = function (pingServer) {
                if (pingServer) {
                    return isServiceAvailable().then(function () {
                        $rootScope.$emit('onNetworkStateChange', _.clone(networkState));
                    });
                }
                return networkState.isServiceAvailable;
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#unblock
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * This function adds the given regular expression to the unblockList. Even app is in offline mode,
             * the urls matching with the given regular expression are not blocked by NetworkService.
             *
             * @param {string} urlRegexStr regular expression
             */
            this.unblock = function (urlRegexStr) {
                excludedList.push(new RegExp(urlRegexStr));
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#connect
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * This method attempts to connect app to the server and returns a promise that will be resolved with
             * a boolean value based on the operation result.
             *
             * @returns {object} promise
             */
            this.connect = function () {
                setAutoConnect(true);
                return connect();
            };

            /**
             * @ngdoc method
             * @name wm.modules.wmCommon.services.$NetworkService#disconnect
             * @methodOf wm.modules.wmCommon.services.$NetworkService
             * @description
             * This method disconnects the app from the server and returns a promise that will be resolved with
             * a boolean value based on the operation result. Use connect method to reconnect.
             *
             * @returns {object} promise
             */
            this.disconnect = function () {
                var p = disconnect();
                this.disableAutoConnect();
                return p;
            };

        }];
}());