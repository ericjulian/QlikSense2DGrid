/*global define */

/* 
	Creates a custom appearenc panel which contains
		- General chart display options
*/
define(["./propertyUtils"], function (propUtil) {
    "use strict";

	/* General chart options */
	var gridHeightWidth = propUtil.createField("gridHeightWidth", "Max Grid Height/Width", "integer", "optional", 250);
	var loadOnlyMasterDimensions = propUtil.createSwitch("loadOnlyMasterDimensions", "Load Only Master Dimensions", true);

	/* Create item panel */
	var configItems = propUtil.createItem("items", "Heat Map Configuration");
	configItems.items["gridHeightWidth"] = gridHeightWidth;
	configItems.items["loadOnlyMasterDimensions"] = loadOnlyMasterDimensions;

    // *****************************************************************************
    // Appearance Section
    // *****************************************************************************
    var appearanceSection = {
        uses: "settings",
		items: {
			GeneralChartOptions: configItems
		}
    };
	
    // *****************************************************************************
    // Main property panel definition
    // ~~
    // Only what's defined here will be returned from properties.js
    // *****************************************************************************
    return {
        type: "items",
        component: "accordion",
        items: {
			appearance: appearanceSection
        }
    };
});