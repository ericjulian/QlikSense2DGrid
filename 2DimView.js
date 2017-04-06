/*global define, console, alert */
/*eslint no-undef: "error"*/
/*eslint-disable no-console*/

define( ["qlik","jquery", "text!./style.css", "text!./template.html"], function (qlik, $, cssContent, template ) {'use strict';
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
		paint: function ( ) {
			//setup scope.table
			console.info("paint fired");
			if ( !this.$scope.table ) {
				this.$scope.table = qlik.table( this );
			}
			return qlik.Promise.resolve();
		},
		controller: ['$scope', function ($scope) {
			console.info("controller fired");

			var app = qlik.currApp();
			var controlCubeDef = getControlCubeDef();

			/*
				Get a list of all fields and populate them to a dropdown list
			*/
			app.getList("FieldList", function(reply) {
				console.info("getList fired");
				$scope.fieldList1 = {
					model: null,
					qFieldList: reply.qFieldList
				};
				$scope.fieldList2 = {
					model: null,
					qFieldList: reply.qFieldList
				};
			});
			
			/* Get Master Measures */
			app.createGenericObject({
				qMeasureListDef : {  	
					qType: "measure", qData: { title: "/title", tags: "/tags",  "measure": "/qMeasure" } 
				}  
			}, function(reply) {
				$scope.measureList = {
					model: null,
					qMeasureList: reply.qMeasureList
				};
			});

			$scope.stratify = function(selectedField1, selectedField2, measure) {
				console.info("stratify fired");
				controlCubeDef = addControlCubeDimensions(controlCubeDef, selectedField1, selectedField2);
				controlCubeDef = addControlCubeMeasures(controlCubeDef, measure);
				app.createCube(controlCubeDef, function ( reply ) {
					console.info("create cube reply fired")
					$scope.controlCubeDef = reply;
					console.info($scope.controlCubeDef.qHyperCube)
				});
			};

			
			$scope.getFieldValues = function (field) {
				console.info("getFieldValues fired");
				app.createList({
					"qDef": {
						"qFieldDefs": [
							field
						]
					},
					"qInitialDataFetch": [{
						qTop: 0,
						qLeft: 0,
						qHeight: 1000,
						qWidth: 1000
					}]
					}, function(reply) {
						console.info("getFieldValues reply fired");
						$scope.fieldValueList = {
							model: null,
							qMatrix: reply.qListObject.qDataPages[0].qMatrix
						}
					}
		  		);
			}
		}]
	};

} );

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
	cube.qMeasures.push({
		qDef: {
			qDef: measure
		}
	});
	return cube;
}

function getControlCubeDef() {
	return {
		qDimensions: [],
		qMeasures: [],
		qInitialDataFetch: [{
			qTop: 0,
			qLeft: 0,
			qHeight: 1000,
			qWidth: 3
		}]
	};
}
