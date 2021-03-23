var jsonURL = "sessionStats.json"

var fontSizeMin = 10;
var fontSizeMax = 100;

var fontFamily = "Impact";

var padding = 0.15;

var rotateStops = 6;  // minimum 2, to make all same rotation, set max=min
var rotateMin = -45;
var rotateMax = 45;

var svgWidth = 1280;
var svgHeight = 720;

const urlParams = new URLSearchParams(window.location.search);

// Routines for loading the JSON stats file
var getJSON = function(url, callback) {
					var xhr = new XMLHttpRequest();
					xhr.open('GET', url, true);
					xhr.responseType = 'json';
					xhr.onload = function() {
						var status = xhr.status;
						if (status === 200) {
							callback(null, xhr.response);
						} else {
							callback(status, xhr.response);
						}
					};
					xhr.send();
				};

function loadJSON (url) {
	getJSON(jsonURL,
			function(err, data) {
				if (err !== null) {
					alert('Something went wrong: ' + err);
				} else {
					gotNewStats(data);
				}
			});
}


var rankColors = [
	{"rank": 200, "color": "rgb(100, 149, 237)"},
	{"rank": 150, "color": "rgb(240, 93, 93)"},
	{"rank": 100, "color": "rgb(204, 122, 0)"},
	{"rank": 50, "color": "rgb(171, 132, 12)"},
	{"rank": 40, "color": "rgb(0, 121, 121)"},
	{"rank": 30, "color": "rgb(54, 41, 88)"},
	{"rank": 20, "color": "rgb(81, 113, 51)"},
	{"rank": 10, "color": 'rgb(62, 87, 40)'},
	{"rank": 5, "color": 'rgb(24, 63, 99)'},
	{"rank": 0, "color": 'rgb(0,0,0)'},
];

// returns the appropriate color based on the number of sessions
function rankColor(sessions) {
	rank = rankColors.find(function (r,i,a) {
				if(sessions>=r.rank) {
					return true;
				}
				return false;
		});
	return rank.color;
}

function getColor(i,count) {
	if (urlParams.has("colorful")) {
		return d3.schemeCategory10[count % d3.schemeCategory10.length];
	} else {
		return rankColor(i.sessions);
	}
}

var tooltipDivID="tooltip";
var tooltipID="tooltip";
var tooltipRowID="tooltipRow";

function setTooltip(event) {
	var tooltip = event.target.getAttribute("tooltip");

	var t = tooltip.split(",");
// 	var tooltipHTML = t[0]+" "+t[1]+" "+t[2]+"<br>Sessions: "+t[3];
	document.getElementById(tooltipID+"1").innerHTML=t[0];
	document.getElementById(tooltipID+"2").innerHTML=t[1];
	document.getElementById(tooltipID+"3").innerHTML=t[2];
	document.getElementById(tooltipID+"4").innerHTML=t[3];
	document.getElementById(tooltipID+"5").innerHTML=t[4];
    
// 	var tooltipDiv=document.getElementById(tooltipDivID);
// 	tooltipDiv.innerHTML = tooltipHTML;
	
	document.getElementById(tooltipRowID).style.visibility = 'visible';
// 	tooltipDiv.style.visibility = 'visible';
}

function hideTooltip(event) {
// 	var tooltipDiv=document.getElementById(tooltipDivID);
// 	tooltipDiv.style.visibility = 'hidden';
	document.getElementById(tooltipRowID).style.visibility = 'hidden';
}

function wordCloud(selector) {
	// called when update completes the layout
	// this will draw the svg onto the page
	function draw(words) {
	  d3.select(selector).append("svg")
		.attr("viewBox", "0 0 "+svgWidth+" "+svgHeight)
		.append("g")
		.attr("transform", "translate(" + svgWidth / 2 + "," + svgHeight / 2 + ")")
		.selectAll("text")
		.data(words)
		.enter().append("text")
		.style("font-size", function(d) { return d.size + "px"; })
		.style("font-family", fontFamily)
		.style("fill", function(d, i) { return d.color; })
		.attr("text-anchor", "middle")
		.attr("tooltip",function(d) {return d.tooltip;})
		.on("mouseover", setTooltip)
		.on("mouseout", hideTooltip)
		.attr("transform", function(d) {
					return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
				})
		.text(function(d) { return d.text; });
	}
	
	// this is basically a public function 'update' for the wordCloud object
	// call this with an array of word objects with text, size, color, and rotate
return {
			update: function(words) {
				d3.layout.cloud()
					.size([svgWidth, svgHeight])
					.words(words)
					.padding(padding)
					.rotate(function(d) { return d.rotate; })
					.font(fontFamily)
					.fontSize(function(d) { return d.size; })
					.on("end", draw)
					.start();
			}
		}

}

var myWordCloud = wordCloud("#svgWrapperDiv");


function wordsByCallsign(stats) {
	var words = [];

	// first find the max and min values
	var minSessions = 999;
	var maxSessions = 0;
	stats.individual.forEach(function (i) {
		if (i.sessions > maxSessions) { maxSessions = i.sessions; }
		if (i.sessions < minSessions) { minSessions = i.sessions; }
	});
	
	// create word entries and compute size, color, and rotation for each VE
	stats.individual.forEach(function (i, count) {
    	var word = {
    			"text": i.callsign, 
    			"size": (i.sessions / (maxSessions-minSessions+1) * (fontSizeMax-fontSizeMin))+fontSizeMin,
    			"color": getColor(i,count),
    			"rotate": (Math.floor(Math.random() * rotateStops) * (rotateMax-rotateMin) / (rotateStops-1)) + rotateMin,
    			"tooltip": [i.veNum+"-"+i.callsign+" "+i.name,i.sessions,i.remoteSessions,i.remoteExaminees,i.remoteElementsPassed].join(),
			};
			
		// Overrides go here
    	if (i.sessions == maxSessions) {
    		word["rotate"] = 0;
    	}
    	
    	words.push(word);
	});

	return words;
}

function wordsGroupedByName(stats) {
	var words = [];

	var names = [];
	stats.individual.forEach(function (i) {
		var index = names.findIndex(function(value) {
											return value.name == i.name;
										});
		if (index == -1) {
			names.push(
						{
							"name": i.name,
							"count": 1, 
							"sessions": i.sessions,
							"remoteSessions": i.remoteSessions,
							"remoteExaminees": i.remoteExaminees,
							"remoteElementsPassed": i.remoteElementsPassed,
						}
					)
		} else {
			names[index].count += 1;
			names[index].sessions += i.sessions;
			names[index].remoteSessions += i.remoteSessions;
			names[index].remoteExaminees += i.remoteExaminees;
			names[index].remoteElementsPassed += i.remoteElementsPassed;
		}
	});

	// first find the max and min values
	var minSessions = 999;
	var maxSessions = 0;
	names.forEach(function (i) {
		if (i.sessions > maxSessions) { maxSessions = i.sessions; }
		if (i.sessions < minSessions) { minSessions = i.sessions; }
	});
	
	// create word entries and compute size, color, and rotation for each VE
	names.forEach(function (i, count) {
    	var word = {
    			"text": i.name, 
    			"size": (i.sessions / (maxSessions-minSessions+1) * (fontSizeMax-fontSizeMin))+fontSizeMin,
    			"color": getColor(i,count),
    			"rotate": (Math.floor(Math.random() * rotateStops) * (rotateMax-rotateMin) / (rotateStops-1)) + rotateMin,
    			"tooltip": "",
   				"tooltip": [i.count+" "+i.name+" VE"+(i.count!==1?"s":""),i.sessions,i.remoteSessions,i.remoteExaminees,i.remoteElementsPassed].join(),
			};
			
		// Overrides go here
    	if (i.sessions == maxSessions) {
    		word["rotate"] = 0;
    	}
    	
    	words.push(word);
	});

	return words;
}

// Called when new JSON data is here
function gotNewStats(stats) {

	var words = [];

	// seed the random number generator so we get repeatable patterns
	// pattern will change every time the stats are updated
	// for now also change the pattern at least every day
	var d = new Date();
	Math.seedrandom(JSON.stringify(stats)+d.getUTCDate());

	if (urlParams.has("name")) {
		words = wordsGroupedByName(stats);
	} else {
		words = wordsByCallsign(stats);
	}

	myWordCloud.update(words);
}

// This starts the process
loadJSON(jsonURL);

