/*global WM, wm, _, window, sessionStorage, localStorage, setTimeout*/

/**
 * @ngdoc service
 * @name wm.oauth.oAuthProviderService
 * @description
 * The `oAuthProviderService` provides the details about the oauth based service apis
 */

wm.plugins.security.services.oAuthProviderService = [
    "BaseService",
    "$rootScope",
    "$timeout",
    "CONSTANTS",
    "$uibModal",
    "$templateCache",
    "VARIABLE_CONSTANTS",

    function (BaseService, $rs, $timeout, CONSTANTS, $uibModal, $tc, VARIABLE_CONSTANTS) {
    'use strict';

    var listeners = {},
        oAuthDialogInstance,
        newWindowProps = 'width=400,height=600',
        ACCESSTOKEN_PLACEHOLDERS = {
            'STUDIO': 'WM_STUDIO_',
            'RUN': 'WM_RUN_'
        };

    //template related to oauth sign in dialog
    $tc.put('template/advanced/oauth.html',
        '<div>' +
            '<div class="modal-header">' +
                '<h3 class="modal-title">Application is requesting you to sign in with</h3>' +
            '</div>' +
            '<div class="modal-body">' +
                '<ul style="list-style: none" class="list-items">' +
                    '<li style="padding-bottom: 10px;" class="list-item" ng-repeat="provider in $root.providersConfig">' +
                        '<button class="btn" ng-click="provider.invoke()">{{provider.name}}</button>' +
                    '</li>' +
                '</ul> ' +
            '</div>' +
        '</div>');

    //have a empty provider Config model by default
    $rs.providersConfig = {};

    //watch providersConfig and invoke the dialog
    $rs.$watch('providersConfig', function(newValue) {
        if (!_.isEmpty(newValue)) {
            if (!oAuthDialogInstance) {
                oAuthDialogInstance = $uibModal.open({
                    ariaLabelledBy: 'modal-title',
                    ariaDescribedBy: 'modal-body',
                    templateUrl: 'template/advanced/oauth.html',
                    controller: 'CommonPageController',
                    size: 'sm'
                });
                oAuthDialogInstance.closed.then(function() {
                    _.forEach($rs.providersConfig, function(config, provider) {
                        delete $rs.providersConfig[provider];
                    });
                    oAuthDialogInstance = undefined;
                });
            }
        } else if (oAuthDialogInstance) {
            oAuthDialogInstance.close();
            oAuthDialogInstance = undefined;
        }
    }, true);
    /**
     * function to load the default providers
     * @param successCallback callback to be invoked upon successful fetch of the providers
     * @param failureCallback callback to be invoked upon error
     * @returns {*}
     */
    function loadDefaultProviders(successCallback, failureCallback) {
        return BaseService.execute({
            target: "oauthConfiguration",
            action: "getDefaultProviders"
        }, successCallback, failureCallback);
    }
    /**
     * function to load the configured providers
     * @param successCallback callback to be invoked upon successful fetch of the providers
     * @param failureCallback callback to be invoked upon error
     * @returns {*}
     */
    function loadConfiguredProviders(successCallback, failureCallback) {
        return BaseService.execute({
            target: "oauthConfiguration",
            action: "getConfiguredProviders",
            urlParams: {
                projectID : $rs.project.id
            }
        }, successCallback, failureCallback);
    }
    /**
     * function to add the providers
     * @param params providers data to be sent
     * @param successCallback callback to be invoked upon successful fetch of the providers
     * @param failureCallback callback to be invoked upon error
     * @returns {*}
     */
    function addProvider(params, successCallback, failureCallback) {
        return BaseService.execute({
            target: "oauthConfiguration",
            action: "addProvider",
            urlParams: {
                projectId : $rs.project.id
            },
            data: params.providers
        }, successCallback, failureCallback);
    }

    /**
     * function to get the authorization url
     * @param params provider id for which the auth url has to be fetched
     * @param successCallback callback to be invoked upon successful fetch of the providers
     * @param failureCallback callback to be invoked upon error
     * @returns {*}
     */
    function getAuthorizationUrl(params, successCallback, failureCallback) {
        var action = CONSTANTS.isStudioMode ? "getStudioAuthorizationUrl" : "getAuthorizationUrl";
        return BaseService.execute({
            target: "oauthConfiguration",
            action: action,
            urlParams: {
                projectId : $rs.project.id,
                providerId: params.providerId
            }
        }, successCallback, failureCallback);
    }

    /**
     * This function sets the accessToken
     * @param provider
     * @param accesstoken
     */
    function setAccessToken(provider, accesstoken) {
        var accessTokenKey;
        if (CONSTANTS.isStudioMode) {
            accessTokenKey = ACCESSTOKEN_PLACEHOLDERS.STUDIO + $rs.project.name + '_' + provider + VARIABLE_CONSTANTS.REST_SERVICE.ACCESSTOKEN_PLACEHOLDER.RIGHT;
        } else {
            accessTokenKey = ACCESSTOKEN_PLACEHOLDERS.RUN + $rs.project.id + '_' + provider + VARIABLE_CONSTANTS.REST_SERVICE.ACCESSTOKEN_PLACEHOLDER.RIGHT;
        }
        sessionStorage.setItem(accessTokenKey, accesstoken);
    }

    /**
     * this function retrieves the accessToken based on the run/studiomode
     * @param provider
     * @returns {*}
     */
    function getAccessToken(provider) {
        var accessTokenKey;
        if (CONSTANTS.isStudioMode) {
            accessTokenKey = ACCESSTOKEN_PLACEHOLDERS.STUDIO + $rs.project.name + '_' + provider + VARIABLE_CONSTANTS.REST_SERVICE.ACCESSTOKEN_PLACEHOLDER.RIGHT;
        } else {
            accessTokenKey = ACCESSTOKEN_PLACEHOLDERS.RUN + $rs.project.id + '_' + provider + VARIABLE_CONSTANTS.REST_SERVICE.ACCESSTOKEN_PLACEHOLDER.RIGHT;
        }
        return sessionStorage.getItem(accessTokenKey);
    }

    /**
     * this is a callback function to check if the authentication is done and invokes the successCallback
     * @param providerId
     * @param successCallback
     * @param evt
     */
    function checkAuthenticationStatus(providerId, successCallback, evt) {
        var accessTokenKey = providerId + VARIABLE_CONSTANTS.REST_SERVICE.ACCESSTOKEN_PLACEHOLDER.RIGHT,
            accessToken = localStorage.getItem(accessTokenKey);
        if (evt && evt.origin !== window.location.origin) {
            return;
        }
        if (accessToken) {
            delete $rs.providersConfig[providerId];
            localStorage.removeItem(accessTokenKey);
            setAccessToken(providerId, accessToken);
            window.removeEventListener("message", listeners[providerId]);
            $timeout(function() {
                delete listeners[providerId];
                if (successCallback) {
                    successCallback(accessToken);
                }
            });
        }
    }

    /**
     * this function adds the listener on the window and assigns the listener
     * @param provider
     * @param callback
     */
    function onAuthWindowOpen(provider, callback) {
        listeners[provider] = checkAuthenticationStatus.bind(undefined, provider, callback);
        window.addEventListener("message", listeners[provider], false);
    }

    /**
     * checks for the window existence i.e if the window is manually closed by the user or any such
     * @param oAuthWindow
     * @param provider
     * @param callback
     */
    function checkForWindowExistence(oAuthWindow, provider, callback) {
        if (oAuthWindow && listeners[provider]) {
            if (!oAuthWindow.closed) { //.closed is supported across major browser vendors however for IE the user has to enable protected mode from security options
                setTimeout(checkForWindowExistence.bind(undefined, oAuthWindow, provider, callback), 3000);
            } else {
                window.removeEventListener("message", listeners[provider]);
                delete listeners[provider];
                if (callback) {
                    callback('error');
                }
            }
        }
    }

    /**
     * this function is a callback function which enables the listener and checks for the window existence
     * @param providerId
     * @param onSuccess
     * @param oAuthWindow
     */
    function postGetAuthorizationURL(providerId, onSuccess, oAuthWindow) {
        onAuthWindowOpen(providerId, onSuccess);
        checkForWindowExistence(oAuthWindow, providerId, onSuccess);
    }

    /**
     * this function is used to perform the authorization by opening the window and having active listeners
     * @param url
     * @param providerId
     * @param onSuccess
     * @returns {*}
     */
    function performAuthorization(url, providerId, onSuccess) {
        var oAuthWindow;
        if (url) {
            oAuthWindow = window.open(url, '_blank', newWindowProps);
            if (oAuthWindow) {
                postGetAuthorizationURL(providerId, onSuccess, oAuthWindow);
            }
        }
        if (!url || (url && !oAuthWindow)) {
            return getAuthorizationUrl({
                'providerId': providerId
            }).then(function(response) {
                if (!$rs.isStudioMode){
                    $rs.providersConfig[providerId] = {
                        name: providerId,
                        url: response,
                        invoke: function () {
                            postGetAuthorizationURL(providerId, onSuccess, window.open(response, '_blank', newWindowProps));
                        }
                    };
                }
            });
        }
    }

    this.loadDefaultProviders = loadDefaultProviders;
    this.loadConfiguredProviders = loadConfiguredProviders;
    this.addProvider = addProvider;
    this.getAuthorizationUrl = getAuthorizationUrl;
    this.performAuthorization = performAuthorization;
    this.getAccessToken = getAccessToken;
}];