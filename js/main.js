function openNav() {
    document.getElementById("mySidebar").style.width = "350px";
}
function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
}


(function () {

    //Color scheme object
    const colorObject = {
        URBAN: ['#C0C0C0', '#A9A9A9', '#808080', '#696969', '#000000'],
        WATER: ['#c8dbef', '#88a6c6', '#6283a6', '#4e6f90', '#273660'],
        FOREST: ['#8D9967', '#697A50', '#4C5E46', '#334A36', '#263E31'],
        AGRI: ['#f4e799', '#d8b358', '#ae8421', '#8d6c03', '#746719'],
        OTHERS: ['#b491c8', '#7c5295', '#663a82', '#52307c', '#3c1361']
    };

    //pseudo-global variables
    var attrArray = ["URBAN", "AGRI", "FOREST", "WATER", "OTHERS"];
    var expressed = attrArray[0]; //initial attribute

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 700,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 12.5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    var xScale = d3.scale.linear()
        .range([0, chartInnerWidth - 10])
        .domain([0, 100]);

    var barScale = d3.scale.linear()
        .range([chartInnerWidth - 10, 0])
        .domain([0, 100]);

    //begin script when window loads
    window.onload = setMap();


  //setMap
    function setMap() {

        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 700;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height)
            .call(d3.behavior.zoom().on("zoom", function () {
                map.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
            }))
            .append("g");

        //Projections
        var projection = d3.geo.mercator()
            .scale(500)
            .translate([width / 3, height / 2]);

        var path = d3.geo.path()
            .projection(projection);


        d3.queue()
            .defer(d3.csv, "data/Africa_LandUse.csv") //load attributes from csv
            .defer(d3.json, "data/AfricaCountries.topojson") //load choropleth spatial data
            .await(callback);

        function callback(error, csvData, africa) {
            console.log(error);
            console.log(csvData);
            console.log(africa);
        };

    
        function callback(error, csvData, africa) {

            //place graticule on the map
            setGraticule(map, path);

            //translate Africa TopoJSONs
            africaCountries = topojson.feature(africa, africa.objects.AfricaCountries).features

            //join csv data to GeoJSON enumeration units
            africaCountries = joinData(africaCountries, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData, expressed);

            //add enumeration units to the map
            setEnumerationUnits(africaCountries, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale, expressed);

            createDropdown(csvData);


        };
    }; //end of setMap


    function setGraticule(map, path) {
        //create graticule genlegenderator
        var graticule = d3.geo.graticule()
            .step([15, 15]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines  
        
    }; //end of setGraticule

    function joinData(africaCountries, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson countries
        for (var i = 0; i < csvData.length; i++) {
            var csvCountry = csvData[i]; //the current region
            var csvKey = csvCountry.CODE; //the CSV primary key

            //loop through geojson regions to find correct country
            for (var a = 0; a < africaCountries.length; a++) {

                var geojsonProps = africaCountries[a].properties; //the current country geojson properties
                var geojsonKey = geojsonProps.CODE; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {

                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvCountry[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };

        return africaCountries;
    };

    function setEnumerationUnits(africaCountries, map, path, colorScale) {
  
        var countries = map.selectAll(".countries")
            .data(africaCountries)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "countries " + d.properties.CODE;
            })
            .attr("d", path)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function (d) {
                highlight(d.properties);
            })
            .on("mouseout", function (d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        var desc = countries.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');

    };//end of setEnumerationUnits


    function makeColorScale(data, type) {
        // Get colorClasses based on the selected land use type
        var colorClasses = colorObject[type];

        //create color scale generator
        var colorScale = d3.scale.quantile()
            .range(colorClasses);

        colorScale.domain([0, 100]);
        //assign array of expressed values as scale domain
        return colorScale;

    };

    //function to test for data value and return color
    function choropleth(props, colorScale) {
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)) {
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };


    //function to create coordinated bar chart
    function setChart(csvData, colorScale, type) {

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight + topBottomPadding * 2)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each country
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function (a, b) {
                return b[expressed] - a[expressed]
            })
            .attr("class", function (d) {
                return "bar " + d.CODE;
            })
            .attr("height", chartInnerHeight / csvData.length - 1)
            //Bars event listeners
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);

        //Add style descriptor to each rect
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}')

            .attr("y", function (d, i) {
                return i * (chartInnerHeight / csvData.length) + leftPadding;
            })
            .attr("width", function (d, i) {
                return chartWidth - topBottomPadding - barScale(parseFloat(d[expressed]));
            })
            .attr("x", function (d, i) {
                return barScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function (d) {
                return choropleth(d, colorScale);
            });

        //create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Percentage of " + expressed + " in each country");

        //create vertical axis generator
        var xAxis = d3.svg.axis()
            .scale(xScale)
            .orient("bottom")
            .ticks(10);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + leftPadding + "," + 689 + ")")
            .call(xAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bar positions, heights, and colors
        updateChart(bars, csvData.length, colorScale, type);
    };//end of setChart()

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData) {
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Land Use Type");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function (d) { return d })
            .text(function (d) { return d });
    };
    
    //Create legend
    function legend(type) {
        var colorClasses = colorObject[type];
        var quantile = d3.scale.quantile()
            .domain([0, 1])
            .range(colorClasses);

        var svg = d3.select("svg");

        svg.selectAll('.legendQuant')
            .remove();

        var g = svg.append("g")
            .attr("class", "legendQuant")
            .attr("transform", "translate(20,600)");

        g.append("text")
            .attr("class", "caption")
            .attr("x", 0)
            .attr("y", -10)
            .text("Percentage of " + type);

        var quantileLegend = d3.legend.color()
            .labelFormat(d3.format("%"))
            .scale(quantile)
            .orient("bottom");

        svg.select(".legendQuant")
            .call(quantileLegend);
    };



    //dropdown change listener handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData, expressed);

        //Example 1.5 line 9...recolor enumeration units
        var countries = d3.selectAll(".countries")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                return choropleth(d.properties, colorScale)
            });

        //Re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function (a, b) {
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function (d, i) {
                return i * 20
            })
            .duration(500);

        updateChart(bars, csvData.length, colorScale);
    };

    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale, type) {
        //position bars
        bars.attr("y", function (d, i) {
            return chartInnerHeight - (i * (chartInnerHeight / n));
        })
            //size/resize bars
            .attr("width", function (d, i) {
                return chartInnerWidth - 10 - barScale(parseFloat(d[expressed]));
            })
            .attr("x", function (d, i) {
                return leftPadding + rightPadding;
            })
            //color/recolor bars
            .style("fill", function (d) {
                return choropleth(d, colorScale);
            })
        //Add text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text("Percentage of " + expressed + " in each country");

        legend(expressed);

    };


    //function to highlight enumeration units and bars
    function highlight(props) {

        var selected = d3.selectAll("." + props.CODE)
            .style({ 'fill-opacity': .7 });

        setLabel(props);
    };

    //function to reset the element style on mouseout
    function dehighlight(props) {
        var selected = d3.selectAll("." + props.CODE)
            .style('fill-opacity', function () {
                return getStyle(this, 'fill-opacity')
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };

        //Remove info label
        d3.select(".infolabel")
            .remove();
    };

    //function to create dynamic label
    function setLabel(props) {
        //label content


        var labelAttribute =
            "<b>" + props.NAME + "</b>" + "<p>" + "</p>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.CODE + "_label")
            .html(labelAttribute);

        var countryName = infolabel.append("div")
            .attr("class", "labelname")
            .html(expressed + ":" + " " + parseFloat(props[expressed]) + "%");

    };

    //function to move info label with mouse
    function moveLabel() {
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };


})(); //last line of main.js