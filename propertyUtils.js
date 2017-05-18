/*global define */

/*
	Creates propties used to create custom items in the properties panel.
    1) Create field
    2) Create switch
    3) Create dropdown
    4) Create dropdown option
    5) Create item
*/
define([], function () {
    "use strict";
    return {
        createField : function (propRef, propLabel, propType, propExpression, propDefaultVal) {
            return {
                ref: propRef,
                label: propLabel,
                type: propType,
                expression: propExpression,
                defaultValue: propDefaultVal
            }
        },
        createSwitch : function (propRef, propLabel, propDefaultVal) {
            return {
                ref: propRef,
                label: propLabel,
                component: "switch",
                type: "boolean",
                options: [{
                    value: true,
                    label: "On"
                },
                {
                    value: false,
                    label: "Off"
                }],
                defaultValue: propDefaultVal
            };
        },
        createDropDown : function (propRef, propLabel, propType, propOptions, propDefaultVal) {
            return {
                ref: propRef,
                label: propLabel,
                type: propType,
                component: "dropdown",
                options: propOptions,
                defaultValue: propDefaultVal
            };
        },
        createOption : function (propLabel, propValue) {
            return {
                value: propValue,
                label: propLabel
            };
        },
        createItem : function (itemType, itemLabel) {
            return {
                type: itemType,
                label: itemLabel,
                items: {}
            };
        }
    };
});