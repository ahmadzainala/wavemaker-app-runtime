/*global WM, wm*/
/*jslint todo: true */
/**
 * @ngdoc service
 * @name wm.common.$ProjectService
 * @description
 * The `ProjectService` provides the details about the project apis.
 */

wm.modules.wmCommon.services.ProjectService = function (BaseService, CONSTANTS, $location) {
    'use strict';

    function run(details, successCallback, failureCallback) {
        var target = CONSTANTS.isRunMode ? 'Project_Run' : 'Project';
        BaseService.execute({
            target: target,
            action: "run",
            data: {
                action: "inplaceDeploy",
                projectId: details.projectId
            },
            config: details.config
        }, successCallback, failureCallback);
    }

    function getDeployedUrl() {
        var locationUrl,
            lastIndex,
            projectDeployedUrl;

        /*If $location.$$absUrl is of the form http://localhost:8080/WM2c908a52446c435b01446cfdacf50013/#/Main,
         * remove # and the page name to get only the deployed url of the project.*/
        if (CONSTANTS.isRunMode) {
            locationUrl = $location.$$absUrl;
            lastIndex = locationUrl.split("#")[0].lastIndexOf("/");
            projectDeployedUrl = locationUrl.substr(0, lastIndex);
            lastIndex = projectDeployedUrl.lastIndexOf("/");
            if (projectDeployedUrl[lastIndex + 1] === "#") {
                projectDeployedUrl = projectDeployedUrl.substr(0, lastIndex);
            }
            if (projectDeployedUrl.indexOf('http') !== -1) {
                /*Removing the protocol from the url*/
                if (projectDeployedUrl.indexOf('https:') !== -1) {
                    projectDeployedUrl = projectDeployedUrl.substr(6);
                } else {
                    projectDeployedUrl = projectDeployedUrl.substr(5);
                }
            }

            return projectDeployedUrl;
        }
    }

    /**
     * @ngdoc function
     * @name wm.common.$ProjectService#getId
     * @methodOf wm.common.$ProjectService
     * @function
     *
     * @description
     * returns the id of the project service based on the 'mode'.
     *
     */
    function getId() {
        return $location.$$absUrl.split('/')[3];
    }

    /* APIs returned by the ProjectService.*/
    return {

        /**
         * @ngdoc function
         * @name wm.common.$ProjectService#run
         * @methodOf wm.common.$ProjectService
         * @function
         *
         * @description
         * deploy and run the specified project.
         *
         * @param {object} details Details object
         * @param {function} successCallback to called on success
         * @param {function} failureCallback to called on failure
         */
        run: run,
        /**
         * @ngdoc function
         * @name wm.common.$ProjectService#getDeployedUrl
         * @methodOf wm.common.$ProjectService
         * @function
         *
         * @description
         * Returns deployed url
         *
         */
        getDeployedUrl : getDeployedUrl,
        /*
        * Returns project Id
        *
        * */
        getId : getId
    };

};