/*global WM, _*/
/*jslint todo: true */
/*Directive for Wizard */

WM.module('wm.layouts.containers')
    .run(['$templateCache', function ($templateCache) {
        'use strict';

        //Define the template for the wizard directive
        $templateCache.put('template/layout/container/wizard.html',
            '<div class="app-wizard panel clearfix" init-widget apply-styles="container">' +
                '<div class="app-wizard-heading">' +
                    '<ul class="app-wizard-steps nav nav-pills"></ul>' +
                '</div>' +
                '<div class="app-wizard-body panel-body">' +
                    '<wm-message scopedataset="message"></wm-message>' +
                    '<div wmtransclude></div>' +
                '</div>' +
                '<div class="app-wizard-actions panel-footer">' +
                    '<a class="app-wizard-skip" name="skipStep_{{name}}" ng-show="currentStep.enableskip" title="Skip step" ng-click="skip()">Skip &raquo;</a>' +
                    '<div class="app-wizard-actions-right">' +
                        '<button name="cancelBtn_{{name}}" class="btn app-button btn-secondary" title="{{cancelbtnlabel}}">{{cancelbtnlabel}}</button>' +
                        '<button name="previousBtn_{{name}}" class="btn app-button btn-secondary" ng-if="steps.indexOf(currentStep) > 0" ng-click="prev()">' +
                            '<i class="app-icon wi wi-chevron-left"></i>' +
                            '<span class="btn-caption">{{previousbtnlabel}}</span>' +
                        '</button>' +
                        '<button name="nextBtn_{{name}}" class="btn app-button btn-primary" ng-if="steps.indexOf(currentStep) !== steps.length - 1" ng-click="next()" ng-disabled="currentStep.disablenext || currentStep.isFormInvalid">' +
                            '<span class="btn-caption">{{nextbtnlabel}}</span>' +
                            '<i class="app-icon wi wi-chevron-right"></i>' +
                        '</button>' +
                        '<button name="doneBtn_{{name}}" class="btn app-button btn-success" ng-if="(steps.indexOf(currentStep) === steps.length - 1) || currentStep.enabledone" ng-click="done()" ng-disabled="currentStep.isFormInvalid">' +
                            '<i class="app-icon wi wi-done"></i>' +
                            '<span class="btn-caption">{{donebtnlabel}}</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
            );

        //Define the template for the wizard step directive
        $templateCache.put('template/layout/container/wizard-step.html',
            '<form apply-styles="container" init-widget page-container class="app-wizard-step-content" ng-class="{\'current\': status === \'CURRENT\'}" data-step-id="{{stepIndex}}"><div page-container-target wmtransclude></div></form>');
    }])
    .directive('wmWizard', [
        'PropertiesFactory',
        '$templateCache',
        'WidgetUtilService',
        '$compile',
        'CONSTANTS',

        function (PropertiesFactory, $templateCache, WidgetUtilService, $compile, CONSTANTS) {
            'use strict';

            //Get the properties related to the wizard
            var widgetProps  = PropertiesFactory.getPropertiesOf('wm.wizard', ['wm.base', 'wm.layouts', 'wm.containers']),
                STEP_STATUS  = {'COMPLETED': 'COMPLETED', 'CURRENT': 'CURRENT', 'DISABLED': 'DISABLED'};

            function navigateToStep($is, stepIndex) {
                $is.currentStep        = $is.steps[stepIndex];
                $is.currentStep.status = STEP_STATUS.CURRENT;
            }

            return {
                'restrict'  : 'E',
                'scope'     : {'onDone': '&'},
                'replace'   : true,
                'transclude': true,
                'template'  : $templateCache.get('template/layout/container/wizard.html'),
                'controller': ['$scope', '$element', function ($is, $element) {
                    var stepHeaderTarget  = $element.find('.app-wizard-steps');
                    $is.steps        = [];
                    this.dataStepId = 0;
                    //Register step
                    this.register = function (stepScope) {
                        $is.steps.push(stepScope);
                    };
                    //Register step header to append to header list
                    this.registerStepHeader = function (stepScope) {
                        stepScope.stepIndex = this.dataStepId;
                        stepScope._headerElement.attr('data-step-id', this.dataStepId);
                        stepHeaderTarget.append(stepScope._headerElement);
                        $compile(stepScope._headerElement)(stepScope);
                        this.dataStepId++;
                    };
                    //Remove header element on removal of step
                    this.unRegisterHeaderElement = function (stepScope) {
                        stepHeaderTarget.find('[data-step-id="' + stepScope.stepIndex + '"]').remove();
                        $is.steps.splice(stepScope.stepIndex, 1);
                        //On removal of current step make first step as current step
                        if ($is.steps.length) {
                            $is.currentStep = $is.steps[0];
                            WM.element($is.currentStep._headerElement).click();
                        }
                    };
                    if (CONSTANTS.isRunMode) {
                        //Function to navigate to next step
                        $is.next = function () {
                            var params = {$isolateScope: $is, currentStep: $is.currentStep, stepIndex: $is.currentStep.stepIndex};
                            if ($is.currentStep.onNext) {
                                if ($is.currentStep.onNext(params) === false) {
                                    return;
                                }
                            }
                            $is.currentStep.status = STEP_STATUS.COMPLETED;
                            navigateToStep($is, $is.currentStep.stepIndex + 1);
                        };
                        //Function to navigate to previous step
                        $is.prev = function () {
                            var params;
                            if ($is.currentStep.onPrev) {
                                params = {$isolateScope: $is, currentStep: $is.currentStep, stepIndex: $is.currentStep.stepIndex};
                                if ($is.currentStep.onPrev(params) === false) {
                                    return;
                                }
                            }
                            $is.currentStep.status = STEP_STATUS.DISABLED;
                            navigateToStep($is, $is.currentStep.stepIndex - 1);
                        };
                        //Function to skip current step
                        $is.skip = function () {
                            var params;
                            if ($is.currentStep.onSkip) {
                                params = {$isolateScope: $is, currentStep: $is.currentStep, stepIndex: $is.currentStep.stepIndex};
                                if ($is.currentStep.onSkip(params) === false) {
                                    return;
                                }
                            }
                            if ($is.currentStep.stepIndex + 1 < $is.steps.length) {
                                $is.currentStep.status = STEP_STATUS.COMPLETED;
                                navigateToStep($is, $is.currentStep.stepIndex + 1);
                            }
                        };
                        //Function to invoke on-Done event on wizard
                        $is.done = function () {
                            var params;
                            if ($is.onDone) {
                                params = {$isolateScope: $is, steps: $is.steps};
                                if ($is.onDone(params) === false) {
                                    return;
                                }
                            }
                        };
                    }
                }],
                link: {
                    'pre': function ($is) {
                        $is.widgetProps = widgetProps;
                    },
                    'post': function ($is, element, attrs) {
                        $is.currentStep = $is.steps[0];
                        $is.currentStep.status = STEP_STATUS.CURRENT;
                        //initialize the widget
                        WidgetUtilService.postWidgetCreate($is, element, attrs);
                    }
                }
            };
        }])
    .directive('wmWizardstep', [
        'PropertiesFactory',
        '$templateCache',
        'WidgetUtilService',
        'CONSTANTS',
        '$rootScope',

        function (PropertiesFactory, $templateCache, WidgetUtilService, CONSTANTS, $rs) {
            'use strict';

            var widgetProps    = PropertiesFactory.getPropertiesOf('wm.wizardstep', ['wm.base']),
                STEP_STATUS    = {'COMPLETED': 'COMPLETED', 'CURRENT': 'CURRENT', 'DISABLED': 'DISABLED'},
                $headerElement = '<li class="app-wizard-step" ng-class="{active: status === \'COMPLETED\', current: status === \'CURRENT\', disabled: status === \'DISABLED\'}">' +
                                    '<a href="javascript:void(0)">' +
                                        '<span class="arrow"></span>' +
                                        '<i class="app-icon {{iconclass}}" ng-if="iconclass"></i> ' +
                                        '<span class="step-title" ng-bind="heading"></span>' +
                                    '</a>' +
                                '</li>';
            return {
                'restrict'  : 'E',
                'scope'     : {
                    'onNext'    : '&',
                    'onPrev'    : '&',
                    'onLoad'    : '&',
                    'onSkip'    : '&'
                },
                'transclude': true,
                'template'  : $templateCache.get('template/layout/container/wizard-step.html'),
                'replace'   : true,
                'require'   : '^wmWizard',
                'link'      : {
                    'pre': function ($is) {
                        $is.widgetProps = widgetProps;
                    },
                    'post': function ($is, $el, attrs, ctrl) {
                        var $parentElement = $el.parent().closest('.app-wizard'),
                            parentIs       = $parentElement.isolateScope();
                        $is._headerElement  = WM.element($headerElement);
                        $is._formElement    = $el;
                        $is.status          = STEP_STATUS.DISABLED;
                        ctrl.registerStepHeader($is);
                        //Register step with wizard
                        ctrl.register($is);
                        if (CONSTANTS.isStudioMode) {
                            $is.$on('$destroy', function () {
                                ctrl.unRegisterHeaderElement($is);
                            });
                        } else {
                            //$watch on step load ie.. step is active and trigger onLoad event
                            $is.$watch('status', function (nv) {
                                if (nv === STEP_STATUS.CURRENT) {
                                    if ($is.onLoad) {
                                        $is.onLoad({$isolateScope: $is});
                                    }
                                }
                            });
                            //$watch on form valid status
                            $is.$watch($is.name + '.$valid', function (newVal) {
                                $is.isFormInvalid = !newVal;
                            });
                        }
                        $parentElement.on('click', '.app-wizard-step', function (event) {
                            event.stopPropagation();
                            var $headerEles     = $parentElement.find('.app-wizard-step'),
                                currentStepId   = WM.element(event.currentTarget).attr('data-step-id'),
                                $stepPanes      = $parentElement.find('.app-wizard-step-content'),
                                $currentStepEle = $parentElement.find('.app-wizard-step-content[data-step-id=' + currentStepId + ']'),
                                currentStep     = $currentStepEle.isolateScope(),
                                widgetId        = $currentStepEle.attr('widgetid');
                            if (CONSTANTS.isStudioMode) {
                                _.forEach($headerEles, function (headerEle) {
                                    WM.element(headerEle).scope().status = STEP_STATUS.DISABLED;
                                });
                                $stepPanes.removeClass('current');
                                $currentStepEle.addClass('current');
                                currentStep.status = STEP_STATUS.CURRENT;
                                $rs.$emit('set-active-widget', widgetId);
                            } else {
                                if (currentStep.status === STEP_STATUS.COMPLETED) {
                                    _.forEach(parentIs.steps, function (step, index) {
                                        step.status = index < currentStep.stepIndex ? STEP_STATUS.COMPLETED : STEP_STATUS.DISABLED;
                                    });
                                    parentIs.currentStep        = currentStep;
                                    parentIs.currentStep.status = STEP_STATUS.CURRENT;
                                }
                            }
                            $rs.$safeApply($is);
                        });
                        WidgetUtilService.postWidgetCreate($is, $el, attrs);
                    }
                }
            };
        }
    ]);

/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmWizard
 * @restrict E
 *
 * @description
 * The `wmWizard` directive defines wizard widget. <br>
 * wmWizard can only contain wmWizardstep widgets. <br>
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} name
 *                  Name of the wizard.
 * @param {string=} width
 *                  Width of the wizard.
 * @param {string=} height
 *                  Height of the wizard.
 * @param {string=} nextbtnlabel
 *                  Label to Next step button
 * @param {string=} previousbtnlabel
 *                  Label to Previous step button
 * @param {string=} donebtnlabel
 *                  Label to Done button
 * @param {string=} cancelbtnlabel
 *                  Label to Cancel button
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the wizard on the web page. <br>
 *                  default value: `true`.
 *
 * @example
 <example module="wmCore">
     <file name="index.html">
         <div ng-controller="Ctrl" class="wm-app">
             <wm-wizard width="500">
                <wm-wizardstep heading="Registration">
                </wm-wizardstep>
             </wm-wizard>
         </div>
     </file>
     <file name="script.js">
        function Ctrl($scope) {}
     </file>
 </example>
 */


/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmWizardstep
 * @restrict E
 *
 * @description
 * The `wmWizardstep` directive defines wizard step widget. <br>
 * wmWizardstep can be used only inside wmWizard. <br>
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} name
 *                  Name of the wizardstep.
 * @param {string=} heading
 *                  Heading of the step.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the step on the web page. <br>
 *                  Default value: `true`.
 * @param {boolean=} disablenext
 *                  disablenext is a bindable property. <br>
 *                  This property will be used to enable/disable the next step button for wizard. <br>
 * @param {string=} on-next
 *                  Callback function which will be triggered when the next btn is clicked.
 * @param {string=} on-previous
 *                  Callback function which will be triggered when the previous btn is clicked.
 * @param {string=} on-load
 *                  Callback function which will be triggered on load of step.
 *
 * @example
 <example module="wmCore">
     <file name="index.html">
         <div ng-controller="Ctrl" class="wm-app">
            <wm-wizard width="500">
                <wm-wizardstep heading="Registration">
                </wm-wizardstep>
            </wm-wizard>
         </div>
     </file>
     <file name="script.js">
        function Ctrl($scope) {}
     </file>
 </example>
 */