/*global define, console, alert, document */
/*eslint no-undef: "error"*/
/*eslint-disable no-console*/

/*
	https://analyticsensedev.stanfordmed.org/sense/app/1e062157-e1e6-44d1-9307-76d93da9de36/sheet/1373ab3f-f65e-46b6-9111-e685c11d7596/state/analysis?qlikTicket=bCog-u7Nhruj4WZE

	Enhancements
		A majority of setFontColor only needs to be called once.  The rest is opacity dependent but should be simple fast code.
*/
define( ["qlik","jquery", "./Analytics", "text!./style.css", "text!./template.html"], 
	function (qlik, $, analytics, cssContent, template) {'use strict';
		$("<style>").html(cssContent).appendTo("head");
		return {
			template: template,
			initialProperties : {
				qHyperCubeDef : {
					qDimensions : [],
					qMeasures : [],
					qInitialDataFetch : [{
						qWidth : 3,
						qHeight : 500
					}]
				}
			},
			definition : {
				type : "items",
				component : "accordion",
				items : {
					dimensions : {
						uses : "dimensions",
						min : 1
					},
					measures : {
						uses : "measures",
						min : 0
					},
					sorting : {
						uses : "sorting"
					},
					settings : {
						uses : "settings",
						items : {
							initFetchRows : {
								ref : "qHyperCubeDef.qInitialDataFetch.0.qHeight",
								label : "Initial fetch rows",
								type : "number",
								defaultValue : 50
							}
						}
					}
				}
			},
			support : {
				snapshot: true,
				export: true,
				exportData : true
			},
			controller: ['$scope', function ($scope) {
				console.info("controller fired");

				var app = qlik.currApp();
				var controlCubeDef = getControlCubeDef(false);
				var buckets = [];
				/*
					List of colors
				*/
				$scope.heatMapColors = {
					selectedOption: null,
					colorList: getColors()
				};

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

				/*
					Set color
				*/
				$scope.selectedColors = {
					model: null,
					backgroundColor: "rgb(255,0,0)"
				};

				//$scope.setFontColor = function(rgb) {
				//	console.info("setFontColor");						
				//	rgb = rgb.replace("rgb", "");
				//	rgb = rgb.replace("(", "");
				//	rgb = rgb.replace(")", "");
				//	rgb = rgb.replace(" ", "");
				//	var rgbArray = rgb.split(",");
				//	var r = rgbArray[0];
				//	var g = rgbArray[1];
				//	var b = rgbArray[2];
//
				//	var fontColor = setFontColor (r, g, b);
				//	//$("#colorPicker").css("color", fontColor);
				//};
//
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

						var stdDev = analytics.standardDeviation(arrayValues);

						var minMax = analytics.minMax(arrayValues);
						$scope.minRange = {
							model: null,
							minVal: parseInt(minMax.min),
							maxVal: parseInt(minMax.max),
							setVal: parseInt(minMax.min)
						};
						$scope.maxRange = {
							model: null,
							minVal: parseInt(minMax.min),
							maxVal: parseInt(minMax.max),
							setVal: parseInt(minMax.max)
						};

						var opacityIncrementor = Math.round(100 / (minMax.max / stdDev));

						var rgb = $scope.selectedColors.backgroundColor.substring(0, $scope.selectedColors.backgroundColor.length - 1);
						var rgb = rgb.replace("rgb", "");
						rgb = rgb.replace("(", "");
						rgb = rgb.replace("(", "");
						rgb = rgb.replace(")", "");
						rgb = rgb.replace(" ", "");
						var rgbArray = rgb.split(",");
						var r = rgbArray[0];
						var g = rgbArray[1];
						var b = rgbArray[2];
						var a = null;

						if (stdDev > 0) {
							for (var k = stdDev; k < minMax.max; k+=stdDev) {
								a = (opacityIncrementor * buckets.length) / 100;
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
					var rgb = $scope.heatMapColors.selectedOption.substring(0, $scope.heatMapColors.selectedOption.length - 1);
					
					for (var i = 0; i < buckets.length; i++) {
						if (metricVal === "NaN") {
							return { "background-color": "white", color: "#666666"};
						}
						if (metricVal < $scope.minRange.setVal || metricVal > $scope.maxRange.setVal) {
							return { "background-color": "white", color: "#666666"};
						}

						if (metricVal <= buckets[i].heatVal) {
							if (i === 0) {
								return { "background-color": rgb + "," + buckets[0].opacity + ")", color: buckets[0].fontColor };
							}
							else {
								return { "background-color": rgb + "," + buckets[i-1].opacity + ")", color: buckets[i-1].fontColor };
							}
						}
					}
					return { "background-color": "white", color: "#666666" };
				};

				$scope.selectFieldValue = function(fieldName, fieldValue) {
					setFieldValue(app, fieldName, fieldValue);
				};
			}]
		};
	}
);

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

function getControlCubeDef(pivotData) {
	var cubeMode = "P";
	var leftDimNumber = 1;

	if (pivotData) {
		cubeMode = "P";
		leftDimNumber = 1;
	}
	return {
		qDimensions: [],
		qMeasures: [],
		qInitialDataFetch: [{
			qTop: 0,
			qLeft: 0,
			qHeight: 1000,
			qWidth: 1000 /* This sets the width of all arrays, qLeft, qTop, qData. */
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

//function filterFields() {
//
//}

function getColors() {
	console.info("getColors fired");
	return [{
		colorName: "aqua",
		colorCode: "rgb(0,255,255)"
		},
		{
		colorName: "aquamarine",
		colorCode: "rgb(127,255,212)"
		},
		{
		colorName: "bisque",
		colorCode: "rgb(255,228,196)"
		},
		{
		colorName: "black",
		colorCode: "rgb(0,0,0)"
		},
		{
		colorName: "blanchedalmond",
		colorCode: "rgb(255,235,205)"
		},
		{
		colorName: "blue",
		colorCode: "rgb(0,0,255)"
		},
		{
		colorName: "blueviolet",
		colorCode: "rgb(138,43,226)"
		},
		{
		colorName: "brown",
		colorCode: "rgb(165,42,42)"
		},
		{
		colorName: "burlywood",
		colorCode: "rgb(222,184,135)"
		},
		{
		colorName: "cadetblue",
		colorCode: "rgb(95,158,160)"
		},
		{
		colorName: "chartreuse",
		colorCode: "rgb(127,255, 0)"
		},
		{
		colorName: "chocolate",
		colorCode: "rgb(210,105, 30)"
		},
		{
		colorName: "coral",
		colorCode: "rgb(255,127, 80)"
		},
		{
		colorName: "cornflowerblue",
		colorCode: "rgb(100,149,237)"
		},
		{
		colorName: "crimson",
		colorCode: "rgb(220,20,60)"
		},
		{
		colorName: "cyan",
		colorCode: "rgb(0,255,255)"
		},
		{
		colorName: "darkblue",
		colorCode: "rgb(0,0,139)"
		},
		{
		colorName: "darkcyan",
		colorCode: "rgb(0,139,139)"
		},
		{
		colorName: "darkgoldenrod",
		colorCode: "rgb(184,134, 11)"
		},
		{
		colorName: "darkgray",
		colorCode: "rgb(169,169,169)"
		},
		{
		colorName: "darkgreen",
		colorCode: "rgb(0,100, 0)"
		},
		{
		colorName: "darkkhaki",
		colorCode: "rgb(189,183,107)"
		},
		{
		colorName: "darkmagenta",
		colorCode: "rgb(139, 0,139)"
		},
		{
		colorName: "darkolivegreen",
		colorCode: "rgb(85,107, 47)"
		},
		{
		colorName: "darkorange",
		colorCode: "rgb(255,140, 0)"
		},
		{
		colorName: "darkorchid",
		colorCode: "rgb(153, 50,204)"
		},
		{
		colorName: "darkred",
		colorCode: "rgb(139, 0, 0)"
		},
		{
		colorName: "darksalmon",
		colorCode: "rgb(233,150,122)"
		},
		{
		colorName: "darkseagreen",
		colorCode: "rgb(143,188,143)"
		},
		{
		colorName: "darkslateblue",
		colorCode: "rgb(72, 61,139)"
		},
		{
		colorName: "darkslategray",
		colorCode: "rgb(47, 79, 79)"
		},
		{
		colorName: "darkturquoise",
		colorCode: "rgb(0,206,209)"
		},
		{
		colorName: "darkviolet",
		colorCode: "rgb(148, 0,211)"
		},
		{
		colorName: "deeppink",
		colorCode: "rgb(255, 20,147)"
		},
		{
		colorName: "deepskyblue",
		colorCode: "rgb(0,191,255)"
		},
		{
		colorName: "dimgray",
		colorCode: "rgb(105,105,105)"
		},
		{
		colorName: "dodgerblue",
		colorCode: "rgb(30,144,255)"
		},
		{
		colorName: "firebrick",
		colorCode: "rgb(178, 34, 34)"
		},
		{
		colorName: "forestgreen",
		colorCode: "rgb(34,139, 34)"
		},
		{
		colorName: "fuchsia",
		colorCode: "rgb(255,0,255)"
		},
		{
		colorName: "gold",
		colorCode: "rgb(255,215, 0)"
		},
		{
		colorName: "goldenrod",
		colorCode: "rgb(218,165, 32)"
		},
		{
		colorName: "gray",
		colorCode: "rgb(127,127,127)"
		},
		{
		colorName: "green",
		colorCode: "rgb(0,128,0)"
		},
		{
		colorName: "greenyellow",
		colorCode: "rgb(173,255, 47)"
		},
		{
		colorName: "hotpink",
		colorCode: "rgb(255,105,180)"
		},
		{
		colorName: "indianred",
		colorCode: "rgb(205, 92, 92)"
		},
		{
		colorName: "indigo",
		colorCode: "rgb(75,0,130)"
		},
		{
		colorName: "khaki",
		colorCode: "rgb(240,230,140)"
		},
		{
		colorName: "lawngreen",
		colorCode: "rgb(124,252, 0)"
		},
		{
		colorName: "lemonchiffon",
		colorCode: "rgb(255,250,205)"
		},
		{
		colorName: "lime",
		colorCode: "rgb(0,255,0)"
		},
		{
		colorName: "limegreen",
		colorCode: "rgb(50,205, 50)"
		},
		{
		colorName: "magenta",
		colorCode: "rgb(255, 0,255)"
		},
		{
		colorName: "maroon",
		colorCode: "rgb(128,0,0)"
		},
		{
		colorName: "midnightblue",
		colorCode: "rgb(25, 25,112)"
		},
		{
		colorName: "mistyrose",
		colorCode: "rgb(255,228,225)"
		},
		{
		colorName: "moccasin",
		colorCode: "rgb(255,228,181)"
		},
		{
		colorName: "navy",
		colorCode: "rgb(0, 0,128)"
		},
		{
		colorName: "navyblue",
		colorCode: "rgb(159,175,223)"
		},
		{
		colorName: "olive",
		colorCode: "rgb(128,128,0)"
		},
		{
		colorName: "olivedrab",
		colorCode: "rgb(107,142, 35)"
		},
		{
		colorName: "orange",
		colorCode: "rgb(255,165, 0)"
		},
		{
		colorName: "orangered",
		colorCode: "rgb(255, 69, 0)"
		},
		{
		colorName: "orchid",
		colorCode: "rgb(218,112,214)"
		},
		{
		colorName: "palegoldenrod",
		colorCode: "rgb(238,232,170)"
		},
		{
		colorName: "palegreen",
		colorCode: "rgb(152,251,152)"
		},
		{
		colorName: "paleturquoise",
		colorCode: "rgb(175,238,238)"
		},
		{
		colorName: "palevioletred",
		colorCode: "rgb(219,112,147)"
		},
		{
		colorName: "papayawhip",
		colorCode: "rgb(255,239,213)"
		},
		{
		colorName: "peachpuff",
		colorCode: "rgb(255,218,185)"
		},
		{
		colorName: "peru",
		colorCode: "rgb(205,133, 63)"
		},
		{
		colorName: "pink",
		colorCode: "rgb(255,192,203)"
		},
		{
		colorName: "plum",
		colorCode: "rgb(221,160,221)"
		},
		{
		colorName: "powderblue",
		colorCode: "rgb(176,224,230)"
		},
		{
		colorName: "purple",
		colorCode: "rgb(128,0,128)"
		},
		{
		colorName: "red",
		colorCode: "rgb(255, 0, 0)"
		},
		{
		colorName: "rosybrown",
		colorCode: "rgb(188,143,143)"
		},
		{
		colorName: "royalblue",
		colorCode: "rgb(65,105,225)"
		},
		{
		colorName: "saddlebrown",
		colorCode: "rgb(139,69,19)"
		},
		{
		colorName: "salmon",
		colorCode: "rgb(250,128,114)"
		},
		{
		colorName: "sandybrown",
		colorCode: "rgb(244,164, 96)"
		},
		{
		colorName: "seagreen",
		colorCode: "rgb(46,139, 87)"
		},
		{
		colorName: "sienna",
		colorCode: "rgb(160, 82, 45)"
		},
		{
		colorName: "silver",
		colorCode: "rgb(192,192,192)"
		},
		{
		colorName: "skyblue",
		colorCode: "rgb(135,206,235)"
		},
		{
		colorName: "slateblue",
		colorCode: "rgb(106, 90,205)"
		},
		{
		colorName: "slategray",
		colorCode: "rgb(112,128,144)"
		},
		{
		colorName: "springgreen",
		colorCode: "rgb(0,255,127)"
		},
		{
		colorName: "steelblue",
		colorCode: "rgb(70,130,180)"
		},
		{
		colorName: "tan",
		colorCode: "rgb(210,180,140)"
		},
		{
		colorName: "teal",
		colorCode: "rgb(0,128,128)"
		},
		{
		colorName: "thistle",
		colorCode: "rgb(216,191,216)"
		},
		{
		colorName: "tomato",
		colorCode: "rgb(255, 99, 71)"
		},
		{
		colorName: "turquoise",
		colorCode: "rgb(64,224,208)"
		},
		{
		colorName: "violet",
		colorCode: "rgb(238,130,238)"
		},
		{
		colorName: "wheat",
		colorCode: "rgb(245,222,179)"
		},
		{
		colorName: "yellow",
		colorCode: "rgb(255,255, 0)"
		},
		{
		colorName: "yellowgreen",
		colorCode: "rgb(139,205,50)"
		}];
}