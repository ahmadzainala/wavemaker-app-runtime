/*global WM, nv, d3, _ */
/*Directive for chart */

WM.module('wm.widgets.basic')
    .run(['$templateCache', function ($templateCache) {
        'use strict';
        $templateCache.put('template/widget/form/chart.html',
            '<div init-widget class="app-chart" title="{{hint}}" apply-styles>' +
                '<div class="app-chart-inner">' +
                    '<svg></svg>' +
                    '<div class="wm-content-info readonly-wrapper {{class}}" ng-if="showContentLoadError && showNoDataMsg">' +
                        '<p class="wm-message" title="{{hintMsg}}" ng-class="{\'error\': invalidConfig}">{{errMsg}}</p>' +
                    '</div>' +
                '</div>' +
            '</div>'
            );
    }])
    .directive('wmChart', function (PropertiesFactory, $templateCache, $rootScope, WidgetUtilService, CONSTANTS, QueryBuilder, Utils, $timeout, ChartService) {
        'use strict';
        var widgetProps = PropertiesFactory.getPropertiesOf('wm.chart', ['wm.base']),
           // properties of the respective chart type
            options = {
                'Bubble'         : ['bubblesize', 'shape']
            },
            //XPaths to get actual data of data points in charts
            chartDataPointXpath = {
                'Column'         : 'rect.nv-bar',
                'Bar'            : 'g.nv-bar',
                'Area'           : '.nv-stackedarea .nv-point',
                'Cumulative Line': '.nv-cumulativeLine .nv-scatterWrap path.nv-point',
                'Line'           : '.nv-lineChart .nv-scatterWrap path.nv-point',
                'Pie'            : '.nv-pieChart .nv-slice path',
                'Donut'          : '.nv-pieChart .nv-slice path',
                'Bubble'         : '.nv-scatterChart .nv-point-paths path'
            },
            //all properties of the chart
            allOptions = ['bubblesize', 'shape'],
            chartTypes = ['Column', 'Line', 'Area', 'Cumulative Line', 'Bar', 'Pie', 'Donut', 'Bubble'],
            styleProps = {
                'fontunit'      : 'font-size',
                'fontsize'      : 'font-size',
                'color'         : 'fill',
                'fontfamily'    : 'font-family',
                'fontweight'    : 'font-weight',
                'fontstyle'     : 'font-style',
                'textdecoration': 'text-decoration'
            },
            allShapes = ['circle', 'square', 'diamond', 'cross', 'triangle-up', 'triangle-down'],
            notifyFor = {
                'dataset'           : true,
                'xaxisdatakey'      : true,
                'yaxisdatakey'      : true,
                'type'              : true,
                'height'            : true,
                'width'             : true,
                'show'              : true,
                'fontsize'          : true,
                'fontunit'          : true,
                'color'             : true,
                'fontfamily'        : true,
                'fontweight'        : true,
                'fontstyle'         : true,
                'textdecoration'    : true,
                'shape'             : true,
                'selecteditem'      : true,
                'bubblesize'        : true,
                'tooltips'          : true,
                'showlegend'        : true
            };

        // get the data type for the service variable type
        function getDataType(key, data) {
            var keys = key.split('.'),
                newKey = key,
                value;
            if (data) {
                value = data[key];
                //If the element is not directly accessible then access it inside of it
                if (value === undefined && keys.length > 1) {
                    data = data[keys[0]];
                    keys.shift();
                    newKey = keys.join('.');
                    return getDataType(newKey, data);
                }
                return typeof value;
            }
            return null;
        }

        // get the column type definition for the live data-source
        function getColumnType(key, columns) {
            var keys = _.split(key, '.'),
                newKey,
                i,
                type;
            if (columns) {
                for (i = 0; i < columns.length; i += 1) {
                    //Trying to get the column type of key fields of object columns
                    if (keys.length > 0 && key.indexOf('.') > -1) {
                        if (Utils.initCaps(keys[0]) === columns[i].relatedEntityName) {
                            //initialising columns with columns of object type column
                            columns = columns[i].columns;
                            //removing already accessed keys
                            keys.shift();
                            newKey = keys.join('.');
                            return getColumnType(newKey, columns);
                        }
                    } else if (columns[i].fieldName === key) {
                        type = columns[i].type;
                    }
                }
            }
            return type || null;
        }

        // Configuring the properties panel based on the type of the chart chosen
        function togglePropertiesByChartType(scope) {
            // Initially hiding all the properties
            ChartService.hideOrShowProperties(allOptions, scope, false);
            // Showing the properties based on the type of the chart
            ChartService.hideOrShowProperties((chartTypes.indexOf(scope.type) === -1) ? options.Column : options[scope.type], scope, true);

            if (ChartService.isPieType(scope.type)) {
                // If pie chart, set the display key for x and y axis datakey and subgroups
                scope.widgetProps.xaxisdatakey.displayKey = 'LABEL_PROPERTY_LABEL';
                scope.widgetProps.yaxisdatakey.displayKey = 'LABEL_PROPERTY_VALUES';
                PropertiesFactory.getPropertyGroup('xaxis').displayKey = 'LABEL_PROPERTY_LABEL_DATA';
                PropertiesFactory.getPropertyGroup('yaxis').displayKey = 'LABEL_PROPERTY_VALUE_DATA';

                // If it is a pie chart then the yaxisdatakey must be a single select else it has to be a multiselect
                scope.widgetProps.yaxisdatakey.widget = 'list';
                // Only if bound to valid dataset populate the options
                if (scope.dataset) {
                    scope.widgetProps.yaxisdatakey.options = scope.axisoptions;
                }
            } else {
                scope.widgetProps.xaxisdatakey.displayKey = undefined;
                scope.widgetProps.yaxisdatakey.displayKey = undefined;
                PropertiesFactory.getPropertyGroup('xaxis').displayKey = undefined;
                PropertiesFactory.getPropertyGroup('yaxis').displayKey = undefined;

                scope.widgetProps.yaxisdatakey.widget = 'multi-select';
                $timeout(function () {
                    scope.widgetDataset.yaxisdatakey = scope.axisoptions || [];
                }, 5);
            }
        }

        /*
         * Displaying the formatting options based on the type of the column chosen
         * @param axis, x or y axis
         */
        function displayFormatOptions(scope, axis) {
            var type,
                key = axis + 'axisdatakey',
                numFormat = axis + 'numberformat',
                dateFormat = 'xdateformat';

            // get column type
            if (scope.dataset && scope.dataset.propertiesMap) {
                type = scope[key] ? getColumnType(scope[key].split(',')[0], scope.dataset.propertiesMap.columns) : null;
            }
            switch (type) {
            case 'integer':
            case 'float':
                ChartService.hideOrShowProperties([numFormat], scope, true);
                if (axis === 'x') {
                    ChartService.hideOrShowProperties([dateFormat], scope, false);
                }
                break;
            case 'string':
                ChartService.hideOrShowProperties([numFormat, dateFormat], scope, false);
                break;
            case 'date':
                ChartService.hideOrShowProperties([numFormat], scope, false);
                if (axis === 'x') {
                    ChartService.hideOrShowProperties([dateFormat], scope, true);
                }
                break;
            }
        }

        // Based on the chart type, sets the options for the yaxisdatakey
        function setYAxisDataKey(scope, options, dataSet) {
            if (ChartService.isPieType(scope.type)) {
                scope.widgetProps.yaxisdatakey.widget = 'list';
                scope.widgetProps.yaxisdatakey.options = options;
            } else {
                scope.widgetDataset.yaxisdatakey = dataSet || options || [];
            }
        }

        function isGroupByEnabled(groupby) {
            return (groupby && groupby !== 'none');
        }

        // Displaying options for x and y axis based on the columns chosen in aggregation column and groupby
        function modifyAxesOptions(scope) {
            var xAxisOptions = [],
                yAxisOptions = [],
                isAggregationApplied = (isGroupByEnabled(scope.groupby) && scope.aggregation && scope.aggregation !== 'none'),
                options;
            //Check if the data-set has been bound and the value is available in data-set.
            if (scope.binddataset && WM.isObject(scope.dataset)) {

                // get axis options
                options = scope.axisoptions;
                if (isAggregationApplied) {
                    if (scope.groupby) {
                        xAxisOptions = scope.groupby.split(',');
                        scope.xaxisdatakey = xAxisOptions[0];
                    } else {
                        xAxisOptions = options;
                    }
                    //If 'aggregation' is not 'none' and if the 'aggregationColumn' has not already been added into the axesOptions, then add it.
                    if (isAggregationApplied && scope.aggregationcolumn) {
                        yAxisOptions.push(scope.aggregationcolumn);
                        scope.yaxisdatakey = yAxisOptions[0];
                    } else {
                        yAxisOptions = options;
                    }
                    scope.widgetProps.xaxisdatakey.options = xAxisOptions;
                    setYAxisDataKey(scope, yAxisOptions, '');
                    setYAxisDataKey(scope, yAxisOptions, yAxisOptions);
                    //Setting the bubble size and tooltip columns to be shown
                    if (ChartService.isBubbleChart(scope.type)) {
                        scope.widgetProps.bubblesize.options = options;
                    }
                } else {
                    scope.widgetProps.xaxisdatakey.options = options;
                    setYAxisDataKey(scope, options, '');
                    if (ChartService.isBubbleChart(scope.type)) {
                        scope.widgetProps.bubblesize.options = options;
                    }
                }

                displayFormatOptions(scope, 'x');
                displayFormatOptions(scope, 'y');
            } else if (!scope.binddataset) {//Else, set all the values to default.
                scope.widgetProps.xaxisdatakey.options = [];
                setYAxisDataKey(scope, [], '');
                scope.widgetProps.aggregationcolumn.options = [];
                scope.xaxisdatakey = scope.yaxisdatakey = '';
                scope.xaxislabel = scope.yaxislabel = '';
                scope.xunits = scope.yunits = '';
                scope.bubblesize = '';
                scope.widgetProps.bubblesize.options = [];
                scope.widgetProps.aggregationcolumn.disabled = true;
                scope.widgetProps.aggregation.disabled = true;
                //Setting the values to the default
                if (scope.widgetid && scope.active) {
                    $rootScope.$emit('update-widget-property', 'aggregation', '');
                    $rootScope.$emit('update-widget-property', 'aggregationcolumn', '');
                    $rootScope.$emit('update-widget-property', 'groupby', '');
                    $rootScope.$emit('update-widget-property', 'orderby', '');
                }
            }
            scope.$root.$emit('set-markup-attr', scope.widgetid, {'xaxisdatakey': scope.xaxisdatakey, 'yaxisdatakey': scope.yaxisdatakey});
        }

        // Check if x and y axis that are chosen are valid to plot chart
        function isValidAxis(scope) {
            // Check if x axis and y axis are chosen and are not equal
            return scope.binddataset ? (scope.xaxisdatakey && scope.yaxisdatakey) : true;
        }

        // Check if aggregation is chosen
        function isAggregationEnabled(scope) {
            return ((isGroupByEnabled(scope.groupby) && scope.aggregation !== 'none' && scope.aggregationcolumn)) || isGroupByEnabled(scope.groupby) || scope.orderby;
        }

        //Gets the value by parsing upto the leaf node
        function getLeafNodeVal(key, dataObj) {
            var keys = key.split('.'),
                data = dataObj,
                i;
            for (i = 0; i < keys.length; i += 1) {
                if (data) {
                    data = data[keys[i]];
                } else { //If value becomes undefined then acceess the key directly
                    data =  dataObj[key];
                    break;
                }
            }
            return data;
        }

        /*Charts like Line,Area,Cumulative Line does not support any other datatype
        other than integer unlike the column and bar.It is a nvd3 issue. Inorder to
        support that this is a fix*/
        function getxAxisVal(scope, dataObj, xKey, index) {
            var value = getLeafNodeVal(xKey, dataObj);
            //If x axis is other than number type then add indexes
            if (ChartService.isLineTypeChart(scope.type) && !Utils.isNumberType(scope.xAxisDataType)) {
                //Verification to get the unique data keys
                scope.xDataKeyArr.push(value);
                return index;
            }
            return value;
        }

        //Getting the min and max values among all the x values
        function getXMinMaxValues(datum) {
            if (!datum) {
                return;
            }
            var xValues = {};
            /*
             compute the min x value
             eg: When data has objects
                input: [{x:1, y:2}, {x:2, y:3}, {x:3, y:4}]
                min x: 1
             eg: When data has arrays
                input: [[10, 20], [20, 30], [30, 40]];
                min x: 10
            */
            xValues.min = _.minBy(datum.values, function (dataObject) {
                return (dataObject.x || dataObject[0]);
            });
            /*
             compute the max x value
             eg: When data has objects
                input: [{x:1, y:2}, {x:2, y:3}, {x:3, y:4}]
                max x: 3
             eg: When data has arrays
                input: [[10, 20], [20, 30], [30, 40]];
                max x: 30
             */
            xValues.max = _.maxBy(datum.values, function (dataObject) {
                return (dataObject.x || dataObject[0]);
            });
            return xValues;
        }

        //Getting the min and max values among all the y values
        function getYMinMaxValues(datum) {
            var yValues = {},
                minValues = [],
                maxValues = [];
            if (!datum) {
                return;
            }

            /*
             Getting the min and max y values among all the series of data
             compute the min y value
             eg: When data has objects
                input: [[{x:1, y:2}, {x:2, y:3}, {x:3, y:4}], [{x:2, y:3}, {x:3, y:4}, {x:4, y:5}]]
                min y values : '2'(among first set) & '3'(among second set)
                max y values : '4'(among first set) & '5'(among second set)

             eg: When data has arrays
                input: [[[10, 20], [20, 30], [30, 40]], [[20, 30], [30, 40], [40, 50]]]
                min y values : '20'(among first set) & '30'(among second set)
                max y values : '40'(among first set) & '50'(among second set)
             */

            _.forEach(datum, function (data) {
                minValues.push(_.minBy(data.values, function (dataObject) { return dataObject.y || dataObject[1]; }));
                maxValues.push(_.maxBy(data.values, function (dataObject) { return dataObject.y || dataObject[1]; }));
            });
            //Gets the least and highest values among all the min and max values of respective series of data
            yValues.min = _.minBy(minValues, function (dataObject) {
                return dataObject.y || dataObject[1];
            });
            yValues.max = _.maxBy(maxValues, function (dataObject) {
                return dataObject.y || dataObject[1];
            });
            return yValues;
        }

        //Returns the single data point based on the type of the data chart accepts
        function valueFinder(scope, dataObj, xKey, yKey, index, shape) {
            var xVal = getxAxisVal(scope, dataObj, xKey, index),
                value = getLeafNodeVal(yKey, dataObj),
                yVal = parseFloat(value) || value,
                dataPoint = {},
                size = parseFloat(dataObj[scope.bubblesize]) || 2;

            if (ChartService.isChartDataJSON(scope.type)) {
                dataPoint.x = xVal;
                dataPoint.y = yVal;
                //only Bubble chart has the third dimension
                if (ChartService.isBubbleChart(scope.type)) {
                    dataPoint.size = size;
                    dataPoint.shape = shape || 'circle';
                }
            } else if (ChartService.isChartDataArray(scope.type)) {
                dataPoint = [xVal, yVal];
            }
            //Adding actual unwrapped data to chart data to use at the time of selected data point of chart event
            dataPoint._dataObj = dataObj;
            return dataPoint;
        }
        //Setting appropriate error messages
        function setErrMsg(scope, message) {
            if (scope.showNoDataMsg) {
                scope.showContentLoadError = true;
                scope.invalidConfig = true;
                $rootScope.$safeApply(scope, function () {
                    scope.errMsg = $rootScope.locale[message];
                });
            }
        }

        //Formatting the binded data compatible to chart data
        function getChartData(scope) {
            if (!isValidAxis(scope)) {
                setErrMsg(scope, 'MESSAGE_INVALID_AXIS');
                return [];
            }
            scope.sampleData = ChartService.getSampleData(scope);
            // scope variables used to keep the actual key values for x-axis
            scope.xDataKeyArr = [];
            //Plotting the chart with sample data when the chart dataset is not bound
            if (!scope.binddataset) {
                return scope.sampleData;
            }

            if (CONSTANTS.isStudioMode) {
                // When binddataset value is there and chartData is not populated yet then a Loading message will be shown
                if (scope.binddataset && !scope.chartData) {
                    return [];
                }
                if (scope.isServiceVariable) {
                    scope.showContentLoadError = true;
                    scope.errMsg = $rootScope.locale.MESSAGE_INFO_SAMPLE_DATA;
                    scope.hintMsg = $rootScope.locale.MESSAGE_ERROR_DATA_DISPLAY + scope.name;
                    return scope.sampleData;
                }
                if (!scope.chartData) {
                    return scope.sampleData;
                }
            } else {
                //When invalid axis are chosen when aggregation is enabled then plot the chart with sample data
                if ((!isValidAxis(scope) && isAggregationEnabled(scope))) {
                    return scope.sampleData;
                }
                if (!scope.chartData) {
                    return [];
                }
            }

            var datum = [],
                xAxisKey = scope.xaxisdatakey,
                yAxisKeys = scope.yaxisdatakey ? scope.yaxisdatakey.split(',') : [],
                dataSet = scope.chartData,
                yAxisKey,
                shapes = [];

            //check if the datasource is live variable then get the column definition else directly get the data type of the object passed
            if (scope.isLiveVariable) {
                scope.xAxisDataType = getColumnType(xAxisKey, scope.dataset.propertiesMap.columns);
                scope.yAxisDataType = getColumnType(yAxisKeys[0], scope.dataset.propertiesMap.columns);
            } else {
                if (scope.chartData && scope.chartData[0]) {
                    scope.xAxisDataType = getDataType(xAxisKey, scope.chartData[0]);
                    scope.yAxisDataType = getDataType(yAxisKeys[0], scope.chartData[0]);
                }
            }

            if (WM.isArray(dataSet)) {
                if (ChartService.isPieType(scope.type)) {
                    yAxisKey = yAxisKeys[0];
                    datum = _.map(dataSet, function (dataObj, index) {
                        return valueFinder(scope, dataSet[index], xAxisKey, yAxisKey);
                    });
                } else {
                    if (ChartService.isBubbleChart(scope.type)) {
                        shapes =  scope.shape === 'random' ? allShapes : scope.shape;
                    }
                    yAxisKeys.forEach(function (yAxisKey, series) {
                        datum.push({
                            values: _.map(dataSet, function (dataObj, index) {
                                return valueFinder(scope, dataSet[index], xAxisKey, yAxisKey, index, (WM.isArray(shapes) && shapes[series]) || scope.shape);
                            }),
                            key: yAxisKey
                        });
                    });
                }
            }
            return datum;
        }

        // Getting the relevant aggregation function based on the selected option
        function getAggregationFunction(option) {
            switch (option) {
            case 'average':
                return 'AVG';
            case 'count':
                return 'COUNT';
            case 'maximum':
                return 'MAX';
            case 'minimum':
                return 'MIN';
            case 'sum':
                return 'SUM';
            default:
                return '';
            }
        }

        //Constructing the grouped data based on the selection of orderby, x & y axis
        function getGroupedData(scope, queryResponse, groupingColumn) {
            var  chartData = [],
                groupData = {},
                groupValues = [],
                groupKey,
                index = 0,
                i;
            scope.xAxisDataType = getColumnType(scope.xaxisdatakey, scope.dataset.propertiesMap.columns);
            scope.yAxisDataType = getColumnType(scope.yaxisdatakey, scope.dataset.propertiesMap.columns);
            scope.xDataKeyArr = [];

            while (queryResponse.length !== 0) {
                groupKey = queryResponse[queryResponse.length - 1][groupingColumn];
                //Data should be in ascending order of 'x', since there is tooltips issue incase of line chart
                groupValues.push(valueFinder(scope, queryResponse[queryResponse.length - 1], scope.xaxisdatakey, scope.yaxisdatakey, 0));
                queryResponse.splice(queryResponse.length - 1, 1);
                for (i = queryResponse.length - 1; i >= 0; i -= 1) {
                    /*Checking if the new column groupKey is same as the chosen groupKey
                    Then pushing the data
                    Then splicing the data since it is already pushed */
                    if (groupKey === queryResponse[i][groupingColumn]) {
                        index += 1;
                        //Data should be in ascending order of 'x', since there is tooltips issue incase of line chart
                        groupValues.push(valueFinder(scope, queryResponse[i], scope.xaxisdatakey, scope.yaxisdatakey, index));
                        queryResponse.splice(i, 1);
                    }
                }

                //Pushing the data with groupKey and values
                groupData = {
                    key : groupKey,
                    values : groupValues
                };
                chartData.push(groupData);
                groupValues = [];
                index = 0;
            }
            return chartData;
        }

        //Construct orderby expression
        function getOrderbyExpression(orderby) {
            var orderbyCols = (orderby ? orderby.replace(/:/g, ' ') : '').split(','),
                trimmedCols = '';
            orderbyCols = orderbyCols.map(function (col) {
                return col.trim();
            });
            trimmedCols = orderbyCols.join();
            return trimmedCols;
        }

        //Replacing the '.' by the '_' because '.' is not supported in the alias names
        function getValidAliasName(aliasName) {
            return aliasName ? aliasName.replace(/\./g, '_') : null;
        }

        // Returns the columns that are to be fetched in the query response
        function getQueryColumns(scope) {
            var columns = [],
                groupbyColumns = scope.groupby && scope.groupby !== 'none' ? scope.groupby.split(',') : [],
                yAxisKeys = scope.yaxisdatakey ? scope.yaxisdatakey.split(',') : [],
                expr;

            // adding groupby columns
            groupbyColumns.forEach(function (columnName) {
                if (columnName !== scope.aggregationcolumn) {
                    columns.push(columnName + ' AS ' + getValidAliasName(columnName));
                }
            });

            // adding aggregation column, if enabled
            if (scope.aggregation !== 'none' &&  scope.aggregationcolumn) {
                columns.push(getAggregationFunction(scope.aggregation) + '(' + scope.aggregationcolumn + ') AS ' + getValidAliasName(scope.aggregationcolumn));
            }

            // adding x-axis column, if not pushed yet
            if (scope.aggregationcolumn !== scope.xaxisdatakey) {
                expr = scope.xaxisdatakey + ' AS ' + getValidAliasName(scope.xaxisdatakey);
                if (columns.indexOf(expr) === -1) {
                    columns.push(expr);
                }
            }

            // adding y-axis columns, if not pushed yet
            yAxisKeys.forEach(function (yAxisKey) {
                if (yAxisKey !== scope.aggregationcolumn) {
                    expr = yAxisKey + ' AS ' + getValidAliasName(yAxisKey);
                    if (columns.indexOf(expr) === -1) {
                        columns.push(expr);
                    }
                }
            });

            return columns;
        }

        /*Decides whether the data should be visually grouped or not
        Visually grouped when a different column is choosen in the group by other than x and y axis*/
        function getGroupingDetails(scope) {
            var isVisuallyGrouped = false,
                visualGroupingColumn,
                groupingExpression,
                groupbyColumns = scope.groupby && scope.groupby !== 'none' ? scope.groupby.split(',') : [],
                yAxisKeys = scope.yaxisdatakey ? scope.yaxisdatakey.split(',') : [],
                groupingColumnIndex,
                columns = [];

            if (groupbyColumns.length) {
                /*Getting the group by column which is not selected either in x or y axis*/
                groupbyColumns.every(function (column, index) {
                    if (scope.xaxisdatakey !== column && WM.element.inArray(column, yAxisKeys) === -1) {
                        isVisuallyGrouped = true;
                        visualGroupingColumn = column;
                        groupingColumnIndex = index;
                        groupbyColumns.splice(groupingColumnIndex, 1);
                        return false;
                    }
                    return true;
                });
                //Constructing the groupby expression
                if (visualGroupingColumn) {
                    columns.push(visualGroupingColumn);
                }

                if (groupbyColumns.length) {
                    columns = _.concat(columns, groupbyColumns);
                }
            }
            //If x and y axis are not included in aggregation need to be included in groupby
            if (scope.xaxisdatakey !== scope.aggregationcolumn) {
                columns.push(scope.xaxisdatakey);
            }
            _.forEach(yAxisKeys, function (key) {
                if (key !== scope.aggregationcolumn) {
                    columns.push(key);
                }
            });
            groupingExpression =  columns.join(',');
            // set isVisuallyGrouped flag in scope for later use
            scope.isVisuallyGrouped = isVisuallyGrouped;

            return {
                expression: groupingExpression,
                isVisuallyGrouped: isVisuallyGrouped,
                visualGroupingColumn: visualGroupingColumn
            };
        }

        //Function to get the aggregated data after applying the aggregation & group by or order by operations.
        function getAggregatedData(scope, element, callback) {
            var query,
                variableName,
                variable,
                columns,
                yAxisKeys = scope.yaxisdatakey ? scope.yaxisdatakey.split(',') : [],
                orderbyexpression = getOrderbyExpression(scope.orderby),
                groupingDetails = getGroupingDetails(scope),
                groupbyExpression = groupingDetails.expression,
                elScope = element.scope();

            //Returning if the data is not yet loaded
            if (!scope.chartData) {
                return;
            }

            //Set the variable name based on whether the widget is bound to a variable opr widget
            if (scope.binddataset.indexOf('bind:Variables.') !== -1) {
                variableName = scope.binddataset.replace('bind:Variables.', '');
                variableName = variableName.substr(0, variableName.indexOf('.'));
            } else {
                variableName = scope.dataset.variableName;
            }

            variable = elScope.Variables && elScope.Variables[variableName];
            if (!variable) {
                return;
            }
            columns = getQueryColumns(scope);
            query = QueryBuilder.getQuery({
                'tableName': variable.type,
                'columns': columns,
                'filterFields': scope.filterFields || variable.filterFields,
                'groupby': groupbyExpression,
                'orderby': orderbyexpression
            });

            //Execute the query.
            QueryBuilder.executeQuery({
                'databaseName': variable.liveSource,
                'query': query,
                'page': 1,
                'size': variable.maxResults || 500,
                'nativeSql': false
            }, function (response) {
                //Transform the result into a format supported by the chart.
                var chartData = [],
                    aggregationAlias = getValidAliasName(scope.aggregationcolumn),
                    visualGroupingColumnAlias = groupingDetails.visualGroupingColumn ? getValidAliasName(groupingDetails.visualGroupingColumn) : '',
                    xAxisAliasKey = getValidAliasName(scope.xaxisdatakey),
                    yAxisAliasKeys = [];

                yAxisKeys.forEach(function (yAxisKey) {
                    yAxisAliasKeys.push(getValidAliasName(yAxisKey));
                });

                WM.forEach(response.content, function (data) {
                    var obj = {};
                    // Set the response in the chartData based on 'aggregationColumn', 'xAxisDataKey' & 'yAxisDataKey'.
                    if (scope.aggregation !== 'none') {
                        obj[scope.aggregationcolumn] = data[aggregationAlias];
                    }

                    if (visualGroupingColumnAlias) {
                        obj[groupingDetails.visualGroupingColumn] = data[visualGroupingColumnAlias];
                    }

                    obj[scope.xaxisdatakey] = data[xAxisAliasKey];
                    yAxisKeys.forEach(function (yAxisKey) {
                        yAxisAliasKeys.push(getValidAliasName(yAxisKey));
                    });

                    yAxisKeys.forEach(function (yAxisKey, index) {
                        obj[yAxisKey] = data[yAxisAliasKeys[index]];
                    });

                    chartData.push(obj);
                });

                scope.chartData = groupingDetails.isVisuallyGrouped ? getGroupedData(scope, chartData, groupingDetails.visualGroupingColumn) : chartData;

                Utils.triggerFn(callback);
            }, function () {
                scope.chartData = [];
                setErrMsg(scope, 'MESSAGE_ERROR_FETCH_DATA');
                Utils.triggerFn(callback);
            });
        }

        // Applying the font related styles for the chart
        function setTextStyle(properties, id) {
            var charttext = d3.select('#wmChart' + id + ' svg').selectAll('text');
            charttext.style(properties);
        }

        function angle(d) {
            var a = (d.startAngle + d.endAngle) * 90 / Math.PI - 90;
            return a > 90 ? a - 180 : a;
        }

        //This function sets maximum width for the labels that can be displayed.This will helpful when they are overlapping
        function setLabelsMaxWidth(scope) {
            var xTicks,
                tickWidth,
                maxLength,
                xDist,
                yDist,
                totalHeight,
                maxNoLabels,
                nthElement,
                labelsAvailableWidth,
                fontsize = parseInt(scope.fontsize, 10) || 12,
                isBarchart = ChartService.isBarChart(scope.type),
                barWrapper,
                yAxisWrapper,
                svgWrapper;
            //getting the x ticks in the chart
            xTicks = WM.element('#wmChart' + scope.$id + ' svg').find('g.nv-x').find('g.tick').find('text');

            //getting the distance between the two visible ticks associated with visible text
            xTicks.each(function () {
                var xTick = WM.element(this),
                    xTransform,
                    tickDist;
                if (xTick.text() && xTick.css('opacity') === '1') {
                    xTransform = xTick.parent().attr('transform').split(',');
                    xDist = parseFloat(xTransform[0].substr(10));
                    yDist = parseFloat(xTransform[1] || '0');
                    if (!isBarchart && xDist > 0) {
                        tickDist = xDist;
                    } else if (yDist > 0) {
                        tickDist = yDist;
                    }
                    if (tickWidth) {
                        tickWidth = tickDist - tickWidth;
                        return false;
                    }
                    tickWidth = tickDist;
                    return true;
                }
            });

            //In case of bar chart getting the available space for the labels to be displayed
            if (isBarchart) {
                barWrapper = WM.element('#wmChart' + scope.$id + ' svg>g.nv-wrap>g>g.nv-barsWrap')[0];
                yAxisWrapper = WM.element('#wmChart' + scope.$id + ' svg>g.nv-wrap>g>g.nv-y')[0];
                svgWrapper = WM.element('#wmChart' + scope.$id + ' svg')[0];
                //getting the total height of the chart
                totalHeight = barWrapper ? barWrapper.getBoundingClientRect().height : 0;
                //getting the labels available space
                labelsAvailableWidth = yAxisWrapper ? svgWrapper.getBoundingClientRect().width - yAxisWrapper.getBoundingClientRect().width : svgWrapper.getBoundingClientRect().width;

                //Setting the max length for the label
                maxLength = Math.round(labelsAvailableWidth / fontsize);
                //if available space for each label is less than the font-size
                //then limiting the labels to be displayed
                if (tickWidth < fontsize) {
                    //calculate the maximum no of labels to be fitted
                    maxNoLabels = totalHeight / fontsize;
                    //showing only the nth element
                    nthElement = Math.ceil(scope.chartData.length / maxNoLabels);
                    //showing up only some labels
                    d3.select('#wmChart' + scope.$id + ' svg').select('g.nv-x').selectAll('g.tick').select('text').each(function (text, i) {
                        //hiding every non nth element
                        if (i % nthElement !== 0) {
                            d3.select(this).attr('opacity', 0);
                        }
                    });
                }
            } else {
                //Setting the max length for the label
                maxLength = Math.round(tickWidth / fontsize);
            }

            //Validating if every label exceeds the max length and if so limiting the length and adding ellipsis
            xTicks.each(function () {
                if (this.textContent.length > maxLength) {
                    this.textContent = this.textContent.substr(0, maxLength) + '...';
                }
            });
        }

        // Returns the columns of that can be choosen in the x and y axis
        function getDefaultColumns(scope) {
            var defaultColumns = [],
                type,
                stringColumn,
                columns = scope.isLiveVariable ? scope.dataset.propertiesMap.columns : [],
                i,
                temp;


            for (i = 0; i < columns.length && defaultColumns.length <= 2; i += 1) {
                type = columns[i].type;
                if (!columns[i].isRelated && (Utils.isNumberType(type))) {
                    defaultColumns.push(columns[i].fieldName);
                } else if (type === 'string' && !stringColumn) {
                    stringColumn = columns[i].fieldName;
                }
            }
            //Other than bubble chart x: string type y: number type
            //Bubble chart x: number type y: number type
            if (stringColumn && defaultColumns.length > 0 && !ChartService.isBubbleChart(scope.type)) {
                temp = defaultColumns[0];
                defaultColumns[0] = stringColumn;
                defaultColumns[1] = temp;
            }

            return defaultColumns;
        }

        //Call user defined javascript function when user links it to click event of the widget.
        function attachClickEvent(scope) {
            var dataObj;
            d3.select('#wmChart' + scope.$id + ' svg').selectAll(chartDataPointXpath[scope.type]).style('pointer-events', 'all').on('click', function (data, index) {
                switch (scope.type) {
                case 'Column':
                case 'Bar':
                    dataObj = data._dataObj;
                    break;
                case 'Pie':
                case 'Donut':
                    dataObj = data.data._dataObj;
                    break;
                case 'Area':
                case 'Cumulative Line':
                case 'Line':
                    dataObj = data[0]._dataObj;
                    break;
                case 'Bubble':
                    dataObj = data.data.point[4]._dataObj;
                    break;
                }
                $rootScope.$safeApply(scope, function () {
                    scope.selecteditem = dataObj;
                    scope.onSelect && scope.onSelect({$event: d3.event, $isolateScope: scope, selectedChartItem: data, selectedItem: scope.selecteditem});
                });
            });
        }

        /*  Returns Y Scale min value
            Ex: Input   : 8.97
                Output  : 8.87

                Input   : 8
                Output  : 7
        */

        function postPlotProcess(scope, element, chart) {
            var chartSvg,
                pieLabels,
                pieGroups,
                angleArray,
                styleObj = {};

            //If user sets to highlight the data points and increase the thickness of the line
            if (ChartService.isLineTypeChart(scope.type)) {
                ChartService.setLineThickness(scope.$id, scope.linethickness);
                ChartService.highlightPoints(scope.$id, scope.highlightpoints);
            }

            if (!ChartService.isPieType(scope.type)) {
                setLabelsMaxWidth(scope);
            } else if (!scope.showlabelsoutside) {
                /** Nvd3 has a issue in rotating text. So we will use this as a temp fix.
                 * If the issue is resolved there, we can remove this.*/
                /* If it is a donut chart, then rotate the text and position them*/
                chartSvg = d3.select('#wmChart' + scope.$id + ' svg');
                pieLabels = chartSvg.select('.nv-pieLabels').selectAll('.nv-label');
                pieGroups = chartSvg.select('.nv-pie').selectAll('.nv-slice');
                angleArray = [];
                if (pieGroups && pieGroups.length) {
                    pieGroups.each(function () {
                        d3.select(this).attr('transform', function (d) {
                            angleArray.push(angle(d));
                        });
                    });
                    pieLabels.each(function (d, i) {
                        var group = d3.select(this);
                        WM.element(group[0][0]).find('text').attr('transform', 'rotate(' + angleArray[i] + ')');
                    });
                }
            }

            // prepare text style props object and set
            WM.forEach(styleProps, function (value, key) {
                if (key === 'fontsize' || key === 'fontunit') {
                    styleObj[value] = scope.fontsize + scope.fontunit;
                } else {
                    styleObj[value] = scope[key];
                }
            });
            setTextStyle(styleObj, scope.$id);
            //Modifying the legend position only when legend is shown
            if (scope.showlegend && scope.legendposition) {
                ChartService.modifyLegendPosition(scope, scope.legendposition, scope.$id);
            }

            /*
             * allow window-resize functionality, for only-run mode as
             * updating chart is being handled by watchers of height & width in studio-mode
             * */
            if (CONSTANTS.isRunMode) {
                nv.utils.windowResize(function () {
                    if (element[0].getBoundingClientRect().height) {
                        chart.update();
                        if (!ChartService.isPieType(scope.type)) {
                            setLabelsMaxWidth(scope);
                        }
                    } else {
                        var parent = element.closest('.app-accordion-panel, .tab-pane').isolateScope();
                        if (parent) {
                            parent.initialized = false;
                        }
                    }
                });
            }
        }

        // prepares and configures the chart properties
        function configureChart(scope, element, datum) {
            //Copy the data only in case of pie chart with default data
            //Reason : when multiple pie charts are bound to same data, first chart theme will be applied to all charts
            var chartData = datum,
                xDomainValues,
                yDomainValues,
                chart,
                yformatOptions = {};
            if (ChartService.isAxisDomainValid(scope, 'x')) {
                xDomainValues = scope.binddataset ? getXMinMaxValues(datum[0]) : { 'min' : {'x': 1},  'max' : {'x' : 5}};
            }
            if (ChartService.isAxisDomainValid(scope, 'y')) {
                yDomainValues = scope.binddataset ? getYMinMaxValues(datum) : { 'min' : {'y' : 1}, 'max' : {'y' : 5}};
            }

            if (ChartService.isPieType(scope.type) && (!scope.binddataset || !scope.scopedataset)) {
                chartData = Utils.getClonedObject(scope.scopedataset || datum);
            }

            // get the chart obejct
            chart = ChartService.initChart(scope, xDomainValues, yDomainValues, null, !scope.binddataset);

            // changing the default no data message*
            d3.select('#wmChart' + scope.$id + ' svg')
                .datum(chartData)
                .call(chart);
            postPlotProcess(scope, element, chart);
            return chart;
        }

        // Plotting the chart with set of the properties set to it
        function plotChart(scope, element) {
            var datum = [];
            //call user-transformed function
            scope.chartData = (scope.onTransform && scope.onTransform({$scope: scope})) || scope.chartData;

            //Getting the order by data only in run mode. The order by applies for all the charts other than pie and donut charts
            if (scope.isVisuallyGrouped && !ChartService.isPieType(scope.type)) {
                datum = scope.chartData;
            } else {
                datum = getChartData(scope);
            }
            // checking the parent container before plotting the chart
            if (!element[0].getBoundingClientRect().height) {
                return;
            }
            //empty svg to add-new chart
            element.find('svg').empty();

            nv.addGraph(function () {
                configureChart(scope, element, datum);
            }, function () {
                /*Bubble chart has an time out delay of 300ms in their implementation due to which we
                * won't be getting required data points on attaching events
                * hence delaying it 600ms*/
                setTimeout(function () {
                    attachClickEvent(scope);
                }, 600);
            });
        }

        function plotChartProxy(scope, element) {
            $rootScope.$safeApply(scope, function () {
                scope.showContentLoadError = false;
                scope.invalidConfig = false;
            });
            //If aggregation/group by/order by properties have been set, then get the aggregated data and plot the result in the chart.
            if (scope.binddataset && scope.isLiveVariable && (scope.filterFields || isAggregationEnabled(scope))) {
                getAggregatedData(scope, element, function () {
                    plotChart(scope, element);
                });
            } else { //Else, simply plot the chart.
                //In case of live variable resetting the aggregated data to the normal dataset when the aggregation has been removed
                if (scope.dataset && scope.dataset.data && scope.isLiveVariable) {
                    scope.chartData = scope.dataset.data;
                }
                plotChart(scope, element);
            }
        }

        // sets the default x and y axis options
        function setDefaultAxisOptions(scope) {
            var defaultColumns = getDefaultColumns(scope);
            //If we get the valid default columns then assign them as the x and y axis
            //In case of service variable we may not get the valid columns because we cannot know the datatypes
            scope.xaxisdatakey = defaultColumns[0] || null;
            scope.yaxisdatakey = defaultColumns[1] || null;
            scope.$root.$emit('set-markup-attr', scope.widgetid, {'xaxisdatakey': scope.xaxisdatakey, 'yaxisdatakey': scope.yaxisdatakey});
        }

        //Function that iterates through all the columns and then fetching the numeric and non primary columns among them
        function setNumericandNonPrimaryColumns(scope) {
            var columns,
                type;
            scope.numericColumns = [];
            scope.nonPrimaryColumns = [];
            //Fetching all the columns
            if (scope.dataset && scope.dataset.propertiesMap) {
                columns = Utils.fetchPropertiesMapColumns(scope.dataset.propertiesMap);
            }

            if (columns) {
                //Iterating through all the columns and fetching the numeric and non primary key columns
                WM.forEach(Object.keys(columns), function (key) {
                    type = columns[key].type;
                    if (Utils.isNumberType(type)) {
                        scope.numericColumns.push(key);
                    }
                    //Hiding only table's primary key
                    if (columns[key].isRelatedPk === 'true' || !columns[key].isPrimaryKey) {
                        scope.nonPrimaryColumns.push(key);
                    }
                });
                scope.numericColumns = scope.numericColumns.sort();
                scope.nonPrimaryColumns = scope.nonPrimaryColumns.sort();
            }
        }

        //Sets the aggregation columns
        function setAggregationColumns(scope) {
            if (!scope.axisoptions) {
                return;
            }
            //Set the 'aggregationColumn' to show all keys in case of aggregation function is count or to numeric keys in all other cases.
            scope.widgetProps.aggregationcolumn.options = scope.aggregation === 'count' ? scope.axisoptions : scope.numericColumns;
        }

        // Define the property change handler. This function will be triggered when there is a change in the widget property
        function propertyChangeHandler(scope, element, key, newVal, oldVal) {
            var variableName,
                variableObj,
                elScope,
                styleObj = {};
            switch (key) {
            case 'dataset':
                elScope = element.scope();
                //Set the variable name based on whether the widget is bound to a variable opr widget
                if (scope.binddataset && scope.binddataset.indexOf('bind:Variables.') !== -1) {
                    variableName = scope.binddataset.replace('bind:Variables.', '');
                    variableName = variableName.substr(0, variableName.indexOf('.'));
                } else {
                    variableName = scope.dataset.variableName;
                }
                //Resetting the flag to false when the binding was removed
                if (!newVal && !scope.binddataset) {
                    scope.isVisuallyGrouped = false;
                }

                variableObj = elScope.Variables && elScope.Variables[variableName];
                //setting the flag for the live variable in the scope for the checks
                scope.isLiveVariable = variableObj && variableObj.category === 'wm.LiveVariable';
                scope.axisoptions = WidgetUtilService.extractDataSetFields(scope.dataset, scope.dataset && scope.dataset.propertiesMap, {'sort' : true});

                //If binded to a live variable feed options to the aggregation and group by
                if (scope.isLiveVariable && CONSTANTS.isStudioMode) {
                    //Updating the numeric and non primary columns when dataset is changed
                    setNumericandNonPrimaryColumns(scope);
                    setAggregationColumns(scope);
                    ChartService.setGroupByColumns(scope);
                }
                scope.isServiceVariable = variableObj && variableObj.category === 'wm.ServiceVariable';

                //liveVariables contain data in 'data' property' of the variable
                scope.chartData = scope.isLiveVariable ? newVal && (newVal.data || '') : (newVal && newVal.dataValue === '' && _.keys(newVal).length === 1) ? '' : newVal;

                //if the data returned is an object make it an array of object
                if (!WM.isArray(scope.chartData) && WM.isObject(scope.chartData)) {
                    scope.chartData = [scope.chartData];
                }

                // perform studio mode actions
                if (CONSTANTS.isStudioMode) {
                    // if dataset changed from workspace controller, set default columns
                    if (scope.newcolumns) {
                        setDefaultAxisOptions(scope);
                        scope.newcolumns = false;
                    }
                    WidgetUtilService.updatePropertyPanelOptions(scope);
                    modifyAxesOptions(scope);
                }

                if (newVal && newVal.filterFields) {
                    scope.filterFields = newVal.filterFields;
                }

                // plotchart for only valid data and only after bound variable returns data
                if (scope.chartData && !scope.variableInflight) {
                    scope._plotChartProxy();
                }
                break;
            case 'type':
                //setting group by columns based on the chart type
                if (CONSTANTS.isStudioMode) {
                    ChartService.setGroupByColumns(scope);
                }
                //Based on the change in type deciding the default margins
                if (ChartService.isPieType(scope.type)) {
                    scope.offsettop = 0;
                    scope.offsetright = 0;
                    scope.offsetbottom = 0;
                    scope.offsetleft = 0;
                } else if (oldVal === 'Pie' || oldVal === 'Donut') {
                    scope.offsettop = 25;
                    scope.offsetright = 25;
                    scope.offsetbottom = 55;
                    scope.offsetleft = 75;
                }

                // In studio mode, configure properties dependent on chart type
                if (CONSTANTS.isStudioMode) {
                    togglePropertiesByChartType(scope);
                }

                if (scope.chartReady) {
                    scope._plotChartProxy();
                }
                break;
            case 'xaxisdatakey':
            case 'yaxisdatakey':
            case 'height':
            case 'width':
            case 'show':
            case 'bubblesize':
            case 'shape':
            case 'tooltips':
            case 'showlegend':
                    //In RunMode, the plotchart method will not be called for all property change
                if (scope.chartReady) {
                    scope._plotChartProxy();
                }
                break;
            case 'fontsize':
            case 'fontunit':
            case 'color':
            case 'fontfamily':
            case 'fontweight':
            case 'fontstyle':
            case 'textdecoration':
                if (scope.chartReady) {
                    styleObj[styleProps[key]] = (key === 'fontsize' || key === 'fontunit') ? scope.fontsize + scope.fontunit : newVal;
                    setTextStyle(styleObj, scope.$id);
                }
                break;
            }
        }

        return {
            restrict: 'E',
            replace: true,
            scope: {
                'scopedataset': '=?',
                'onTransform': '&',
                'onSelect': '&'
            },
            template: $templateCache.get('template/widget/form/chart.html'),
            compile: function () {
                return {
                    pre: function (iScope) {
                        if (CONSTANTS.isStudioMode) {
                            iScope.widgetProps = Utils.getClonedObject(widgetProps);
                        } else {
                            iScope.widgetProps = widgetProps;
                        }
                    },
                    post: function (scope, element, attrs) {
                        var handlers = [],
                            boundVariableName;
                        // flag to prevent initial chart plotting on each property change
                        scope.chartReady = false;

                        scope._plotChartProxy = _.debounce(plotChartProxy.bind(undefined, scope, element), 50);

                        if (!scope.theme) {
                            //Default theme for pie/donut is Azure and for other it is Terrestrial
                            scope.theme = ChartService.isPieType(scope.type) ? 'Azure' : 'Terrestrial';
                        }

                        function onDestroy() {
                            handlers.forEach(Utils.triggerFn);
                            handlers = [];
                        }

                        //add id the the chart
                        element.attr('id', 'wmChart' + scope.$id);
                        scope.widgetDataset = {};

                        // register the property change handler
                        WidgetUtilService.registerPropertyChangeListener(propertyChangeHandler.bind(undefined, scope, element), scope, notifyFor);

                        //Executing WidgetUtilService method to initialize the widget with the essential configurations.
                        WidgetUtilService.postWidgetCreate(scope, element, attrs);

                        if (scope.widgetid) {
                            //replot the chart after made changes in preview dialog
                            handlers.push($rootScope.$on('wms:replot-chart', function (event, activeChartScope) {
                                if (activeChartScope.$id === scope.$id) {
                                    //If aggregation function is set to none then remove it from markup
                                    if (scope.aggregation === 'none') {
                                        $rootScope.$emit('update-widget-property', 'aggregation', '');
                                        $rootScope.$emit('update-widget-property', 'aggregationcolumn', '');
                                    }
                                    modifyAxesOptions(scope);
                                    scope._plotChartProxy();
                                }
                            }));
                        }

                        /* Note:  The below code has to be called only after postWidgetCreate
                         * During initial load the plot chart will be called only once. During load time, 'plotChart' should not
                         * be called on each property change*/
                        scope.chartReady = true;

                        // When there is not value binding, then plot the chart with sample data
                        if (!scope.binddataset && !attrs.scopedataset) {
                            scope._plotChartProxy();
                        }

                        // Run Mode Iniitilzation
                        if (CONSTANTS.isRunMode) {
                            scope.showNoDataMsg = false;
                            // fields defined in scope: {} MUST be watched explicitly
                            //watching scopedataset attribute to plot chart for the element.
                            if (attrs.scopedataset) {
                                handlers.push(scope.$watch('scopedataset', function (newVal) {
                                    scope.chartData = newVal || scope.chartData;
                                    scope._plotChartProxy();
                                }));
                            }
                        } else {
                            scope.showNoDataMsg = true;
                            // on canvas-resize, plot the chart again
                            handlers.push(scope.$root.$on('canvas-resize', function () {
                                scope._plotChartProxy();
                            }));
                        }

                        if (scope.binddataset && scope.binddataset.indexOf('bind:Variables.') !== -1) {
                            boundVariableName = scope.binddataset.replace('bind:Variables.', '');
                            boundVariableName = boundVariableName.split('.')[0];
                            handlers.push($rootScope.$on('toggle-variable-state', function (event, variableName, active) {
                                //based on the active state and response toggling the 'loading data...' and 'no data found' messages
                                //variable is active.so showing loading data message
                                if (boundVariableName === variableName) {
                                    scope.variableInflight = active;
                                    scope.message = active ? 'Loading Data...' : '';
                                }
                            }));
                        }

                        scope.$on('$destroy', onDestroy);
                        element.on('$destroy', onDestroy);

                        //Container widgets like tabs, accordions will trigger this method to redraw the chart.
                        scope.redraw = scope._plotChartProxy;
                    }
                };
            }
        };
    });

/**
 * @ngdoc directive
 * @name wm.widgets.basic.directive:wmChart
 * @restrict E
 *
 * @description
 * The `wmChart` directive defines a chart widget.
 *
 * @scope
 *
 * @requires PropertiesFactory
 * @requires $rootScope
 * @requires $templateCache
 * @requires WidgetUtilService
 *
 * @param {string=} name
 *                  Name of the chart widget.
 * @param {list=} type
 *                  The type of the chart.
 * @param {string=} width
 *                  Width of the chart.
 * @param {string=} height
 *                  Height of the chart.
 * @param {string=} offset
 *                  This property controls the offset of the chart.
 * @param {string=} scopedatavalue
 *                  Variable defined in controller scope.<br>
 *                  The value of this variable is used as data in plotting chart.
 * @param {string=} dataset
 *                  Sets the data for the chart.<br>
 *                  This property supports binding with variables.<br>
 *                  When bound to a variable, the data associated with the variable becomes the basis for data for plotting the chart.
 * @param {list=} groupby
 *                  Shows the options to group the data.<br>
 * @param {list=} aggregation
 *                  Shows the options to aggregate the data in the chart.<br>
 * @param {list=} aggregationcolumn
 *                  Shows the options to aggregate the data in the chart.<br>
 * @param {list=} orderby
 *                  Shows the options to order the data.<br>
 * @param {list=} xaxisdatakey
 *                  The key of the object, i.e x-axis variable, on the chart.<br>
 * @param {string=} xaxislabel
 *                  The caption of x axis on the chart.<br>
 * @param {list=} xnumberformat
 *                  Shows the options to format the number type in x axis.<br>
 * @param {number=} xdigits
 *                  The number of digits to be displayed after decimal in x axis.<br>
 * @param {list=} xdateformat
 *                  Shows the options to format the date type in x axis.<br>
 * @param {number=} xaxislabeldistance
 *                  This property controls the distance between the x axis and its label.<br>
 * @param {number=} xaxisunits
 *                  This property controls the distance between the x axis and its label.
 * @param {list=} yaxisdatakey
 *                  The key of the object, i.e y-axis variable, on the chart.<br>
 * @param {string=} yaxislabel
 *                  The caption of x axis on the chart.<br>
 * @param {list=} ynumberformat
 *                  Shows the options to format the number type in x axis.<br>
 * @param {number=} ydigits
 *                  The number of digits to be displayed after decimal in x axis.<br>
 * @param {list=} ydateformat
 *                  Shows the options to format the date type in x axis.<br>
 * @param {number=} yaxislabeldistance
 *                  This property controls the distance between the x axis and its label.<br>
 * @param {number=} yaxisunits
 *                  Specifies the units for the y axis.<br>
 * @param {boolean=} show
 *                  Show isa bindable property. <br>
 *                  This property will be used to show/hide the chart widget on the web page. <br>
 *                  Default value: `true`. <br>
 * @param {string=} nodatamessage
 *                  This message will be displayed in grid, when there is no data to display. <br>
 * @param {boolean=} tooltips
 *                  This property controls whether to show the tooltip on hover. <br>
 * @param {boolean=} showlegend
 *                  This property controls whether to show the legends. <br>
 * @param {list=} legendposition
 *                  This property controls where to show the legends. <br>
 *                  Possible values are Top, Bottom.
 *                  Default value: `Top`. <br>
 *@param {boolean=} showvalues
 *                  This property controls showing of values on the bars. <br>
 *@param {boolean=} showlabels
 *                  This property controls showing of labels. <br>
 *@param {boolean=} showcontrols
 *                  This property controls showing the default controls for charts. <br>
 *@param {boolean=} staggerlabels
 *                  This property controls whether to stagger the labels which distributes labels into multiple lines. <br>
 *@param {boolean=} reducexticks
 *                  This property controls whether to reduce the xticks or not. <br>
 *@param {list=} labeltype
 *                  This property controls the type of the label to be shown in the chart. <br>
 *                  Key is the value of the key data, value is the data value, and percent represents the percentage that the slice of data represents. <br>
 *@param {number=} barspacing
 *                  This property controls the spacing between the bars and value ranges from 0.1 to 0.9. <br>
 *@param {number=} donutratio
 *                  This property controls the radius and value ranges from 0.1 to 1. <br>
 *@param {boolean=} showlabelsoutside
 *                  This property controls the labels should be outside or inside. <br>
 * @param {number=} bubblesize
 *                  This property controls the size of the bubble.<br>
 * @param {number=} showxdistance
 *                  This property enables showing the distance from the x axis.<br>
 * @param {number=} showydistance
 *                  This property enables showing the distance from the y axis.<br>
 * @param {string=} on-transform
 *                  Callback function for `transform` event.
 *
 * @example
    <example module='wmCore'>
        <file name='index.html'>
            <div ng-controller='Ctrl' class='wm-app'>
                <wm-layoutgrid>
                    <wm-gridrow>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Column' tooltips='false' staggerlabels='true' barspacing='0.2'></wm-chart>
                        </wm-gridcolumn>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Line' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                    </wm-gridrow>
                    <wm-gridrow>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Area' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Pie' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                    </wm-gridrow>
                    <wm-gridrow>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Bar' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Cumulative Line' tooltips='false'> </wm-chart>
                        </wm-gridcolumn>
                    </wm-gridrow>
                    <wm-gridrow>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Donut' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                        <wm-gridcolumn columnwidth='6'>
                            <wm-chart type='Bubble' tooltips='false'></wm-chart>
                        </wm-gridcolumn>
                    </wm-gridrow>
                </wm-layoutgrid>
            </div>
        </file>
        <file name='script.js'>
            function Ctrl($scope) {}
        </file>
    </example>
 */
