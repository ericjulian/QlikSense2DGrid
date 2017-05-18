/*global define, console, alert, document */
/*eslint no-undef: "error"*/
/*eslint-disable no-console*/

/*
	https://analyticsensedev.stanfordmed.org/sense/app/1e062157-e1e6-44d1-9307-76d93da9de36/sheet/1373ab3f-f65e-46b6-9111-e685c11d7596/state/analysis?qlikTicket=bCog-u7Nhruj4WZE

	Enhancements
		Property to set the maximum size of the grid. 250 is default.
		Property to set whether all dimensions or only master dimensions are loaded.
		Handle nulls in filtering of heatmap
*/
define( ["qlik","jquery", "./Analytics", "./properties", "text!./style.css", "text!./template.html"], 
	function (qlik, $, analytics, propertiesPanel, cssContent, template) {'use strict';
		$("<style>").html(cssContent).appendTo("head");
		return {
			template: template,
			definition : propertiesPanel,
			controller: ['$scope', function ($scope) {
				console.info("controller fired");

				var app = qlik.currApp();
				var controlCubeDef = getControlCubeDef($scope.layout.gridHeightWidth);
				var dimensionLoadType = $scope.layout.loadOnlyMasterDimensions;
				var buckets = [];
				var heatRGB = null;
				/*
					List of colors
				*/
				$scope.heatMapColors = {
					selectedOption: null,
					colorList: getColors()
				};

				$scope.excludeNulls = false;
				/*
					Get a list of all fields and populate them to a dropdown list
				*/
				app.getList("FieldList", function(reply) {
					console.info("getList fired");
					if ($scope.fieldList1 === undefined) {
						$scope.fieldList1 = {
							model: null,
							qFieldList: reply.qFieldList
						};
						$scope.fieldList2 = {
							model: null,
							qFieldList: reply.qFieldList
						};
					}
				});
				
				/* Get Master Measures */
				app.createGenericObject({
					qMeasureListDef : {  	
						qType: "measure", qData: { title: "/title", tags: "/tags",  "measure": "/qMeasure" } 
					}  
				}, function(reply) {
					console.info("createGenericObject fired");
					$scope.measureList = {
						model: null,
						qMeasureList: reply.qMeasureList
					};
				});
				
				$scope.stratify = function(selectedField1, selectedField2, measure) {
					console.info("stratify fired");
					deleteRows();
					controlCubeDef = addControlCubeDimensions(controlCubeDef, selectedField1, selectedField2);
					controlCubeDef = addControlCubeMeasures(controlCubeDef, measure);
					app.createCube(controlCubeDef, function ( reply ) {
						console.info("create cube reply fired")
						$scope.controlCubeDef = reply;

						var arrayValues = [];
						for (var i = 0; i < $scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qData.length; i++) {
							for (var j = 0; j < $scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qData[i].length; j++) {
								if ($scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qData[i][j].qNum !== "NaN") { 
									arrayValues.push($scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qData[i][j].qNum);
								}
							}
						}

						$scope.totalVertical = $scope.controlCubeDef.qHyperCube.qSize.qcy;
						$scope.totalHorizontal = $scope.controlCubeDef.qHyperCube.qSize.qcx;
						$scope.loadedVertical = $scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qLeft.length;
						$scope.loadedHorizontal = $scope.controlCubeDef.qHyperCube.qPivotDataPages[0].qTop.length;

						var stdDev = analytics.standardDeviation(arrayValues);

						var minMax = analytics.minMax(arrayValues);
						$scope.minRange = {
							model: null,
							minVal: minMax.min,
							maxVal: minMax.max,
							setVal: minMax.min
						};
						$scope.maxRange = {
							model: null,
							minVal: minMax.min,
							maxVal: minMax.max,
							setVal: minMax.max
						};

						var opacityIncrementor = Math.round(100 / (minMax.max / stdDev));

						var r = 0;
						var g = 0;
						var b = 0;
						var a = null;

						buckets = [];
						if (stdDev > 0) {
							for (var k = stdDev; k < minMax.max+stdDev; k+=stdDev) {
								a = (opacityIncrementor * buckets.length + 1) / 100;
								buckets.push({heatVal: k, opacity: a, fontColor: setFontColor(r, g, b, a)});
							}
						}
						else {
							buckets.push({heatVal: k, opacity: a, fontColor: setFontColor(r, g, b, a)});
						}
					});
				};

				/*
					Sets the styles of the 
				*/
				$scope.setStyle = function(metricVal) {
					if ($scope.heatMapColors.selectedOption === null) {
						return { "background-color": "white", color: "#666666" };
					}

					for (var i = 0; i < buckets.length; i++) {
						if (isNaN(metricVal) === true) {
							if ($scope.excludeNulls === false) {
								return { "background-color": "white", color: "#666666" };
							}
							else {
								return { "background-color": "white", color: "#ffffff" };
							}
						}
						if (metricVal < $scope.minRange.setVal || metricVal > $scope.maxRange.setVal) {
							return { "background-color": "white", color: "white"};
						}

						if (metricVal <= buckets[i].heatVal) {
							if (i === 0) {
								return { "background-color": "rgb(" + $scope.heatMapColors.selectedOption + "," + buckets[i].opacity + ")", color: buckets[0].fontColor };
							}
							else {
								return { "background-color": "rgb(" + $scope.heatMapColors.selectedOption + "," + buckets[i].opacity + ")", color: buckets[i].fontColor };
							}
						}
					}
					return { "background-color": "white", color: "#666666" };
				};

				$scope.selectFieldValue = function(fieldName, fieldValue) {
					setFieldValue(app, fieldName, fieldValue);
				};

				$scope.filterGrid = function() {
					filterData($scope.minRange.setVal, $scope.maxRange.setVal, $scope.controlCubeDef.qHyperCube, app);
				};
			}]
		};
	}
);

function filterData(minValue, maxValue, cube, app) {
	var fieldLeft = cube.qDimensionInfo[0].qGroupFieldDefs[0];
	var fieldTop = cube.qDimensionInfo[1].qGroupFieldDefs[0];
	var data = cube.qPivotDataPages[0].qData;
	var dataTop = cube.qPivotDataPages[0].qTop;
	var dataLeft = cube.qPivotDataPages[0].qLeft;
	var dataLen = data.length;
	var dataWidth = dataTop.length;
	var selectedValuesTop = [];
	var selectedValuesLeft = [];

	for (var i = 0; i < dataLen; i++) {
		for (var j = 0; j < dataWidth; j++) {
			if ((selectedValuesLeft[i] === undefined || selectedValuesTop[j] === undefined) && (data[i][j].qNum >= minValue && data[i][j].qNum <= maxValue)) {
				selectedValuesLeft[i] = dataLeft[i].qText;
				selectedValuesTop[j] = dataTop[j].qText;
				break;
			}
		}
	}

	var leftFieldValues = selectedValuesLeft.filter(function(val) {
		return val !== undefined;
	});

	var topFieldValues = selectedValuesTop.filter(function(val) {
		return val !== undefined;
	});

	app.field(fieldLeft).selectValues(leftFieldValues, true, true);
	app.field(fieldTop).selectValues(topFieldValues, true, true);
}

function addControlCubeDimensions(cube, field1, field2) {
	cube.qDimensions = [{
		qDef: {
			qFieldDefs: [field1]
		}
	},
	{
		qDef: {
			qFieldDefs: [field2]
		}
	}];
	return cube;
}

function addControlCubeMeasures(cube, measure) {
	cube.qMeasures = [{
		qDef: {
			qDef: measure
		}
	}];
	return cube;
}

function getControlCubeDef(heightWidth) {
	var cubeMode = "P";
	var leftDimNumber = 1;

	return {
		qDimensions: [],
		qMeasures: [],
		qInitialDataFetch: [{
			qTop: 0,
			qLeft: 0,
			qHeight: heightWidth,
			qWidth: heightWidth /* This sets the width of all arrays, qLeft, qTop, qData. */
		}],
		qMode: cubeMode, /* "P" to pivot data */
		qNoOfLeftDims: leftDimNumber /* This is what gives me qTop which has the years. */
	};
}

function deleteRows() {
	var rowCount = document.getElementById("pivotDataTable").rows.length - 1;
	if (rowCount > 0) {
		for (var i = rowCount; i > 0; i--) {
			document.getElementById("pivotDataTable").deleteRow(i);
		}
	}
}

function setFontColor (r, g, b, a) {
	console.info("setFontColor fired");
	var fontColor = "";

	var o = Math.round(((parseInt(r) * 299) + (parseInt(g) * 587) + (parseInt(b) * 114)) / 1000);
	if (o > 125) {
		//black
		fontColor = "rgb(0,0,0)";
	}
	else {
		if (a > .5) {
			fontColor = "rgb(255,255,255)";
		}
		else {
			fontColor = "rgb(0,0,0)";
		}
	}
	return fontColor;
}

function setFieldValue(app, fieldName, fieldValue) {
	console.info("setFieldValue fired");

	if (!isNaN(fieldValue) && isFinite(fieldValue)) {
		app.field(fieldName).selectValues([parseFloat(fieldValue)], true, true);
	}
	else {
		app.field(fieldName).selectValues([fieldValue], true, true);
	}
}

function getColors() {
	console.info("getColors fired");
	return [{
		colorName: "aqua",
		colorCode: "rgb(0,255,255)",
		colorValue: "0,255,255"
		},
		{
		colorName: "aquamarine",
		colorCode: "rgb(127,255,212)",
		colorValue: "127,255,212"
		},
		{
		colorName: "bisque",
		colorCode: "rgb(255,228,196)",
		colorValue: "255,228,196"
		},
		{
		colorName: "black",
		colorCode: "rgb(0,0,0)",
		colorValue: "0,0,0"
		},
		{
		colorName: "blanchedalmond",
		colorCode: "rgb(255,235,205)",
		colorValue: "255,235,205"
		},
		{
		colorName: "blue",
		colorCode: "rgb(0,0,255)",
		colorValue: "0,0,255"
		},
		{
		colorName: "blueviolet",
		colorCode: "rgb(138,43,226)",
		colorValue: "138,43,226"
		},
		{
		colorName: "brown",
		colorCode: "rgb(165,42,42)",
		colorValue: "165,42,42"
		},
		{
		colorName: "burlywood",
		colorCode: "rgb(222,184,135)",
		colorValue: "222,184,135"
		},
		{
		colorName: "cadetblue",
		colorCode: "rgb(95,158,160)",
		colorValue: "95,158,160"
		},
		{
		colorName: "chartreuse",
		colorCode: "rgb(127,255,0)",
		colorValue: "127,255,0"
		},
		{
		colorName: "chocolate",
		colorCode: "rgb(210,105,30)",
		colorValue: "210,105,30"
		},
		{
		colorName: "coral",
		colorCode: "rgb(255,127,80)",
		colorValue: "255,127,80"
		},
		{
		colorName: "cornflowerblue",
		colorCode: "rgb(100,149,237)",
		colorValue: "100,149,237"
		},
		{
		colorName: "crimson",
		colorCode: "rgb(220,20,60)",
		colorValue: "220,20,60"
		},
		{
		colorName: "cyan",
		colorCode: "rgb(0,255,255)",
		colorValue: "0,255,255"
		},
		{
		colorName: "darkblue",
		colorCode: "rgb(0,0,139)",
		colorValue: "0,0,139"
		},
		{
		colorName: "darkcyan",
		colorCode: "rgb(0,139,139)",
		colorValue: "0,139,139"
		},
		{
		colorName: "darkgoldenrod",
		colorCode: "rgb(184,134,11)",
		colorValue: "184,134,11"
		},
		{
		colorName: "darkgray",
		colorCode: "rgb(169,169,169)",
		colorValue: "169,169,169"
		},
		{
		colorName: "darkgreen",
		colorCode: "rgb(0,100,0)",
		colorValue: "0,100,0"
		},
		{
		colorName: "darkkhaki",
		colorCode: "rgb(189,183,107)",
		colorValue: "189,183,107"
		},
		{
		colorName: "darkmagenta",
		colorCode: "rgb(139,0,139)",
		colorValue: "139,0,139"
		},
		{
		colorName: "darkolivegreen",
		colorCode: "rgb(85,107,47)",
		colorValue: "85,107,47"
		},
		{
		colorName: "darkorange",
		colorCode: "rgb(255,140,0)",
		colorValue: "255,140,0"
		},
		{
		colorName: "darkorchid",
		colorCode: "rgb(153,50,204)",
		colorValue: "153,50,204"
		},
		{
		colorName: "darkred",
		colorCode: "rgb(139,0,0)",
		colorValue: "139,0,0"
		},
		{
		colorName: "darksalmon",
		colorCode: "rgb(233,150,122)",
		colorValue: "233,150,122"
		},
		{
		colorName: "darkseagreen",
		colorCode: "rgb(143,188,143)",
		colorValue: "143,188,143"
		},
		{
		colorName: "darkslateblue",
		colorCode: "rgb(72,61,139)",
		colorValue: "72,61,139"
		},
		{
		colorName: "darkslategray",
		colorCode: "rgb(47,79,79)",
		colorValue: "47,79,79"
		},
		{
		colorName: "darkturquoise",
		colorCode: "rgb(0,206,209)",
		colorValue: "0,206,209"
		},
		{
		colorName: "darkviolet",
		colorCode: "rgb(148,0,211)",
		colorValue: "148,0,211"
		},
		{
		colorName: "deeppink",
		colorCode: "rgb(255,20,147)",
		colorValue: "255,20,147"
		},
		{
		colorName: "deepskyblue",
		colorCode: "rgb(0,191,255)",
		colorValue: "0,191,255"
		},
		{
		colorName: "dimgray",
		colorCode: "rgb(105,105,105)",
		colorValue: "105,105,105"
		},
		{
		colorName: "dodgerblue",
		colorCode: "rgb(30,144,255)",
		colorValue: "30,144,255"
		},
		{
		colorName: "firebrick",
		colorCode: "rgb(178,34,34)",
		colorValue: "178,34,34"
		},
		{
		colorName: "forestgreen",
		colorCode: "rgb(34,139,34)",
		colorValue: "34,139,34"
		},
		{
		colorName: "fuchsia",
		colorCode: "rgb(255,0,255)",
		colorValue: "255,0,255"
		},
		{
		colorName: "gold",
		colorCode: "rgb(255,215,0)",
		colorValue: "255,215,0"
		},
		{
		colorName: "goldenrod",
		colorCode: "rgb(218,165,32)",
		colorValue: "218,165,32"
		},
		{
		colorName: "gray",
		colorCode: "rgb(127,127,127)",
		colorValue: "127,127,127"
		},
		{
		colorName: "green",
		colorCode: "rgb(0,128,0)",
		colorValue: "0,128,0"
		},
		{
		colorName: "greenyellow",
		colorCode: "rgb(173,255,47)",
		colorValue: "173,255,47"
		},
		{
		colorName: "hotpink",
		colorCode: "rgb(255,105,180)",
		colorValue: "255,105,180"
		},
		{
		colorName: "indianred",
		colorCode: "rgb(205,92,92)",
		colorValue: "205,92,92"
		},
		{
		colorName: "indigo",
		colorCode: "rgb(75,0,130)",
		colorValue: "75,0,130"
		},
		{
		colorName: "khaki",
		colorCode: "rgb(240,230,140)",
		colorValue: "240,230,140"
		},
		{
		colorName: "lawngreen",
		colorCode: "rgb(124,252,0)",
		colorValue: "124,252,0"
		},
		{
		colorName: "lemonchiffon",
		colorCode: "rgb(255,250,205)",
		colorValue: "255,250,205"
		},
		{
		colorName: "lime",
		colorCode: "rgb(0,255,0)",
		colorValue: "0,255,0"
		},
		{
		colorName: "limegreen",
		colorCode: "rgb(50,205,50)",
		colorValue: "50,205,50"
		},
		{
		colorName: "magenta",
		colorCode: "rgb(255,0,255)",
		colorValue: "255,0,255"
		},
		{
		colorName: "maroon",
		colorCode: "rgb(128,0,0)",
		colorValue: "128,0,0"
		},
		{
		colorName: "midnightblue",
		colorCode: "rgb(25,25,112)",
		colorValue: "25,25,112"
		},
		{
		colorName: "mistyrose",
		colorCode: "rgb(255,228,225)",
		colorValue: "255,228,225"
		},
		{
		colorName: "moccasin",
		colorCode: "rgb(255,228,181)",
		colorValue: "255,228,181"
		},
		{
		colorName: "navy",
		colorCode: "rgb(0,0,128)",
		colorValue: "0,0,128"
		},
		{
		colorName: "navyblue",
		colorCode: "rgb(159,175,223)",
		colorValue: "159,175,223"
		},
		{
		colorName: "olive",
		colorCode: "rgb(128,128,0)",
		colorValue: "128,128,0"
		},
		{
		colorName: "olivedrab",
		colorCode: "rgb(107,142,35)",
		colorValue: "107,142,35"
		},
		{
		colorName: "orange",
		colorCode: "rgb(255,165,0)",
		colorValue: "255,165,0"
		},
		{
		colorName: "orangered",
		colorCode: "rgb(255,69,0)",
		colorValue: "255,69,0"
		},
		{
		colorName: "orchid",
		colorCode: "rgb(218,112,214)",
		colorValue: "218,112,214"
		},
		{
		colorName: "palegoldenrod",
		colorCode: "rgb(238,232,170)",
		colorValue: "238,232,170"
		},
		{
		colorName: "palegreen",
		colorCode: "rgb(152,251,152)",
		colorValue: "152,251,152"
		},
		{
		colorName: "paleturquoise",
		colorCode: "rgb(175,238,238)",
		colorValue: "175,238,238"
		},
		{
		colorName: "palevioletred",
		colorCode: "rgb(219,112,147)",
		colorValue: "219,112,147"
		},
		{
		colorName: "papayawhip",
		colorCode: "rgb(255,239,213)",
		colorValue: "255,239,213"
		},
		{
		colorName: "peachpuff",
		colorCode: "rgb(255,218,185)",
		colorValue: "255,218,185"
		},
		{
		colorName: "peru",
		colorCode: "rgb(205,133,63)",
		colorValue: "205,133,63"
		},
		{
		colorName: "pink",
		colorCode: "rgb(255,192,203)",
		colorValue: "255,192,203"
		},
		{
		colorName: "plum",
		colorCode: "rgb(221,160,221)",
		colorValue: "221,160,221"
		},
		{
		colorName: "powderblue",
		colorCode: "rgb(176,224,230)",
		colorValue: "176,224,230"
		},
		{
		colorName: "purple",
		colorCode: "rgb(128,0,128)",
		colorValue: "128,0,128"
		},
		{
		colorName: "red",
		colorCode: "rgb(255,0,0)",
		colorValue: "255,0,0"
		},
		{
		colorName: "rosybrown",
		colorCode: "rgb(188,143,143)",
		colorValue: "188,143,143"
		},
		{
		colorName: "royalblue",
		colorCode: "rgb(65,105,225)",
		colorValue: "65,105,225"
		},
		{
		colorName: "saddlebrown",
		colorCode: "rgb(139,69,19)",
		colorValue: "139,69,19"
		},
		{
		colorName: "salmon",
		colorCode: "rgb(250,128,114)",
		colorValue: "250,128,114"
		},
		{
		colorName: "sandybrown",
		colorCode: "rgb(244,164,96)",
		colorValue: "244,164,96"
		},
		{
		colorName: "seagreen",
		colorCode: "rgb(46,139,87)",
		colorValue: "46,139,87"
		},
		{
		colorName: "sienna",
		colorCode: "rgb(160,82,45)",
		colorValue: "160,82,45"
		},
		{
		colorName: "silver",
		colorCode: "rgb(192,192,192)",
		colorValue: "192,192,192"
		},
		{
		colorName: "skyblue",
		colorCode: "rgb(135,206,235)",
		colorValue: "135,206,235"
		},
		{
		colorName: "slateblue",
		colorCode: "rgb(106,90,205)",
		colorValue: "106,90,205"
		},
		{
		colorName: "slategray",
		colorCode: "rgb(112,128,144)",
		colorValue: "112,128,144"
		},
		{
		colorName: "springgreen",
		colorCode: "rgb(0,255,127)",
		colorValue: "0,255,127"
		},
		{
		colorName: "steelblue",
		colorCode: "rgb(70,130,180)",
		colorValue: "70,130,180"
		},
		{
		colorName: "tan",
		colorCode: "rgb(210,180,140)",
		colorValue: "210,180,140"
		},
		{
		colorName: "teal",
		colorCode: "rgb(0,128,128)",
		colorValue: "0,128,128"
		},
		{
		colorName: "thistle",
		colorCode: "rgb(216,191,216)",
		colorValue: "216,191,216"
		},
		{
		colorName: "tomato",
		colorCode: "rgb(255,99,71)",
		colorValue: "255,99,71"
		},
		{
		colorName: "turquoise",
		colorCode: "rgb(64,224,208)",
		colorValue: "64,224,208"
		},
		{
		colorName: "violet",
		colorCode: "rgb(238,130,238)",
		colorValue: "238,130,238"
		},
		{
		colorName: "wheat",
		colorCode: "rgb(245,222,179)",
		colorValue: "245,222,179"
		},
		{
		colorName: "yellow",
		colorCode: "rgb(255,255,0)",
		colorValue: "255,255,0"
		},
		{
		colorName: "yellowgreen",
		colorCode: "rgb(139,205,50)",
		colorValue: "139,205,50"
		}];
}