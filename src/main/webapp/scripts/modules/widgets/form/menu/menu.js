/*global WM */
/*Directive for menu */

WM.module('wm.widgets.form')
    .run(['$templateCache', '$rootScope', function ($templateCache, $rootScope) {
        'use strict';
        $templateCache.put('template/widget/form/menu.html',
                '<div class="dropdown app-menu" init-widget data-ng-show="show" dropdown>' +
                    '<button class="btn btn-default app-button dropdown-toggle {{menuclass}}" dropdown-toggle' +
                        $rootScope.getWidgetStyles() +
                        '><i class="{{iconclass}}"></i>' +
                        ' {{caption}} ' +
                        '<span wmtransclude></span>' +
                        '<span class="caret"></span>' +
                    '</button>' +
                    '<wm-menu-dropdown items="menuItems"/>' +
                '</div>'
            );
        $templateCache.put('template/widget/form/anchormenu.html',
                '<div class="dropdown app-menu" init-widget data-ng-show="show" dropdown>' +
                    '<a class="app-anchor dropdown-toggle {{menuclass}}" dropdown-toggle' + $rootScope.getWidgetStyles() + '><i class="{{iconclass}}"></i>' +
                        ' {{caption}} ' +
                        '<span wmtransclude></span>' +
                        '<span class="caret"></span>' +
                    '</a>' +
                    '<wm-menu-dropdown items="menuItems"/>' +
                '</div>'
            );
        $templateCache.put('template/widget/form/menu/dropdown.html',
                '<ul class="dropdown-menu pull-right">' +
                    '<wm-menu-dropdown-item data-ng-repeat="item in items" item="item"/>' +
                '</ul>'
            );
        $templateCache.put('template/widget/form/menu/dropdownItem.html',
                '<li data-ng-class="{\'disabled\': item.disabled, \'dropdown-submenu\' : item.children.length > 0}">' +
                    '<a title="{{item.label}}">' +
                        '<i class="{{item.icon}}"></i>' +
                        '{{item.label}}' +
                    '</a>' +
                '</li>'
            );
    }])
    .directive('wmMenu', ['$templateCache', 'PropertiesFactory', 'WidgetUtilService', '$timeout', function ($templateCache, PropertiesFactory, WidgetUtilService, $timeout) {
        'use strict';

        var widgetProps = PropertiesFactory.getPropertiesOf('wm.menu', ['wm.base.editors', 'wm.base.editors.dataseteditors']),
            ALLFIELDS = 'All Fields',
            notifyFor = {
                'iconname': true,
                'scopedataset': true,
                'dataset': true,
                'dropposition': true
            };

        function getMenuItems(newVal, scope) {
            var menuItems = [],
                transformFn;
            if (WM.isString(newVal)) {
                menuItems = newVal.split(',').map(function (item) {
                    var _val = item && item.trim();
                    return {
                        'label': _val,
                        'value': _val
                    };
                });
            } else if (WM.isArray(newVal)) {
                if (WM.isObject(newVal[0])) {
                    transformFn = function (item) {
                        return {
                            'label': scope.displayfield ? item[scope.displayfield] : item.label,
                            'icon': item.icon,
                            'disabled': item.disabled,
                            'value': scope.datafield ? (scope.datafield === 'All Fields' ? item : item[scope.datafield]) : item,
                            'children' : (item.children || []).map(transformFn)
                        };
                    };
                    menuItems = newVal.map(transformFn);
                } else {
                    menuItems = newVal.map(function (item) {
                        return {
                            'label': item,
                            'value': item
                        };
                    });
                }
            }

            return menuItems;
        }

        /*
         * update datafield, display field in the property panel
         */
        function updatePropertyPanelOptions(dataset, propertiesMap, scope) {
            var variableKeys = [];

            scope.widgetProps.datafield.options = [];
            scope.widgetProps.displayfield.options = [];
            scope.$root.$emit("set-markup-attr", scope.widgetid, {'datafield': '', 'displayfield': ''});

            if (WM.isString(dataset)) {
                return;
            }

            /* on binding of data*/
            if (WM.isArray(dataset)) {
                dataset = dataset[0] || dataset;
                variableKeys = WidgetUtilService.extractDataSetFields(dataset, propertiesMap) || [];
            }

            /*removing null values from the variableKeys*/
            WM.forEach(variableKeys, function (variableKey, index) {
                if (dataset[variableKey] === null || WM.isObject(dataset[variableKey])) {
                    variableKeys.splice(index, 1);
                }
            });

            /* re-initialize the property values */
            if (scope.newcolumns) {
                scope.newcolumns = false;
                scope.datafield = '';
                scope.displayfield = '';
                scope.$root.$emit("set-markup-attr", scope.widgetid, {'datafield': scope.datafield, 'displayfield': scope.displayfield});
            }

            scope.widgetProps.datafield.options = ['', ALLFIELDS].concat(variableKeys);
            scope.widgetProps.displayfield.options = [''].concat(variableKeys);
        }

        function propertyChangeHandler(scope, element, key, newVal) {
            switch (key) {
            case 'scopedataset':
            case 'dataset':
                /*if studio-mode, then update the displayField & dataField in property panel*/
                if (scope.widgetid && WM.isDefined(newVal) && newVal !== null) {
                    updatePropertyPanelOptions(newVal.data || newVal, newVal.propertiesMap, scope);
                }
                if (!scope.widgetid && newVal) {
                    scope.menuItems = getMenuItems(newVal.data || newVal, scope);
                }
                break;
            case 'dropposition':
                if (newVal === 'up') {
                    element.addClass('dropup');
                } else {
                    element.removeClass('dropup');
                }
                break;
            }
        }

        return {
            'restrict': 'E',
            'scope': {
                'scopedataset': '=?',
                'onSelect': '&'
            },
            'template': function (tElement, tAttrs) {
                var template = '';
                if (tAttrs.type && tAttrs.type === 'anchor') {
                    template = WM.element($templateCache.get('template/widget/form/anchormenu.html'));
                } else {
                    template = WM.element($templateCache.get('template/widget/form/menu.html'));
                }
                return template[0].outerHTML;
            },
            'replace': true,
            'transclude': true,
            'compile': function (tElement) {
                return {
                    'pre': function (scope, element, attrs) {
                        //@Deprecated iconname; use iconclass instead
                        if (!attrs.iconclass && attrs.iconname) {
                            WM.element(tElement.context).attr('iconclass', 'glyphicon glyphicon-' + attrs.iconname);
                            attrs.iconclass = 'glyphicon glyphicon-' + attrs.iconname;
                        }
                        scope.widgetProps = widgetProps;
                    },
                    'post': function (scope, element, attrs) {
                        var onPropertyChange = propertyChangeHandler.bind(undefined, scope, element);
                        /* register the property change handler */
                        WidgetUtilService.registerPropertyChangeListener(onPropertyChange, scope, notifyFor);
                        WidgetUtilService.postWidgetCreate(scope, element, attrs);

                        if (!scope.widgetid && attrs.hasOwnProperty('scopedataset')) {
                            $timeout(function () {
                                scope.$watch('scopedataset', function (newVal) {
                                    onPropertyChange('scopedataset', newVal);
                                });
                            }, 0, true);
                        }
                    }
                };
            }
        };
    }])
    .directive('wmMenuDropdown', ['$templateCache', function ($templateCache) {
        'use strict';
        return {
            'restrict': "E",
            'replace': true,
            'scope': {
                'items': '='
            },
            'template': $templateCache.get('template/widget/form/menu/dropdown.html'),
            'compile': function () {
                return {
                    'post': function (scope) {
                        scope.onSelect = function (args) {
                            scope.$parent.onSelect(args);
                        };
                    }
                };
            }
        };
    }])
    .directive('wmMenuDropdownItem', ['$templateCache', '$compile', 'CONSTANTS',  function ($templateCache, $compile, CONSTANTS) {
        'use strict';
        return {
            'restrict': "E",
            'replace': true,
            'scope': {
                'item': '='
            },
            'template': function () {
                var template = WM.element($templateCache.get('template/widget/form/menu/dropdownItem.html'));
                if (!CONSTANTS.isStudioMode) {
                    template.attr('data-ng-click', 'onSelect({$event: $event, $scope: this, $item: item.value || item.label })');
                }
                return template[0].outerHTML;
            },
            'link': function (scope, element) {
                if (scope.item.children && scope.item.children.length > 0) {
                    element.append('<wm-menu-dropdown items="item.children"/>');
                    element.off('click');
                    $compile(element.contents())(scope);
                }
                scope.onSelect = function (args) {
                    scope.$parent.onSelect(args);
                };
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.widgets.basic.directive:wmMenu
 * @restrict E
 *
 * @description
 * The `wmMenu` directive defines a menu widget.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $rootScope
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} caption
 *                  Content / Lebel of the Menu widget. <br>
 *                  This property is bindable.
 * @param {string=} name
 *                  Name of the menu widget.
 * @param {string=} position
 *                  This property defined the Position of the Menu dropdown - up/down <br>
 *                  Possible values are ["up" ,"down"] <br>
 *                  Default value : "down"
 * @param {string=} width
 *                  Width of the menu.
 * @param {string=} height
 *                  Height of the menu.
 * @param {string=} scopedatavalue
 *                  This property accepts the value for the Menu widget from a variable defined in the script workspace. <br>
 * @param {string=} dataset
 *                  This property accepts the options to create the Menu widget from a wavemaker studio variable (live or static) which can hold object, array or string data.
 * @param {string=} datafield
 *                  This property sets the dataValue to be returned by a menu widget when the list is populated using the dataSet property.
 * @param {string=} displayfield
 *                  This property sets the displayValue to show in the menu widget when the list is populated using the dataSet property.
 * @param {expression=} displayexpression
 *                      This is an advanced property that gives more control over what is displayed in the Menu widget. <br>
 *                      A Display Expression uses a Javascript expression to format exactly what is shown. <br>
 *                      This property is bindable.
 * @param {boolean=} show
 *                  Show is a bindable property. <br>
 *                  This property will be used to show/hide the chart widget on the web page. <br>
 *                  Default value: `true`. <br>
 * @param {string=} iconclass
 *                  CSS class of the icon.
 * @param {string=} on-select
 *                  Callback function which is executed when a Menu value is selected.
 * @example
 *   <example module="wmCore">
 *       <file name="index.html">
 *           <div data-ng-controller="Ctrl" class="wm-app">
 *              <wm-menu scopedataset="nodes" caption="Menu" iconclass="glyphicon glyphicon-align-justify"></wm-menu>
 *           </div>
 *       </file>
 *       <file name="script.js">
 *          function Ctrl($scope) {
 *              $scope.nodes = [
 *                  {
 *                      "label": "item1",
 *                      "icon": "glyphicon glyphicon-euro"
 *                  },
 *                  {
 *                      "label": "item2",
 *                      "icon": "glyphicon glyphicon-euro"
 *                  },
 *                  {
 *                      "label": "item3",
 *                      "icon": "glyphicon glyphicon-euro"
 *                  },
 *                  {
 *                      "label": "item4",
 *                      "icon": "glyphicon glyphicon-euro",
 *                      "children" : [
 *                          {
 *                              "label": "sub-menu-item1",
 *                              "icon": "glyphicon glyphicon-euro"
 *                          },
 *                          {
 *                              "label": "sub-menu-item2",
 *                              "icon": "glyphicon glyphicon-euro"
 *                          }
 *                      ]
 *                  }
 *              ];
 *          }
 *       </file>
 *   </example>
 */