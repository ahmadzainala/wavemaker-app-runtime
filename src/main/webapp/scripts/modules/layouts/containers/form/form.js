/*global WM, _*/

WM.module('wm.layouts.containers')
    .run(['$templateCache', function ($templateCache) {
        'use strict';
        $templateCache.put('template/layout/container/form.html',
                '<form role="form" init-widget class="panel app-panel app-form" ng-class="[captionAlignClass, captionPositionClass, formClassName]"' +
                    ' autocomplete="autocomplete" apply-styles="shell">' +
                    '<div class="panel-heading" ng-if="title || subheading || iconclass">' +
                        '<h3 class="panel-title">' +
                            '<div class="pull-left"><i class="app-icon panel-icon {{iconclass}}" ng-show="iconclass"></i></div>' +
                            '<div class="pull-left">' +
                                '<div class="heading">{{title}}</div>' +
                                '<div class="description">{{subheading}}</div>' +
                            '</div>' +
                        '</h3>' +
                    '</div>' +
                    '<div class="form-body panel-body" apply-styles="inner-shell">' +
                        '<wm-message scopedataset="statusMessage"></wm-message>' +
                        '<div class="form-elements" wmtransclude>' +
                            '<div class="overlay" ng-if="showNoFieldsMsg">' +
                                '<span>{{:: $root.locale.MESSAGE_CANNOT_GENERATE_FIELDS_IN_STUDIO}}</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="hidden-form-elements"></div>' +
                    '</div>' +
                    '</form>'
            );
    }])
    .directive('wmForm', ['$rootScope', 'PropertiesFactory', 'WidgetUtilService', '$compile', 'CONSTANTS', 'Utils', function ($rootScope, PropertiesFactory, WidgetUtilService, $compile, CONSTANTS, Utils) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.layouts.form', ['wm.base', 'wm.base.events.touch']),
            notifyFor = {
                'captionsize'     : true,
                'novalidate'      : true,
                'autocomplete'    : true,
                'submitbutton'    : true,
                'resetbutton'     : true,
                'captionalign'    : true,
                'captionposition' : true,
                'method'          : true,
                'action'          : true,
                'metadata'        : true,
                'formdata'        : true
            },
            submitBtnTemplate = '<wm-button class="form-submit" type="submit" caption="submit"></wm-button>';
        //Function to set the default values on the form fields
        function setDefaultValues(scope) {
            //If form fields are not available, return here
            if (!scope.formdata || !scope.elScope.formFields || _.isEmpty(scope.elScope.formFields)) {
                return;
            }
            _.forEach(scope.elScope.formFields, function (field) {
                field.value = scope.formdata[field.key || field.name];
            });
        }
        //Generate the form field with given field definition. Add a grid column wrapper around the form field.
        function setMarkupForFormField(field, columnWidth) {
            var template = '',
                widget   = '<wm-form-field';
            _.forEach(field, function (value, key) {
                widget = widget + ' ' + key + '="' + value + '"';
            });
            widget   += '></wm-form-field>';
            template +=  '<wm-gridcolumn columnwidth="' + columnWidth + '">' + widget + '</wm-gridcolumn>';
            return template;
        }
        //Function to generate and compile the form fields from the metadata
        function generateFormFields(scope, element) {
            var fields        = scope.metadata ? scope.metadata.data || scope.metadata : [],
                fieldTemplate = '',
                $gridLayout   = element.find('.form-elements .app-grid-layout:first'),
                noOfColumns   = Number($gridLayout.attr('columns')) || 1,
                colCount      = 0,
                columnWidth   = 12 / noOfColumns,
                $fieldsMarkup,
                index,
                userFields;
            scope.elScope.formFields = []; //empty the form fields
            $gridLayout.empty(); //Remove any elements from the grid
            if (_.isEmpty(fields)) {
                return;
            }
            if (scope.onBeforerender) {
                userFields = scope.onBeforerender({$metadata: fields, $scope: scope});
                if (userFields) {
                    fields = userFields;
                }
            }
            if (!_.isArray(fields)) {
                return;
            }
            while (fields[colCount]) {
                fieldTemplate += '<wm-gridrow>';
                for (index = 0; index < noOfColumns; index++) {
                    if (fields[colCount]) {
                        fieldTemplate += setMarkupForFormField(fields[colCount], columnWidth);
                    }
                    colCount++;
                }
                fieldTemplate += '</wm-gridrow>';
            }
            $fieldsMarkup = WM.element(fieldTemplate);
            $gridLayout.prepend($fieldsMarkup);
            $compile($fieldsMarkup)(scope.elScope);
            setDefaultValues(scope);
        }

        /* Define the property change handler. This function will be triggered when there is a change in the widget property */
        function propertyChangeHandler(scope, element, attrs, key, newVal) {
            var value, resetBtnTemplate, $gridLayout;
            switch (key) {
            case 'captionsize':
                element.find('.form-group .app-label.ng-isolate-scope').each(function () {
                    WM.element(this).isolateScope().width = newVal;
                });
                break;
            case 'captionalign':
                scope.captionAlignClass = "align-" + newVal;
                break;
            case 'captionposition':
                scope.captionPositionClass = "position-" + newVal;
                break;
            case 'novalidate':
                if (newVal === true || newVal === 'true') {
                    element.attr('novalidate', '');
                } else {
                    element.removeAttr('novalidate');
                }
                break;
            case 'autocomplete':
                value = (newVal === true || newVal === 'true') ? 'on' : 'off';
                element.attr(key, value);
                break;
            case 'submitbutton':
                if (newVal === true || newVal === 'true') {
                    element.append($compile(submitBtnTemplate)(scope));
                } else {
                    element.find('.form-submit').remove();
                }
                break;
            case 'resetbutton':
                if (newVal === true || newVal === 'true') {
                    resetBtnTemplate = $compile('<wm-button class="reset-submit" type="reset" caption="reset" ' + (!scope.widgetid ? 'on-click="resetForm();"' : '') + ' ></wm-button>')(scope);
                    element.append(resetBtnTemplate);
                } else {
                    element.find('.reset-submit').remove();
                }
                break;
            case 'method':
                scope.widgetProps.enctype.show = newVal === 'post';
                break;
            case 'action':
                attrs.$set('action', newVal);
                break;
            case 'metadata':
                if (CONSTANTS.isRunMode) {
                    generateFormFields(scope, element);
                } else {
                    //As form fields are not generated in studio mode, show a message
                    $gridLayout = element.find('.form-elements .app-grid-layout:first');
                    if (newVal) {
                        $gridLayout.hide();
                        scope.showNoFieldsMsg = true;
                    } else {
                        $gridLayout.show();
                        scope.showNoFieldsMsg = false;
                    }
                }
                break;
            case 'formdata':
                if (CONSTANTS.isRunMode) {
                    setDefaultValues(scope);
                }
                break;
            }
        }
        function resetFormFields(element) {
            var eleScope = element.scope();
            element.find('[role="input"]').each(function () {
                WM.element(this).isolateScope().reset();
            });
            $rootScope.$safeApply(eleScope);
        }
        /*Called by users programatically.*/
        function resetForm($s, element) {
            resetFormFields(element);
            if ($s.formFields) {
                _.forEach($s.formFields, function (dataValue) {
                    if (dataValue.type === 'blob') {
                        WM.element(element).find('[name=' + dataValue.key + ']').val('');
                        dataValue.href  = '';
                        dataValue.value = null;
                    } else {
                        dataValue.value = undefined;
                    }
                });
            } else {
                //Get all form fields and reset the values
                element.find('[data-role="form-field"]').each(function () {
                    WM.element(this).isolateScope().datavalue = undefined;
                });
            }
            $s.formdata      = undefined;
            $s.statusMessage = undefined;
            $rootScope.$safeApply($s);
        }

        function bindEvents(scope, element) {
            var params,
                formData,
                formVariable,
                fieldTarget,
                formWidget,
                field;
            element.on('submit', function (event) {
                formData     = {};
                formVariable = element.scope().Variables[scope.formvariable];
                if (scope.onSubmit || formVariable) {
                    //Get all form fields and prepare form data as key value pairs
                    element.find('[data-role="form-field"]').each(function () {
                        var fieldName;
                        field       = WM.element(this).isolateScope().fieldDefConfig;
                        fieldTarget = _.split(field.key || field.target, '.');
                        fieldName   = fieldTarget[0] || field.key || field.name;
                        if (fieldTarget.length === 1 && !formData[fieldName]) {
                            formData[fieldName] = field.value;
                        } else {
                            if (formVariable.category === 'wm.Variable' && !formData[fieldTarget[1]]) {
                                formData[fieldTarget[1]] = field.value;
                            } else {
                                formData[fieldTarget[0]] = formData[fieldTarget[0]] || {};
                                //Check for if property already not exits
                                if (!formData[fieldTarget[0]][fieldTarget[1]]) {
                                    formData[fieldTarget[0]][fieldTarget[1]] = field.value;
                                }
                            }
                        }
                    });
                    //Form fields wont't contain grid widgets get those using attribute and add to form data
                    element.find('[isFormField="true"]').each(function () {
                        formWidget = WM.element(this).isolateScope();
                        fieldTarget = _.split(formWidget.name, '.');
                        if (fieldTarget.length === 1) {
                            formData[formWidget.name] = formWidget.dataset;
                        } else {
                            formData[fieldTarget[0]] = formData[fieldTarget[0]] || {};
                            formData[fieldTarget[0]][fieldTarget[1]] = formWidget.dataset;
                        }
                    });
                    params = {$event: event, $scope: scope, $formData: formData};
                    //If on submit is there execute it and if it returns true do service variable invoke else return
                    if (scope.onSubmit && scope.onSubmit(params) === false) {
                        return;
                    }
                    scope.formdata = formData;
                    //If its a service variable call setInput and assign form data and invoke the service
                    if (formVariable && formVariable.category === 'wm.ServiceVariable') {
                        formVariable.setInput(formData);
                        formVariable.update({}, function () {
                            if (scope.postmessage) {
                                scope.statusMessage = {
                                    'type'    : 'success',
                                    'caption' : scope.postmessage
                                };
                            }
                        }, function (errMsg) {
                            scope.statusMessage = {
                                'type'   : 'error',
                                'caption': errMsg
                            };
                        });
                    }
                }
            });
            /*clear the file uploader in the form*/
            element.bind('reset', function () {
                resetForm(scope, element);
            });
        }

        return {
            'restrict': 'E',
            'replace': true,
            'scope': {},
            'transclude': true,
            'template': WidgetUtilService.getPreparedTemplate.bind(undefined, 'template/layout/container/form.html'),
            'link': {
                'pre': function (scope, element) {
                    scope.widgetProps = widgetProps;
                    scope.elScope = element.scope().$new();
                    scope.elScope.formFields   = [];
                    scope.elScope.isUpdateMode = true;
                },
                'post': function (scope, element, attrs) {
                    var handlers = [];
                    scope.statusMessage = undefined;
                    /* register the property change handler */
                    WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, scope, element, attrs), scope, notifyFor);

                    if (!scope.widgetid) {
                        bindEvents(scope, element);
                        scope.resetForm = resetForm.bind(undefined, scope, element);
                    } else {
                        //event emitted on building new markup from canvasDom
                        handlers.push($rootScope.$on('compile-form-fields', function (event, scopeId, markup) {
                            //as multiple form directives will be listening to the event, apply field-definitions only for current form
                            if (!markup || scope.$id !== scopeId) {
                                return;
                            }
                            scope.elScope.formFields = undefined;
                            element.find('.form-elements').empty();
                            element.find('.hidden-form-elements').empty();
                            var markupObj = WM.element('<div>' + markup + '</div>');
                            /* if layout grid template found, simulate canvas dom addition of the elements */
                            $rootScope.$emit('prepare-element', markupObj, function () {
                                element.find('.form-elements').append(markupObj);
                                $compile(markupObj)(scope);
                            });
                        }));
                    }
                    scope.elScope.ngform  = scope[scope.name];
                    WidgetUtilService.postWidgetCreate(scope, element, attrs);

                    scope.$on('$destroy', function () {
                        handlers.forEach(Utils.triggerFn);
                    });
                }
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.layouts.containers.directive:wmForm
 * @restrict E
 *
 * @description
 * The 'wmForm' directive defines a form in the layout.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires WidgetUtilService
 * @requires $compile
 *
 * @param {string=} title
 *                  Title of the form. This property is a bindable property.
 * @param {string=} name
 *                  Name of the form.
 * @param {string=} target
 *                  Defines the target for the form.
 * @param {string=} width
 *                  Width of the form.
 * @param {string=} height
 *                  Height of the form.
 * @param {string=} method
 *                  Defines the method to be used for submission of the form to the server [GET, POST].
 * @param {string=} action
 *                  Defines the action to be performed on successful submission of the form. This property is a bindable property.
 * @param {string=} enctype
 *                  enctype for form submit, i.e, encryption type for data submission, Example:"application/x-www-form-urlencoded", "multipart/form-data", "text/plain"
 * @param {string=} novalidate
 *                  Sets novalidate option for the form
 * @param {string=} autocomplete
 *                  Sets autocomplete for the form.
 * @param {string=} captionalign
 *                  Defines the alignment of the caption elements of widgets inside the form.<br>
 *                  Default value for captionalign is `left`.
 * @param {string=} captionposition
 *                  Defines the position of the caption elements of widgets inside the form.<br>
 *                  Default value for captionposition is `left`.
 * @param {string=} captionsize
 *                  Defines the size of the caption displayed inside the form.<br>
 *                  Default value for captionalign is `left`.
 * @param {string=} horizontalalign
 *                  Align the content of the accordion-content to left/right/center.
 *                  Default value: `left`.
 *                  Default value for autocomplete is `on`.
 * @param {string=} on-swipeup
 *                  Callback function for `swipeup` event.
 * @param {string=} on-swipedown
 *                  Callback function for `swipedown` event.
 * @param {string=} on-swiperight
 *                  Callback function for `swiperight` event.
 * @param {string=} on-swipeleft
 *                  Callback function for `swipeleft` event.
 * @param {string=} on-pinchin
 *                  Callback function for `pinchin` event.
 * @param {string=} on-pinchout
 *                  Callback function for `pinchout` event.
 * @param {string=} on-submit
 *                  Callback function for `submit` event.
 *
 *
 * @example
    <example module="wmCore">
        <file name="index.html">
            <div ng-controller="Ctrl" class="wm-app">
                <wm-form title="Form" class="panel-default" height="300">
                    <wm-layoutgrid>
                        <wm-gridrow>
                            <wm-gridcolumn>
                                <wm-composite>
                                    <wm-label class="col-md-3" caption="Name"></wm-label>
                                    <wm-container class="col-md-9">
                                        <wm-text tabindex="1" placeholder="Enter Name"></wm-text>
                                    </wm-container>
                                </wm-composite>
                            </wm-gridcolumn>
                        </wm-gridrow>
                        <wm-gridrow>
                            <wm-gridcolumn>
                                <wm-composite>
                                    <wm-label class="col-md-3" caption="Type"></wm-label>
                                    <wm-container class="col-md-9">
                                        <wm-select tabindex="3" dataset="Option 1, Option 2, Option 3" datavalue="Option 3"></wm-select>
                                    </wm-container>
                                </wm-composite>
                            </wm-gridcolumn>
                        </wm-gridrow>
                        <wm-gridrow>
                            <wm-gridcolumn>
                                <wm-composite horizontalalign="left">
                                    <wm-label class="col-md-3" caption="Description"></wm-label>
                                    <wm-container class="col-md-9">
                                        <wm-textarea tabindex="4" placeholder="Enter Description"></wm-textarea>
                                    </wm-container>
                                </wm-composite>
                            </wm-gridcolumn>
                        </wm-gridrow>
                    </wm-layoutgrid>
                    <wm-buttongroup horizontalalign="right" class="form-action col-md-12">
                        <wm-button caption="Reset" type="reset" class="btn-secondary"></wm-button>
                        <wm-button caption="Cancel" type="button" class="btn-warning"></wm-button>
                        <wm-button caption="Save" type="submit" class="btn-primary"></wm-button>
                    </wm-buttongroup>
                </wm-form>
            </div>
        </file>
         <file name="script.js">
             function Ctrl($scope) {}
         </file>
    </example>
 */
