/*global WM,_ */
/*jslint todo: true */
/*Directive for tabbar*/
WM.module('wm.layouts.containers')
    .run(['$templateCache', function ($templateCache) {
        'use strict';
        $templateCache.put('template/layouts/containers/mobile/tabbar/tabbar.html',
            '<div data-role="mobile-tabbar" class="app-tabbar app-top-nav {{class}} {{position}}" init-widget listen-property="dataset">' +
                '<nav class="navbar navbar-default">' +
                    '<ul class="tab-items nav navbar-nav">' +
                        '<li class="tab-item" ng-repeat="item in tabItems" ng-show="(tabItems.length == layout.max) || $index+1 < layout.max" >' +
                            '<a ng-href="{{item.link}}" ng-click="onSelect({$event: $event, $scope: this, $item: item.value || item.label })">' +
                                '<i class="app-icon" ng-class="item.icon"></i><label>{{item.label}}</label>' +
                            '</a>' +
                        '</li>' +
                        '<li class="menu-items dropdown" ng-show="tabItems.length > layout.max" ng-class="{\'dropup\' : position == \'bottom\'}" uib-dropdown>' +
                            '<a uib-dropdown-toggle>' +
                                '<i class="app-icon {{morebuttoniconclass}}"></i><label>{{morebuttonlabel}}</label>' +
                            '</a>' +
                            '<ul class="dropdown-menu-right" uib-dropdown-menu ng-class="{\'nav navbar-nav\' : menutype == \'thumbnail\'}">' +
                                '<li class="menu-item" ng-repeat="item in tabItems" ng-show="$index+1 >= layout.max">' +
                                    '<a ng-href="{{item.link}}" ng-click="onSelect({$event: $event, $scope: this, $item: item.value || item.label });">' +
                                        '<i class="app-icon" ng-class="item.icon"></i><label>{{item.label}}</label>' +
                                    '</a>' +
                                '</li>' +
                            '</ul>' +
                        '</li>' +
                    '</ul>' +
                '</nav>' +
            '</div>');
    }])
    .directive('wmMobileTabbar', ['$window', '$templateCache', 'PropertiesFactory', 'WidgetUtilService', function ($window, $templateCache, PropertiesFactory, WidgetUtilService) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.tabbar', ['wm.base', 'wm.tabbar.dataProps']),
            notifyFor   = { 'dataset': true},
            layouts     = [
                {'minwidth' : 2048, 'max': 12},
                {'minwidth' : 1024, 'max': 10},
                {'minwidth' : 768,  'max': 7},
                {'minwidth' : 480,  'max': 5},
                {'minwidth' : 0,    'max': 4}
            ];

        function getSuitableLayout(avaiableWidth) {
            return _.find(layouts, function (l) {
                return avaiableWidth >= l.minwidth;
            });
        }

        function getItems(newVal) {
            return newVal.map(function (item) {
                return {
                    'label': item,
                    'icon': 'wi wi-' + item
                };
            });
        }
        function getTabItems(newVal, scope) {
            if (WM.isArray(newVal)) {
                var transformFn;
                if (WM.isObject(newVal[0])) {
                    transformFn = function (item) {
                        return {
                            'label': WidgetUtilService.getEvaluatedData(scope, item, {expressionName: 'itemlabel'}) || item.label,
                            'icon': WidgetUtilService.getEvaluatedData(scope, item, {expressionName: 'itemicon'}) || item.icon,
                            'link': WidgetUtilService.getEvaluatedData(scope, item, {expressionName: 'itemlink'}) || item.link
                        };
                    };
                    scope.tabItems = newVal.map(transformFn);
                } else {
                    scope.tabItems = getItems(newVal);
                }
            } else if (WM.isString(newVal)) {
                scope.tabItems = getItems(newVal.split(","));
            }
        }

        function propertyChangeHandler(scope, key, newVal) {
            switch (key) {
            case 'dataset':
                if (newVal) {
                    getTabItems(newVal.data || newVal, scope);
                }
                break;
            }
        }

        function onResize(scope, element) {
            scope.$root.$evalAsync(function () {
                scope.layout = getSuitableLayout(element.parent().width());
            });
        }

        function onDestroy() {
            WM.element($window).off('.tabbar');
        }

        function registerResizeHandler(scope, element) {
            WM.element($window).on('resize.tabbar', _.debounce(onResize.bind(undefined, scope, element), 20));
        }

        return {
            'scope' : {
                'onSelect': '&',
                'menutype': '&',
                'position': '&'
            },
            'restrict' : 'E',
            'replace'  : true,
            'template' : $templateCache.get('template/layouts/containers/mobile/tabbar/tabbar.html'),
            'link'     : {
                'pre' : function (scope) {
                    scope.widgetProps = widgetProps;
                    scope.position = 'bottom'; /**top | bottom**/
                    scope.menutype = 'thumbnail'; /**thumbnail | list**/
                },
                'post' : function (scope, element, attrs) {
                    var onPropertyChange = propertyChangeHandler.bind(undefined, scope);

                    registerResizeHandler(scope, element);

                    scope.layout = getSuitableLayout(element.parent().width());
                    /* register the property change handler */
                    WidgetUtilService.registerPropertyChangeListener(onPropertyChange, scope, notifyFor);
                    WidgetUtilService.postWidgetCreate(scope, element, attrs);

                    scope.$on('$destroy', onDestroy);
                    element.on('$destroy', onDestroy);
                }
            }
        };
    }]);

/**
 * @ngdoc directive
 * @name wm.layouts.containers:wmMobileTabbar
 * @restrict E
 *
 * @description
 * The `wmTabbar` directive defines wm-tabbar widget.
 *
 *
 * @scope
 *
 * @param {string=} name
 *                  Name of the widget.
 * @param {string=} dropposition
 *                  dropdown position, allowed values are 'up' or 'down'. Default value is up.
 * @param {string=} on-select
 *                  callback to be called when an item is clicked.
 * @param {string=} class
 *                 class to apply to the widget
 * @example
 *   <example module="wmCore">
 *       <file name="index.html">
 *           <div ng-controller="Ctrl" class="wm-app">
 *              <wm-mobile-tabbar dataset="home,star,music,edit"></wm-mobile-tabbar>
 *           </div>
 *       </file>
 *       <file name="script.js">
 *           function Ctrl($scope) {
 *              $scope.demo = true;
 *           }
 *       </file>
 *   </example>
 */