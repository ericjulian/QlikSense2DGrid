/*global define */

define([], function () {
    "use strict";
    return {
      standardDeviation: function (values) {
        var avg = this.average(values);

        var squareDiffs = values.map(function(value){
          var diff = value - avg;
          var sqrDiff = diff * diff;
          return sqrDiff;
        });
          
        var avgSquareDiff = this.average(squareDiffs);

        var stdDev = Math.sqrt(avgSquareDiff);
        return stdDev;
      },

      average: function (data){
        var sum = data.reduce(function(sum, value){
          return sum + value;
          }, 0);

        var avg = sum / data.length;
        return avg;
      },

      minMax: function(values) {
        var minValue = 0;
        var maxValue = 0;

        for (var i = 0; i < values.length; i++) {
          if (values[i] < minValue) {
            minValue = values[i];
          }
          if (values[i] > maxValue) {
            maxValue = values[i];
          }
        }
        return {
          min: minValue,
          max: maxValue
        }
      }
    }
});